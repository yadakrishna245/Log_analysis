/* LogSherlock Pro - Severity Override Panel (File 14) */
/* Exports: window.renderSeverityOverridePanel */

(function() {
  'use strict';

  var STYLE_ID = 'lsp-severity-override-style';
  var OVERRIDES_KEY = 'lsp_severity_overrides';
  var COLLAPSED_KEY = 'lsp_severity_override_collapsed';

  var SEVERITY_LEVELS = ['critical', 'error', 'warning', 'info', 'debug', 'any'];
  var SEVERITY_COLORS = {
    critical: '#f38ba8',
    error: '#fab387',
    warning: '#f9e2af',
    info: '#89b4fa',
    debug: '#6c7086',
    any: '#a6adc8'
  };

  function injectStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.lsp-so-panel { border: 1px solid #3a3a5c; border-radius: 8px; margin: 12px 0; background: #1e1e2e; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; color: #cdd6f4; }',
      '.lsp-so-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer; background: #2a2a3e; border-radius: 8px 8px 0 0; user-select: none; }',
      '.lsp-so-header:hover { background: #333350; }',
      '.lsp-so-header h3 { margin: 0; font-size: 15px; }',
      '.lsp-so-header .lsp-so-toggle { font-size: 18px; transition: transform 0.2s; }',
      '.lsp-so-body { padding: 16px; display: block; }',
      '.lsp-so-body.collapsed { display: none; }',
      '.lsp-so-section { margin-bottom: 18px; padding: 12px; background: #262640; border-radius: 6px; border: 1px solid #3a3a5c; }',
      '.lsp-so-section h4 { margin: 0 0 10px 0; font-size: 13px; color: #a6adc8; text-transform: uppercase; letter-spacing: 0.5px; }',
      '.lsp-so-btn { padding: 8px 16px; border: none; border-radius: 5px; cursor: pointer; font-size: 13px; font-weight: 500; transition: background 0.2s; margin-right: 6px; }',
      '.lsp-so-btn-primary { background: #89b4fa; color: #1e1e2e; }',
      '.lsp-so-btn-primary:hover { background: #74a8fc; }',
      '.lsp-so-btn-success { background: #a6e3a1; color: #1e1e2e; }',
      '.lsp-so-btn-success:hover { background: #8fd98a; }',
      '.lsp-so-btn-danger { background: #f38ba8; color: #1e1e2e; }',
      '.lsp-so-btn-danger:hover { background: #e6779a; }',
      '.lsp-so-btn-secondary { background: #45475a; color: #cdd6f4; }',
      '.lsp-so-btn-secondary:hover { background: #585b70; }',
      '.lsp-so-btn-sm { padding: 4px 10px; font-size: 11px; }',
      '.lsp-so-form { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }',
      '.lsp-so-form-full { grid-column: 1 / -1; }',
      '.lsp-so-input, .lsp-so-select { width: 100%; padding: 8px 12px; border: 1px solid #45475a; border-radius: 5px; background: #1e1e2e; color: #cdd6f4; font-size: 13px; box-sizing: border-box; }',
      '.lsp-so-label { font-size: 11px; color: #a6adc8; margin-bottom: 3px; display: block; }',
      '.lsp-so-override-list { max-height: 300px; overflow-y: auto; }',
      '.lsp-so-override-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid #2a2a3e; gap: 8px; }',
      '.lsp-so-override-item:last-child { border-bottom: none; }',
      '.lsp-so-override-info { flex: 1; min-width: 0; }',
      '.lsp-so-override-pattern { font-size: 13px; font-weight: 500; word-break: break-all; }',
      '.lsp-so-override-meta { font-size: 11px; color: #6c7086; margin-top: 2px; }',
      '.lsp-so-severity-badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; text-transform: uppercase; }',
      '.lsp-so-severity-strike { text-decoration: line-through; opacity: 0.6; }',
      '.lsp-so-severity-arrow { margin: 0 6px; color: #6c7086; }',
      '.lsp-so-affected { background: #1a3a2e; border: 1px solid #a6e3a1; border-radius: 5px; padding: 10px 14px; margin-bottom: 14px; font-size: 13px; color: #a6e3a1; }',
      '.lsp-so-findings-list { max-height: 250px; overflow-y: auto; margin-top: 10px; }',
      '.lsp-so-finding-item { padding: 6px 10px; border-bottom: 1px solid #2a2a3e; font-size: 12px; display: flex; align-items: center; gap: 8px; }',
      '.lsp-so-empty { text-align: center; padding: 20px; color: #6c7086; font-style: italic; }',
      '.lsp-so-actions { display: flex; gap: 4px; flex-shrink: 0; }',
      '.lsp-so-export-row { display: flex; gap: 8px; margin-top: 10px; }',
      '.lsp-so-file-input { margin: 8px 0; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function getOverrides() {
    if (typeof localStorage === 'undefined') return [];
    try {
      var raw = localStorage.getItem(OVERRIDES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function setOverrides(overrides) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
  }

  function isCollapsed() {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  }

  function setCollapsed(val) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(COLLAPSED_KEY, val ? 'true' : 'false');
  }

  function generateId() {
    return 'so_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function matchesOverride(finding, override) {
    // Check original severity match
    if (override.originalSeverity !== 'any' && finding.severity && finding.severity.toLowerCase() !== override.originalSeverity.toLowerCase()) {
      return false;
    }

    var target = '';
    if (override.matchType === 'category') {
      target = finding.category || '';
    } else {
      target = finding.text || '';
    }

    if (override.matchType === 'contains') {
      return target.toLowerCase().indexOf(override.pattern.toLowerCase()) !== -1;
    } else if (override.matchType === 'regex') {
      try {
        var re = new RegExp(override.pattern, 'i');
        return re.test(target);
      } catch(e) {
        return false;
      }
    } else if (override.matchType === 'category') {
      return target.toLowerCase() === override.pattern.toLowerCase();
    }
    return false;
  }

  function applyOverrides(findings, overrides) {
    var affected = [];
    findings.forEach(function(f, idx) {
      for (var i = 0; i < overrides.length; i++) {
        if (matchesOverride(f, overrides[i])) {
          affected.push({ finding: f, index: idx, override: overrides[i], originalSeverity: f.severity });
          break;
        }
      }
    });
    return affected;
  }

  function severityBadge(severity, strikethrough) {
    var color = SEVERITY_COLORS[severity.toLowerCase()] || '#a6adc8';
    var cls = 'lsp-so-severity-badge' + (strikethrough ? ' lsp-so-severity-strike' : '');
    return '<span class="' + cls + '" style="background:' + color + '22;color:' + color + ';border:1px solid ' + color + '44;">' + escapeHtml(severity) + '</span>';
  }

  function escapeHtml(str) {
    if (typeof document === 'undefined') return str || '';
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function downloadJSON(data, filename) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function renderPanel(findings) {
    injectStyles();

    var container = document.createElement('div');
    container.className = 'lsp-so-panel';

    var collapsed = isCollapsed();

    var header = document.createElement('div');
    header.className = 'lsp-so-header';
    header.innerHTML = '<h3>⚖️ Severity Overrides</h3><span class="lsp-so-toggle">' + (collapsed ? '▶' : '▼') + '</span>';
    container.appendChild(header);

    var body = document.createElement('div');
    body.className = 'lsp-so-body' + (collapsed ? ' collapsed' : '');
    container.appendChild(body);

    header.addEventListener('click', function() {
      var isNowCollapsed = !body.classList.contains('collapsed');
      body.classList.toggle('collapsed');
      header.querySelector('.lsp-so-toggle').textContent = isNowCollapsed ? '▶' : '▼';
      setCollapsed(isNowCollapsed);
    });

    function rebuildBody() {
      body.innerHTML = '';
      var overrides = getOverrides();
      var affectedFindings = applyOverrides(findings || [], overrides);

      // Affected count
      var affectedDiv = document.createElement('div');
      affectedDiv.className = 'lsp-so-affected';
      affectedDiv.textContent = '🎯 ' + affectedFindings.length + ' finding' + (affectedFindings.length !== 1 ? 's' : '') + ' affected by overrides in current scan';
      body.appendChild(affectedDiv);

      // Affected findings display
      if (affectedFindings.length > 0) {
        var findingsSection = document.createElement('div');
        findingsSection.className = 'lsp-so-section';
        findingsSection.innerHTML = '<h4>📋 Overridden Findings</h4>';
        var findingsList = document.createElement('div');
        findingsList.className = 'lsp-so-findings-list';
        affectedFindings.forEach(function(af) {
          var item = document.createElement('div');
          item.className = 'lsp-so-finding-item';
          item.innerHTML = severityBadge(af.originalSeverity, true) +
            '<span class="lsp-so-severity-arrow">→</span>' +
            severityBadge(af.override.newSeverity, false) +
            '<span style="margin-left:8px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escapeHtml(af.finding.text) + '">' + escapeHtml(af.finding.text.substring(0, 80)) + '</span>';
          findingsList.appendChild(item);
        });
        findingsSection.appendChild(findingsList);
        body.appendChild(findingsSection);
      }

      // Add Override Form
      var formSection = document.createElement('div');
      formSection.className = 'lsp-so-section';
      formSection.innerHTML = '<h4>➕ Add Override Rule</h4>';

      var form = document.createElement('div');
      form.className = 'lsp-so-form';

      form.innerHTML =
        '<div>' +
          '<label class="lsp-so-label">Pattern</label>' +
          '<input type="text" class="lsp-so-input" id="lsp-so-pattern" placeholder="e.g. OOM on node-X" />' +
        '</div>' +
        '<div>' +
          '<label class="lsp-so-label">Match Type</label>' +
          '<select class="lsp-so-select" id="lsp-so-matchtype">' +
            '<option value="contains">Contains</option>' +
            '<option value="regex">Regex</option>' +
            '<option value="category">Category</option>' +
          '</select>' +
        '</div>' +
        '<div>' +
          '<label class="lsp-so-label">Original Severity (or any)</label>' +
          '<select class="lsp-so-select" id="lsp-so-orig-sev">' +
            '<option value="any">Any</option>' +
            '<option value="critical">Critical</option>' +
            '<option value="error">Error</option>' +
            '<option value="warning">Warning</option>' +
            '<option value="info">Info</option>' +
            '<option value="debug">Debug</option>' +
          '</select>' +
        '</div>' +
        '<div>' +
          '<label class="lsp-so-label">New Severity</label>' +
          '<select class="lsp-so-select" id="lsp-so-new-sev">' +
            '<option value="critical">Critical</option>' +
            '<option value="error">Error</option>' +
            '<option value="warning">Warning</option>' +
            '<option value="info">Info</option>' +
            '<option value="debug">Debug</option>' +
          '</select>' +
        '</div>' +
        '<div class="lsp-so-form-full">' +
          '<label class="lsp-so-label">Reason</label>' +
          '<input type="text" class="lsp-so-input" id="lsp-so-reason" placeholder="e.g. In MY environment, OOM on node-X is ALWAYS critical" />' +
        '</div>';

      formSection.appendChild(form);

      var addBtn = document.createElement('button');
      addBtn.className = 'lsp-so-btn lsp-so-btn-success';
      addBtn.textContent = '✅ Add Override';
      addBtn.addEventListener('click', function() {
        var patternInput = form.querySelector('#lsp-so-pattern');
        var matchTypeInput = form.querySelector('#lsp-so-matchtype');
        var origSevInput = form.querySelector('#lsp-so-orig-sev');
        var newSevInput = form.querySelector('#lsp-so-new-sev');
        var reasonInput = form.querySelector('#lsp-so-reason');

        var pattern = patternInput.value.trim();
        if (!pattern) { patternInput.focus(); return; }

        var newOverride = {
          id: generateId(),
          pattern: pattern,
          matchType: matchTypeInput.value,
          originalSeverity: origSevInput.value,
          newSeverity: newSevInput.value,
          reason: reasonInput.value.trim(),
          createdAt: new Date().toISOString()
        };

        var current = getOverrides();
        current.push(newOverride);
        setOverrides(current);
        rebuildBody();
      });
      formSection.appendChild(addBtn);
      body.appendChild(formSection);

      // Existing Overrides List
      var listSection = document.createElement('div');
      listSection.className = 'lsp-so-section';
      listSection.innerHTML = '<h4>📝 Active Overrides (' + overrides.length + ')</h4>';

      if (overrides.length === 0) {
        listSection.innerHTML += '<div class="lsp-so-empty">No overrides configured. Add one above.</div>';
      } else {
        var list = document.createElement('div');
        list.className = 'lsp-so-override-list';
        overrides.forEach(function(ov) {
          var item = document.createElement('div');
          item.className = 'lsp-so-override-item';

          var info = document.createElement('div');
          info.className = 'lsp-so-override-info';
          info.innerHTML = '<div class="lsp-so-override-pattern">' +
            severityBadge(ov.originalSeverity, true) +
            '<span class="lsp-so-severity-arrow">→</span>' +
            severityBadge(ov.newSeverity, false) +
            ' <code style="font-size:12px;background:#1a1a2e;padding:2px 6px;border-radius:3px;">' + escapeHtml(ov.pattern) + '</code>' +
            '</div>' +
            '<div class="lsp-so-override-meta">' +
            '<span>' + escapeHtml(ov.matchType) + '</span>' +
            (ov.reason ? ' • ' + escapeHtml(ov.reason) : '') +
            ' • ' + escapeHtml(new Date(ov.createdAt).toLocaleDateString()) +
            '</div>';
          item.appendChild(info);

          var actions = document.createElement('div');
          actions.className = 'lsp-so-actions';

          var editBtn = document.createElement('button');
          editBtn.className = 'lsp-so-btn lsp-so-btn-secondary lsp-so-btn-sm';
          editBtn.textContent = '✏️';
          editBtn.title = 'Edit';
          editBtn.addEventListener('click', function() {
            var current = getOverrides();
            var idx = current.findIndex(function(o) { return o.id === ov.id; });
            if (idx === -1) return;
            var newPattern = prompt('Pattern:', ov.pattern);
            if (newPattern === null) return;
            var newReason = prompt('Reason:', ov.reason || '');
            if (newReason === null) newReason = ov.reason;
            current[idx].pattern = newPattern.trim() || ov.pattern;
            current[idx].reason = newReason.trim();
            setOverrides(current);
            rebuildBody();
          });
          actions.appendChild(editBtn);

          var deleteBtn = document.createElement('button');
          deleteBtn.className = 'lsp-so-btn lsp-so-btn-danger lsp-so-btn-sm';
          deleteBtn.textContent = '🗑️';
          deleteBtn.title = 'Delete';
          deleteBtn.addEventListener('click', function() {
            var current = getOverrides();
            current = current.filter(function(o) { return o.id !== ov.id; });
            setOverrides(current);
            rebuildBody();
          });
          actions.appendChild(deleteBtn);

          item.appendChild(actions);
          list.appendChild(item);
        });
        listSection.appendChild(list);
      }

      body.appendChild(listSection);

      // Export/Import section
      var syncSection = document.createElement('div');
      syncSection.className = 'lsp-so-section';
      syncSection.innerHTML = '<h4>🔄 Export / Import Overrides</h4>';

      var exportRow = document.createElement('div');
      exportRow.className = 'lsp-so-export-row';

      var exportBtn = document.createElement('button');
      exportBtn.className = 'lsp-so-btn lsp-so-btn-primary';
      exportBtn.textContent = '⬇️ Export Overrides';
      exportBtn.addEventListener('click', function() {
        var currentOverrides = getOverrides();
        if (currentOverrides.length === 0) {
          alert('No overrides to export.');
          return;
        }
        var exportData = {
          type: 'severity_overrides',
          exportDate: new Date().toISOString(),
          version: '1.0.0',
          overrides: currentOverrides
        };
        downloadJSON(exportData, 'logsherlock-severity-overrides-' + new Date().toISOString().slice(0, 10) + '.json');
      });
      exportRow.appendChild(exportBtn);
      syncSection.appendChild(exportRow);

      var importLabel = document.createElement('div');
      importLabel.style.cssText = 'font-size:12px;color:#a6adc8;margin:10px 0 4px;';
      importLabel.textContent = 'Import overrides from file:';
      syncSection.appendChild(importLabel);

      var fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json';
      fileInput.className = 'lsp-so-file-input';
      fileInput.addEventListener('change', function(e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
          try {
            var parsed = JSON.parse(ev.target.result);
            if (!parsed || !Array.isArray(parsed.overrides)) {
              alert('Invalid file. Expected { overrides: [...] }');
              return;
            }
            // Validate each override
            var valid = parsed.overrides.every(function(o) {
              return o.id && o.pattern && o.matchType && o.newSeverity;
            });
            if (!valid) {
              alert('Invalid override structure in file.');
              return;
            }
            var current = getOverrides();
            var existingIds = {};
            current.forEach(function(o) { existingIds[o.id] = true; });
            var newOnes = parsed.overrides.filter(function(o) { return !existingIds[o.id]; });
            var merged = current.concat(newOnes);
            setOverrides(merged);
            alert('Imported ' + newOnes.length + ' new override(s). ' + (parsed.overrides.length - newOnes.length) + ' skipped (already exist).');
            rebuildBody();
          } catch(err) {
            alert('Failed to parse JSON: ' + err.message);
          }
        };
        reader.readAsText(file);
      });
      syncSection.appendChild(fileInput);

      body.appendChild(syncSection);
    }

    rebuildBody();
    return container;
  }

  window.renderSeverityOverridePanel = function(findings) {
    return renderPanel(findings);
  };

})();
