(function() {
  "use strict";

  var STORAGE_KEY = 'lsp_runbooks';
  var USER_KEY = 'lsp_runbook_user';

  function getRunbooks() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch(e) { return []; }
  }

  function saveRunbooks(runbooks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runbooks));
  }

  function getUserName() {
    return localStorage.getItem(USER_KEY) || '';
  }

  function setUserName(name) {
    localStorage.setItem(USER_KEY, name);
  }

  function promptUserName() {
    var stored = getUserName();
    if (stored) return stored;
    var name = prompt('Enter your name for runbook completion tracking:');
    if (name && name.trim()) {
      setUserName(name.trim());
      return name.trim();
    }
    return '';
  }

  function generateId() {
    return 'rb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function getCompletionPct(runbook) {
    if (!runbook.steps || runbook.steps.length === 0) return 0;
    var done = runbook.steps.filter(function(s) { return s.isCompleted; }).length;
    return Math.round((done / runbook.steps.length) * 100);
  }

  function injectStyles() {
    if (document.getElementById('lsp-runbook-styles')) return;
    var style = document.createElement('style');
    style.id = 'lsp-runbook-styles';
    style.textContent = [
      '.lsp-rb-panel { border:1px solid #444; border-radius:8px; margin:10px 0; background:#1a1a2e; color:#e0e0e0; font-family:monospace; }',
      '.lsp-rb-header { padding:12px 16px; cursor:pointer; font-size:16px; font-weight:bold; background:#16213e; border-radius:8px 8px 0 0; display:flex; justify-content:space-between; align-items:center; }',
      '.lsp-rb-header:hover { background:#1a2744; }',
      '.lsp-rb-body { padding:16px; display:none; }',
      '.lsp-rb-body.open { display:block; }',
      '.lsp-rb-runbook { background:#0a1a3a; border:1px solid #336; border-radius:6px; padding:12px; margin-bottom:12px; }',
      '.lsp-rb-runbook-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }',
      '.lsp-rb-runbook-name { font-weight:bold; color:#88ccff; font-size:14px; }',
      '.lsp-rb-runbook-cat { font-size:11px; background:#333; padding:2px 6px; border-radius:3px; color:#aaa; }',
      '.lsp-rb-progress { height:6px; background:#333; border-radius:3px; overflow:hidden; margin:6px 0; }',
      '.lsp-rb-progress-bar { height:100%; background:#33cc33; transition:width 0.3s; }',
      '.lsp-rb-progress-text { font-size:11px; color:#aaa; }',
      '.lsp-rb-step { display:flex; align-items:flex-start; gap:8px; padding:6px 8px; margin:3px 0; background:#111; border-radius:4px; }',
      '.lsp-rb-step.completed { background:#0a2a0a; }',
      '.lsp-rb-step input[type="checkbox"] { margin-top:3px; cursor:pointer; }',
      '.lsp-rb-step-text { flex:1; font-size:12px; }',
      '.lsp-rb-step-text.done { text-decoration:line-through; color:#666; }',
      '.lsp-rb-step-meta { font-size:10px; color:#666; margin-top:2px; }',
      '.lsp-rb-matched { border-left:3px solid #33cc33; }',
      '.lsp-rb-matched-badge { font-size:10px; background:#33cc33; color:#000; padding:2px 6px; border-radius:3px; font-weight:bold; }',
      '.lsp-rb-form { background:#0f3460; padding:12px; border-radius:6px; margin-top:12px; }',
      '.lsp-rb-form label { display:block; margin:6px 0 2px; font-size:12px; color:#88aacc; }',
      '.lsp-rb-form input, .lsp-rb-form select, .lsp-rb-form textarea { width:100%; padding:6px 8px; border:1px solid #555; border-radius:4px; background:#1a1a2e; color:#e0e0e0; box-sizing:border-box; margin-bottom:4px; font-family:monospace; }',
      '.lsp-rb-form textarea { min-height:80px; resize:vertical; }',
      '.lsp-rb-btn { padding:6px 12px; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold; margin-right:4px; }',
      '.lsp-rb-btn-add { background:#0066cc; color:#fff; }',
      '.lsp-rb-btn-del { background:#cc3333; color:#fff; }',
      '.lsp-rb-btn-edit { background:#cc9900; color:#fff; }',
      '.lsp-rb-btn-export { background:#339933; color:#fff; }',
      '.lsp-rb-btn-secondary { background:#555; color:#fff; }',
      '.lsp-rb-empty { color:#aaa; padding:16px; background:#222; border-radius:6px; text-align:center; }',
      '.lsp-rb-actions { display:flex; gap:6px; margin-top:12px; flex-wrap:wrap; }',
      '.lsp-rb-toggle { font-size:18px; transition:transform 0.2s; }',
      '.lsp-rb-toggle.open { transform:rotate(90deg); }'
    ].join('\n');
    document.head.appendChild(style);
  }

  window.renderRunbookExecutorPanel = function(findings) {
    injectStyles();
    var runbooks = getRunbooks();
    var panel = document.createElement('div');
    panel.className = 'lsp-rb-panel';

    // Header
    var header = document.createElement('div');
    header.className = 'lsp-rb-header';
    var headerText = document.createElement('span');
    headerText.textContent = '📋 Runbook Executor';
    var toggle = document.createElement('span');
    toggle.className = 'lsp-rb-toggle';
    toggle.textContent = '▶';
    header.appendChild(headerText);
    header.appendChild(toggle);

    var body = document.createElement('div');
    body.className = 'lsp-rb-body';

    header.addEventListener('click', function() {
      body.classList.toggle('open');
      toggle.classList.toggle('open');
    });

    var contentArea = document.createElement('div');

    function renderContent() {
      contentArea.innerHTML = '';
      var currentRunbooks = getRunbooks();

      // Find categories present in findings
      var findingCategories = {};
      findings.forEach(function(f) {
        if (f.category) {
          findingCategories[f.category.toLowerCase()] = true;
        }
      });

      if (currentRunbooks.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'lsp-rb-empty';
        empty.textContent = '📋 No runbooks defined. Add a runbook below to get started.';
        contentArea.appendChild(empty);
        return;
      }

      // Sort: matched runbooks first
      var sorted = currentRunbooks.slice().sort(function(a, b) {
        var aMatch = findingCategories[a.category.toLowerCase()] ? 0 : 1;
        var bMatch = findingCategories[b.category.toLowerCase()] ? 0 : 1;
        return aMatch - bMatch;
      });

      sorted.forEach(function(rb) {
        var isMatched = findingCategories[rb.category.toLowerCase()];
        var rbDiv = document.createElement('div');
        rbDiv.className = 'lsp-rb-runbook' + (isMatched ? ' lsp-rb-matched' : '');

        var rbHeader = document.createElement('div');
        rbHeader.className = 'lsp-rb-runbook-header';
        var nameSpan = document.createElement('span');
        nameSpan.className = 'lsp-rb-runbook-name';
        nameSpan.textContent = rb.name;
        rbHeader.appendChild(nameSpan);

        var rightDiv = document.createElement('span');
        var catSpan = document.createElement('span');
        catSpan.className = 'lsp-rb-runbook-cat';
        catSpan.textContent = rb.category;
        rightDiv.appendChild(catSpan);

        if (isMatched) {
          var badge = document.createElement('span');
          badge.className = 'lsp-rb-matched-badge';
          badge.textContent = ' ACTIVE';
          badge.style.marginLeft = '6px';
          rightDiv.appendChild(badge);
        }

        var delBtn = document.createElement('button');
        delBtn.className = 'lsp-rb-btn lsp-rb-btn-del';
        delBtn.textContent = '🗑️';
        delBtn.style.marginLeft = '6px';
        delBtn.addEventListener('click', function() {
          var rbs = getRunbooks().filter(function(r) { return r.id !== rb.id; });
          saveRunbooks(rbs);
          renderContent();
        });
        rightDiv.appendChild(delBtn);
        rbHeader.appendChild(rightDiv);
        rbDiv.appendChild(rbHeader);

        // Progress
        var pct = getCompletionPct(rb);
        var progressContainer = document.createElement('div');
        progressContainer.className = 'lsp-rb-progress';
        var progressBar = document.createElement('div');
        progressBar.className = 'lsp-rb-progress-bar';
        progressBar.style.width = pct + '%';
        progressContainer.appendChild(progressBar);
        rbDiv.appendChild(progressContainer);
        var pctText = document.createElement('div');
        pctText.className = 'lsp-rb-progress-text';
        pctText.textContent = pct + '% complete (' + rb.steps.filter(function(s){return s.isCompleted;}).length + '/' + rb.steps.length + ' steps)';
        rbDiv.appendChild(pctText);

        // Steps
        rb.steps.forEach(function(step, idx) {
          var stepDiv = document.createElement('div');
          stepDiv.className = 'lsp-rb-step' + (step.isCompleted ? ' completed' : '');
          var cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = step.isCompleted;
          cb.addEventListener('change', function() {
            var rbs = getRunbooks();
            var targetRb = rbs.find(function(r) { return r.id === rb.id; });
            if (targetRb) {
              var userName = promptUserName();
              if (cb.checked) {
                targetRb.steps[idx].isCompleted = true;
                targetRb.steps[idx].completedAt = Date.now();
                targetRb.steps[idx].completedBy = userName;
              } else {
                targetRb.steps[idx].isCompleted = false;
                targetRb.steps[idx].completedAt = null;
                targetRb.steps[idx].completedBy = null;
              }
              saveRunbooks(rbs);
              renderContent();
            }
          });
          stepDiv.appendChild(cb);

          var textDiv = document.createElement('div');
          var stepText = document.createElement('div');
          stepText.className = 'lsp-rb-step-text' + (step.isCompleted ? ' done' : '');
          stepText.textContent = step.text;
          textDiv.appendChild(stepText);

          if (step.isCompleted && step.completedAt) {
            var meta = document.createElement('div');
            meta.className = 'lsp-rb-step-meta';
            meta.textContent = '✓ ' + (step.completedBy || 'unknown') + ' at ' + new Date(step.completedAt).toLocaleString();
            textDiv.appendChild(meta);
          }
          stepDiv.appendChild(textDiv);
          rbDiv.appendChild(stepDiv);
        });

        // Export button for completed runbooks
        if (pct > 0) {
          var exportRbBtn = document.createElement('button');
          exportRbBtn.className = 'lsp-rb-btn lsp-rb-btn-export';
          exportRbBtn.textContent = '📤 Export Proof-of-Work';
          exportRbBtn.style.marginTop = '8px';
          exportRbBtn.addEventListener('click', function() {
            var report = {
              runbook: rb.name,
              category: rb.category,
              completionPct: pct,
              exportedAt: new Date().toISOString(),
              steps: rb.steps.map(function(s) {
                return {
                  text: s.text,
                  isCompleted: s.isCompleted,
                  completedAt: s.completedAt ? new Date(s.completedAt).toISOString() : null,
                  completedBy: s.completedBy || null
                };
              })
            };
            var textReport = '=== RUNBOOK PROOF-OF-WORK ===\n' +
              'Runbook: ' + rb.name + '\n' +
              'Category: ' + rb.category + '\n' +
              'Completion: ' + pct + '%\n' +
              'Exported: ' + new Date().toISOString() + '\n\n' +
              'STEPS:\n' +
              rb.steps.map(function(s, i) {
                var status = s.isCompleted ? '[✓]' : '[ ]';
                var detail = s.isCompleted ? ' (by ' + (s.completedBy || '?') + ' at ' + new Date(s.completedAt).toLocaleString() + ')' : '';
                return status + ' ' + (i + 1) + '. ' + s.text + detail;
              }).join('\n');
            var blob = new Blob([textReport], { type: 'text/plain' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'runbook-pow-' + rb.id + '.txt';
            a.click();
            URL.revokeObjectURL(url);
          });
          rbDiv.appendChild(exportRbBtn);
        }

        contentArea.appendChild(rbDiv);
      });
    }

    body.appendChild(contentArea);
    renderContent();

    // Add form
    var form = document.createElement('div');
    form.className = 'lsp-rb-form';
    var formTitle = document.createElement('div');
    formTitle.style.cssText = 'font-weight:bold;margin-bottom:8px;color:#88ccff;';
    formTitle.textContent = '➕ Add New Runbook';
    form.appendChild(formTitle);

    var lbl1 = document.createElement('label');
    lbl1.textContent = 'Runbook Name:';
    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'e.g., Memory Issue Triage';

    var lbl2 = document.createElement('label');
    lbl2.textContent = 'Category (matches finding category):';
    var catInput = document.createElement('input');
    catInput.type = 'text';
    catInput.placeholder = 'e.g., memory, security, network';

    var lbl3 = document.createElement('label');
    lbl3.textContent = 'Steps (one per line):';
    var stepsInput = document.createElement('textarea');
    stepsInput.placeholder = 'Check memory usage with free -m\nReview OOM logs in /var/log/syslog\nRestart affected service\nVerify service recovery';

    var addBtn = document.createElement('button');
    addBtn.className = 'lsp-rb-btn lsp-rb-btn-add';
    addBtn.textContent = '➕ Add Runbook';
    addBtn.style.marginTop = '8px';
    addBtn.addEventListener('click', function() {
      var name = nameInput.value.trim();
      var category = catInput.value.trim();
      var stepsText = stepsInput.value.trim();
      if (!name || !category || !stepsText) return;
      var stepLines = stepsText.split('\n').filter(function(l) { return l.trim(); });
      var steps = stepLines.map(function(line) {
        return { text: line.trim(), isCompleted: false, completedAt: null, completedBy: null };
      });
      var rbs = getRunbooks();
      rbs.push({ id: generateId(), name: name, category: category, steps: steps });
      saveRunbooks(rbs);
      nameInput.value = '';
      catInput.value = '';
      stepsInput.value = '';
      renderContent();
    });

    form.appendChild(lbl1);
    form.appendChild(nameInput);
    form.appendChild(lbl2);
    form.appendChild(catInput);
    form.appendChild(lbl3);
    form.appendChild(stepsInput);
    form.appendChild(addBtn);
    body.appendChild(form);

    panel.appendChild(header);
    panel.appendChild(body);

    return panel;
  };

})();
