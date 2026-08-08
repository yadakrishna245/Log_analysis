/**
 * LogSherlock Pro — Executive Summary Panel
 * Generates a non-technical one-page summary for management/stakeholders
 */
(function () {
  'use strict';

  var STYLE_ID = 'lsp-executive-summary-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.lsp-exec-panel { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; border: 1px solid #e0e0e0; border-radius: 8px; margin: 16px 0; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }',
      '.lsp-exec-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; cursor: pointer; background: #f8f9fa; border-radius: 8px 8px 0 0; user-select: none; }',
      '.lsp-exec-header h2 { margin: 0; font-size: 18px; }',
      '.lsp-exec-header .lsp-toggle { font-size: 14px; color: #666; }',
      '.lsp-exec-body { padding: 20px; }',
      '.lsp-exec-body.collapsed { display: none; }',
      '.lsp-exec-status { padding: 12px 16px; border-radius: 6px; font-size: 16px; font-weight: 600; margin-bottom: 16px; }',
      '.lsp-exec-status.critical { background: #fdecea; color: #b71c1c; }',
      '.lsp-exec-status.warning { background: #fff8e1; color: #e65100; }',
      '.lsp-exec-status.healthy { background: #e8f5e9; color: #1b5e20; }',
      '.lsp-exec-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 18px; }',
      '.lsp-exec-metric { background: #f5f5f5; padding: 12px; border-radius: 6px; text-align: center; }',
      '.lsp-exec-metric .val { font-size: 24px; font-weight: 700; color: #1a237e; }',
      '.lsp-exec-metric .label { font-size: 12px; color: #666; margin-top: 4px; }',
      '.lsp-exec-section { margin-bottom: 16px; }',
      '.lsp-exec-section h3 { font-size: 14px; color: #444; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px; }',
      '.lsp-exec-issue { padding: 10px 14px; background: #fafafa; border-left: 3px solid #e53935; margin-bottom: 8px; border-radius: 0 4px 4px 0; }',
      '.lsp-exec-issue.high { border-left-color: #ff9800; }',
      '.lsp-exec-issue.medium { border-left-color: #ffc107; }',
      '.lsp-exec-issue.low { border-left-color: #4caf50; }',
      '.lsp-exec-recommendation { padding: 12px 16px; background: #e3f2fd; border-radius: 6px; font-weight: 500; }',
      '.lsp-exec-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }',
      '.lsp-exec-actions button { padding: 8px 14px; border: 1px solid #ccc; border-radius: 4px; background: #fff; cursor: pointer; font-size: 13px; }',
      '.lsp-exec-actions button:hover { background: #f0f0f0; }',
      '.lsp-exec-timestamp { font-size: 11px; color: #999; margin-top: 12px; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function getSeverityWeight(sev) {
    var s = (sev || '').toLowerCase();
    if (s === 'critical') return 4;
    if (s === 'high') return 3;
    if (s === 'medium') return 2;
    if (s === 'low') return 1;
    return 0;
  }

  function determineStatus(findings) {
    var critCount = 0;
    var highCount = 0;
    for (var i = 0; i < findings.length; i++) {
      var sev = (findings[i].severity || '').toLowerCase();
      if (sev === 'critical') critCount++;
      if (sev === 'high') highCount++;
    }
    if (critCount > 0) return { label: 'Critical — Immediate Attention Required', cls: 'critical' };
    if (highCount > 0 || findings.length > 10) return { label: 'Warning — Issues Detected', cls: 'warning' };
    return { label: 'Healthy — System Operating Normally', cls: 'healthy' };
  }

  function getCategories(findings) {
    var cats = {};
    for (var i = 0; i < findings.length; i++) {
      var c = findings[i].category || 'Uncategorized';
      cats[c] = true;
    }
    return Object.keys(cats);
  }

  function getTopIssues(findings, count) {
    var sorted = findings.slice().sort(function (a, b) {
      return getSeverityWeight(b.severity) - getSeverityWeight(a.severity);
    });
    return sorted.slice(0, count);
  }

  function plainEnglish(finding) {
    var text = finding.text || '';
    // Remove technical jargon patterns for exec audience
    var cleaned = text.replace(/\[.*?\]/g, '').replace(/\{.*?\}/g, '').replace(/\d{4}-\d{2}-\d{2}T[\d:.Z]+/g, '').trim();
    if (cleaned.length > 120) cleaned = cleaned.substring(0, 117) + '...';
    return cleaned || 'System issue detected requiring attention';
  }

  function getRiskAssessment(findings) {
    var cats = getCategories(findings);
    var critCount = findings.filter(function (f) { return (f.severity || '').toLowerCase() === 'critical'; }).length;
    var highCount = findings.filter(function (f) { return (f.severity || '').toLowerCase() === 'high'; }).length;
    var spread = cats.length;

    if (critCount >= 3 || (critCount > 0 && spread > 4)) return 'High Risk — Multiple critical issues across several system areas';
    if (critCount > 0 || highCount >= 3) return 'Elevated Risk — Critical or numerous high-priority issues present';
    if (highCount > 0 || spread > 3) return 'Moderate Risk — Some concerns requiring monitoring';
    if (findings.length > 0) return 'Low Risk — Minor issues detected, no immediate threat';
    return 'Minimal Risk — No significant issues identified';
  }

  function getRecommendation(findings) {
    var critCount = findings.filter(function (f) { return (f.severity || '').toLowerCase() === 'critical'; }).length;
    var highCount = findings.filter(function (f) { return (f.severity || '').toLowerCase() === 'high'; }).length;
    if (critCount > 0) return 'Immediate action required — Critical issues must be addressed before they impact operations.';
    if (highCount > 0) return 'Monitor closely — High-priority issues should be resolved within the current sprint.';
    return 'System healthy — Continue routine monitoring. No urgent action needed.';
  }

  function generateTextReport(findings, scanTime) {
    var status = determineStatus(findings);
    var cats = getCategories(findings);
    var topIssues = getTopIssues(findings, 3);
    var lines = [];
    lines.push('EXECUTIVE SUMMARY — LOG ANALYSIS REPORT');
    lines.push('Generated: ' + scanTime);
    lines.push('');
    lines.push('STATUS: ' + status.label);
    lines.push('');
    lines.push('KEY METRICS:');
    lines.push('  Total Findings: ' + findings.length);
    lines.push('  Critical Issues: ' + findings.filter(function (f) { return (f.severity || '').toLowerCase() === 'critical'; }).length);
    lines.push('  Categories Affected: ' + cats.length);
    lines.push('');
    lines.push('TOP ISSUES:');
    for (var i = 0; i < topIssues.length; i++) {
      lines.push('  ' + (i + 1) + '. [' + (topIssues[i].severity || 'Unknown').toUpperCase() + '] ' + plainEnglish(topIssues[i]));
    }
    lines.push('');
    lines.push('RISK ASSESSMENT: ' + getRiskAssessment(findings));
    lines.push('');
    lines.push('RECOMMENDATION: ' + getRecommendation(findings));
    return lines.join('\n');
  }

  function generateHtmlReport(findings, scanTime) {
    var status = determineStatus(findings);
    var cats = getCategories(findings);
    var topIssues = getTopIssues(findings, 3);
    var critCount = findings.filter(function (f) { return (f.severity || '').toLowerCase() === 'critical'; }).length;

    var issuesHtml = '';
    for (var i = 0; i < topIssues.length; i++) {
      issuesHtml += '<li><strong>' + (topIssues[i].severity || 'Unknown').toUpperCase() + ':</strong> ' + plainEnglish(topIssues[i]) + '</li>';
    }

    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Executive Summary - Log Analysis</title>' +
      '<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#333;}' +
      'h1{color:#1a237e;border-bottom:2px solid #1a237e;padding-bottom:10px;}' +
      '.status{padding:12px;border-radius:6px;font-weight:bold;margin:16px 0;}' +
      '.critical{background:#fdecea;color:#b71c1c;}.warning{background:#fff8e1;color:#e65100;}.healthy{background:#e8f5e9;color:#1b5e20;}' +
      '.metrics{display:flex;gap:20px;margin:16px 0;}.metric{background:#f5f5f5;padding:16px;border-radius:6px;text-align:center;flex:1;}' +
      '.metric .val{font-size:28px;font-weight:bold;color:#1a237e;}.metric .lbl{font-size:12px;color:#666;}' +
      '</style></head><body>' +
      '<h1>Executive Summary — Log Analysis Report</h1>' +
      '<p><em>Generated: ' + scanTime + '</em></p>' +
      '<div class="status ' + status.cls + '">' + status.label + '</div>' +
      '<div class="metrics"><div class="metric"><div class="val">' + findings.length + '</div><div class="lbl">Total Findings</div></div>' +
      '<div class="metric"><div class="val">' + critCount + '</div><div class="lbl">Critical</div></div>' +
      '<div class="metric"><div class="val">' + cats.length + '</div><div class="lbl">Categories</div></div></div>' +
      '<h2>Top Issues</h2><ol>' + issuesHtml + '</ol>' +
      '<h2>Risk Assessment</h2><p>' + getRiskAssessment(findings) + '</p>' +
      '<h2>Recommendation</h2><p><strong>' + getRecommendation(findings) + '</strong></p>' +
      '</body></html>';
  }

  function downloadFile(content, filename, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  window.renderExecutiveSummaryPanel = function (findings) {
    injectStyles();
    findings = findings || [];
    var scanTime = new Date().toLocaleString();

    var container = document.createElement('div');
    container.className = 'lsp-exec-panel';

    var status = determineStatus(findings);
    var cats = getCategories(findings);
    var topIssues = getTopIssues(findings, 3);
    var critCount = findings.filter(function (f) { return (f.severity || '').toLowerCase() === 'critical'; }).length;

    var headerEl = document.createElement('div');
    headerEl.className = 'lsp-exec-header';
    headerEl.innerHTML = '<h2>📊 Executive Summary</h2><span class="lsp-toggle">▼</span>';

    var bodyEl = document.createElement('div');
    bodyEl.className = 'lsp-exec-body';

    // Status
    var statusHtml = '<div class="lsp-exec-status ' + status.cls + '">' + status.label + '</div>';

    // Metrics
    var metricsHtml = '<div class="lsp-exec-metrics">' +
      '<div class="lsp-exec-metric"><div class="val">' + findings.length + '</div><div class="label">Total Findings</div></div>' +
      '<div class="lsp-exec-metric"><div class="val">' + critCount + '</div><div class="label">Critical Issues</div></div>' +
      '<div class="lsp-exec-metric"><div class="val">' + cats.length + '</div><div class="label">Categories Affected</div></div>' +
      '<div class="lsp-exec-metric"><div class="val">' + (critCount > 0 ? 'Urgent' : (findings.length > 5 ? 'High' : 'Normal')) + '</div><div class="label">Resolution Priority</div></div>' +
      '</div>';

    // Top Issues
    var issuesHtml = '<div class="lsp-exec-section"><h3>Top Issues</h3>';
    if (topIssues.length === 0) {
      issuesHtml += '<p>No issues found — system is operating normally.</p>';
    } else {
      for (var i = 0; i < topIssues.length; i++) {
        var sevCls = (topIssues[i].severity || '').toLowerCase();
        issuesHtml += '<div class="lsp-exec-issue ' + sevCls + '"><strong>' + (i + 1) + '.</strong> ' + plainEnglish(topIssues[i]) + '</div>';
      }
    }
    issuesHtml += '</div>';

    // Risk Assessment
    var riskHtml = '<div class="lsp-exec-section"><h3>Risk Assessment</h3><p>' + getRiskAssessment(findings) + '</p></div>';

    // Recommendation
    var recHtml = '<div class="lsp-exec-recommendation">' + getRecommendation(findings) + '</div>';

    // Actions
    var actionsHtml = '<div class="lsp-exec-actions">' +
      '<button data-action="copy">📋 Copy to Clipboard</button>' +
      '<button data-action="txt">📄 Download .txt</button>' +
      '<button data-action="html">🌐 Download .html (PDF-ready)</button>' +
      '</div>';

    var timestampHtml = '<div class="lsp-exec-timestamp">Scan performed: ' + scanTime + '</div>';

    bodyEl.innerHTML = statusHtml + metricsHtml + issuesHtml + riskHtml + recHtml + actionsHtml + timestampHtml;

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

    // Action buttons
    bodyEl.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      if (action === 'copy') {
        var text = generateTextReport(findings, scanTime);
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = '✅ Copied!';
          setTimeout(function () { btn.textContent = '📋 Copy to Clipboard'; }, 2000);
        });
      } else if (action === 'txt') {
        downloadFile(generateTextReport(findings, scanTime), 'executive-summary-' + Date.now() + '.txt', 'text/plain');
      } else if (action === 'html') {
        downloadFile(generateHtmlReport(findings, scanTime), 'executive-summary-' + Date.now() + '.html', 'text/html');
      }
    });

    return container;
  };
})();
