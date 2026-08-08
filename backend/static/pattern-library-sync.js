/* LogSherlock Pro - Pattern Library Sync Panel (File 13) */
/* Exports: window.renderPatternLibrarySyncPanel */

(function() {
  'use strict';

  var STYLE_ID = 'lsp-pattern-library-sync-style';
  var PATTERNS_KEY = 'lsp_custom_patterns';
  var USERNAME_KEY = 'lsp_sync_username';
  var COLLAPSED_KEY = 'lsp_pattern_sync_collapsed';

  function injectStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.lsp-pls-panel { border: 1px solid #3a3a5c; border-radius: 8px; margin: 12px 0; background: #1e1e2e; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; color: #cdd6f4; }',
      '.lsp-pls-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer; background: #2a2a3e; border-radius: 8px 8px 0 0; user-select: none; }',
      '.lsp-pls-header:hover { background: #333350; }',
      '.lsp-pls-header h3 { margin: 0; font-size: 15px; }',
      '.lsp-pls-header .lsp-pls-toggle { font-size: 18px; transition: transform 0.2s; }',
      '.lsp-pls-body { padding: 16px; display: block; }',
      '.lsp-pls-body.collapsed { display: none; }',
      '.lsp-pls-section { margin-bottom: 18px; padding: 12px; background: #262640; border-radius: 6px; border: 1px solid #3a3a5c; }',
      '.lsp-pls-section h4 { margin: 0 0 10px 0; font-size: 13px; color: #a6adc8; text-transform: uppercase; letter-spacing: 0.5px; }',
      '.lsp-pls-btn { padding: 8px 16px; border: none; border-radius: 5px; cursor: pointer; font-size: 13px; font-weight: 500; transition: background 0.2s; }',
      '.lsp-pls-btn-primary { background: #89b4fa; color: #1e1e2e; }',
      '.lsp-pls-btn-primary:hover { background: #74a8fc; }',
      '.lsp-pls-btn-success { background: #a6e3a1; color: #1e1e2e; }',
      '.lsp-pls-btn-success:hover { background: #8fd98a; }',
      '.lsp-pls-btn-danger { background: #f38ba8; color: #1e1e2e; }',
      '.lsp-pls-btn-danger:hover { background: #e6779a; }',
      '.lsp-pls-btn-secondary { background: #45475a; color: #cdd6f4; }',
      '.lsp-pls-btn-secondary:hover { background: #585b70; }',
      '.lsp-pls-empty { text-align: center; padding: 20px; color: #6c7086; font-style: italic; }',
      '.lsp-pls-input { width: 100%; padding: 8px 12px; border: 1px solid #45475a; border-radius: 5px; background: #1e1e2e; color: #cdd6f4; font-size: 13px; box-sizing: border-box; margin-bottom: 8px; }',
      '.lsp-pls-file-input { margin: 8px 0; }',
      '.lsp-pls-select { padding: 8px 12px; border: 1px solid #45475a; border-radius: 5px; background: #1e1e2e; color: #cdd6f4; font-size: 13px; margin-bottom: 8px; }',
      '.lsp-pls-preview { background: #1a1a2e; border: 1px solid #45475a; border-radius: 5px; padding: 12px; margin: 10px 0; max-height: 200px; overflow-y: auto; font-size: 12px; }',
      '.lsp-pls-preview-item { padding: 4px 0; border-bottom: 1px solid #2a2a3e; }',
      '.lsp-pls-diff { display: flex; gap: 12px; margin: 10px 0; flex-wrap: wrap; }',
      '.lsp-pls-diff-stat { padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; }',
      '.lsp-pls-diff-new { background: #1e3a2e; color: #a6e3a1; }',
      '.lsp-pls-diff-updated { background: #3a3a1e; color: #f9e2af; }',
      '.lsp-pls-diff-skipped { background: #2e2e3a; color: #6c7086; }',
      '.lsp-pls-info { font-size: 12px; color: #6c7086; margin-top: 6px; }',
      '.lsp-pls-pattern-count { font-size: 13px; color: #89b4fa; font-weight: 500; margin-bottom: 10px; }',
      '.lsp-pls-username-row { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }',
      '.lsp-pls-username-row input { flex: 1; margin-bottom: 0; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function getPatterns() {
    if (typeof localStorage === 'undefined') return [];
    try {
      var raw = localStorage.getItem(PATTERNS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function setPatterns(patterns) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PATTERNS_KEY, JSON.stringify(patterns));
  }

  function getUsername() {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(USERNAME_KEY) || '';
  }

  function setUsername(name) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(USERNAME_KEY, name);
  }

  function isCollapsed() {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  }

  function setCollapsed(val) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(COLLAPSED_KEY, val ? 'true' : 'false');
  }

  function generateExportBlob(patterns, username) {
    return {
      exportedBy: username,
      exportDate: new Date().toISOString(),
      version: '1.0.0',
      patterns: patterns
    };
  }

  function validateImportStructure(data) {
    if (!data || typeof data !== 'object') return false;
    if (!Array.isArray(data.patterns)) return false;
    if (typeof data.exportedBy !== 'string') return false;
    if (typeof data.exportDate !== 'string') return false;
    if (typeof data.version !== 'string') return false;
    return true;
  }

  function computeDiff(existingPatterns, incomingPatterns, strategy) {
    var result = { newCount: 0, updatedCount: 0, skippedCount: 0, finalPatterns: [] };

    if (strategy === 'replace') {
      result.finalPatterns = incomingPatterns.slice();
      result.newCount = incomingPatterns.length;
      return result;
    }

    var existingMap = {};
    existingPatterns.forEach(function(p) {
      var key = (p.name || p.pattern || JSON.stringify(p)).toLowerCase();
      existingMap[key] = p;
    });

    result.finalPatterns = existingPatterns.slice();

    incomingPatterns.forEach(function(p) {
      var key = (p.name || p.pattern || JSON.stringify(p)).toLowerCase();
      if (existingMap[key]) {
        if (strategy === 'merge-overwrite') {
          var idx = result.finalPatterns.findIndex(function(ep) {
            return (ep.name || ep.pattern || JSON.stringify(ep)).toLowerCase() === key;
          });
          if (idx !== -1) {
            result.finalPatterns[idx] = p;
            result.updatedCount++;
          }
        } else {
          result.skippedCount++;
        }
      } else {
        result.finalPatterns.push(p);
        result.newCount++;
      }
    });

    return result;
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
    container.className = 'lsp-pls-panel';

    var collapsed = isCollapsed();

    var header = document.createElement('div');
    header.className = 'lsp-pls-header';
    header.innerHTML = '<h3>🔄 Pattern Library Sync</h3><span class="lsp-pls-toggle">' + (collapsed ? '▶' : '▼') + '</span>';
    container.appendChild(header);

    var body = document.createElement('div');
    body.className = 'lsp-pls-body' + (collapsed ? ' collapsed' : '');
    container.appendChild(body);

    header.addEventListener('click', function() {
      var isNowCollapsed = !body.classList.contains('collapsed');
      body.classList.toggle('collapsed');
      header.querySelector('.lsp-pls-toggle').textContent = isNowCollapsed ? '▶' : '▼';
      setCollapsed(isNowCollapsed);
    });

    function rebuildBody() {
      body.innerHTML = '';
      var patterns = getPatterns();

      // Export section
      var exportSection = document.createElement('div');
      exportSection.className = 'lsp-pls-section';
      exportSection.innerHTML = '<h4>📤 Export Patterns</h4>';

      if (!patterns || patterns.length === 0) {
        exportSection.innerHTML += '<div class="lsp-pls-empty">No custom patterns to export. Create some in Pattern Editor first.</div>';
      } else {
        var countDiv = document.createElement('div');
        countDiv.className = 'lsp-pls-pattern-count';
        countDiv.textContent = patterns.length + ' custom pattern' + (patterns.length !== 1 ? 's' : '') + ' available for export';
        exportSection.appendChild(countDiv);

        var usernameRow = document.createElement('div');
        usernameRow.className = 'lsp-pls-username-row';
        var usernameInput = document.createElement('input');
        usernameInput.type = 'text';
        usernameInput.className = 'lsp-pls-input';
        usernameInput.placeholder = 'Your name (for export metadata)';
        usernameInput.value = getUsername();
        usernameInput.style.marginBottom = '0';
        usernameRow.appendChild(usernameInput);
        exportSection.appendChild(usernameRow);

        usernameInput.addEventListener('change', function() {
          setUsername(usernameInput.value.trim());
        });

        var downloadBtn = document.createElement('button');
        downloadBtn.className = 'lsp-pls-btn lsp-pls-btn-primary';
        downloadBtn.textContent = '⬇️ Download Patterns (.json)';
        downloadBtn.addEventListener('click', function() {
          var name = usernameInput.value.trim();
          if (!name) {
            name = prompt('Enter your name for export metadata:') || 'Anonymous';
            usernameInput.value = name;
            setUsername(name);
          }
          var currentPatterns = getPatterns();
          var blob = generateExportBlob(currentPatterns, name);
          var filename = 'logsherlock-patterns-' + new Date().toISOString().slice(0, 10) + '.json';
          downloadJSON(blob, filename);
        });
        exportSection.appendChild(downloadBtn);

        var infoDiv = document.createElement('div');
        infoDiv.className = 'lsp-pls-info';
        infoDiv.textContent = 'Exports all custom patterns with metadata for team sharing.';
        exportSection.appendChild(infoDiv);
      }

      body.appendChild(exportSection);

      // Import section
      var importSection = document.createElement('div');
      importSection.className = 'lsp-pls-section';
      importSection.innerHTML = '<h4>📥 Import Patterns</h4>';

      var fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json';
      fileInput.className = 'lsp-pls-file-input';
      importSection.appendChild(fileInput);

      var strategyLabel = document.createElement('div');
      strategyLabel.style.cssText = 'font-size:12px;color:#a6adc8;margin:8px 0 4px;';
      strategyLabel.textContent = 'Merge Strategy:';
      importSection.appendChild(strategyLabel);

      var strategySelect = document.createElement('select');
      strategySelect.className = 'lsp-pls-select';
      strategySelect.innerHTML = '<option value="replace">Replace All</option><option value="merge-skip">Merge (skip duplicates)</option><option value="merge-overwrite">Merge (overwrite duplicates)</option>';
      importSection.appendChild(strategySelect);

      var previewArea = document.createElement('div');
      previewArea.id = 'lsp-pls-import-preview';
      importSection.appendChild(previewArea);

      var importState = { data: null, diff: null };

      fileInput.addEventListener('change', function(e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
          previewArea.innerHTML = '';
          try {
            var parsed = JSON.parse(ev.target.result);
            if (!validateImportStructure(parsed)) {
              previewArea.innerHTML = '<div style="color:#f38ba8;padding:8px;">❌ Invalid file structure. Expected: { exportedBy, exportDate, version, patterns[] }</div>';
              importState.data = null;
              return;
            }
            importState.data = parsed;
            showPreview();
          } catch(err) {
            previewArea.innerHTML = '<div style="color:#f38ba8;padding:8px;">❌ Invalid JSON file: ' + err.message + '</div>';
            importState.data = null;
          }
        };
        reader.readAsText(file);
      });

      strategySelect.addEventListener('change', function() {
        if (importState.data) showPreview();
      });

      function showPreview() {
        previewArea.innerHTML = '';
        var existingPatterns = getPatterns();
        var strategy = strategySelect.value;
        var diff = computeDiff(existingPatterns, importState.data.patterns, strategy);
        importState.diff = diff;

        var metaDiv = document.createElement('div');
        metaDiv.className = 'lsp-pls-preview';
        metaDiv.innerHTML = '<div style="margin-bottom:6px;"><strong>From:</strong> ' + escapeHtml(importState.data.exportedBy) + '</div>' +
          '<div style="margin-bottom:6px;"><strong>Date:</strong> ' + escapeHtml(importState.data.exportDate) + '</div>' +
          '<div><strong>Patterns in file:</strong> ' + importState.data.patterns.length + '</div>';
        previewArea.appendChild(metaDiv);

        var diffDiv = document.createElement('div');
        diffDiv.className = 'lsp-pls-diff';
        diffDiv.innerHTML = '<span class="lsp-pls-diff-stat lsp-pls-diff-new">+ ' + diff.newCount + ' new</span>' +
          '<span class="lsp-pls-diff-stat lsp-pls-diff-updated">↻ ' + diff.updatedCount + ' updated</span>' +
          '<span class="lsp-pls-diff-stat lsp-pls-diff-skipped">⊘ ' + diff.skippedCount + ' skipped</span>';
        previewArea.appendChild(diffDiv);

        // Pattern preview list
        if (importState.data.patterns.length > 0) {
          var listDiv = document.createElement('div');
          listDiv.className = 'lsp-pls-preview';
          importState.data.patterns.slice(0, 10).forEach(function(p) {
            var item = document.createElement('div');
            item.className = 'lsp-pls-preview-item';
            item.textContent = (p.name || p.pattern || JSON.stringify(p));
            listDiv.appendChild(item);
          });
          if (importState.data.patterns.length > 10) {
            var moreDiv = document.createElement('div');
            moreDiv.style.cssText = 'color:#6c7086;font-style:italic;padding-top:4px;';
            moreDiv.textContent = '... and ' + (importState.data.patterns.length - 10) + ' more';
            listDiv.appendChild(moreDiv);
          }
          previewArea.appendChild(listDiv);
        }

        var applyBtn = document.createElement('button');
        applyBtn.className = 'lsp-pls-btn lsp-pls-btn-success';
        applyBtn.textContent = '✅ Apply Import';
        applyBtn.style.marginTop = '10px';
        applyBtn.addEventListener('click', function() {
          setPatterns(diff.finalPatterns);
          previewArea.innerHTML = '<div style="color:#a6e3a1;padding:8px;">✅ Import successful! ' + diff.finalPatterns.length + ' patterns now in library.</div>';
          importState.data = null;
          importState.diff = null;
          // Refresh export section count
          setTimeout(function() { rebuildBody(); }, 1000);
        });
        previewArea.appendChild(applyBtn);
      }

      body.appendChild(importSection);
    }

    function escapeHtml(str) {
      var div = document.createElement('div');
      div.textContent = str || '';
      return div.innerHTML;
    }

    rebuildBody();
    return container;
  }

  window.renderPatternLibrarySyncPanel = function(findings) {
    return renderPanel(findings);
  };

})();
