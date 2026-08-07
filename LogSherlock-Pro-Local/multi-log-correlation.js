/**
 * LogSherlock Pro - Multi-Log Correlation Engine
 * Cross-file event correlation: connects failures across nodes
 * Standalone - no external dependencies
 */

(function () {
  'use strict';

  // ─── Constants ───────────────────────────────────────────────────────
  const TIMESTAMP_PROXIMITY_MS = 30000; // 30 seconds
  const LANE_COLORS = [
    '#01a982', '#ff6b6b', '#4ecdc4', '#ffa726',
    '#ab47bc', '#42a5f5', '#ef5350', '#66bb6a'
  ];
  const CONNECT_COLOR = '#01a982';
  const BG_COLOR = '#1e1e2e';

  // ─── 8 Predefined Correlation Chains ─────────────────────────────────
  const CORRELATION_CHAINS = [
    {
      id: 'chain-fencing-vm',
      name: 'Fencing → GFS2 Withdraw → Storage Offline → VM Crash',
      patterns: ['fence_timeout', 'gfs2_withdraw', 'storage_offline', 'vm_crash'],
      keywords: [
        ['fenc', 'stonith', 'fence_timeout', 'shooting'],
        ['gfs2', 'withdraw', 'filesystem withdraw'],
        ['storage', 'offline', 'target lost', 'path down'],
        ['vm', 'crash', 'qemu', 'libvirt', 'domain.*destroy']
      ]
    },
    {
      id: 'chain-network-partition',
      name: 'Network Bond Fail → Quorum Loss → Cluster Partition',
      patterns: ['bond_fail', 'quorum_loss', 'cluster_partition'],
      keywords: [
        ['bond', 'link down', 'nic', 'carrier lost', 'network'],
        ['quorum', 'not quorate', 'votes'],
        ['partition', 'split', 'membership change', 'node left']
      ]
    },
    {
      id: 'chain-disk-readonly',
      name: 'Disk I/O Errors → LVM Partial → Filesystem Readonly',
      patterns: ['disk_io_error', 'lvm_partial', 'fs_readonly'],
      keywords: [
        ['i/o error', 'blk_update', 'sector', 'medium error', 'disk'],
        ['lvm', 'partial', 'vg', 'missing pv'],
        ['readonly', 'read-only', 'remount-ro', 'ext4_abort']
      ]
    },
    {
      id: 'chain-oom-disconnect',
      name: 'OOM Kill → Service Crash → Client Disconnections',
      patterns: ['oom_kill', 'service_crash', 'client_disconnect'],
      keywords: [
        ['oom', 'out of memory', 'killed process', 'oom-killer'],
        ['service', 'crash', 'segfault', 'core dump', 'failed'],
        ['disconnect', 'connection reset', 'broken pipe', 'timeout']
      ]
    },
    {
      id: 'chain-lockup-panic',
      name: 'CPU Soft Lockup → Kernel Panic → Node Fence',
      patterns: ['cpu_lockup', 'kernel_panic', 'node_fence'],
      keywords: [
        ['soft lockup', 'cpu stuck', 'rcu_sched', 'watchdog'],
        ['kernel panic', 'not syncing', 'oops', 'bug:'],
        ['fence', 'stonith', 'reboot', 'ipmi', 'power off']
      ]
    },
    {
      id: 'chain-multipath-storage',
      name: 'Multipath Failure → SCSI Errors → Storage Unavailable',
      patterns: ['multipath_fail', 'scsi_error', 'storage_unavail'],
      keywords: [
        ['multipath', 'mpath', 'path failed', 'dm-'],
        ['scsi', 'sense key', 'medium error', 'unit attention'],
        ['storage', 'unavailable', 'no device', 'offline']
      ]
    },
    {
      id: 'chain-dns-app',
      name: 'DNS Timeout → Service Discovery Fail → Application Errors',
      patterns: ['dns_timeout', 'discovery_fail', 'app_error'],
      keywords: [
        ['dns', 'resolve', 'nxdomain', 'timeout.*lookup', 'named'],
        ['discovery', 'consul', 'etcd', 'registry', 'endpoint'],
        ['application', 'error', '500', 'connection refused', 'unavail']
      ]
    },
    {
      id: 'chain-memleak-kill',
      name: 'Memory Leak → Swap Thrashing → OOM → Service Kill',
      patterns: ['memory_leak', 'swap_thrash', 'oom', 'service_kill'],
      keywords: [
        ['memory', 'leak', 'growing', 'rss', 'anon'],
        ['swap', 'thrash', 'pgscan', 'kswapd', 'high swap'],
        ['oom', 'out of memory', 'oom-killer', 'invoked'],
        ['kill', 'sigkill', 'systemd.*failed', 'service.*stop']
      ]
    }
  ];



  // ─── Utility: Parse timestamp from finding ───────────────────────────
  function parseTimestamp(finding) {
    if (finding.timestamp instanceof Date) return finding.timestamp.getTime();
    if (typeof finding.timestamp === 'number') return finding.timestamp;
    if (typeof finding.timestamp === 'string') {
      const d = new Date(finding.timestamp);
      if (!isNaN(d.getTime())) return d.getTime();
    }
    // Try to extract timestamp from the line text
    if (finding.line || finding.text) {
      const text = finding.line || finding.text;
      const match = text.match(/(\d{4}[-/]\d{2}[-/]\d{2}[\sT]\d{2}:\d{2}:\d{2})/);
      if (match) {
        const d = new Date(match[1].replace(/\//g, '-'));
        if (!isNaN(d.getTime())) return d.getTime();
      }
      // Syslog-style: Mon DD HH:MM:SS
      const syslog = text.match(/([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/);
      if (syslog) {
        const d = new Date(`2026 ${syslog[1]}`);
        if (!isNaN(d.getTime())) return d.getTime();
      }
    }
    return Date.now();
  }

  // ─── Utility: Match finding against chain keywords ──────────────────
  function matchChainStep(finding, keywords) {
    const text = ((finding.line || '') + ' ' + (finding.text || '') + ' ' + (finding.pattern || '') + ' ' + (finding.message || '')).toLowerCase();
    return keywords.some(kw => text.includes(kw.toLowerCase()));
  }

  // ─── Utility: Get file identifier ──────────────────────────────────
  function getFileId(finding) {
    return finding.file || finding.filename || finding.source || 'unknown';
  }

  // ─── Core: analyzeCorrelation ───────────────────────────────────────
  function analyzeCorrelation(findings) {
    if (!findings || !Array.isArray(findings) || findings.length === 0) {
      return { groups: [], chains: [], rootCause: null, impactScore: 0, summary: 'No findings to correlate.' };
    }

    // Normalize and sort by timestamp
    const normalized = findings.map((f, idx) => ({
      ...f,
      _ts: parseTimestamp(f),
      _file: getFileId(f),
      _idx: idx
    })).sort((a, b) => a._ts - b._ts);

    // Get unique files
    const uniqueFiles = [...new Set(normalized.map(f => f._file))];

    // ── Step 1: Group by timestamp proximity ──
    const timeGroups = [];
    let currentGroup = [normalized[0]];

    for (let i = 1; i < normalized.length; i++) {
      if (normalized[i]._ts - currentGroup[currentGroup.length - 1]._ts <= TIMESTAMP_PROXIMITY_MS) {
        currentGroup.push(normalized[i]);
      } else {
        if (currentGroup.length > 1 || timeGroups.length === 0) {
          timeGroups.push([...currentGroup]);
        }
        currentGroup = [normalized[i]];
      }
    }
    if (currentGroup.length > 0) {
      timeGroups.push(currentGroup);
    }

    // Filter groups that span multiple files
    const crossFileGroups = timeGroups.filter(group => {
      const files = new Set(group.map(f => f._file));
      return files.size > 1;
    });

    // ── Step 2: Detect pattern chains ──
    const detectedChains = [];

    CORRELATION_CHAINS.forEach(chain => {
      const matched = [];
      chain.keywords.forEach((stepKeywords, stepIdx) => {
        const matchingFindings = normalized.filter(f => matchChainStep(f, stepKeywords));
        if (matchingFindings.length > 0) {
          matched.push({
            step: stepIdx,
            stepName: chain.patterns[stepIdx],
            findings: matchingFindings
          });
        }
      });

      // Chain is detected if at least 2 consecutive steps match
      if (matched.length >= 2) {
        const isConsecutive = matched.some((m, i) => i > 0 && m.step === matched[i - 1].step + 1);
        if (isConsecutive) {
          const chainFindings = matched.flatMap(m => m.findings);
          const chainFiles = [...new Set(chainFindings.map(f => f._file))];
          const firstEvent = chainFindings.sort((a, b) => a._ts - b._ts)[0];
          const lastEvent = chainFindings[chainFindings.length - 1];
          const duration = lastEvent._ts - firstEvent._ts;

          detectedChains.push({
            chain: chain,
            matchedSteps: matched,
            rootCauseFile: firstEvent._file,
            affectedFiles: chainFiles,
            startTime: firstEvent._ts,
            endTime: lastEvent._ts,
            durationMs: duration,
            findings: chainFindings
          });
        }
      }
    });

    // ── Step 3: Determine root cause ──
    let rootCause = null;
    if (detectedChains.length > 0) {
      const earliest = detectedChains.sort((a, b) => a.startTime - b.startTime)[0];
      rootCause = {
        file: earliest.rootCauseFile,
        chain: earliest.chain.name,
        timestamp: earliest.startTime,
        event: earliest.matchedSteps[0].findings[0]
      };
    } else if (crossFileGroups.length > 0) {
      const firstGroup = crossFileGroups[0];
      const first = firstGroup.sort((a, b) => a._ts - b._ts)[0];
      rootCause = {
        file: first._file,
        chain: 'Timestamp proximity correlation',
        timestamp: first._ts,
        event: first
      };
    }

    // ── Step 4: Calculate impact score ──
    const affectedFileCount = uniqueFiles.length;
    const chainCount = detectedChains.length;
    const crossGroupCount = crossFileGroups.length;
    const totalSpanMs = normalized.length > 1 ? normalized[normalized.length - 1]._ts - normalized[0]._ts : 0;
    const impactScore = Math.min(100, Math.round(
      (affectedFileCount * 15) + (chainCount * 25) + (crossGroupCount * 10) + Math.min(25, totalSpanMs / 10000)
    ));

    // ── Step 5: Build summary ──
    let summary = 'No cross-file correlation detected.';
    if (rootCause) {
      const affectedCount = detectedChains.length > 0
        ? detectedChains[0].affectedFiles.length
        : crossFileGroups.length > 0 ? new Set(crossFileGroups[0].map(f => f._file)).size : 0;
      const durationSec = detectedChains.length > 0
        ? Math.round(detectedChains[0].durationMs / 1000)
        : totalSpanMs > 0 ? Math.round(totalSpanMs / 1000) : 0;
      const fileName = rootCause.file.split(/[/\\]/).pop();
      summary = `File "${fileName}" triggered a cascade affecting ${affectedCount} files over ${durationSec} seconds`;
    }

    return {
      groups: crossFileGroups,
      chains: detectedChains,
      rootCause: rootCause,
      impactScore: impactScore,
      uniqueFiles: uniqueFiles,
      totalFindings: findings.length,
      summary: summary,
      timelineData: normalized
    };
  }



  // ─── Render: renderCorrelationPanel ─────────────────────────────────
  function renderCorrelationPanel(findings) {
    const analysis = analyzeCorrelation(findings);

    if (!findings || findings.length === 0) {
      return `<div style="background:${BG_COLOR};color:#cdd6f4;padding:24px;border-radius:12px;font-family:monospace;text-align:center;">
        <p style="opacity:0.6;">No log findings to correlate. Scan multiple log files to see cross-file correlation.</p>
      </div>`;
    }

    const { groups, chains, rootCause, impactScore, uniqueFiles, summary, timelineData } = analysis;

    // Assign colors to files
    const fileColors = {};
    uniqueFiles.forEach((file, idx) => {
      fileColors[file] = LANE_COLORS[idx % LANE_COLORS.length];
    });

    // Build timeline HTML
    const timelineStart = timelineData.length > 0 ? timelineData[0]._ts : 0;
    const timelineEnd = timelineData.length > 0 ? timelineData[timelineData.length - 1]._ts : 0;
    const timelineSpan = Math.max(timelineEnd - timelineStart, 1000);

    // Build swim lanes
    let lanesHtml = '';
    uniqueFiles.forEach((file, fileIdx) => {
      const color = fileColors[file];
      const shortName = file.split(/[/\\]/).pop();
      const fileFindings = timelineData.filter(f => f._file === file);
      const isRoot = rootCause && rootCause.file === file;

      let eventsHtml = '';
      fileFindings.forEach(f => {
        const leftPct = timelineSpan > 0 ? ((f._ts - timelineStart) / timelineSpan) * 85 + 5 : 50;
        const title = (f.line || f.text || f.message || f.pattern || '').substring(0, 80).replace(/"/g, '&quot;');
        eventsHtml += `<div style="position:absolute;left:${leftPct}%;top:50%;transform:translate(-50%,-50%);width:12px;height:12px;background:${color};border-radius:50%;cursor:pointer;border:2px solid #fff;z-index:2;" title="${title}"></div>`;
      });

      const rootBadge = isRoot
        ? `<span style="background:#ff6b6b;color:#fff;padding:2px 8px;border-radius:4px;font-size:10px;margin-left:8px;font-weight:bold;">ROOT CAUSE</span>`
        : '';

      lanesHtml += `
        <div style="display:flex;align-items:center;margin-bottom:4px;">
          <div style="width:200px;flex-shrink:0;padding:8px 12px;display:flex;align-items:center;">
            <div style="width:10px;height:10px;border-radius:50%;background:${color};margin-right:8px;flex-shrink:0;"></div>
            <span style="color:${color};font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${file}">${shortName}</span>
            ${rootBadge}
          </div>
          <div style="flex:1;position:relative;height:40px;background:rgba(255,255,255,0.03);border-radius:4px;border-left:2px solid ${color};">
            ${eventsHtml}
          </div>
        </div>`;
    });

    // Build correlation arrows (SVG overlay)
    let arrowsSvg = '';
    if (chains.length > 0) {
      let arrows = '';
      chains.forEach(chain => {
        for (let i = 0; i < chain.matchedSteps.length - 1; i++) {
          const fromStep = chain.matchedSteps[i].findings[0];
          const toStep = chain.matchedSteps[i + 1].findings[0];
          const fromFileIdx = uniqueFiles.indexOf(fromStep._file);
          const toFileIdx = uniqueFiles.indexOf(toStep._file);
          const fromX = timelineSpan > 0 ? ((fromStep._ts - timelineStart) / timelineSpan) * 85 + 5 : 50;
          const toX = timelineSpan > 0 ? ((toStep._ts - timelineStart) / timelineSpan) * 85 + 5 : 50;
          const fromY = fromFileIdx * 44 + 22;
          const toY = toFileIdx * 44 + 22;

          arrows += `<line x1="${fromX}%" y1="${fromY}" x2="${toX}%" y2="${toY}" stroke="${CONNECT_COLOR}" stroke-width="2" stroke-dasharray="4,2" opacity="0.7"/>`;
          arrows += `<circle cx="${toX}%" cy="${toY}" r="4" fill="${CONNECT_COLOR}" opacity="0.8"/>`;
        }
      });
      const svgHeight = uniqueFiles.length * 44;
      arrowsSvg = `<svg style="position:absolute;top:0;left:200px;right:0;height:${svgHeight}px;pointer-events:none;z-index:1;width:calc(100% - 200px);">${arrows}</svg>`;
    }

    // Build chains detail
    let chainsHtml = '';
    if (chains.length > 0) {
      chains.forEach(ch => {
        const stepsHtml = ch.matchedSteps.map(s => {
          const f = s.findings[0];
          const fname = f._file.split(/[/\\]/).pop();
          return `<span style="background:${fileColors[f._file] || '#555'};color:#fff;padding:2px 8px;border-radius:3px;font-size:11px;">${s.stepName} (${fname})</span>`;
        }).join('<span style="color:#01a982;margin:0 4px;">→</span>');

        chainsHtml += `
          <div style="margin-bottom:12px;padding:10px;background:rgba(1,169,130,0.08);border-left:3px solid ${CONNECT_COLOR};border-radius:4px;">
            <div style="font-size:12px;color:#a6adc8;margin-bottom:6px;">${ch.chain.name}</div>
            <div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;">${stepsHtml}</div>
            <div style="font-size:11px;color:#6c7086;margin-top:6px;">Duration: ${Math.round(ch.durationMs / 1000)}s | Files affected: ${ch.affectedFiles.length}</div>
          </div>`;
      });
    } else {
      chainsHtml = '<div style="color:#6c7086;font-size:12px;padding:8px;">No predefined chain patterns detected.</div>';
    }

    // Impact score bar
    const scoreColor = impactScore > 70 ? '#ff6b6b' : impactScore > 40 ? '#ffa726' : '#01a982';
    const impactHtml = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <span style="color:#a6adc8;font-size:12px;">Cross-Node Impact:</span>
        <div style="flex:1;height:8px;background:#313244;border-radius:4px;overflow:hidden;">
          <div style="width:${impactScore}%;height:100%;background:${scoreColor};border-radius:4px;transition:width 0.3s;"></div>
        </div>
        <span style="color:${scoreColor};font-weight:bold;font-size:14px;">${impactScore}/100</span>
      </div>`;

    // Build full panel
    const panelId = 'correlation-panel-' + Date.now();
    const detailId = 'correlation-detail-' + Date.now();

    const html = `
      <div id="${panelId}" style="background:${BG_COLOR};color:#cdd6f4;padding:20px;border-radius:12px;font-family:'JetBrains Mono',monospace;border:1px solid #313244;margin:16px 0;">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:20px;">🔗</span>
            <h3 style="margin:0;font-size:16px;color:#cdd6f4;">Multi-Log Correlation</h3>
            <span style="background:#313244;padding:2px 8px;border-radius:10px;font-size:11px;color:#a6adc8;">${uniqueFiles.length} files</span>
          </div>
          <button onclick="(function(){var d=document.getElementById('${detailId}');d.style.display=d.style.display==='none'?'block':'none';})();" style="background:#313244;border:1px solid #45475a;color:#cdd6f4;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;">▼ Details</button>
        </div>

        <!-- Summary -->
        <div style="background:rgba(1,169,130,0.1);border:1px solid rgba(1,169,130,0.3);border-radius:8px;padding:12px;margin-bottom:16px;">
          <p style="margin:0;font-size:13px;color:#01a982;">📊 ${summary}</p>
        </div>

        <!-- Impact Score -->
        ${impactHtml}

        <!-- Timeline -->
        <div style="margin-bottom:16px;">
          <div style="font-size:12px;color:#a6adc8;margin-bottom:8px;">Event Timeline (swim lanes per file)</div>
          <div style="position:relative;background:#181825;border-radius:8px;padding:12px;border:1px solid #313244;overflow:hidden;">
            ${arrowsSvg}
            <div style="position:relative;z-index:2;">
              ${lanesHtml}
            </div>
            <!-- Time axis -->
            <div style="display:flex;justify-content:space-between;padding:4px 12px 0;margin-left:200px;">
              <span style="font-size:10px;color:#6c7086;">${timelineData.length > 0 ? new Date(timelineStart).toLocaleTimeString() : ''}</span>
              <span style="font-size:10px;color:#6c7086;">${timelineData.length > 0 ? new Date(timelineEnd).toLocaleTimeString() : ''}</span>
            </div>
          </div>
        </div>

        <!-- Collapsible Details -->
        <div id="${detailId}" style="display:none;">
          <div style="border-top:1px solid #313244;padding-top:16px;">
            <h4 style="margin:0 0 12px;font-size:14px;color:#cdd6f4;">Detected Correlation Chains</h4>
            ${chainsHtml}

            <h4 style="margin:16px 0 12px;font-size:14px;color:#cdd6f4;">Time-Proximity Groups (cross-file)</h4>
            ${groups.length > 0 ? groups.map((group, gi) => {
              const files = [...new Set(group.map(f => f._file))];
              const span = group.length > 1 ? Math.round((group[group.length-1]._ts - group[0]._ts) / 1000) : 0;
              return `<div style="margin-bottom:8px;padding:8px;background:#181825;border-radius:4px;border:1px solid #313244;">
                <span style="font-size:11px;color:#a6adc8;">Group ${gi+1}:</span>
                <span style="font-size:11px;color:#cdd6f4;margin-left:6px;">${group.length} events across ${files.length} files (${span}s span)</span>
              </div>`;
            }).join('') : '<div style="color:#6c7086;font-size:12px;padding:8px;">No cross-file time-proximity groups found.</div>'}
          </div>
        </div>
      </div>`;

    return html;
  }



  // ─── Self-initialize on DOMContentLoaded ────────────────────────────
  function init() {
    // Register globally
    if (typeof window !== 'undefined') {
      window.LogSherlockCorrelation = {
        analyzeCorrelation: analyzeCorrelation,
        renderCorrelationPanel: renderCorrelationPanel,
        CORRELATION_CHAINS: CORRELATION_CHAINS
      };
    }

    // Auto-render if container exists
    if (typeof document !== 'undefined') {
      const container = document.getElementById('correlation-panel');
      if (container) {
        // Look for findings in global scope
        const findings = (typeof window !== 'undefined' && (window.__logFindings || window.logFindings)) || [];
        if (findings.length > 0) {
          container.innerHTML = renderCorrelationPanel(findings);
        } else {
          container.innerHTML = renderCorrelationPanel([]);
        }
      }
    }

    console.log('[LogSherlock] Multi-Log Correlation engine loaded. Use window.LogSherlockCorrelation.renderCorrelationPanel(findings) or analyzeCorrelation(findings).');
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  } else if (typeof window !== 'undefined') {
    window.addEventListener('load', init);
  }

  // ─── Module Exports (for Node.js / bundler compatibility) ───────────
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      renderCorrelationPanel: renderCorrelationPanel,
      analyzeCorrelation: analyzeCorrelation,
      CORRELATION_CHAINS: CORRELATION_CHAINS
    };
  }

})();
