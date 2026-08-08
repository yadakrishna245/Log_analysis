(function() {
  "use strict";

  var STORAGE_KEY = 'lsp_remediation_library';

  function getLibrary() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch(e) { return []; }
  }

  function saveLibrary(lib) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lib));
  }

  function matchEntry(finding, entry) {
    if (entry.category && finding.category && entry.category.toLowerCase() !== finding.category.toLowerCase()) {
      return false;
    }
    if (entry.pattern) {
      var text = (finding.text || '') + ' ' + (finding.context || '');
      try {
        var re = new RegExp(entry.pattern, 'i');
        return re.test(text);
      } catch(e) {
        return text.toLowerCase().indexOf(entry.pattern.toLowerCase()) !== -1;
      }
    }
    return entry.category && finding.category && entry.category.toLowerCase() === finding.category.toLowerCase();
  }

  function injectStyles() {
    if (document.getElementById('lsp-remediation-styles')) return;
    var style = document.createElement('style');
    style.id = 'lsp-remediation-styles';
    style.textContent = [
      '.lsp-rem-panel { border:1px solid #444; border-radius:8px; margin:10px 0; background:#1a1a2e; color:#e0e0e0; font-family:monospace; }',
      '.lsp-rem-header { padding:12px 16px; cursor:pointer; font-size:16px; font-weight:bold; background:#16213e; border-radius:8px 8px 0 0; display:flex; justify-content:space-between; align-items:center; }',
      '.lsp-rem-header:hover { background:#1a2744; }',
      '.lsp-rem-body { padding:16px; display:none; }',
      '.lsp-rem-body.open { display:block; }',
      '.lsp-rem-disclaimer { background:#333; padding:8px 12px; border-radius:4px; font-size:11px; color:#aaa; margin-bottom:12px; border-left:3px solid #cc9900; }',
      '.lsp-rem-match { background:#0a2e0a; border:1px solid #339933; border-radius:6px; padding:12px; margin-bottom:10px; }',
      '.lsp-rem-match-finding { font-size:12px; color:#88ff88; margin-bottom:6px; }',
      '.lsp-rem-match-suggestion { background:#1a3a1a; padding:8px; border-radius:4px; margin-top:6px; }',
      '.lsp-rem-match-suggestion-text { color:#ccffcc; font-size:12px; white-space:pre-wrap; }',
      '.lsp-rem-match-kb { font-size:11px; color:#66aaff; margin-top:4px; }',
      '.lsp-rem-match-kb a { color:#66aaff; text-decoration:underline; }',
      '.lsp-rem-copy-btn { padding:4px 8px; background:#0066cc; color:#fff; border:none; border-radius:3px; font-size:11px; cursor:pointer; margin-top:4px; }',
      '.lsp-rem-copy-btn:hover { background:#0077ee; }',
      '.lsp-rem-empty { color:#aaa; padding:16px; background:#222; border-radius:6px; text-align:center; line-height:1.6; }',
      '.lsp-rem-form { background:#0f3460; padding:12px; border-radius:6px; margin-top:12px; }',
      '.lsp-rem-form label { display:block; margin:6px 0 2px; font-size:12px; color:#88aacc; }',
      '.lsp-rem-form input, .lsp-rem-form select, .lsp-rem-form textarea { width:100%; padding:6px 8px; border:1px solid #555; border-radius:4px; background:#1a1a2e; color:#e0e0e0; box-sizing:border-box; margin-bottom:4px; font-family:monospace; }',
      '.lsp-rem-form textarea { min-height:60px; resize:vertical; }',
      '.lsp-rem-btn { padding:6px 12px; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold; }',
      '.lsp-rem-btn-add { background:#0066cc; color:#fff; }',
      '.lsp-rem-btn-del { background:#cc3333; color:#fff; }',
      '.lsp-rem-btn-edit { background:#cc9900; color:#fff; }',
      '.lsp-rem-btn-export { background:#339933; color:#fff; }',
      '.lsp-rem-btn-import { background:#666; color:#fff; }',
      '.lsp-rem-lib-item { display:flex; justify-content:space-between; align-items:flex-start; padding:10px 12px; background:#16213e; border-radius:4px; margin:4px 0; }',
      '.lsp-rem-lib-info { flex:1; }',
      '.lsp-rem-lib-cat { font-size:11px; background:#333; padding:2px 6px; border-radius:3px; color:#88ccff; display:inline-block; }',
      '.lsp-rem-lib-pattern { font-size:11px; color:#888; margin-top:2px; }',
      '.lsp-rem-lib-suggestion { font-size:12px; color:#ccc; margin-top:4px; }',
      '.lsp-rem-actions { display:flex; gap:6px; margin-top:12px; }',
      '.lsp-rem-toggle { font-size:18px; transition:transform 0.2s; }',
      '.lsp-rem-toggle.open { transform:rotate(90deg); }',
      '.lsp-rem-no-match { color:#aaa; padding:10px; background:#222; border-radius:4px; text-align:center; margin-bottom:10px; font-size:12px; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  window.renderRemediationPanel = function(findings) {
    injectStyles();
    var library = getLibrary();
    var panel = document.createElement('div');
    panel.className = 'lsp-rem-panel';

    // Header
    var header = document.createElement('div');
    header.className = 'lsp-rem-header';
    var headerText = document.createElement('span');
    headerText.textContent = '💊 Remediation Suggestions';
    var toggle = document.createElement('span');
    toggle.className = 'lsp-rem-toggle';
    toggle.textContent = '▶';
    header.appendChild(headerText);
    header.appendChild(toggle);

    var body = document.createElement('div');
    body.className = 'lsp-rem-body';

    header.addEventListener('click', function() {
      body.classList.toggle('open');
      toggle.classList.toggle('open');
    });

    // Disclaimer
    var disclaimer = document.createElement('div');
    disclaimer.className = 'lsp-rem-disclaimer';
    disclaimer.textContent = '⚠️ User-defined remediation suggestions (not auto-generated)';
    body.appendChild(disclaimer);

    if (library.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'lsp-rem-empty';
      empty.textContent = '📝 Add your first remediation suggestion to get started';
      body.appendChild(empty);
    } else {
      // Match findings against library
      var matchedResults = [];
      findings.forEach(function(f) {
        library.forEach(function(entry) {
          if (matchEntry(f, entry)) {
            matchedResults.push({ finding: f, entry: entry });
          }
        });
      });

      if (matchedResults.length === 0) {
        var noMatch = document.createElement('div');
        noMatch.className = 'lsp-rem-no-match';
        noMatch.textContent = 'No remediation matches for current findings. Library has ' + library.length + ' entries.';
        body.appendChild(noMatch);
      } else {
        var matchTitle = document.createElement('div');
        matchTitle.style.cssText = 'font-weight:bold;color:#66ff66;margin-bottom:8px;';
        matchTitle.textContent = '✅ ' + matchedResults.length + ' Remediation Match(es) Found';
        body.appendChild(matchTitle);

        matchedResults.forEach(function(mr) {
          var matchDiv = document.createElement('div');
          matchDiv.className = 'lsp-rem-match';
          var findingDiv = document.createElement('div');
          findingDiv.className = 'lsp-rem-match-finding';
          var preview = mr.finding.text.length > 100 ? mr.finding.text.substring(0, 100) + '...' : mr.finding.text;
          findingDiv.textContent = '📍 Line ' + (mr.finding.line || '?') + ' [' + (mr.finding.severity || '?') + ']: ' + preview;
          matchDiv.appendChild(findingDiv);

          var sugDiv = document.createElement('div');
          sugDiv.className = 'lsp-rem-match-suggestion';
          var sugText = document.createElement('div');
          sugText.className = 'lsp-rem-match-suggestion-text';
          sugText.textContent = '💡 Fix: ' + mr.entry.suggestion;
          sugDiv.appendChild(sugText);

          if (mr.entry.kbLink) {
            var kb = document.createElement('div');
            kb.className = 'lsp-rem-match-kb';
            var kbLink = document.createElement('a');
            kbLink.href = mr.entry.kbLink;
            kbLink.target = '_blank';
            kbLink.textContent = '📖 KB Article';
            kb.appendChild(kbLink);
            sugDiv.appendChild(kb);
          }

          var copyBtn = document.createElement('button');
          copyBtn.className = 'lsp-rem-copy-btn';
          copyBtn.textContent = '📋 Copy fix';
          copyBtn.addEventListener('click', function() {
            navigator.clipboard.writeText(mr.entry.suggestion).then(function() {
              copyBtn.textContent = '✅ Copied!';
              setTimeout(function() { copyBtn.textContent = '📋 Copy fix'; }, 2000);
            });
          });
          sugDiv.appendChild(copyBtn);
          matchDiv.appendChild(sugDiv);
          body.appendChild(matchDiv);
        });
      }
    }

    // Library list
    var libSection = document.createElement('div');
    libSection.style.marginTop = '16px';
    var libTitle = document.createElement('div');
    libTitle.style.cssText = 'font-weight:bold;color:#88aacc;margin-bottom:8px;font-size:13px;';
    libTitle.textContent = '📚 Remediation Library (' + library.length + ' entries)';
    libSection.appendChild(libTitle);

    var editingId = null;

    function refreshLibList() {
      var lib = getLibrary();
      libList.innerHTML = '';
      lib.forEach(function(entry, idx) {
        var item = document.createElement('div');
        item.className = 'lsp-rem-lib-item';
        var info = document.createElement('div');
        info.className = 'lsp-rem-lib-info';
        var cat = document.createElement('span');
        cat.className = 'lsp-rem-lib-cat';
        cat.textContent = entry.category || 'Any';
        info.appendChild(cat);
        var pat = document.createElement('div');
        pat.className = 'lsp-rem-lib-pattern';
        pat.textContent = 'Pattern: ' + (entry.pattern || '*');
        info.appendChild(pat);
        var sug = document.createElement('div');
        sug.className = 'lsp-rem-lib-suggestion';
        sug.textContent = entry.suggestion.length > 60 ? entry.suggestion.substring(0, 60) + '...' : entry.suggestion;
        info.appendChild(sug);
        item.appendChild(info);

        var btns = document.createElement('div');
        btns.style.display = 'flex';
        btns.style.gap = '4px';
        var editBtn = document.createElement('button');
        editBtn.className = 'lsp-rem-btn lsp-rem-btn-edit';
        editBtn.textContent = '✏️';
        editBtn.addEventListener('click', function() {
          editingId = idx;
          catInput.value = entry.category || '';
          patInput.value = entry.pattern || '';
          sugInput.value = entry.suggestion || '';
          kbInput.value = entry.kbLink || '';
          addBtn.textContent = '💾 Save';
        });
        var delBtn = document.createElement('button');
        delBtn.className = 'lsp-rem-btn lsp-rem-btn-del';
        delBtn.textContent = '🗑️';
        delBtn.addEventListener('click', function() {
          var lib = getLibrary();
          lib.splice(idx, 1);
          saveLibrary(lib);
          refreshLibList();
        });
        btns.appendChild(editBtn);
        btns.appendChild(delBtn);
        item.appendChild(btns);
        libList.appendChild(item);
      });
    }

    var libList = document.createElement('div');
    libSection.appendChild(libList);
    body.appendChild(libSection);

    // Add/Edit form
    var form = document.createElement('div');
    form.className = 'lsp-rem-form';
    var formTitle = document.createElement('div');
    formTitle.style.cssText = 'font-weight:bold;margin-bottom:8px;color:#88ccff;';
    formTitle.textContent = '➕ Add / Edit Remediation Entry';
    form.appendChild(formTitle);

    var lbl1 = document.createElement('label');
    lbl1.textContent = 'Category:';
    var catInput = document.createElement('input');
    catInput.type = 'text';
    catInput.placeholder = 'e.g., security, performance, error';

    var lbl2 = document.createElement('label');
    lbl2.textContent = 'Pattern (regex or text to match):';
    var patInput = document.createElement('input');
    patInput.type = 'text';
    patInput.placeholder = 'e.g., connection refused|timeout';

    var lbl3 = document.createElement('label');
    lbl3.textContent = 'Remediation Suggestion:';
    var sugInput = document.createElement('textarea');
    sugInput.placeholder = 'e.g., Check firewall rules and ensure port 5432 is open';

    var lbl4 = document.createElement('label');
    lbl4.textContent = 'KB Link (optional):';
    var kbInput = document.createElement('input');
    kbInput.type = 'text';
    kbInput.placeholder = 'https://wiki.example.com/article';

    var addBtn = document.createElement('button');
    addBtn.className = 'lsp-rem-btn lsp-rem-btn-add';
    addBtn.textContent = '➕ Add Entry';
    addBtn.style.marginTop = '8px';
    addBtn.addEventListener('click', function() {
      var category = catInput.value.trim();
      var pattern = patInput.value.trim();
      var suggestion = sugInput.value.trim();
      var kbLink = kbInput.value.trim();
      if (!suggestion) return;
      var lib = getLibrary();
      var userName = localStorage.getItem('lsp_user_name') || 'anonymous';
      if (editingId !== null) {
        lib[editingId] = { category: category, pattern: pattern, suggestion: suggestion, kbLink: kbLink, addedBy: lib[editingId].addedBy, dateAdded: lib[editingId].dateAdded };
        editingId = null;
        addBtn.textContent = '➕ Add Entry';
      } else {
        lib.push({ category: category, pattern: pattern, suggestion: suggestion, kbLink: kbLink, addedBy: userName, dateAdded: new Date().toISOString() });
      }
      saveLibrary(lib);
      catInput.value = '';
      patInput.value = '';
      sugInput.value = '';
      kbInput.value = '';
      refreshLibList();
    });

    form.appendChild(lbl1);
    form.appendChild(catInput);
    form.appendChild(lbl2);
    form.appendChild(patInput);
    form.appendChild(lbl3);
    form.appendChild(sugInput);
    form.appendChild(lbl4);
    form.appendChild(kbInput);
    form.appendChild(addBtn);
    body.appendChild(form);

    // Import/Export
    var actions = document.createElement('div');
    actions.className = 'lsp-rem-actions';

    var exportBtn = document.createElement('button');
    exportBtn.className = 'lsp-rem-btn lsp-rem-btn-export';
    exportBtn.textContent = '📤 Export Library';
    exportBtn.addEventListener('click', function() {
      var data = JSON.stringify(getLibrary(), null, 2);
      var blob = new Blob([data], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'remediation-library.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    var importBtn = document.createElement('button');
    importBtn.className = 'lsp-rem-btn lsp-rem-btn-import';
    importBtn.textContent = '📥 Import Library';
    importBtn.addEventListener('click', function() {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
          try {
            var imported = JSON.parse(ev.target.result);
            if (Array.isArray(imported)) {
              saveLibrary(imported);
              refreshLibList();
            }
          } catch(err) { /* ignore invalid */ }
        };
        reader.readAsText(file);
      };
      input.click();
    });

    actions.appendChild(exportBtn);
    actions.appendChild(importBtn);
    body.appendChild(actions);

    panel.appendChild(header);
    panel.appendChild(body);
    refreshLibList();

    return panel;
  };

})();
