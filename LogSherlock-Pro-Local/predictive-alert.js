(function() {
  'use strict';

  var STYLE_ID = 'logsherlock-predictive-alert-style';
  var LS_PREFIX = 'logsherlock_pred_';

  var DEFAULT_THRESHOLDS = {
    disk: 100,
    memory_free: 0,
    queue: 1000,
    cpu: 100,
    connections: 10000,
    load: 100
  };

  // Patterns to extract numeric metrics from finding text
  var METRIC_PATTERNS = [
    { name: 'disk', regex: /(?:disk|storage|filesystem)\s*(?:usage|used|utilization)?[:\s]*(\d+(?:\.\d+)?)\s*%/i, unit: '%', threshold: 100, direction: 'up' },
    { name: 'disk', regex: /(\d+(?:\.\d+)?)\s*%\s*(?:disk|storage|full)/i, unit: '%', threshold: 100, direction: 'up' },
    { name: 'memory_free', regex: /(?:free|available)\s*(?:memory|mem|ram)[:\s]*(\d+(?:\.\d+)?)\s*(?:MB|GB|KB)/i, unit: 'MB', threshold: 0, direction: 'down' },
    { name: 'memory_used', regex: /(?:memory|mem|ram)\s*(?:usage|used|utilization)[:\s]*(\d+(?:\.\d+)?)\s*%/i, unit: '%', threshold: 100, direction: 'up' },
    { name: 'queue', regex: /(?:queue|backlog)\s*(?:depth|size|length)?[:\s]*(\d+)/i, unit: 'items', threshold: 1000, direction: 'up' },
    { name: 'cpu', regex: /(?:cpu|processor)\s*(?:usage|load|utilization)?[:\s]*(\d+(?:\.\d+)?)\s*%/i, unit: '%', threshold: 100, direction: 'up' },
    { name: 'cpu', regex: /(\d+(?:\.\d+)?)\s*%\s*(?:cpu|processor)/i, unit: '%', threshold: 100, direction: 'up' },
    { name: 'connections', regex: /(?:connections?|conn)\s*(?:count|active)?[:\s]*(\d+)/i, unit: 'conns', threshold: 10000, direction: 'up' },
    { name: 'load', regex: /(?:load\s*average|loadavg)[:\s]*(\d+(?:\.\d+)?)/i, unit: '', threshold: 100, direction: 'up' },
    { name: 'latency', regex: /(?:latency|response\s*time)[:\s]*(\d+(?:\.\d+)?)\s*(?:ms|sec)/i, unit: 'ms', threshold: 5000, direction: 'up' }
  ];

  var CSS = `
    .pa-panel { border: 1px solid #334155; border-radius: 8px; margin: 12px 0; background: #1e293b; font-family: 'Segoe UI', sans-serif; }
    .pa-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer; background: #0f172a; border-radius: 8px 8px 0 0; user-select: none; }
    .pa-header h3 { margin: 0; color: #e2e8f0; font-size: 15px; }
    .pa-header .pa-toggle { color: #94a3b8; font-size: 18px; transition: transform 0.2s; }
    .pa-header .pa-toggle.collapsed { transform: rotate(-90deg); }
    .pa-body { padding: 16px; }
    .pa-body.hidden { display: none; }
    .pa-metric-card { border: 1px solid #334155; border-radius: 6px; padding: 12px; margin-bottom: 12px; background: #0f172a; }
    .pa-metric-name { font-size: 14px; font-weight: 600; color: #e2e8f0; margin-bottom: 8px; text-transform: capitalize; }
    .pa-metric-detail { font-size: 12px; color: #94a3b8; margin: 4px 0; }
    .pa-metric-detail strong { color: #e2e8f0; }
    .pa-alert { padding: 8px 12px; border-radius: 4px; font-size: 13px; margin-top: 8px; font-weight: 500; }
    .pa-alert-danger { background: rgba(220,38,38,0.15); border: 1px solid #dc2626; color: #fca5a5; }
    .pa-alert-warning { background: rgba(202,138,4,0.15); border: 1px solid #ca8a04; color: #fde047; }
    .pa-alert-ok { background: rgba(34,197,94,0.15); border: 1px solid #22c55e; color: #86efac; }
    .pa-no-data { color: #64748b; text-align: center; padding: 24px; font-style: italic; }
    .pa-data-points { font-size: 11px; color: #64748b; margin-top: 4px; }
    .pa-trend-line { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
    .pa-trend-indicator { font-size: 16px; }
    .pa-threshold-config { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; padding: 10px; border: 1px solid #334155; border-radius: 6px; background: #0f172a; }
    .pa-threshold-config label { font-size: 11px; color: #94a3b8; display: flex; flex-direction: column; gap: 2px; }
    .pa-threshold-config input { width: 70px; padding: 3px 5px; border: 1px solid #475569; border-radius: 3px; background: #1e293b; color: #e2e8f0; font-size: 12px; }
    .pa-config-title { font-size: 12px; color: #94a3b8; margin-bottom: 6px; font-weight: 600; }
    .pa-stats { font-size: 12px; color: #94a3b8; margin-bottom: 10px; }
    .pa-insufficient { color: #64748b; font-style: italic; font-size: 12px; padding: 8px; border: 1px dashed #475569; border-radius: 4px; margin-top: 6px; }
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

  function extractMetrics(findings) {
    var metrics = {};

    findings.forEach(function(f) {
      var ts = parseTs(f.timestamp);
      if (!ts) return;
      var text = f.text || '';

      METRIC_PATTERNS.forEach(function(pattern) {
        var match = text.match(pattern.regex);
        if (match) {
          var value = parseFloat(match[1]);
          if (isNaN(value)) return;
          if (!metrics[pattern.name]) {
            metrics[pattern.name] = { points: [], unit: pattern.unit, threshold: pattern.threshold, direction: pattern.direction };
          }
          metrics[pattern.name].points.push({ timestamp: ts.getTime(), value: value });
        }
      });
    });

    return metrics;
  }

  function linearRegression(points) {
    var n = points.length;
    if (n < 2) return null;

    // Normalize timestamps to hours from first point for numerical stability
    var t0 = points[0].timestamp;
    var sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    points.forEach(function(p) {
      var x = (p.timestamp - t0) / 3600000; // hours
      var y = p.value;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    });

    var denom = n * sumXX - sumX * sumX;
    if (Math.abs(denom) < 1e-10) return null;

    var slope = (n * sumXY - sumX * sumY) / denom;
    var intercept = (sumY - slope * sumX) / n;

    // R-squared
    var meanY = sumY / n;
    var ssTotal = 0, ssResidual = 0;
    points.forEach(function(p) {
      var x = (p.timestamp - t0) / 3600000;
      var predicted = slope * x + intercept;
      ssTotal += (p.value - meanY) * (p.value - meanY);
      ssResidual += (p.value - predicted) * (p.value - predicted);
    });
    var rSquared = ssTotal === 0 ? 0 : 1 - (ssResidual / ssTotal);

    return {
      slope: slope,
      intercept: intercept,
      rSquared: rSquared,
      t0: t0
    };
  }

  function projectBreachTime(regression, threshold, direction, lastPoint) {
    if (!regression) return null;
    // threshold = value we're approaching
    // Find x where y = threshold: x = (threshold - intercept) / slope
    if (Math.abs(regression.slope) < 1e-10) return null;

    // Check direction makes sense
    if (direction === 'up' && regression.slope <= 0) return null;
    if (direction === 'down' && regression.slope >= 0) return null;

    var xHours = (threshold - regression.intercept) / regression.slope;
    var breachTimestamp = regression.t0 + xHours * 3600000;

    // Only return future projections
    if (breachTimestamp <= lastPoint.timestamp) return null;

    return new Date(breachTimestamp);
  }

  function getThresholds() {
    var thresholds = JSON.parse(JSON.stringify(DEFAULT_THRESHOLDS));
    if (typeof localStorage !== 'undefined') {
      var stored = localStorage.getItem(LS_PREFIX + 'thresholds');
      if (stored) {
        try {
          var parsed = JSON.parse(stored);
          Object.keys(parsed).forEach(function(k) {
            thresholds[k] = parsed[k];
          });
        } catch(e) { /* ignore */ }
      }
    }
    return thresholds;
  }

  function saveThresholds(thresholds) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_PREFIX + 'thresholds', JSON.stringify(thresholds));
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  window.renderPredictiveAlertPanel = function(findings) {
    injectStyle();

    var container = document.createElement('div');
    container.className = 'pa-panel';

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
      header.className = 'pa-header';
      header.innerHTML = '<h3>\uD83D\uDCC8 Predictive Alerts</h3><span class="pa-toggle ' + (collapsed ? 'collapsed' : '') + '">\u25BC</span>';
      header.addEventListener('click', function() {
        collapsed = !collapsed;
        saveState();
        render();
      });
      container.appendChild(header);

      if (collapsed) return;

      var body = document.createElement('div');
      body.className = 'pa-body';

      if (!findings || findings.length === 0) {
        body.innerHTML = '<div class="pa-no-data">No findings available for predictive analysis</div>';
        container.appendChild(body);
        return;
      }

      var thresholds = getThresholds();
      var metrics = extractMetrics(findings);
      var metricNames = Object.keys(metrics);

      if (metricNames.length === 0) {
        body.innerHTML = '<div class="pa-no-data">No numeric metrics found in finding text. Predictive analysis requires findings containing values like "disk usage: 85%", "free memory: 512MB", "queue depth: 150", etc.</div>';
        container.appendChild(body);
        return;
      }

      // Threshold configuration
      var configDiv = document.createElement('div');
      configDiv.className = 'pa-threshold-config';
      configDiv.innerHTML = '<div class="pa-config-title" style="width:100%;">\u2699\uFE0F Thresholds (configurable)</div>';

      metricNames.forEach(function(name) {
        var th = thresholds[name] !== undefined ? thresholds[name] : metrics[name].threshold;
        var label = document.createElement('label');
        label.innerHTML = escapeHtml(name) + '<input type="number" data-metric="' + escapeHtml(name) + '" value="' + th + '">';
        configDiv.appendChild(label);
      });
      body.appendChild(configDiv);

      // Stats
      var stats = document.createElement('div');
      stats.className = 'pa-stats';
      stats.textContent = '\uD83D\uDCCA ' + metricNames.length + ' metric type(s) detected from ' + findings.length + ' findings';
      body.appendChild(stats);

      // Metric cards
      metricNames.forEach(function(name) {
        var metric = metrics[name];
        var card = document.createElement('div');
        card.className = 'pa-metric-card';

        var title = document.createElement('div');
        title.className = 'pa-metric-name';
        title.textContent = '\uD83D\uDCCF ' + name.replace(/_/g, ' ');
        card.appendChild(title);

        var pointsSorted = metric.points.slice().sort(function(a, b) { return a.timestamp - b.timestamp; });
        var latestValue = pointsSorted[pointsSorted.length - 1].value;
        var earliestValue = pointsSorted[0].value;

        var detail1 = document.createElement('div');
        detail1.className = 'pa-metric-detail';
        detail1.innerHTML = 'Data points: <strong>' + pointsSorted.length + '</strong> | Latest: <strong>' + latestValue + ' ' + escapeHtml(metric.unit) + '</strong> | First: <strong>' + earliestValue + ' ' + escapeHtml(metric.unit) + '</strong>';
        card.appendChild(detail1);

        if (pointsSorted.length < 3) {
          var insufficient = document.createElement('div');
          insufficient.className = 'pa-insufficient';
          insufficient.textContent = 'Insufficient data for prediction (need at least 3 data points, have ' + pointsSorted.length + ')';
          card.appendChild(insufficient);
        } else {
          var reg = linearRegression(pointsSorted);

          if (reg) {
            var trendDir = reg.slope > 0 ? '\u2191' : (reg.slope < 0 ? '\u2193' : '\u2192');
            var trendEmoji = reg.slope > 0 ? '\uD83D\uDCC8' : (reg.slope < 0 ? '\uD83D\uDCC9' : '\u27A1\uFE0F');

            var eqn = document.createElement('div');
            eqn.className = 'pa-metric-detail';
            eqn.innerHTML = 'Trend: <strong>' + trendEmoji + ' y = ' + reg.slope.toFixed(4) + 'x + ' + reg.intercept.toFixed(2) + '</strong> (x in hours from first observation)';
            card.appendChild(eqn);

            var conf = document.createElement('div');
            conf.className = 'pa-metric-detail';
            conf.innerHTML = 'R\u00B2 confidence: <strong>' + (reg.rSquared * 100).toFixed(1) + '%</strong>';
            card.appendChild(conf);

            var th = thresholds[name] !== undefined ? thresholds[name] : metric.threshold;
            var breach = projectBreachTime(reg, th, metric.direction, pointsSorted[pointsSorted.length - 1]);

            if (breach) {
              var now = new Date();
              var hoursUntil = (breach.getTime() - now.getTime()) / 3600000;
              var alertClass = hoursUntil < 6 ? 'pa-alert-danger' : (hoursUntil < 24 ? 'pa-alert-warning' : 'pa-alert-ok');
              var alertDiv = document.createElement('div');
              alertDiv.className = 'pa-alert ' + alertClass;

              var timeStr;
              if (hoursUntil < 1) {
                timeStr = Math.round(hoursUntil * 60) + ' minutes';
              } else if (hoursUntil < 48) {
                timeStr = hoursUntil.toFixed(1) + ' hours';
              } else {
                timeStr = (hoursUntil / 24).toFixed(1) + ' days';
              }

              alertDiv.innerHTML = '\u26A0\uFE0F Projected threshold breach (' + th + ' ' + escapeHtml(metric.unit) + ') in <strong>' + timeStr + '</strong> — ' + breach.toISOString();
              card.appendChild(alertDiv);
            } else {
              var safeDiv = document.createElement('div');
              safeDiv.className = 'pa-alert pa-alert-ok';
              safeDiv.textContent = '\u2705 Trend does not project a threshold breach (threshold: ' + th + ' ' + metric.unit + ')';
              card.appendChild(safeDiv);
            }
          }
        }

        // Data points list
        var dpDiv = document.createElement('div');
        dpDiv.className = 'pa-data-points';
        dpDiv.textContent = 'Points: ' + pointsSorted.map(function(p) { return p.value + ' @ ' + new Date(p.timestamp).toLocaleString(); }).join(' \u2192 ');
        card.appendChild(dpDiv);

        body.appendChild(card);
      });

      container.appendChild(body);

      // Attach threshold change listeners
      var inputs = container.querySelectorAll('.pa-threshold-config input[data-metric]');
      for (var i = 0; i < inputs.length; i++) {
        inputs[i].addEventListener('change', function(e) {
          var metricName = e.target.getAttribute('data-metric');
          var val = parseFloat(e.target.value);
          if (!isNaN(val)) {
            thresholds[metricName] = val;
            saveThresholds(thresholds);
            render();
          }
        });
      }
    }

    render();
    return container;
  };

})();
