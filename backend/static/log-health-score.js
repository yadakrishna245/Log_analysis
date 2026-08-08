(function() {
  'use strict';

  var STYLE_ID = 'lsp-health-score-styles';
  var LS_KEY = 'lsp_health_scores';

  function injectStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.lsp-hs-panel{background:#1e1e2e;border:1px solid #3a3a5a;border-radius:8px;margin:10px 0;font-family:monospace;color:#cdd6f4}' +
      '.lsp-hs-header{padding:12px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:#2a2a3e;border-radius:8px 8px 0 0}' +
      '.lsp-hs-header:hover{background:#3a3a5a}' +
      '.lsp-hs-header h3{margin:0;font-size:16px}' +
      '.lsp-hs-body{padding:16px;display:none}' +
      '.lsp-hs-body.open{display:block}' +
      '.lsp-hs-gauge-wrap{display:flex;flex-direction:column;align-items:center;margin-bottom:20px}' +
      '.lsp-hs-gauge{position:relative;width:180px;height:180px;border-radius:50%;display:flex;align-items:center;justify-content:center}' +
      '.lsp-hs-gauge-inner{width:140px;height:140px;background:#1e1e2e;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-direction:column}' +
      '.lsp-hs-score{font-size:42px;font-weight:bold}' +
      '.lsp-hs-label{font-size:12px;color:#a6adc8;margin-top:4px}' +
      '.lsp-hs-trend{margin-top:10px;font-size:14px;padding:4px 12px;border-radius:4px}' +
      '.lsp-hs-trend-improving{background:#a6e3a1;color:#1e1e2e}' +
      '.lsp-hs-trend-declining{background:#f38ba8;color:#1e1e2e}' +
      '.lsp-hs-trend-stable{background:#89b4fa;color:#1e1e2e}' +
      '.lsp-hs-breakdown{margin-top:16px}' +
      '.lsp-hs-breakdown h4{margin:0 0 8px 0;font-size:14px;color:#a6adc8}' +
      '.lsp-hs-brow{display:flex;justify-content:space-between;padding:4px 8px;border-bottom:1px solid #2a2a3e;font-size:13px}' +
      '.lsp-hs-ded{color:#f38ba8}' +
      '.lsp-hs-chevron{transition:transform 0.2s}' +
      '.lsp-hs-chevron.open{transform:rotate(180deg)}';
    document.head.appendChild(style);
  }

  function getScoreColor(score) {
    if (score <= 30) return '#f38ba8';
    if (score <= 60) return '#fab387';
    if (score <= 80) return '#f9e2af';
    return '#a6e3a1';
  }

  function loadHistory() {
    if (typeof localStorage === 'undefined') return [];
    try {
      var data = localStorage.getItem(LS_KEY);
      return data ? JSON.parse(data) : [];
    } catch(e) { return []; }
  }

  function saveHistory(history) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(history));
    } catch(e) {}
  }

  function getTrend(history, currentScore) {
    if (history.length < 2) return 'Stable';
    var prev = history[history.length - 2].score;
    if (currentScore > prev + 5) return 'Improving';
    if (currentScore < prev - 5) return 'Declining';
    return 'Stable';
  }

  function renderLogHealthScorePanel(findings) {
    if (typeof document === 'undefined') return;
    injectStyles();

    var container = document.getElementById('lsp-hs-panel');
    if (!container) {
      container = document.createElement('div');
      container.id = 'lsp-hs-panel';
      document.body.appendChild(container);
    }

    var items = Array.isArray(findings) ? findings : [];
    var score = 100;
    var deductions = {};
    var sevWeights = { 'CRITICAL': 15, 'HIGH': 8, 'MEDIUM': 3, 'LOW': 1 };

    items.forEach(function(f) {
      var sev = (f.severity || 'LOW').toUpperCase();
      var weight = sevWeights[sev] || 1;
      var cat = f.category || 'Uncategorized';
      if (!deductions[cat]) deductions[cat] = 0;
      deductions[cat] += weight;
      score -= weight;
    });

    var maxLine = 0;
    items.forEach(function(f) {
      if (f.line && f.line > maxLine) maxLine = f.line;
    });
    if (maxLine > 0 && (items.length / maxLine) > 0.1) {
      score -= 10;
      if (!deductions['Density Penalty']) deductions['Density Penalty'] = 0;
      deductions['Density Penalty'] += 10;
    }

    score = Math.max(0, score);

    var history = loadHistory();
    history.push({ score: score, timestamp: new Date().toISOString(), findings: items.length });
    if (history.length > 50) history = history.slice(-50);
    saveHistory(history);

    var trend = getTrend(history, score);
    var color = getScoreColor(score);
    var conic = 'conic-gradient(' + color + ' 0% ' + score + '%, #3a3a5a ' + score + '% 100%)';
    var trendClass = 'lsp-hs-trend-' + trend.toLowerCase();

    var html = '<div class="lsp-hs-panel">';
    html += '<div class="lsp-hs-header" id="lsp-hs-toggle"><h3>\uD83D\uDC8A Log Health Score</h3>';
    html += '<span class="lsp-hs-chevron" id="lsp-hs-chevron">\u25BC</span></div>';
    html += '<div class="lsp-hs-body open" id="lsp-hs-body">';
    html += '<div class="lsp-hs-gauge-wrap">';
    html += '<div class="lsp-hs-gauge" style="background:' + conic + ';">';
    html += '<div class="lsp-hs-gauge-inner">';
    html += '<span class="lsp-hs-score" style="color:' + color + ';">' + score + '</span>';
    html += '<span class="lsp-hs-label">/ 100</span>';
    html += '</div></div>';
    html += '<span class="lsp-hs-trend ' + trendClass + '">Trend: ' + trend + '</span></div>';

    html += '<div class="lsp-hs-breakdown"><h4>Deductions by Category</h4>';
    var cats = Object.keys(deductions).sort(function(a, b) { return deductions[b] - deductions[a]; });
    if (cats.length === 0) {
      html += '<div class="lsp-hs-brow"><span>No deductions \u2014 system looks healthy!</span></div>';
    } else {
      cats.forEach(function(cat) {
        html += '<div class="lsp-hs-brow"><span>' + cat + '</span><span class="lsp-hs-ded">-' + deductions[cat] + '</span></div>';
      });
    }
    html += '</div></div></div>';
    container.innerHTML = html;

    var toggle = document.getElementById('lsp-hs-toggle');
    var body = document.getElementById('lsp-hs-body');
    var chevron = document.getElementById('lsp-hs-chevron');
    if (toggle) {
      toggle.addEventListener('click', function() {
        body.classList.toggle('open');
        chevron.classList.toggle('open');
      });
    }
  }

  if (typeof window !== 'undefined') {
    window.renderLogHealthScorePanel = renderLogHealthScorePanel;
  }
})();
