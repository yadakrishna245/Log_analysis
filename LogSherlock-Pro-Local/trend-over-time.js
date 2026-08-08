/**
 * LogSherlock Pro — Trend Over Time Panel
 * Charts findings count over last N scans using CSS bar chart
 */
(function () {
  'use strict';

  var STYLE_ID = 'lsp-trend-style';
  var STORAGE_KEY = 'lsp_trend_data';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.lsp-trend-panel { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; border: 1px solid #e0e0e0; border-radius: 8px; margin: 16px 0; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }',
      '.lsp-trend-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; cursor: pointer; background: #f8f9fa; border-radius: 8px 8px 0 0; user-select: none; }',
      '.lsp-trend-header h2 { margin: 0; font-size: 18px; }',
      '.lsp-trend-header .lsp-toggle { font-size: 14px; color: #666; }',
      '.lsp-trend-body { padding: 20px; }',
      '.lsp-trend-body.collapsed { display: none; }',
      '.lsp-trend-controls { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }',
      '.lsp-trend-controls select { padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; }',
      '.lsp-trend-controls button { padding: 6px 12px; border: 1px solid #e53935; border-radius: 4px; background: #fff; color: #e53935; cursor: pointer; font-size: 12px; }',
      '.lsp-trend-controls button:hover { background: #fdecea; }',
      '.lsp-trend-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }',
      '.lsp-trend-stat { background: #f5f5f5; padding: 12px; border-radius: 6px; text-align: center; }',
      '.lsp-trend-stat .val { font-size: 20px; font-weight: 700; }',
      '.lsp-trend-stat .val.up { color: #e53935; }',
      '.lsp-trend-stat .val.down { color: #2e7d32; }',
      '.lsp-trend-stat .val.stable { color: #666; }',
      '.lsp-trend-stat .lbl { font-size: 11px; color: #666; margin-top: 4px; }',
      '.lsp-trend-chart { display: flex; align-items: flex-end; gap: 4px; height: 180px; padding: 10px 0; border-bottom: 2px solid #e0e0e0; margin-bottom: 8px; overflow-x: auto; }',
      '.lsp-trend-bar { display: flex; flex-direction: column-reverse; align-items: center; min-width: 28px; flex: 1; max-width: 50px; }',
      '.lsp-trend-bar-seg { width: 100%; min-height: 0; transition: height 0.3s; }',
      '.lsp-trend-bar-seg.critical { background: #b71c1c; }',
      '.lsp-trend-bar-seg.high { background: #e65100; }',
      '.lsp-trend-bar-seg.medium { background: #f9a825; }',
      '.lsp-trend-bar-seg.low { background: #66bb6a; }',
      '.lsp-trend-bar-label { font-size: 9px; color: #999; margin-top: 4px; text-align: center; white-space: nowrap; }',
      '.lsp-trend-bar-total { font-size: 10px; font-weight: 600; color: #333; margin-bottom: 2px; }',
      '.lsp-trend-legend { display: flex; gap: 14px; margin-top: 8px; font-size: 11px; color: #666; }',
      '.lsp-trend-legend span::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }',
      '.lsp-trend-legend .leg-critical::before { background: #b71c1c; }',
      '.lsp-trend-legend .leg-high::before { background: #e65100; }',
      '.lsp-trend-legend .leg-medium::before { background: #f9a825; }',
      '.lsp-trend-legend .leg-low::before { background: #66bb6a; }',
      '.lsp-trend-empty { text-align: center; padding: 30px; color: #666; font-size: 14px; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function getHistory() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(history) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }

  function buildScanSummary(findings) {
    var summary = { date: new Date().toISOString(), total: findings.length, critical: 0, high: 0, medium: 0, low: 0 };
    for (var i = 0; i < findings.length; i++) {
      var sev = (findings[i].severity || '').toLowerCase();
      if (sev === 'critical') summary.critical++;
      else if (sev === 'high') summary.high++;
      else if (sev === 'medium') summary.medium++;
      else summary.low++;
    }
    return summary;
  }

  function formatDate(isoStr) {
    try {
      var d = new Date(isoStr);
      return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    } catch (e) {
      return isoStr;
    }
  }

  function getTrendDirection(history) {
    if (history.length < 2) return { dir: '→', label: 'Stable', cls: 'stable' };
    var last = history[history.length - 1].total;
    var prev = history[history.length - 2].total;
    if (last > prev) return { dir: '↑', label: 'Increasing', cls: 'up' };
    if (last < prev) return { dir: '↓', label: 'Decreasing', cls: 'down' };
    return { dir: '→', label: 'Stable', cls: 'stable' };
  }

  function getPercentChange(current, previous) {
    if (previous === 0) return current > 0 ? '+100%' : '0%';
    var change = ((current - previous) / previous * 100).toFixed(1);
    return (change > 0 ? '+' : '') + change + '%';
  }

  function get7DayAverage(history) {
    var now = Date.now();
    var sevenDays = 7 * 24 * 60 * 60 * 1000;
    var recent = history.filter(function (h) {
      return (now - new Date(h.date).getTime()) <= sevenDays;
    });
    if (recent.length === 0) return null;
    var sum = 0;
    for (var i = 0; i < recent.length; i++) sum += recent[i].total;
    return Math.round(sum / recent.length);
  }

  window.renderTrendOverTimePanel = function (findings) {
    injectStyles();
    findings = findings || [];

    // Add current scan to history
    var history = getHistory();
    var currentSummary = buildScanSummary(findings);
    history.push(currentSummary);
    // Keep max 100 entries
    if (history.length > 100) history = history.slice(history.length - 100);
    saveHistory(history);

    var container = document.createElement('div');
    container.className = 'lsp-trend-panel';

    var headerEl = document.createElement('div');
    headerEl.className = 'lsp-trend-header';
    headerEl.innerHTML = '<h2>📈 Trend Over Time</h2><span class="lsp-toggle">▼</span>';

    var bodyEl = document.createElement('div');
    bodyEl.className = 'lsp-trend-body';

    function renderBody(limit) {
      var displayHistory = history.slice(-limit);

      if (displayHistory.length < 2) {
        bodyEl.innerHTML = '<div class="lsp-trend-empty">📊 Trends will appear after 2+ scans<br><small>Current scan recorded. Run another scan to see trends.</small></div>' +
          '<div class="lsp-trend-controls"><button data-action="clear">🗑️ Clear History</button></div>';
        return;
      }

      var maxTotal = 1;
      for (var i = 0; i < displayHistory.length; i++) {
        if (displayHistory[i].total > maxTotal) maxTotal = displayHistory[i].total;
      }

      var trend = getTrendDirection(displayHistory);
      var lastScan = displayHistory[displayHistory.length - 1];
      var prevScan = displayHistory[displayHistory.length - 2];
      var pctVsLast = getPercentChange(lastScan.total, prevScan.total);
      var avg7 = get7DayAverage(history);
      var pctVsAvg = avg7 !== null ? getPercentChange(lastScan.total, avg7) : 'N/A';

      // Controls
      var controlsHtml = '<div class="lsp-trend-controls">' +
        '<label>Show last: <select data-action="limit">' +
        '<option value="10"' + (limit === 10 ? ' selected' : '') + '>10 scans</option>' +
        '<option value="20"' + (limit === 20 ? ' selected' : '') + '>20 scans</option>' +
        '<option value="50"' + (limit === 50 ? ' selected' : '') + '>50 scans</option>' +
        '</select></label>' +
        '<button data-action="clear">🗑️ Clear History</button>' +
        '</div>';

      // Stats
      var statsHtml = '<div class="lsp-trend-stats">' +
        '<div class="lsp-trend-stat"><div class="val ' + trend.cls + '">' + trend.dir + ' ' + trend.label + '</div><div class="lbl">Trend Direction</div></div>' +
        '<div class="lsp-trend-stat"><div class="val ' + (pctVsLast.charAt(0) === '+' ? 'up' : (pctVsLast.charAt(0) === '-' ? 'down' : 'stable')) + '">' + pctVsLast + '</div><div class="lbl">vs Last Scan</div></div>' +
        '<div class="lsp-trend-stat"><div class="val ' + (pctVsAvg.charAt(0) === '+' ? 'up' : (pctVsAvg.charAt(0) === '-' ? 'down' : 'stable')) + '">' + pctVsAvg + '</div><div class="lbl">vs 7-Day Average</div></div>' +
        '<div class="lsp-trend-stat"><div class="val stable">' + displayHistory.length + '</div><div class="lbl">Scans in View</div></div>' +
        '</div>';

      // Chart
      var chartHeight = 160;
      var barsHtml = '';
      for (var b = 0; b < displayHistory.length; b++) {
        var scan = displayHistory[b];
        var critH = Math.round((scan.critical / maxTotal) * chartHeight);
        var highH = Math.round((scan.high / maxTotal) * chartHeight);
        var medH = Math.round((scan.medium / maxTotal) * chartHeight);
        var lowH = Math.round((scan.low / maxTotal) * chartHeight);

        barsHtml += '<div class="lsp-trend-bar">' +
          '<div class="lsp-trend-bar-total">' + scan.total + '</div>' +
          '<div class="lsp-trend-bar-seg critical" style="height:' + critH + 'px"></div>' +
          '<div class="lsp-trend-bar-seg high" style="height:' + highH + 'px"></div>' +
          '<div class="lsp-trend-bar-seg medium" style="height:' + medH + 'px"></div>' +
          '<div class="lsp-trend-bar-seg low" style="height:' + lowH + 'px"></div>' +
          '<div class="lsp-trend-bar-label">' + formatDate(scan.date) + '</div>' +
          '</div>';
      }

      var chartHtml = '<div class="lsp-trend-chart">' + barsHtml + '</div>';
      var legendHtml = '<div class="lsp-trend-legend">' +
        '<span class="leg-critical">Critical</span>' +
        '<span class="leg-high">High</span>' +
        '<span class="leg-medium">Medium</span>' +
        '<span class="leg-low">Low</span></div>';

      bodyEl.innerHTML = controlsHtml + statsHtml + chartHtml + legendHtml;
    }

    renderBody(10);

    container.appendChild(headerEl);
    container.appendChild(bodyEl);

    // Collapse toggle
    headerEl.addEventListener('click', function () {
      var toggle = headerEl.querySelector('.lsp-toggle');
      if (bodyEl.classList.contains('collapsed')) {
        bodyEl.classList.remove('collapsed');
        toggle.textContent = '▼';
      } else {
        bodyEl.classList.add('collapsed');
        toggle.textContent = '►';
      }
    });

    // Event delegation
    bodyEl.addEventListener('change', function (e) {
      var sel = e.target.closest('select[data-action="limit"]');
      if (sel) {
        renderBody(parseInt(sel.value, 10));
      }
    });

    bodyEl.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-action="clear"]');
      if (btn) {
        if (confirm('Clear all trend history? This cannot be undone.')) {
          localStorage.removeItem(STORAGE_KEY);
          history = [];
          var newSummary = buildScanSummary(findings);
          history.push(newSummary);
          saveHistory(history);
          renderBody(10);
        }
      }
    });

    return container;
  };
})();
