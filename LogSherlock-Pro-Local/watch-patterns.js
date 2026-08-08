(function() {
  "use strict";

  var STORAGE_KEY = 'lsp_watch_patterns';

  function getPatterns() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch(e) { return []; }
  }

  function savePatterns(patterns) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
  }

  function generateId() {
    return 'wp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function matchFinding(finding, wp) {
    var textToSearch = (finding.text || '') + ' ' + (finding.context || '');
    if (wp.isRegex) {
      try {
        var re = new RegExp(wp.pattern, 'i');
        return re.test(textToSearch);
      } catch(e) { return false; }
    } else {
      return textToSearch.toLowerCase().indexOf(wp.pattern.toLowerCase()) !== -1;
    }
  }

  function injectStyles() {
    if (document.getElementById('lsp-watch-patterns-styles')) return;
    var style = document.createElement('style');
    style.id = 'lsp-watch-patterns-styles';
    style.textContent = [
      '.lsp-wp-panel { border:1px solid #444; border-radius:8px; margin:10px 0; background:#1a1a2e; color:#e0e0e0; font-family:monospace; }',
      '.lsp-wp-header { padding:12px 16px; cursor:pointer; font-size:16px; font-weight:bold; background:#16213e; border-radius:8px 8px 0 0; display:flex; justify-content:space-between; align-items:center; }',
      '.lsp-wp-header:hover { background:#1a2744; }',
      '.lsp-wp-body { padding:16px; display:none; }',
      '.lsp-wp-body.open { display:block; }',
      '.lsp-wp-alert { background:#3d0000; border:1px solid #ff4444; border-radius:6px; padding:12px; margin-bottom:12px; }',
      '.lsp-wp-alert-header { color:#ff6666; font-weight:bold; font-size:14px; margin-bottom:8px; }',
      '.lsp-wp-match-item { background:#2a0000; padding:6px 10px; margin:4px 0; border-radius:4px; font-size:12px; color:#ffaaaa; }',
      '.lsp-wp-no-match { color:#66ff66; padding:12px; background:#002200; border-radius:6px; text-align:center; }',
      '.lsp-wp-setup { color:#aaa; padding:16px; background:#222; border-radius:6px; line-height:1.6; }',
      '.lsp-wp-form { background:#0f3460; padding:12px; border-radius:6px; margin-top:12px; }',
      '.lsp-wp-form label { display:block; margin:6px 0 2px; font-size:12px; color:#88aacc; }',
      '.lsp-wp-form input, .lsp-wp-form select { width:100%; padding:6px 8px; border:1px solid #555; border-radius:4px; background:#1a1a2e; color:#e0e0e0; box-sizing:border-box; margin-bottom:4px; }',
      '.lsp-wp-form-row { display:flex; gap:8px; align-items:center; margin:6px 0; }',
      '.lsp-wp-btn { padding:6px 12px; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold; }',
      '.lsp-wp-btn-add { background:#0066cc; color:#fff; }',
      '.lsp-wp-btn-add:hover { background:#0077ee; }',
      '.lsp-wp-btn-del { background:#cc3333; color:#fff; }',
      '.lsp-wp-btn-del:hover { background:#ee4444; }',
      '.lsp-wp-btn-edit { background:#cc9900; color:#fff; }',
      '.lsp-wp-btn-edit:hover { background:#ddaa00; }',
      '.lsp-wp-btn-export { background:#339933; color:#fff; }',
      '.lsp-wp-btn-import { background:#666; color:#fff; }',
      '.lsp-wp-list { margin-top:12px; }',
      '.lsp-wp-list-item { display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#16213e; border-radius:4px; margin:4px 0; }',
      '.lsp-wp-list-item-info { flex:1; }',
      '.lsp-wp-list-item-label { font-weight:bold; color:#88ccff; }',
      '.lsp-wp-list-item-pattern { font-size:11px; color:#888; margin-top:2px; }',
      '.lsp-wp-priority { font-size:10px; padding:2px 6px; border-radius:3px; margin-left:6px; }',
      '.lsp-wp-priority-high { background:#cc3333; color:#fff; }',
      '.lsp-wp-priority-medium { background:#cc9900; color:#fff; }',
      '.lsp-wp-priority-low { background:#336633; color:#fff; }',
      '.lsp-wp-actions { display:flex; gap:6px; margin-top:12px; }',
      '.lsp-wp-toggle { font-size:18px; transition:transform 0.2s; }',
      '.lsp-wp-toggle.open { transform:rotate(90deg); }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function renderPatternList(patterns, container, onEdit, onDelete) {
    container.innerHTML = '';
    if (patterns.length === 0) return;
    var title = document.createElement('div');
    title.style.cssText = 'font-size:13px;color:#88aacc;margin-bottom:6px;font-weight:bold;';
    title.textContent = '📋 Defined Watch Patterns (' + patterns.length + ')';
    container.appendChild(title);
    patterns.forEach(function(wp) {
      var item = document.createElement('div');
      item.className = 'lsp-wp-list-item';
      var info = document.createElement('div');
      info.className = 'lsp-wp-list-item-info';
      var labelSpan = document.createElement('span');
      labelSpan.className = 'lsp-wp-list-item-label';
      labelSpan.textContent = wp.label;
      var prioSpan = document.createElement('span');
      prioSpan.className = 'lsp-wp-priority lsp-wp-priority-' + wp.priority;
      prioSpan.textContent = wp.priority;
      var patternDiv = document.createElement('div');
      patternDiv.className = 'lsp-wp-list-item-pattern';
      patternDiv.textContent = (wp.isRegex ? 'regex: ' : 'text: ') + wp.pattern;
      info.appendChild(labelSpan);
      info.appendChild(prioSpan);
      info.appendChild(patternDiv);
      item.appendChild(info);
      var btns = document.createElement('div');
      var editBtn = document.createElement('button');
      editBtn.className = 'lsp-wp-btn lsp-wp-btn-edit';
      editBtn.textContent = '✏️';
      editBtn.onclick = function() { onEdit(wp); };
      var delBtn = document.createElement('button');
      delBtn.className = 'lsp-wp-btn lsp-wp-btn-del';
      delBtn.textContent = '🗑️';
      delBtn.onclick = function() { onDelete(wp.id); };
      btns.appendChild(editBtn);
      btns.appendChild(delBtn);
      item.appendChild(btns);
      container.appendChild(item);
    });
  }

  window.renderWatchPatternsPanel = function(findings) {
    injectStyles();
    var patterns = getPatterns();
    var panel = document.createElement('div');
    panel.className = 'lsp-wp-panel';

    // Header
    var header = document.createElement('div');
    header.className = 'lsp-wp-header';
    var headerText = document.createElement('span');
    headerText.textContent = '👁️ Watch Patterns';
    var toggle = document.createElement('span');
    toggle.className = 'lsp-wp-toggle';
    toggle.textContent = '▶';
    header.appendChild(headerText);
    header.appendChild(toggle);

    var body = document.createElement('div');
    body.className = 'lsp-wp-body';

    header.addEventListener('click', function() {
      body.classList.toggle('open');
      toggle.classList.toggle('open');
    });

    // Match findings against patterns
    var matchResults = [];
    patterns.forEach(function(wp) {
      var matched = [];
      findings.forEach(function(f) {
        if (matchFinding(f, wp)) {
          matched.push(f);
        }
      });
      if (matched.length > 0) {
        matchResults.push({ pattern: wp, matches: matched });
      }
    });

    // Sort by priority
    var prioOrder = { high: 0, medium: 1, low: 2 };
    matchResults.sort(function(a, b) {
      return (prioOrder[a.pattern.priority] || 2) - (prioOrder[b.pattern.priority] || 2);
    });

    // Render matches or status
    if (patterns.length === 0) {
      var setup = document.createElement('div');
      setup.className = 'lsp-wp-setup';
      setup.innerHTML = '<strong>🔧 Watch Patterns Setup</strong><br><br>' +
        'Watch patterns let you monitor specific text or regex patterns across log findings.<br><br>' +
        '<strong>How to use:</strong><br>' +
        '1. Click "Add Pattern" below<br>' +
        '2. Enter a label (e.g., "OOM Killer")<br>' +
        '3. Enter a pattern (text or regex)<br>' +
        '4. Set priority (high/medium/low)<br>' +
        '5. On each scan, matches will be highlighted at the top<br><br>' +
        '<em>Patterns are stored locally and persist across sessions.</em>';
      body.appendChild(setup);
    } else if (matchResults.length === 0) {
      var noMatch = document.createElement('div');
      noMatch.className = 'lsp-wp-no-match';
      noMatch.textContent = '✓ No watch pattern matches in this scan';
      body.appendChild(noMatch);
    } else {
      matchResults.forEach(function(mr) {
        var alert = document.createElement('div');
        alert.className = 'lsp-wp-alert';
        var alertHeader = document.createElement('div');
        alertHeader.className = 'lsp-wp-alert-header';
        alertHeader.textContent = '🚨 ' + mr.pattern.label + ' — ' + mr.matches.length + ' match(es)';
        alert.appendChild(alertHeader);
        mr.matches.forEach(function(m) {
          var matchItem = document.createElement('div');
          matchItem.className = 'lsp-wp-match-item';
          var preview = m.text.length > 80 ? m.text.substring(0, 80) + '...' : m.text;
          matchItem.textContent = 'Line ' + (m.line || '?') + ': ' + preview;
          alert.appendChild(matchItem);
        });
        body.appendChild(alert);
      });
    }

    // Pattern list
    var listContainer = document.createElement('div');
    listContainer.className = 'lsp-wp-list';

    var editingId = null;

    function refreshList() {
      renderPatternList(getPatterns(), listContainer, function(wp) {
        editingId = wp.id;
        labelInput.value = wp.label;
        patternInput.value = wp.pattern;
        regexSelect.value = wp.isRegex ? 'true' : 'false';
        prioritySelect.value = wp.priority;
        addBtn.textContent = '💾 Save';
      }, function(id) {
        var p = getPatterns().filter(function(x) { return x.id !== id; });
        savePatterns(p);
        refreshList();
      });
    }

    body.appendChild(listContainer);

    // Add/Edit form
    var form = document.createElement('div');
    form.className = 'lsp-wp-form';
    var formTitle = document.createElement('div');
    formTitle.style.cssText = 'font-weight:bold;margin-bottom:8px;color:#88ccff;';
    formTitle.textContent = '➕ Add / Edit Watch Pattern';
    form.appendChild(formTitle);

    var lbl1 = document.createElement('label');
    lbl1.textContent = 'Label:';
    var labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.placeholder = 'e.g., OOM Killer';

    var lbl2 = document.createElement('label');
    lbl2.textContent = 'Pattern:';
    var patternInput = document.createElement('input');
    patternInput.type = 'text';
    patternInput.placeholder = 'e.g., Out of memory or oom.*kill';

    var lbl3 = document.createElement('label');
    lbl3.textContent = 'Type:';
    var regexSelect = document.createElement('select');
    regexSelect.innerHTML = '<option value="false">Text (contains)</option><option value="true">Regex</option>';

    var lbl4 = document.createElement('label');
    lbl4.textContent = 'Priority:';
    var prioritySelect = document.createElement('select');
    prioritySelect.innerHTML = '<option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>';

    var addBtn = document.createElement('button');
    addBtn.className = 'lsp-wp-btn lsp-wp-btn-add';
    addBtn.textContent = '➕ Add Pattern';
    addBtn.style.marginTop = '8px';
    addBtn.addEventListener('click', function() {
      var label = labelInput.value.trim();
      var pattern = patternInput.value.trim();
      if (!label || !pattern) return;
      var patterns = getPatterns();
      if (editingId) {
        patterns = patterns.map(function(p) {
          if (p.id === editingId) {
            return { id: p.id, label: label, pattern: pattern, isRegex: regexSelect.value === 'true', priority: prioritySelect.value };
          }
          return p;
        });
        editingId = null;
        addBtn.textContent = '➕ Add Pattern';
      } else {
        patterns.push({ id: generateId(), label: label, pattern: pattern, isRegex: regexSelect.value === 'true', priority: prioritySelect.value });
      }
      savePatterns(patterns);
      labelInput.value = '';
      patternInput.value = '';
      regexSelect.value = 'false';
      prioritySelect.value = 'high';
      refreshList();
    });

    form.appendChild(lbl1);
    form.appendChild(labelInput);
    form.appendChild(lbl2);
    form.appendChild(patternInput);
    form.appendChild(lbl3);
    form.appendChild(regexSelect);
    form.appendChild(lbl4);
    form.appendChild(prioritySelect);
    form.appendChild(addBtn);
    body.appendChild(form);

    // Import/Export
    var actions = document.createElement('div');
    actions.className = 'lsp-wp-actions';

    var exportBtn = document.createElement('button');
    exportBtn.className = 'lsp-wp-btn lsp-wp-btn-export';
    exportBtn.textContent = '📤 Export Patterns';
    exportBtn.addEventListener('click', function() {
      var data = JSON.stringify(getPatterns(), null, 2);
      var blob = new Blob([data], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'watch-patterns.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    var importBtn = document.createElement('button');
    importBtn.className = 'lsp-wp-btn lsp-wp-btn-import';
    importBtn.textContent = '📥 Import Patterns';
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
              savePatterns(imported);
              refreshList();
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
    refreshList();

    return panel;
  };

})();
