/**
 * LogSherlock Pro — Team Dashboard (Local Analytics)
 * All metrics derived from real localStorage scan history.
 * No simulated data. No fake team members. No hardcoded stats.
 */
(function() {
  if (typeof window === 'undefined') return;

  const ACCENT = '#01a982';
  const BG_DARK = '#1a1a2e';
  const BG_CARD = '#16213e';
  const BG_OVERLAY = 'rgba(0,0,0,0.85)';
  const TEXT_PRIMARY = '#e0e0e0';
  const TEXT_SECONDARY = '#a0a0a0';
  const BORDER_COLOR = '#2a2a4a';

  let _currentFilter = '7d';

  // --- Data Access Helpers ---

  function getHistory() {
    try {
      const raw = localStorage.getItem('ls_history');
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function getLatestFindings() {
    try {
      const raw = localStorage.getItem('ls_scan_findings_latest');
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function getShiftSessions() {
    try {
      const raw = localStorage.getItem('logsherlock_shift_sessions');
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function getKnowledgeBase() {
    try {
      const raw = localStorage.getItem('logsherlock_kb');
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  // --- Analytics Computation ---

  function computeUsageAnalytics(history) {
    if (!history.length) return null;
    const totalScans = history.length;
    const totalFindings = history.reduce((sum, h) => sum + (h.findings_count || 0), 0);
    const totalFiles = history.reduce((sum, h) => sum + (h.files_analyzed || 0), 0);
    const totalLines = history.reduce((sum, h) => sum + (h.total_lines || 0), 0);
    const totalTime = history.reduce((sum, h) => sum + (h.analysis_time_seconds || 0), 0);
    return {
      totalScans,
      avgFindings: (totalFindings / totalScans).toFixed(1),
      avgScanTime: (totalTime / totalScans).toFixed(1),
      totalFiles,
      totalLines,
      totalFindings,
      totalTime: totalTime.toFixed(1)
    };
  }

  function computeActivityTimeline(history, days) {
    const now = new Date();
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const dayMap = {};

    // Initialize all days in range
    for (let i = 0; i < days; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      dayMap[key] = 0;
    }

    // Count scans per day
    history.forEach(h => {
      if (!h.timestamp) return;
      const scanDate = new Date(h.timestamp);
      if (scanDate >= cutoff) {
        const key = scanDate.toISOString().split('T')[0];
        if (dayMap.hasOwnProperty(key)) {
          dayMap[key]++;
        }
      }
    });

    // Convert to sorted array (oldest first)
    return Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }

  function computeTopPatterns(history, latestFindings) {
    const patternCounts = {};

    // Aggregate from latest findings
    if (latestFindings && latestFindings.length) {
      latestFindings.forEach(f => {
        const name = f.pattern_name || f.patternName || f.pattern || f.type || 'Unknown';
        patternCounts[name] = (patternCounts[name] || 0) + 1;
      });
    }

    // If history entries have findings embedded, aggregate those too
    history.forEach(h => {
      if (h.findings && Array.isArray(h.findings)) {
        h.findings.forEach(f => {
          const name = f.pattern_name || f.patternName || f.pattern || f.type || 'Unknown';
          patternCounts[name] = (patternCounts[name] || 0) + 1;
        });
      }
    });

    return Object.entries(patternCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }

  // --- Rendering ---

  function renderStatCard(label, value, icon) {
    return `
      <div style="background:${BG_CARD};border:1px solid ${BORDER_COLOR};border-radius:10px;padding:18px 16px;text-align:center;min-width:140px;flex:1;">
        <div style="font-size:22px;margin-bottom:6px;">${icon}</div>
        <div style="font-size:24px;font-weight:700;color:${ACCENT};margin-bottom:4px;">${value}</div>
        <div style="font-size:12px;color:${TEXT_SECONDARY};text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
      </div>
    `;
  }

  function renderActivityChart(timeline) {
    if (!timeline.length) return '<div style="color:' + TEXT_SECONDARY + ';padding:12px;">No activity data</div>';

    const maxCount = Math.max(...timeline.map(t => t.count), 1);
    const barWidth = Math.max(Math.floor(100 / timeline.length), 2);

    let bars = timeline.map(t => {
      const height = Math.max((t.count / maxCount) * 80, 2);
      const dateLabel = t.date.slice(5); // MM-DD
      const opacity = t.count > 0 ? 1 : 0.2;
      return `
        <div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:20px;" title="${t.date}: ${t.count} scan(s)">
          <div style="width:${barWidth}%;min-width:8px;max-width:28px;height:${height}px;background:${ACCENT};opacity:${opacity};border-radius:3px 3px 0 0;transition:all 0.2s;"></div>
          <div style="font-size:9px;color:${TEXT_SECONDARY};margin-top:4px;transform:rotate(-45deg);white-space:nowrap;">${dateLabel}</div>
        </div>
      `;
    }).join('');

    return `
      <div style="display:flex;align-items:flex-end;gap:2px;height:120px;padding:10px 0 30px 0;overflow-x:auto;">
        ${bars}
      </div>
    `;
  }

  function renderPatternList(patterns) {
    if (!patterns.length) {
      return `<div style="color:${TEXT_SECONDARY};padding:16px;text-align:center;font-style:italic;">No scans performed yet</div>`;
    }

    const maxCount = patterns[0].count;
    return patterns.map(p => {
      const barWidth = Math.round((p.count / maxCount) * 100);
      return `
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="color:${TEXT_PRIMARY};font-size:13px;">${escapeHtml(p.name)}</span>
            <span style="color:${ACCENT};font-size:13px;font-weight:600;">${p.count}</span>
          </div>
          <div style="background:${BORDER_COLOR};border-radius:4px;height:6px;overflow:hidden;">
            <div style="width:${barWidth}%;height:100%;background:${ACCENT};border-radius:4px;transition:width 0.3s;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderKBStats(kb) {
    if (!kb.length) {
      return `<div style="color:${TEXT_SECONDARY};padding:16px;text-align:center;font-style:italic;">No knowledge base entries saved yet</div>`;
    }

    const titles = kb.map(entry => {
      const title = entry.title || entry.name || entry.playbook_title || 'Untitled Entry';
      return `<li style="color:${TEXT_PRIMARY};padding:6px 0;border-bottom:1px solid ${BORDER_COLOR};font-size:13px;">📋 ${escapeHtml(title)}</li>`;
    }).join('');

    return `
      <div style="margin-bottom:12px;color:${ACCENT};font-size:15px;font-weight:600;">${kb.length} KB Entr${kb.length === 1 ? 'y' : 'ies'} Saved</div>
      <ul style="list-style:none;padding:0;margin:0;max-height:200px;overflow-y:auto;">
        ${titles}
      </ul>
    `;
  }

  function renderShiftStats(sessions) {
    if (!sessions.length) {
      return `<div style="color:${TEXT_SECONDARY};padding:16px;text-align:center;font-style:italic;">No shift handoff sessions recorded</div>`;
    }
    return `
      <div style="color:${ACCENT};font-size:15px;font-weight:600;margin-bottom:8px;">${sessions.length} Shift Session${sessions.length === 1 ? '' : 's'} Recorded</div>
      <div style="color:${TEXT_SECONDARY};font-size:12px;">Shift handoffs help maintain context across analysis sessions.</div>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Main Render ---

  window.renderTeamDashboard = function() {
    const history = getHistory();
    const latestFindings = getLatestFindings();
    const kb = getKnowledgeBase();
    const shifts = getShiftSessions();
    const analytics = computeUsageAnalytics(history);
    const days = _currentFilter === '30d' ? 30 : 7;
    const timeline = computeActivityTimeline(history, days);
    const patterns = computeTopPatterns(history, latestFindings);

    let content = '';

    // Empty state
    if (!history.length && !kb.length && !shifts.length) {
      content = `
        <div style="text-align:center;padding:60px 20px;">
          <div style="font-size:48px;margin-bottom:16px;">📊</div>
          <h2 style="color:${TEXT_PRIMARY};margin-bottom:12px;">Start Scanning to See Your Analytics</h2>
          <p style="color:${TEXT_SECONDARY};font-size:14px;max-width:400px;margin:0 auto;">
            Run your first log scan and your analytics will appear here. All data is derived from your local scan history — nothing simulated.
          </p>
        </div>
      `;
    } else {
      // Usage Analytics Section
      const statsSection = analytics ? `
        <div style="margin-bottom:28px;">
          <h3 style="color:${TEXT_PRIMARY};margin:0 0 14px 0;font-size:16px;">📈 Usage Analytics</h3>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            ${renderStatCard('Total Scans', analytics.totalScans, '🔍')}
            ${renderStatCard('Avg Findings/Scan', analytics.avgFindings, '🎯')}
            ${renderStatCard('Avg Scan Time', analytics.avgScanTime + 's', '⏱️')}
            ${renderStatCard('Total Files', analytics.totalFiles.toLocaleString(), '📁')}
            ${renderStatCard('Total Lines', analytics.totalLines.toLocaleString(), '📄')}
          </div>
        </div>
      ` : '';

      // Activity Timeline Section
      const timelineSection = `
        <div style="margin-bottom:28px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <h3 style="color:${TEXT_PRIMARY};margin:0;font-size:16px;">📅 Scan Activity Timeline</h3>
            <div style="display:flex;gap:8px;">
              <button onclick="window._tdSetFilter('7d')" style="background:${_currentFilter === '7d' ? ACCENT : BG_CARD};color:${_currentFilter === '7d' ? '#000' : TEXT_SECONDARY};border:1px solid ${BORDER_COLOR};border-radius:6px;padding:4px 12px;cursor:pointer;font-size:12px;">7 Days</button>
              <button onclick="window._tdSetFilter('30d')" style="background:${_currentFilter === '30d' ? ACCENT : BG_CARD};color:${_currentFilter === '30d' ? '#000' : TEXT_SECONDARY};border:1px solid ${BORDER_COLOR};border-radius:6px;padding:4px 12px;cursor:pointer;font-size:12px;">30 Days</button>
            </div>
          </div>
          <div style="background:${BG_CARD};border:1px solid ${BORDER_COLOR};border-radius:10px;padding:16px;">
            ${renderActivityChart(timeline)}
          </div>
        </div>
      `;

      // Top Patterns Section
      const patternsSection = `
        <div style="margin-bottom:28px;">
          <h3 style="color:${TEXT_PRIMARY};margin:0 0 14px 0;font-size:16px;">🔥 Top Detected Patterns</h3>
          <div style="background:${BG_CARD};border:1px solid ${BORDER_COLOR};border-radius:10px;padding:16px;">
            ${renderPatternList(patterns)}
          </div>
        </div>
      `;

      // Knowledge Base Section
      const kbSection = `
        <div style="margin-bottom:28px;">
          <h3 style="color:${TEXT_PRIMARY};margin:0 0 14px 0;font-size:16px;">📚 Knowledge Base</h3>
          <div style="background:${BG_CARD};border:1px solid ${BORDER_COLOR};border-radius:10px;padding:16px;">
            ${renderKBStats(kb)}
          </div>
        </div>
      `;

      // Shift Handoff Section
      const shiftSection = `
        <div style="margin-bottom:28px;">
          <h3 style="color:${TEXT_PRIMARY};margin:0 0 14px 0;font-size:16px;">🔄 Shift Handoffs</h3>
          <div style="background:${BG_CARD};border:1px solid ${BORDER_COLOR};border-radius:10px;padding:16px;">
            ${renderShiftStats(shifts)}
          </div>
        </div>
      `;

      content = statsSection + timelineSection + patternsSection + kbSection + shiftSection;
    }

    // Footer disclaimer
    const footer = `
      <div style="text-align:center;padding:16px 0 8px 0;border-top:1px solid ${BORDER_COLOR};margin-top:20px;">
        <span style="color:${TEXT_SECONDARY};font-size:11px;font-style:italic;">All metrics derived from your local scan history — no simulated data</span>
      </div>
    `;

    return content + footer;
  };

  // --- Modal Management ---

  window.openTeamDashboard = function() {
    // Admin check — only allow if admin flag is set or no restriction
    const adminFlag = localStorage.getItem('ls_admin');
    if (adminFlag === 'false') {
      alert('Access restricted to admin users.');
      return;
    }

    // Remove existing if open
    const existing = document.getElementById('td-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'td-overlay';
    overlay.style.cssText = `
      position:fixed;top:0;left:0;right:0;bottom:0;
      background:${BG_OVERLAY};
      z-index:100000;
      display:flex;align-items:center;justify-content:center;
      animation:tdFadeIn 0.2s ease;
    `;

    const modal = document.createElement('div');
    modal.id = 'td-modal';
    modal.style.cssText = `
      background:${BG_DARK};
      border:1px solid ${BORDER_COLOR};
      border-radius:16px;
      width:90%;max-width:800px;max-height:85vh;
      overflow-y:auto;
      padding:28px 32px;
      box-shadow:0 20px 60px rgba(0,0,0,0.5);
    `;

    // Header
    const header = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid ${BORDER_COLOR};">
        <div>
          <h2 style="color:${TEXT_PRIMARY};margin:0;font-size:20px;">📊 Analytics Dashboard</h2>
          <p style="color:${TEXT_SECONDARY};margin:4px 0 0 0;font-size:12px;">LogSherlock Pro — Local Scan Analytics</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <button onclick="window._tdExportReport()" style="background:${BG_CARD};color:${ACCENT};border:1px solid ${ACCENT};border-radius:8px;padding:8px 14px;cursor:pointer;font-size:12px;font-weight:600;">📥 Export</button>
          <button onclick="window.closeTeamDashboard()" style="background:none;border:none;color:${TEXT_SECONDARY};font-size:24px;cursor:pointer;padding:4px 8px;line-height:1;">&times;</button>
        </div>
      </div>
    `;

    modal.innerHTML = header + window.renderTeamDashboard();
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) window.closeTeamDashboard();
    });

    // Close on Escape
    document.addEventListener('keydown', _tdEscHandler);

    // Inject animation keyframes if not present
    if (!document.getElementById('td-styles')) {
      const style = document.createElement('style');
      style.id = 'td-styles';
      style.textContent = `
        @keyframes tdFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        #td-modal::-webkit-scrollbar { width: 6px; }
        #td-modal::-webkit-scrollbar-track { background: ${BG_DARK}; }
        #td-modal::-webkit-scrollbar-thumb { background: ${BORDER_COLOR}; border-radius: 3px; }
        #td-modal::-webkit-scrollbar-thumb:hover { background: ${ACCENT}; }
      `;
      document.head.appendChild(style);
    }
  };

  window.closeTeamDashboard = function() {
    const overlay = document.getElementById('td-overlay');
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', _tdEscHandler);
  };

  function _tdEscHandler(e) {
    if (e.key === 'Escape') window.closeTeamDashboard();
  }

  window._tdSetFilter = function(filter) {
    _currentFilter = filter;
    // Re-render content inside modal
    const modal = document.getElementById('td-modal');
    if (modal) {
      const header = modal.querySelector('div'); // keep first child (header)
      const headerHtml = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid ${BORDER_COLOR};">
          <div>
            <h2 style="color:${TEXT_PRIMARY};margin:0;font-size:20px;">📊 Analytics Dashboard</h2>
            <p style="color:${TEXT_SECONDARY};margin:4px 0 0 0;font-size:12px;">LogSherlock Pro — Local Scan Analytics</p>
          </div>
          <div style="display:flex;gap:10px;align-items:center;">
            <button onclick="window._tdExportReport()" style="background:${BG_CARD};color:${ACCENT};border:1px solid ${ACCENT};border-radius:8px;padding:8px 14px;cursor:pointer;font-size:12px;font-weight:600;">📥 Export</button>
            <button onclick="window.closeTeamDashboard()" style="background:none;border:none;color:${TEXT_SECONDARY};font-size:24px;cursor:pointer;padding:4px 8px;line-height:1;">&times;</button>
          </div>
        </div>
      `;
      modal.innerHTML = headerHtml + window.renderTeamDashboard();
    }
  };

  window._tdExportReport = function() {
    const history = getHistory();
    const latestFindings = getLatestFindings();
    const kb = getKnowledgeBase();
    const shifts = getShiftSessions();
    const analytics = computeUsageAnalytics(history);
    const patterns = computeTopPatterns(history, latestFindings);

    let report = '=== LogSherlock Pro — Analytics Report ===\n';
    report += `Generated: ${new Date().toLocaleString()}\n\n`;

    if (analytics) {
      report += '--- Usage Analytics ---\n';
      report += `Total Scans: ${analytics.totalScans}\n`;
      report += `Avg Findings/Scan: ${analytics.avgFindings}\n`;
      report += `Avg Scan Time: ${analytics.avgScanTime}s\n`;
      report += `Total Files Analyzed: ${analytics.totalFiles}\n`;
      report += `Total Lines Scanned: ${analytics.totalLines}\n`;
      report += `Total Findings: ${analytics.totalFindings}\n\n`;
    } else {
      report += '--- Usage Analytics ---\nNo scan history available.\n\n';
    }

    report += '--- Top Detected Patterns ---\n';
    if (patterns.length) {
      patterns.forEach((p, i) => {
        report += `${i + 1}. ${p.name} — ${p.count} occurrence(s)\n`;
      });
    } else {
      report += 'No patterns detected yet.\n';
    }
    report += '\n';

    report += '--- Knowledge Base ---\n';
    report += `Entries: ${kb.length}\n`;
    kb.forEach(entry => {
      report += `  • ${entry.title || entry.name || entry.playbook_title || 'Untitled'}\n`;
    });
    report += '\n';

    report += '--- Shift Handoffs ---\n';
    report += `Sessions: ${shifts.length}\n\n`;

    report += '---\nAll metrics derived from your local scan history — no simulated data\n';

    // Download as text file
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logsherlock-report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

})();
