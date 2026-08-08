(function() {
  'use strict';

  var STYLE_ID = 'lsp-kpi-dashboard-style';
  var STATS_KEY = 'lsp_kpi_stats';
  var LAST_RENDER_KEY = 'lsp_kpi_last_render';
  var CSS = '.lsp-kpi-panel{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;border:1px solid #e0e0e0;border-radius:8px;margin:12px 0;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.06)}.lsp-kpi-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;cursor:pointer;background:#f8f9fa;border-radius:8px 8px 0 0;user-select:none}.lsp-kpi-header h3{margin:0;font-size:16px}.lsp-kpi-header .toggle{font-size:18px;transition:transform 0.2s}.lsp-kpi-header .toggle.collapsed{transform:rotate(-90deg)}.lsp-kpi-body{padding:18px;display:block}.lsp-kpi-body.hidden{display:none}.lsp-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px}.lsp-kpi-card{padding:16px;border-radius:8px;background:#f9fafb;border:1px solid #e5e7eb;text-align:center}.lsp-kpi-card-value{font-size:28px;font-weight:700;color:#1f2937;margin-bottom:4px}.lsp-kpi-card-label{font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px}.lsp-kpi-trend{padding:14px;border-radius:8px;background:#eff6ff;border:1px solid #bfdbfe;margin-bottom:12px}.lsp-kpi-trend h4{margin:0 0 8px;font-size:13px;color:#1e40af}.lsp-kpi-trend-row{display:flex;justify-content:space-between;font-size:13px;color:#374151;padding:3px 0}.lsp-kpi-first{text-align:center;padding:24px;color:#6b7280;font-size:14px}.lsp-kpi-history{margin-top:12px;font-size:12px;color:#6b7280;max-height:200px;overflow-y:auto}.lsp-kpi-history table{width:100%;border-collapse:collapse}.lsp-kpi-history th,.lsp-kpi-history td{padding:6px 8px;text-align:left;border-bottom:1px solid #f3f4f6}.lsp-kpi-history th{font-weight:600;color:#374151}';

  function loadJSON(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch(e) { return fallback; }
  }

  function saveJSON(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  window.renderKPIDashboardPanel = function(findings) {
    findings = findings || [];

    if (!document.getElementById(STYLE_ID)) {
      var style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    var now = Date.now();
    var lastRender = localStorage.getItem(LAST_RENDER_KEY);
    var scanDuration = 'N/A';
    if (lastRender) {
      var diff = now - parseInt(lastRender, 10);
      if (!isNaN(diff) && diff > 0) {
        scanDuration = Math.round(diff / 1000) + 's';
      }
    }
    localStorage.setItem(LAST_RENDER_KEY, String(now));

    // Record this scan
    var stats = loadJSON(STATS_KEY, []);
    var criticalCount = findings.filter(function(f) { return (f.severity || '').toLowerCase() === 'critical'; }).length;
    var categoriesFound = [];
    findings.forEach(function(f) {
      var cat = (f.category || 'unknown').toLowerCase();
      if (categoriesFound.indexOf(cat) === -1) categoriesFound.push(cat);
    });

    var entry = {
      date: new Date().toISOString(),
      findingsCount: findings.length,
      criticalCount: criticalCount,
      categoriesFound: categoriesFound,
      scanDuration: scanDuration
    };
    stats.push(entry);
    saveJSON(STATS_KEY, stats);

    var isFirst = stats.length === 1;

    // Build panel
    var panel = document.createElement('div');
    panel.className = 'lsp-kpi-panel';

    var header = document.createElement('div');
    header.className = 'lsp-kpi-header';
    header.innerHTML = '<h3>\uD83D\uDCCA KPI Dashboard</h3><span class="toggle">\u25BC</span>';

    var body = document.createElement('div');
    body.className = 'lsp-kpi-body';

    var collapsed = false;
    header.addEventListener('click', function() {
      collapsed = !collapsed;
      body.classList.toggle('hidden', collapsed);
      header.querySelector('.toggle').classList.toggle('collapsed', collapsed);
    });

    if (isFirst) {
      var firstMsg = document.createElement('div');
      firstMsg.className = 'lsp-kpi-first';
      firstMsg.textContent = '\uD83C\uDF1F First scan recorded! Stats will build over time.';
      body.appendChild(firstMsg);
    }

    // Compute aggregates
    var totalScans = stats.length;
    var totalFindings = stats.reduce(function(sum, s) { return sum + s.findingsCount; }, 0);
    var avgFindings = totalScans > 0 ? (totalFindings / totalScans).toFixed(1) : '0';

    // Most common category
    var catCounts = {};
    stats.forEach(function(s) {
      (s.categoriesFound || []).forEach(function(c) {
        catCounts[c] = (catCounts[c] || 0) + 1;
      });
    });
    var mostCommonCat = 'N/A';
    var maxCatCount = 0;
    Object.keys(catCounts).forEach(function(c) {
      if (catCounts[c] > maxCatCount) { maxCatCount = catCounts[c]; mostCommonCat = c; }
    });

    // KPI Grid
    var grid = document.createElement('div');
    grid.className = 'lsp-kpi-grid';

    var cards = [
      { value: totalScans, label: 'Total Scans' },
      { value: totalFindings, label: 'Findings Analyzed' },
      { value: avgFindings, label: 'Avg Findings/Scan' },
      { value: mostCommonCat, label: 'Most Common Category' }
    ];

    cards.forEach(function(c) {
      var card = document.createElement('div');
      card.className = 'lsp-kpi-card';
      card.innerHTML = '<div class="lsp-kpi-card-value">' + c.value + '</div><div class="lsp-kpi-card-label">' + c.label + '</div>';
      grid.appendChild(card);
    });
    body.appendChild(grid);

    // Weekly trend
    var nowDate = new Date();
    var dayOfWeek = nowDate.getDay();
    var startOfThisWeek = new Date(nowDate);
    startOfThisWeek.setDate(startOfThisWeek.getDate() - dayOfWeek);
    startOfThisWeek.setHours(0, 0, 0, 0);
    var startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    var thisWeekStats = stats.filter(function(s) { return new Date(s.date).getTime() >= startOfThisWeek.getTime(); });
    var lastWeekStats = stats.filter(function(s) {
      var t = new Date(s.date).getTime();
      return t >= startOfLastWeek.getTime() && t < startOfThisWeek.getTime();
    });

    if (lastWeekStats.length > 0 || thisWeekStats.length > 1) {
      var trend = document.createElement('div');
      trend.className = 'lsp-kpi-trend';
      trend.innerHTML = '<h4>\uD83D\uDCC8 Weekly Trend</h4>';

      var twFindings = thisWeekStats.reduce(function(s, e) { return s + e.findingsCount; }, 0);
      var lwFindings = lastWeekStats.reduce(function(s, e) { return s + e.findingsCount; }, 0);

      var row1 = document.createElement('div');
      row1.className = 'lsp-kpi-trend-row';
      row1.innerHTML = '<span>This week: ' + thisWeekStats.length + ' scans, ' + twFindings + ' findings</span>';
      trend.appendChild(row1);

      if (lastWeekStats.length > 0) {
        var row2 = document.createElement('div');
        row2.className = 'lsp-kpi-trend-row';
        row2.innerHTML = '<span>Last week: ' + lastWeekStats.length + ' scans, ' + lwFindings + ' findings</span>';
        trend.appendChild(row2);

        var change = twFindings - lwFindings;
        var row3 = document.createElement('div');
        row3.className = 'lsp-kpi-trend-row';
        row3.innerHTML = '<span>Change: ' + (change >= 0 ? '+' : '') + change + ' findings</span>';
        trend.appendChild(row3);
      }
      body.appendChild(trend);
    }

    // Scan history table
    if (stats.length > 1) {
      var histDiv = document.createElement('div');
      histDiv.className = 'lsp-kpi-history';
      var table = '<table><tr><th>Date</th><th>Findings</th><th>Critical</th><th>Duration</th></tr>';
      var recentStats = stats.slice(-10).reverse();
      recentStats.forEach(function(s) {
        var d = new Date(s.date);
        var dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
        table += '<tr><td>' + dateStr + '</td><td>' + s.findingsCount + '</td><td>' + s.criticalCount + '</td><td>' + s.scanDuration + '</td></tr>';
      });
      table += '</table>';
      histDiv.innerHTML = table;
      body.appendChild(histDiv);
    }

    panel.appendChild(header);
    panel.appendChild(body);

    return panel;
  };
})();
