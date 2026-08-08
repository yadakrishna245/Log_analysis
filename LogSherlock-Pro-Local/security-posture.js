/**
 * LogSherlock Pro — Security Posture Panel
 * Filters and categorizes security-relevant findings into domains
 */
(function () {
  'use strict';

  var STYLE_ID = 'lsp-security-posture-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.lsp-secpost-panel { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; border: 1px solid #e0e0e0; border-radius: 8px; margin: 16px 0; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }',
      '.lsp-secpost-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; cursor: pointer; background: #f8f9fa; border-radius: 8px 8px 0 0; user-select: none; }',
      '.lsp-secpost-header h2 { margin: 0; font-size: 18px; }',
      '.lsp-secpost-header .lsp-toggle { font-size: 14px; color: #666; }',
      '.lsp-secpost-body { padding: 20px; }',
      '.lsp-secpost-body.collapsed { display: none; }',
      '.lsp-secpost-grade { text-align: center; margin-bottom: 20px; }',
      '.lsp-secpost-grade .grade { font-size: 64px; font-weight: 800; display: inline-block; width: 90px; height: 90px; line-height: 90px; border-radius: 50%; }',
      '.lsp-secpost-grade .grade-a { background: #e8f5e9; color: #2e7d32; }',
      '.lsp-secpost-grade .grade-b { background: #f1f8e9; color: #558b2f; }',
      '.lsp-secpost-grade .grade-c { background: #fff8e1; color: #f57f17; }',
      '.lsp-secpost-grade .grade-d { background: #fff3e0; color: #e65100; }',
      '.lsp-secpost-grade .grade-f { background: #fdecea; color: #b71c1c; }',
      '.lsp-secpost-grade .grade-label { display: block; margin-top: 8px; font-size: 13px; color: #666; }',
      '.lsp-secpost-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }',
      '.lsp-secpost-table th { background: #f5f5f5; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #555; border-bottom: 2px solid #e0e0e0; }',
      '.lsp-secpost-table td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 13px; }',
      '.lsp-secpost-table tr:hover { background: #fafafa; }',
      '.lsp-secpost-sev { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; }',
      '.lsp-secpost-sev.critical { background: #fdecea; color: #b71c1c; }',
      '.lsp-secpost-sev.high { background: #fff3e0; color: #e65100; }',
      '.lsp-secpost-sev.medium { background: #fff8e1; color: #f57f17; }',
      '.lsp-secpost-sev.low { background: #e8f5e9; color: #2e7d32; }',
      '.lsp-secpost-empty { text-align: center; padding: 30px; color: #4caf50; font-size: 16px; }',
      '.lsp-secpost-actions { margin-top: 16px; }',
      '.lsp-secpost-actions button { padding: 8px 14px; border: 1px solid #ccc; border-radius: 4px; background: #fff; cursor: pointer; font-size: 13px; }',
      '.lsp-secpost-actions button:hover { background: #f0f0f0; }',
      '.lsp-secpost-summary { font-size: 13px; color: #666; margin-bottom: 12px; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  var CATEGORY_KEYWORDS = ['security', 'auth', 'permission', 'ssl', 'tls', 'certificate', 'encryption', 'vulnerability', 'firewall', 'access', 'credential', 'token'];
  var TEXT_KEYWORDS = ['unauthorized', 'denied', 'forbidden', 'brute', 'injection', 'exploit', 'cve-', 'breach', 'malware'];

  var DOMAINS = {
    'Authentication & Access Control': ['auth', 'permission', 'access', 'credential', 'token', 'unauthorized', 'denied', 'forbidden', 'brute'],
    'Encryption & Certificates': ['ssl', 'tls', 'certificate', 'encryption'],
    'Network Security': ['firewall', 'network'],
    'Vulnerability & Exploits': ['vulnerability', 'injection', 'exploit', 'cve-', 'malware'],
    'Data Protection': ['breach', 'data', 'protection']
  };

  function isSecurityFinding(f) {
    var cat = (f.category || '').toLowerCase();
    var text = (f.text || '').toLowerCase();
    for (var i = 0; i < CATEGORY_KEYWORDS.length; i++) {
      if (cat.indexOf(CATEGORY_KEYWORDS[i]) !== -1) return true;
    }
    for (var j = 0; j < TEXT_KEYWORDS.length; j++) {
      if (text.indexOf(TEXT_KEYWORDS[j]) !== -1) return true;
    }
    return false;
  }

  function classifyDomain(f) {
    var cat = (f.category || '').toLowerCase();
    var text = (f.text || '').toLowerCase();
    var combined = cat + ' ' + text;
    var domainNames = Object.keys(DOMAINS);
    for (var i = 0; i < domainNames.length; i++) {
      var keywords = DOMAINS[domainNames[i]];
      for (var k = 0; k < keywords.length; k++) {
        if (combined.indexOf(keywords[k]) !== -1) return domainNames[i];
      }
    }
    return 'Authentication & Access Control'; // default security domain
  }

  function getSeverityWeight(sev) {
    var s = (sev || '').toLowerCase();
    if (s === 'critical') return 4;
    if (s === 'high') return 3;
    if (s === 'medium') return 2;
    if (s === 'low') return 1;
    return 0;
  }

  function highestSeverity(items) {
    var max = 0;
    var label = 'low';
    for (var i = 0; i < items.length; i++) {
      var w = getSeverityWeight(items[i].severity);
      if (w > max) {
        max = w;
        label = (items[i].severity || 'low').toLowerCase();
      }
    }
    return label;
  }

  function calculateGrade(secFindings) {
    if (secFindings.length === 0) return { grade: 'A', label: 'Excellent — No security issues detected' };
    var score = 0;
    for (var i = 0; i < secFindings.length; i++) {
      score += getSeverityWeight(secFindings[i].severity);
    }
    if (score >= 20) return { grade: 'F', label: 'Failing — Critical security concerns' };
    if (score >= 14) return { grade: 'D', label: 'Poor — Significant security gaps' };
    if (score >= 8) return { grade: 'C', label: 'Fair — Multiple security issues' };
    if (score >= 4) return { grade: 'B', label: 'Good — Minor security concerns' };
    return { grade: 'A', label: 'Excellent — Minimal security exposure' };
  }

  function generateAuditReport(secFindings, domainData, gradeInfo, scanTime) {
    var lines = [];
    lines.push('SECURITY AUDIT REPORT — LogSherlock Pro');
    lines.push('Generated: ' + scanTime);
    lines.push('');
    lines.push('SECURITY GRADE: ' + gradeInfo.grade + ' — ' + gradeInfo.label);
    lines.push('Total Security Findings: ' + secFindings.length);
    lines.push('');
    lines.push('DOMAIN BREAKDOWN:');
    lines.push('-'.repeat(70));

    var domainNames = Object.keys(domainData);
    for (var i = 0; i < domainNames.length; i++) {
      var d = domainData[domainNames[i]];
      lines.push('');
      lines.push(domainNames[i]);
      lines.push('  Findings: ' + d.count);
      lines.push('  Highest Severity: ' + d.highestSev.toUpperCase());
      if (d.sample) {
        lines.push('  Sample: ' + d.sample);
      }
    }

    lines.push('');
    lines.push('-'.repeat(70));
    lines.push('ALL SECURITY FINDINGS:');
    for (var j = 0; j < secFindings.length; j++) {
      lines.push('  [' + (secFindings[j].severity || 'unknown').toUpperCase() + '] ' + (secFindings[j].text || '').substring(0, 100));
    }
    return lines.join('\n');
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

  window.renderSecurityPosturePanel = function (findings) {
    injectStyles();
    findings = findings || [];
    var scanTime = new Date().toLocaleString();

    var container = document.createElement('div');
    container.className = 'lsp-secpost-panel';

    var headerEl = document.createElement('div');
    headerEl.className = 'lsp-secpost-header';
    headerEl.innerHTML = '<h2>🛡️ Security Posture</h2><span class="lsp-toggle">▼</span>';

    var bodyEl = document.createElement('div');
    bodyEl.className = 'lsp-secpost-body';

    // Filter security findings
    var secFindings = findings.filter(isSecurityFinding);

    if (secFindings.length === 0) {
      bodyEl.innerHTML = '<div class="lsp-secpost-empty">✅ No security-related findings detected in this scan ✓</div>';
      container.appendChild(headerEl);
      container.appendChild(bodyEl);
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
      return container;
    }

    // Classify into domains
    var domainData = {};
    var domainNames = Object.keys(DOMAINS);
    for (var d = 0; d < domainNames.length; d++) {
      domainData[domainNames[d]] = { count: 0, highestSev: 'low', items: [], sample: '' };
    }

    for (var i = 0; i < secFindings.length; i++) {
      var domain = classifyDomain(secFindings[i]);
      if (!domainData[domain]) {
        domainData[domain] = { count: 0, highestSev: 'low', items: [], sample: '' };
      }
      domainData[domain].count++;
      domainData[domain].items.push(secFindings[i]);
    }

    // Calculate highest severity and sample for each domain
    var activeDomains = [];
    for (var dn = 0; dn < domainNames.length; dn++) {
      var dd = domainData[domainNames[dn]];
      if (dd.count > 0) {
        dd.highestSev = highestSeverity(dd.items);
        dd.sample = (dd.items[0].text || '').substring(0, 80);
        activeDomains.push(domainNames[dn]);
      }
    }

    var gradeInfo = calculateGrade(secFindings);

    // Grade display
    var gradeHtml = '<div class="lsp-secpost-grade">' +
      '<span class="grade grade-' + gradeInfo.grade.toLowerCase() + '">' + gradeInfo.grade + '</span>' +
      '<span class="grade-label">' + gradeInfo.label + '</span></div>';

    // Summary
    var summaryHtml = '<div class="lsp-secpost-summary">' + secFindings.length + ' security-related finding(s) across ' + activeDomains.length + ' domain(s)</div>';

    // Table
    var tableHtml = '<table class="lsp-secpost-table"><thead><tr><th>Domain</th><th>Count</th><th>Highest Severity</th><th>Sample Finding</th></tr></thead><tbody>';
    for (var t = 0; t < activeDomains.length; t++) {
      var domainInfo = domainData[activeDomains[t]];
      tableHtml += '<tr><td>' + activeDomains[t] + '</td><td>' + domainInfo.count + '</td>' +
        '<td><span class="lsp-secpost-sev ' + domainInfo.highestSev + '">' + domainInfo.highestSev.toUpperCase() + '</span></td>' +
        '<td>' + domainInfo.sample + '</td></tr>';
    }
    tableHtml += '</tbody></table>';

    // Actions
    var actionsHtml = '<div class="lsp-secpost-actions"><button data-action="export">📄 Export Security Audit Report (.txt)</button></div>';

    bodyEl.innerHTML = gradeHtml + summaryHtml + tableHtml + actionsHtml;

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

    // Export
    bodyEl.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-action="export"]');
      if (!btn) return;
      var report = generateAuditReport(secFindings, domainData, gradeInfo, scanTime);
      downloadFile(report, 'security-audit-' + Date.now() + '.txt', 'text/plain');
    });

    return container;
  };
})();
