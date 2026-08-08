(function() {
  'use strict';

  var STYLE_ID = 'logsherlock-anomaly-heatmap-style';
  var LS_PREFIX = 'logsherlock_heatmap_';

  var CSS = `
    .ahm-panel { border: 1px solid #334155; border-radius: 8px; margin: 12px 0; background: #1e293b; font-family: 'Segoe UI', sans-serif; }
    .ahm-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer; background: #0f172a; border-radius: 8px 8px 0 0; user-select: none; }
    .ahm-header h3 { margin: 0; color: #e2e8f0; font-size: 15px; }
    .ahm-header .ahm-toggle { color: #94a3b8; font-size: 18px; transition: transform 0.2s; }
    .ahm-header .ahm-toggle.collapsed { transform: rotate(-90deg); }
    .ahm-body { padding: 16px; }
    .ahm-body.hidden { display: none; }
    .ahm-grid-container { overflow-x: auto; }
    .ahm-grid { display: grid; grid-template-columns: 100px repeat(24, 1fr); gap: 2px; min-width: 700px; }
    .ahm-cell { width: 100%; aspect-ratio: 1; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: transparent; cursor: pointer; transition: all 0.15s; min-height: 24px; }
    .ahm-cell:hover { color: #fff; transform: scale(1.2); z-index: 2; box-shadow: 0 0 6px rgba(0,0,0,0.5); }
    .ahm-hour-label { font-size: 11px; color: #94a3b8; display: flex; align-items: center; justify-content: center; }
    .ahm-day-label { font-size: 11px; color: #94a3b8; display: flex; align-items: center; padding-left: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ahm-legend { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 12px; color: #94a3b8; }
    .ahm-legend-swatch { width: 16px; height: 16px; border-radius: 3px; }
    .ahm-no-data { color: #64748b; text-align: center; padding: 24px; font-style: italic; }
    .ahm-stats { color: #94a3b8; font-size: 12px; margin-bottom: 10px; }
  `;

  function injectStyle() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function parseTs(ts) {
    if (!ts) return null;
    var d = new Date(ts);
    if (isNaN(d.getTime())) return null;
    return d;
  }

  function getCellColor(count, maxCount) {
    if (count === 0) return '#1a3a2a';
    if (maxCount === 0) return '#1a3a2a';
    var ratio = count / maxCount;
    if (ratio <= 0.25) return '#365314';
    if (ratio <= 0.5) return '#a16207';
    if (ratio <= 0.75) return '#c2410c';
    return '#dc2626';
  }

  function getDayKey(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  window.renderAnomalyHeatmapPanel = function(findings) {
    injectStyle();

    var container = document.createElement('div');
    container.className = 'ahm-panel';

    // Load collapsed state from localStorage
    var collapsed = false;
    if (typeof localStorage !== 'undefined') {
      collapsed = localStorage.getItem(LS_PREFIX + 'collapsed') === 'true';
    }

    function saveState() {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LS_PREFIX + 'collapsed', String(collapsed));
      }
    }

    function render() {
      container.innerHTML = '';

      // Header
      var header = document.createElement('div');
      header.className = 'ahm-header';
      header.innerHTML = '<h3>\uD83D\uDDFA\uFE0F Anomaly Heatmap</h3><span class="ahm-toggle ' + (collapsed ? 'collapsed' : '') + '">\u25BC</span>';
      header.addEventListener('click', function() {
        collapsed = !collapsed;
        saveState();
        render();
      });
      container.appendChild(header);

      if (collapsed) return;

      var body = document.createElement('div');
      body.className = 'ahm-body';

      // Parse findings with timestamps
      var timedFindings = [];
      if (findings && findings.length) {
        findings.forEach(function(f) {
          var d = parseTs(f.timestamp);
          if (d) {
            timedFindings.push({ date: d, finding: f });
          }
        });
      }

      if (timedFindings.length === 0) {
        body.innerHTML = '<div class="ahm-no-data">No timestamp data available for heatmap</div>';
        container.appendChild(body);
        return;
      }

      // Group by day and hour
      var dayMap = {};
      var maxCount = 0;
      timedFindings.forEach(function(item) {
        var dayKey = getDayKey(item.date);
        var hour = item.date.getHours();
        if (!dayMap[dayKey]) dayMap[dayKey] = {};
        if (!dayMap[dayKey][hour]) dayMap[dayKey][hour] = 0;
        dayMap[dayKey][hour]++;
        if (dayMap[dayKey][hour] > maxCount) maxCount = dayMap[dayKey][hour];
      });

      var days = Object.keys(dayMap).sort();

      // Stats
      var stats = document.createElement('div');
      stats.className = 'ahm-stats';
      stats.textContent = timedFindings.length + ' findings with timestamps across ' + days.length + ' day(s). Peak: ' + maxCount + ' events/hour.';
      body.appendChild(stats);

      // Grid
      var gridContainer = document.createElement('div');
      gridContainer.className = 'ahm-grid-container';

      var grid = document.createElement('div');
      grid.className = 'ahm-grid';

      // Header row: empty corner + hour labels
      var corner = document.createElement('div');
      corner.className = 'ahm-day-label';
      corner.textContent = '';
      grid.appendChild(corner);

      for (var h = 0; h < 24; h++) {
        var hlabel = document.createElement('div');
        hlabel.className = 'ahm-hour-label';
        hlabel.textContent = String(h).padStart(2, '0');
        grid.appendChild(hlabel);
      }

      // Day rows
      days.forEach(function(day) {
        var dayLabel = document.createElement('div');
        dayLabel.className = 'ahm-day-label';
        dayLabel.textContent = day;
        grid.appendChild(dayLabel);

        for (var hour = 0; hour < 24; hour++) {
          var count = (dayMap[day] && dayMap[day][hour]) ? dayMap[day][hour] : 0;
          var cell = document.createElement('div');
          cell.className = 'ahm-cell';
          cell.style.background = getCellColor(count, maxCount);
          cell.textContent = count > 0 ? count : '';
          cell.title = day + ' ' + String(hour).padStart(2, '0') + ':00 — ' + count + ' finding(s)';
          grid.appendChild(cell);
        }
      });

      gridContainer.appendChild(grid);
      body.appendChild(gridContainer);

      // Legend
      var legend = document.createElement('div');
      legend.className = 'ahm-legend';
      legend.innerHTML = '<span>Less</span>' +
        '<span class="ahm-legend-swatch" style="background:#1a3a2a"></span>' +
        '<span class="ahm-legend-swatch" style="background:#365314"></span>' +
        '<span class="ahm-legend-swatch" style="background:#a16207"></span>' +
        '<span class="ahm-legend-swatch" style="background:#c2410c"></span>' +
        '<span class="ahm-legend-swatch" style="background:#dc2626"></span>' +
        '<span>More</span>';
      body.appendChild(legend);

      container.appendChild(body);
    }

    render();
    return container;
  };

})();
