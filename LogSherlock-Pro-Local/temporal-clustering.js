/**
 * LogSherlock Pro — Temporal Clustering Module
 * Groups findings by timestamp proximity (60-second window).
 * All data derives exclusively from the findings parameter — no fake/demo data.
 */
(function () {
  if (typeof window === 'undefined') return;

  const CLUSTER_WINDOW_MS = 60 * 1000; // 60 seconds

  const SEVERITY_ORDER = { CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, INFO: 1 };

  const SEVERITY_COLORS = {
    CRITICAL: '#ff4444',
    HIGH: '#ff8800',
    MEDIUM: '#ffcc00',
    LOW: '#66ccff',
    INFO: '#888888'
  };

  const MONTHS = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
  };

  /**
   * Parse a log_timestamp string into epoch milliseconds.
   * Supports: ISO 8601, syslog format (Mon DD HH:MM:SS), epoch number.
   * Returns null if unparseable.
   */
  function parseTimestamp(ts) {
    if (ts == null) return null;

    // If it's already a number (epoch millis or seconds)
    if (typeof ts === 'number') {
      // If less than 1e12, assume seconds; otherwise millis
      return ts < 1e12 ? ts * 1000 : ts;
    }

    var str = String(ts).trim();
    if (!str) return null;

    // Try epoch numeric string
    if (/^\d{10,13}$/.test(str)) {
      var num = parseInt(str, 10);
      return num < 1e12 ? num * 1000 : num;
    }

    // Try ISO 8601 (e.g. 2026-08-07T03:14:22, 2026-08-07T03:14:22Z, 2026-08-07T03:14:22+05:30)
    var isoDate = new Date(str);
    if (!isNaN(isoDate.getTime()) && /\d{4}-\d{2}-\d{2}/.test(str)) {
      return isoDate.getTime();
    }

    // Try syslog format: "Mon DD HH:MM:SS" (e.g. "Aug 7 03:14:22" or "Aug 07 03:14:22")
    var syslogMatch = str.match(/^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (syslogMatch) {
      var month = MONTHS[syslogMatch[1]];
      if (month !== undefined) {
        var day = parseInt(syslogMatch[2], 10);
        var hour = parseInt(syslogMatch[3], 10);
        var minute = parseInt(syslogMatch[4], 10);
        var second = parseInt(syslogMatch[5], 10);
        // Use current year since syslog doesn't include year
        var year = new Date().getFullYear();
        var d = new Date(year, month, day, hour, minute, second);
        if (!isNaN(d.getTime())) return d.getTime();
      }
    }

    // Last resort: try Date constructor
    var fallback = new Date(str);
    if (!isNaN(fallback.getTime())) return fallback.getTime();

    return null;
  }

  /**
   * Get the maximum severity from an array of findings.
   */
  function maxSeverity(findings) {
    var max = 'INFO';
    var maxVal = 0;
    for (var i = 0; i < findings.length; i++) {
      var sev = (findings[i].severity || 'INFO').toUpperCase();
      var val = SEVERITY_ORDER[sev] || 0;
      if (val > maxVal) {
        maxVal = val;
        max = sev;
      }
    }
    return max;
  }

  /**
   * Format epoch millis to a readable time string.
   */
  function formatTime(epochMs) {
    var d = new Date(epochMs);
    return d.toLocaleString();
  }

  /**
   * Escape HTML to prevent XSS.
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Build temporal clusters from findings.
   */
  function buildClusters(findings) {
    if (!Array.isArray(findings) || findings.length === 0) return [];

    // Parse timestamps and filter findings that have valid timestamps
    var timed = [];
    for (var i = 0; i < findings.length; i++) {
      var f = findings[i];
      var ts = parseTimestamp(f.log_timestamp);
      if (ts !== null) {
        timed.push({ finding: f, timestamp: ts });
      }
    }

    if (timed.length === 0) return [];

    // Sort by timestamp
    timed.sort(function (a, b) { return a.timestamp - b.timestamp; });

    // Group into clusters using 60-second window
    var clusters = [];
    var currentCluster = [timed[0]];

    for (var j = 1; j < timed.length; j++) {
      var prev = currentCluster[currentCluster.length - 1];
      if (timed[j].timestamp - prev.timestamp <= CLUSTER_WINDOW_MS) {
        currentCluster.push(timed[j]);
      } else {
        clusters.push(currentCluster);
        currentCluster = [timed[j]];
      }
    }
    clusters.push(currentCluster);

    // Only keep clusters with 2+ findings
    var multiClusters = [];
    for (var k = 0; k < clusters.length; k++) {
      if (clusters[k].length >= 2) {
        var members = clusters[k];
        var memberFindings = members.map(function (m) { return m.finding; });
        multiClusters.push({
          id: 'cluster-' + (k + 1) + '-' + members[0].timestamp,
          startTime: members[0].timestamp,
          endTime: members[members.length - 1].timestamp,
          severity: maxSeverity(memberFindings),
          findings: memberFindings
        });
      }
    }

    return multiClusters;
  }

  /**
   * Inject scoped CSS styles for the temporal clustering panel.
   */
  function injectStyles() {
    if (document.getElementById('logsherlock-temporal-clustering-styles')) return;

    var css = [
      '.tc-panel { background: #1e1e2e; border: 1px solid #333; border-radius: 8px; margin: 16px 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; color: #e0e0e0; overflow: hidden; }',
      '.tc-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; cursor: pointer; user-select: none; background: #252535; border-bottom: 1px solid #333; transition: background 0.2s; }',
      '.tc-header:hover { background: #2a2a3e; }',
      '.tc-header-title { font-size: 16px; font-weight: 600; color: #01a982; }',
      '.tc-header-toggle { font-size: 12px; color: #888; transition: transform 0.3s; }',
      '.tc-header-toggle.expanded { transform: rotate(180deg); }',
      '.tc-body { padding: 16px 20px; display: none; }',
      '.tc-body.visible { display: block; }',
      '.tc-summary { font-size: 13px; color: #aaa; margin-bottom: 14px; line-height: 1.5; }',
      '.tc-summary strong { color: #01a982; }',
      '.tc-empty { padding: 20px; text-align: center; color: #777; font-size: 13px; font-style: italic; }',
      '.tc-cluster-card { background: #2a2a3e; border: 1px solid #3a3a4e; border-radius: 6px; margin-bottom: 12px; overflow: hidden; transition: border-color 0.2s; }',
      '.tc-cluster-card:hover { border-color: #01a982; }',
      '.tc-cluster-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer; user-select: none; }',
      '.tc-cluster-header:hover { background: #333346; }',
      '.tc-cluster-time { font-size: 12px; color: #ccc; font-family: monospace; }',
      '.tc-cluster-time .arrow { color: #01a982; margin: 0 6px; }',
      '.tc-cluster-meta { display: flex; align-items: center; gap: 10px; }',
      '.tc-severity-badge { padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #fff; }',
      '.tc-cluster-count { font-size: 12px; color: #aaa; }',
      '.tc-cluster-expand-icon { font-size: 10px; color: #666; transition: transform 0.2s; }',
      '.tc-cluster-expand-icon.open { transform: rotate(90deg); }',
      '.tc-cluster-body { display: none; border-top: 1px solid #3a3a4e; padding: 10px 16px; background: #1e1e2e; }',
      '.tc-cluster-body.open { display: block; }',
      '.tc-finding-item { padding: 8px 0; border-bottom: 1px solid #2a2a3e; font-size: 12px; line-height: 1.6; }',
      '.tc-finding-item:last-child { border-bottom: none; }',
      '.tc-finding-item .label { color: #01a982; font-weight: 600; }',
      '.tc-finding-item .value { color: #ddd; }',
      '.tc-finding-item .line-content { color: #999; font-family: monospace; font-size: 11px; word-break: break-all; margin-top: 4px; padding: 4px 8px; background: #252535; border-radius: 3px; }'
    ].join('\n');

    var style = document.createElement('style');
    style.id = 'logsherlock-temporal-clustering-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /**
   * Render the Temporal Clustering panel into the DOM.
   * @param {Array} findings — real scan findings array
   */
  function renderTemporalClusteringPanel(findings) {
    injectStyles();

    var clusters = buildClusters(findings);

    // Build panel HTML
    var html = '';
    html += '<div class="tc-panel">';
    html += '  <div class="tc-header" id="tc-panel-header">';
    html += '    <span class="tc-header-title">⏰ Event Clusters — Temporal Grouping</span>';
    html += '    <span class="tc-header-toggle" id="tc-panel-toggle">▼</span>';
    html += '  </div>';
    html += '  <div class="tc-body" id="tc-panel-body">';

    if (clusters.length === 0) {
      html += '    <div class="tc-empty">No temporal clusters detected — findings lack parseable timestamps or all events are isolated.</div>';
    } else {
      html += '    <div class="tc-summary">';
      html += '      <strong>' + clusters.length + ' cluster' + (clusters.length > 1 ? 's' : '') + '</strong> detected. ';
      html += '      Findings grouped by timestamp proximity (60s window). Only from findings with parseable timestamps.';
      html += '    </div>';

      for (var i = 0; i < clusters.length; i++) {
        var cluster = clusters[i];
        var sevColor = SEVERITY_COLORS[cluster.severity] || '#888';
        var clusterId = 'tc-cluster-' + i;

        html += '<div class="tc-cluster-card">';
        html += '  <div class="tc-cluster-header" data-cluster-id="' + clusterId + '">';
        html += '    <div>';
        html += '      <div class="tc-cluster-time">';
        html += '        ' + escapeHtml(formatTime(cluster.startTime));
        html += '        <span class="arrow">→</span>';
        html += '        ' + escapeHtml(formatTime(cluster.endTime));
        html += '      </div>';
        html += '    </div>';
        html += '    <div class="tc-cluster-meta">';
        html += '      <span class="tc-severity-badge" style="background:' + sevColor + ';">' + escapeHtml(cluster.severity) + '</span>';
        html += '      <span class="tc-cluster-count">' + cluster.findings.length + ' findings in this cluster</span>';
        html += '      <span class="tc-cluster-expand-icon" id="icon-' + clusterId + '">▶</span>';
        html += '    </div>';
        html += '  </div>';
        html += '  <div class="tc-cluster-body" id="body-' + clusterId + '">';

        for (var j = 0; j < cluster.findings.length; j++) {
          var f = cluster.findings[j];
          html += '<div class="tc-finding-item">';
          html += '  <span class="label">Pattern:</span> <span class="value">' + escapeHtml(f.pattern_name) + '</span>';
          html += '  &nbsp;|&nbsp; <span class="label">Severity:</span> <span class="value">' + escapeHtml(f.severity) + '</span>';
          html += '  &nbsp;|&nbsp; <span class="label">Category:</span> <span class="value">' + escapeHtml(f.category) + '</span>';
          html += '  <br><span class="label">File:</span> <span class="value">' + escapeHtml(f.file) + ':' + escapeHtml(f.line_number) + '</span>';
          if (f.line_content) {
            html += '  <div class="line-content">' + escapeHtml(f.line_content) + '</div>';
          }
          html += '</div>';
        }

        html += '  </div>';
        html += '</div>';
      }
    }

    html += '  </div>';
    html += '</div>';

    // Insert into DOM
    var container = document.getElementById('temporal-clustering-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'temporal-clustering-container';
      // Try to append to a main content area, fallback to body
      var mainArea = document.getElementById('analysis-panels') || document.getElementById('results') || document.querySelector('main') || document.body;
      mainArea.appendChild(container);
    }
    container.innerHTML = html;

    // Bind panel collapse/expand (starts collapsed)
    var panelHeader = document.getElementById('tc-panel-header');
    var panelBody = document.getElementById('tc-panel-body');
    var panelToggle = document.getElementById('tc-panel-toggle');

    if (panelHeader && panelBody) {
      panelHeader.addEventListener('click', function () {
        var isVisible = panelBody.classList.contains('visible');
        if (isVisible) {
          panelBody.classList.remove('visible');
          panelToggle.classList.remove('expanded');
        } else {
          panelBody.classList.add('visible');
          panelToggle.classList.add('expanded');
        }
      });
    }

    // Bind cluster expand/collapse
    var clusterHeaders = container.querySelectorAll('.tc-cluster-header');
    for (var k = 0; k < clusterHeaders.length; k++) {
      (function (header) {
        header.addEventListener('click', function () {
          var id = header.getAttribute('data-cluster-id');
          var body = document.getElementById('body-' + id);
          var icon = document.getElementById('icon-' + id);
          if (body && icon) {
            var isOpen = body.classList.contains('open');
            if (isOpen) {
              body.classList.remove('open');
              icon.classList.remove('open');
            } else {
              body.classList.add('open');
              icon.classList.add('open');
            }
          }
        });
      })(clusterHeaders[k]);
    }

    return { clusters: clusters, clusterCount: clusters.length };
  }

  // Export to window
  window.renderTemporalClusteringPanel = renderTemporalClusteringPanel;

  // Self-initialize on DOMContentLoaded if findings are available globally
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (window.logSherlockFindings && Array.isArray(window.logSherlockFindings)) {
        renderTemporalClusteringPanel(window.logSherlockFindings);
      }
    });
  } else {
    // DOM already loaded
    if (window.logSherlockFindings && Array.isArray(window.logSherlockFindings)) {
      renderTemporalClusteringPanel(window.logSherlockFindings);
    }
  }

})();
