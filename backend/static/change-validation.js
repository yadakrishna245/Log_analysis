/**
 * LogSherlock Pro — Change Validation Panel
 * Confirms whether marked issues are actually resolved after applying a fix
 */
(function () {
  'use strict';

  var STYLE_ID = 'lsp-validation-style';
  var STORAGE_KEY = 'lsp_validation_targets';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.lsp-valid-panel { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; border: 1px solid #e0e0e0; border-radius: 8px; margin: 16px 0; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }',
      '.lsp-valid-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; cursor: pointer; background: #f8f9fa; border-radius: 8px 8px 0 0; user-select: none; }',
      '.lsp-valid-header h2 { margin: 0; font-size: 18px; }',
      '.lsp-valid-header .lsp-toggle { font-size: 14px; color: #666; }',
      '.lsp-valid-body { padding: 20px; }',
      '.lsp-valid-body.collapsed { display: none; }',
      '.lsp-valid-instructions { background: #e3f2fd; padding: 16px; border-radius: 6px; margin-bottom: 16px; line-height: 1.6; }',
      '.lsp-valid-instructions h3 { margin: 0 0 8px 0; font-size: 14px; }',
      '.lsp-valid-instructions ol { margin: 8px 0 0 0; padding-left: 20px; }',
      '.lsp-valid-instructions li { margin-bottom: 4px; font-size: 13px; }',
      '.lsp-valid-findings { margin-bottom: 16px; }',
      '.lsp-valid-finding { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border: 1px solid #eee; border-radius: 4px; margin-bottom: 6px; font-size: 13px; }',
      '.lsp-valid-finding input[type="checkbox"] { margin-top: 2px; cursor: pointer; }',
      '.lsp-valid-finding .text { flex: 1; }',
      '.lsp-valid-finding .meta { font-size: 11px; color: #999; }',
      '.lsp-valid-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }',
      '.lsp-valid-actions button { padding: 8px 14px; border: 1px solid #ccc; border-radius: 4px; background: #fff; cursor: pointer; font-size: 13px; }',
      '.lsp-valid-actions button:hover { background: #f0f0f0; }',
      '.lsp-valid-actions button.primary { background: #1a237e; color: #fff; border-color: #1a237e; }',
      '.lsp-valid-actions button.primary:hover { background: #283593; }',
      '.lsp-valid-actions button.danger { border-color: #e53935; color: #e53935; }',
      '.lsp-valid-actions button.danger:hover { background: #fdecea; }',
      '.lsp-valid-results { margin-top: 16px; }',
      '.lsp-valid-result { padding: 10px 14px; border-radius: 4px; margin-bottom: 8px; font-size: 13px; }',
      '.lsp-valid-result.resolved { background: #e8f5e9; border-left: 4px solid #2e7d32; }',
      '.lsp-valid-result.still-present { background: #fdecea; border-left: 4px solid #b71c1c; }',
      '.lsp-valid-result.new-issue { background: #fff8e1; border-left: 4px solid #f57f17; }',
      '.lsp-valid-result .status-icon { font-size: 16px; margin-right: 8px; }',
      '.lsp-valid-result .evidence { font-size: 11px; color: #666; margin-top: 4px; display: block; }',
      '.lsp-valid-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }',
      '.lsp-valid-summary-item { text-align: center; padding: 12px; border-radius: 6px; }',
      '.lsp-valid-summary-item.resolved { background: #e8f5e9; }',
      '.lsp-valid-summary-item.still { background: #fdecea; }',
      '.lsp-valid-summary-item.new { background: #fff8e1; }',
      '.lsp-valid-summary-item .count { font-size: 24px; font-weight: 700; }',
      '.lsp-valid-summary-item .label { font-size: 11px; color: #666; }',
      '.lsp-valid-target-count { font-size: 12px; color: #666; margin-bottom: 12px; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function getTargets() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveTargets(targets) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(targets));
  }

  function findingKey(f) {
    return (f.text || '') + '||' + (f.file || '') + '||' + (f.category || '');
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

  function generateValidationReport(results, scanTime) {
    var lines = [];
    lines.push('CHANGE VALIDATION REPORT — LogSherlock Pro');
    lines.push('Validation performed: ' + scanTime);
    lines.push('');

    var resolved = results.filter(function (r) { return r.status === 'resolved'; });
    var stillPresent = results.filter(function (r) { return r.status === 'still-present'; });
    var newIssues = results.filter(function (r) { return r.status === 'new-issue'; });

    lines.push('SUMMARY:');
    lines.push('  ✅ Resolved: ' + resolved.length);
    lines.push('  ❌ Still Present: ' + stillPresent.length);
    lines.push('  ⚠️ New Issues: ' + newIssues.length);
    lines.push('');

    if (resolved.length > 0) {
      lines.push('RESOLVED ISSUES (Proof of Fix):');
      for (var i = 0; i < resolved.length; i++) {
        lines.push('  ✅ ' + resolved[i].text);
        lines.push('     Evidence: ' + resolved[i].evidence);
      }
      lines.push('');
    }

    if (stillPresent.length > 0) {
      lines.push('STILL PRESENT (Fix Incomplete):');
      for (var j = 0; j < stillPresent.length; j++) {
        lines.push('  ❌ ' + stillPresent[j].text);
        lines.push('     Evidence: ' + stillPresent[j].evidence);
      }
      lines.push('');
    }

    if (newIssues.length > 0) {
      lines.push('NEW ISSUES (Not in Previous Scan):');
      for (var k = 0; k < newIssues.length; k++) {
        lines.push('  ⚠️ ' + newIssues[k].text);
        lines.push('     Evidence: ' + newIssues[k].evidence);
      }
    }

    return lines.join('\n');
  }

  window.renderChangeValidationPanel = function (findings) {
    injectStyles();
    findings = findings || [];
    var scanTime = new Date().toLocaleString();

    var container = document.createElement('div');
    container.className = 'lsp-valid-panel';

    var headerEl = document.createElement('div');
    headerEl.className = 'lsp-valid-header';
    headerEl.innerHTML = '<h2>✅ Change Validation</h2><span class="lsp-toggle">▼</span>';

    var bodyEl = document.createElement('div');
    bodyEl.className = 'lsp-valid-body';

    var targets = getTargets();

    function renderContent() {
      targets = getTargets();
      var currentKeys = {};
      for (var i = 0; i < findings.length; i++) {
        currentKeys[findingKey(findings[i])] = findings[i];
      }

      // If targets exist, show validation results
      if (targets.length > 0) {
        var results = [];
        var targetKeys = {};

        // Check each target against current findings
        for (var t = 0; t < targets.length; t++) {
          var key = findingKey(targets[t]);
          targetKeys[key] = true;
          if (currentKeys[key]) {
            results.push({
              status: 'still-present',
              text: targets[t].text || 'Unknown finding',
              evidence: 'Finding still present in current scan (file: ' + (targets[t].file || 'unknown') + ', line: ' + (targets[t].line || 'unknown') + ')'
            });
          } else {
            results.push({
              status: 'resolved',
              text: targets[t].text || 'Unknown finding',
              evidence: 'Was on line ' + (targets[t].line || '?') + ' in previous scan (' + (targets[t].file || 'unknown') + '), not found in current scan → RESOLVED'
            });
          }
        }

        // Check for new issues not in targets
        for (var n = 0; n < findings.length; n++) {
          var fKey = findingKey(findings[n]);
          if (!targetKeys[fKey]) {
            results.push({
              status: 'new-issue',
              text: findings[n].text || 'Unknown finding',
              evidence: 'New finding in current scan (file: ' + (findings[n].file || 'unknown') + ', line: ' + (findings[n].line || 'unknown') + ') — was not present in previous scan'
            });
          }
        }

        var resolved = results.filter(function (r) { return r.status === 'resolved'; });
        var stillPresent = results.filter(function (r) { return r.status === 'still-present'; });
        var newIssues = results.filter(function (r) { return r.status === 'new-issue'; });

        // Summary
        var html = '<div class="lsp-valid-summary">' +
          '<div class="lsp-valid-summary-item resolved"><div class="count">' + resolved.length + '</div><div class="label">✅ Resolved</div></div>' +
          '<div class="lsp-valid-summary-item still"><div class="count">' + stillPresent.length + '</div><div class="label">❌ Still Present</div></div>' +
          '<div class="lsp-valid-summary-item new"><div class="count">' + newIssues.length + '</div><div class="label">⚠️ New Issues</div></div>' +
          '</div>';

        // Results
        html += '<div class="lsp-valid-results">';
        for (var r = 0; r < results.length; r++) {
          var res = results[r];
          var icon = res.status === 'resolved' ? '✅' : (res.status === 'still-present' ? '❌' : '⚠️');
          var statusLabel = res.status === 'resolved' ? 'RESOLVED' : (res.status === 'still-present' ? 'STILL PRESENT' : 'NEW ISSUE');
          html += '<div class="lsp-valid-result ' + res.status + '">' +
            '<span class="status-icon">' + icon + '</span><strong>' + statusLabel + ':</strong> ' + (res.text || '').substring(0, 100) +
            '<span class="evidence">' + res.evidence + '</span></div>';
        }
        html += '</div>';

        // Actions
        html += '<div class="lsp-valid-actions">' +
          '<button data-action="export" class="primary">📄 Export Validation Report</button>' +
          '<button data-action="clear" class="danger">🗑️ Clear Targets</button>' +
          '<button data-action="mark-mode">➕ Mark New Targets</button>' +
          '</div>';

        bodyEl.innerHTML = html;
      } else {
        // No targets — show instructions + mark mode
        var instrHtml = '<div class="lsp-valid-instructions">' +
          '<h3>How to Use Change Validation</h3>' +
          '<ol>' +
          '<li><strong>Mark findings</strong> below that you expect to fix</li>' +
          '<li><strong>Apply your fix</strong> to the system/logs</li>' +
          '<li><strong>Run a new scan</strong> — this panel will show what was resolved</li>' +
          '</ol>' +
          '</div>';

        // Show current findings to mark
        var findingsHtml = '<div class="lsp-valid-target-count">' + findings.length + ' findings available to mark for validation</div>';
        findingsHtml += '<div class="lsp-valid-findings">';
        for (var f = 0; f < findings.length; f++) {
          var finding = findings[f];
          findingsHtml += '<div class="lsp-valid-finding">' +
            '<input type="checkbox" data-idx="' + f + '" />' +
            '<div class="text">' + (finding.text || '').substring(0, 100) +
            '<div class="meta">' + (finding.severity || '').toUpperCase() + ' | ' + (finding.file || 'unknown') + ':' + (finding.line || '?') + ' | ' + (finding.category || '') + '</div>' +
            '</div></div>';
        }
        findingsHtml += '</div>';

        var actHtml = '<div class="lsp-valid-actions">' +
          '<button data-action="save-targets" class="primary">💾 Mark Selected as Fix Targets</button>' +
          '</div>';

        bodyEl.innerHTML = instrHtml + findingsHtml + actHtml;
      }
    }

    renderContent();

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
    bodyEl.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');

      if (action === 'save-targets') {
        var checkboxes = bodyEl.querySelectorAll('input[type="checkbox"]:checked');
        var newTargets = [];
        for (var i = 0; i < checkboxes.length; i++) {
          var idx = parseInt(checkboxes[i].getAttribute('data-idx'), 10);
          if (findings[idx]) {
            newTargets.push({
              text: findings[idx].text,
              line: findings[idx].line,
              severity: findings[idx].severity,
              category: findings[idx].category,
              file: findings[idx].file,
              timestamp: findings[idx].timestamp,
              markedAt: new Date().toISOString()
            });
          }
        }
        if (newTargets.length === 0) {
          alert('Please select at least one finding to mark as a fix target.');
          return;
        }
        saveTargets(newTargets);
        btn.textContent = '✅ ' + newTargets.length + ' target(s) saved!';
        setTimeout(function () { renderContent(); }, 1500);
      } else if (action === 'clear') {
        if (confirm('Clear all validation targets? This will reset the validation workflow.')) {
          localStorage.removeItem(STORAGE_KEY);
          renderContent();
        }
      } else if (action === 'mark-mode') {
        localStorage.removeItem(STORAGE_KEY);
        renderContent();
      } else if (action === 'export') {
        // Rebuild results for export
        var currentKeys = {};
        for (var c = 0; c < findings.length; c++) {
          currentKeys[findingKey(findings[c])] = findings[c];
        }
        var exportResults = [];
        var exportTargets = getTargets();
        var targetKeysExport = {};
        for (var t = 0; t < exportTargets.length; t++) {
          var key = findingKey(exportTargets[t]);
          targetKeysExport[key] = true;
          if (currentKeys[key]) {
            exportResults.push({ status: 'still-present', text: exportTargets[t].text || '', evidence: 'Still present in current scan' });
          } else {
            exportResults.push({ status: 'resolved', text: exportTargets[t].text || '', evidence: 'Was on line ' + (exportTargets[t].line || '?') + ', not found in current scan' });
          }
        }
        for (var n = 0; n < findings.length; n++) {
          if (!targetKeysExport[findingKey(findings[n])]) {
            exportResults.push({ status: 'new-issue', text: findings[n].text || '', evidence: 'New in current scan (line ' + (findings[n].line || '?') + ')' });
          }
        }
        var report = generateValidationReport(exportResults, scanTime);
        downloadFile(report, 'validation-report-' + Date.now() + '.txt', 'text/plain');
      }
    });

    return container;
  };
})();
