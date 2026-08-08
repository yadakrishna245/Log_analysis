/**
 * LogSherlock Pro — Custom Pattern Editor
 * Lets engineers define their own regex patterns that run alongside built-in ones.
 * Storage: localStorage key 'logsherlock_custom_patterns'
 */
(function () {
  if (typeof window === 'undefined') return;

  const STORAGE_KEY = 'logsherlock_custom_patterns';
  const ACCENT = '#01a982';
  const BG = '#1e1e2e';
  const BG_CARD = '#2a2a3e';
  const BG_INPUT = '#33334d';
  const TEXT = '#e0e0e0';
  const TEXT_MUTED = '#a0a0b0';
  const BORDER = '#3a3a5a';
  const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
  const SEVERITY_COLORS = {
    CRITICAL: '#ff4d6a',
    HIGH: '#ff8c42',
    MEDIUM: '#ffd166',
    LOW: '#06d6a0',
    INFO: '#118ab2'
  };

  let editingPatternId = null;

  // --- Storage Helpers ---
  function loadPatterns() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('[LogSherlock] Failed to load custom patterns:', e);
      return [];
    }
  }

  function savePatterns(patterns) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
    } catch (e) {
      console.error('[LogSherlock] Failed to save custom patterns:', e);
    }
  }

  function generateId() {
    return 'cp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // --- Public API ---
  function getCustomPatterns() {
    return loadPatterns()
      .filter(function (p) { return p.enabled; })
      .map(function (p) {
        return {
          id: p.id,
          name: p.name,
          regex: p.regex,
          severity: p.severity,
          category: p.category,
          description: p.description,
          solution_hint: p.solution_hint,
          custom: true
        };
      });
  }



  // --- Validation ---
  function validateRegex(regexStr) {
    if (!regexStr || !regexStr.trim()) return { valid: false, error: 'Regex cannot be empty' };
    try {
      new RegExp(regexStr);
      return { valid: true, error: null };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }

  function testRegexAgainstFindings(regexStr) {
    var result = validateRegex(regexStr);
    if (!result.valid) return { matches: 0, error: result.error };
    var re = new RegExp(regexStr, 'gi');
    var findings = window.lastScanFindings || window.scanFindings || [];
    var matchCount = 0;
    findings.forEach(function (f) {
      var content = f.line_content || f.lineContent || f.raw || '';
      if (re.test(content)) matchCount++;
      re.lastIndex = 0;
    });
    return { matches: matchCount, error: null };
  }

  // --- Style Injection ---
  function injectStyles() {
    if (document.getElementById('logsherlock-cpe-styles')) return;
    var style = document.createElement('style');
    style.id = 'logsherlock-cpe-styles';
    style.textContent = [
      '.cpe-panel { background: ' + BG + '; color: ' + TEXT + '; padding: 24px; border-radius: 12px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 900px; margin: 20px auto; }',
      '.cpe-title { font-size: 1.4rem; font-weight: 700; margin-bottom: 20px; color: ' + ACCENT + '; }',
      '.cpe-form { background: ' + BG_CARD + '; padding: 20px; border-radius: 8px; border: 1px solid ' + BORDER + '; margin-bottom: 24px; }',
      '.cpe-field { margin-bottom: 14px; }',
      '.cpe-field label { display: block; font-size: 0.85rem; color: ' + TEXT_MUTED + '; margin-bottom: 4px; font-weight: 600; }',
      '.cpe-field input, .cpe-field textarea, .cpe-field select { width: 100%; padding: 10px 12px; background: ' + BG_INPUT + '; border: 1px solid ' + BORDER + '; border-radius: 6px; color: ' + TEXT + '; font-size: 0.9rem; box-sizing: border-box; }',
      '.cpe-field input:focus, .cpe-field textarea:focus, .cpe-field select:focus { outline: none; border-color: ' + ACCENT + '; box-shadow: 0 0 0 2px ' + ACCENT + '33; }',
      '.cpe-field textarea { min-height: 60px; resize: vertical; }',
      '.cpe-regex-wrap { position: relative; }',
      '.cpe-regex-indicator { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 1.1rem; }',
      '.cpe-btn { padding: 10px 18px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 600; transition: opacity 0.2s; }',
      '.cpe-btn:hover { opacity: 0.85; }',
      '.cpe-btn-primary { background: ' + ACCENT + '; color: #000; }',
      '.cpe-btn-secondary { background: ' + BG_INPUT + '; color: ' + TEXT + '; border: 1px solid ' + BORDER + '; }',
      '.cpe-btn-danger { background: #ff4d6a22; color: #ff4d6a; border: 1px solid #ff4d6a44; }',
      '.cpe-btn-group { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }',
      '.cpe-test-result { margin-top: 8px; font-size: 0.85rem; padding: 8px 12px; border-radius: 6px; background: ' + BG_INPUT + '; }',
      '.cpe-list { margin-top: 16px; }',
      '.cpe-list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px; }',
      '.cpe-list-count { font-size: 0.9rem; color: ' + TEXT_MUTED + '; }',
      '.cpe-pattern-card { background: ' + BG_CARD + '; border: 1px solid ' + BORDER + '; border-radius: 8px; padding: 14px 18px; margin-bottom: 10px; }',
      '.cpe-pattern-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }',
      '.cpe-pattern-name { font-weight: 700; font-size: 1rem; }',
      '.cpe-pattern-regex { font-family: "Fira Code", "Cascadia Code", monospace; font-size: 0.8rem; background: ' + BG_INPUT + '; padding: 4px 8px; border-radius: 4px; color: ' + ACCENT + '; word-break: break-all; margin: 6px 0; display: inline-block; }',
      '.cpe-severity-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }',
      '.cpe-pattern-meta { font-size: 0.8rem; color: ' + TEXT_MUTED + '; margin-top: 6px; }',
      '.cpe-pattern-actions { display: flex; gap: 8px; margin-top: 10px; align-items: center; }',
      '.cpe-toggle { position: relative; width: 40px; height: 22px; cursor: pointer; }',
      '.cpe-toggle input { opacity: 0; width: 0; height: 0; }',
      '.cpe-toggle-slider { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: ' + BG_INPUT + '; border-radius: 22px; transition: 0.3s; }',
      '.cpe-toggle-slider:before { content: ""; position: absolute; height: 16px; width: 16px; left: 3px; bottom: 3px; background: ' + TEXT + '; border-radius: 50%; transition: 0.3s; }',
      '.cpe-toggle input:checked + .cpe-toggle-slider { background: ' + ACCENT + '; }',
      '.cpe-toggle input:checked + .cpe-toggle-slider:before { transform: translateX(18px); }',
      '.cpe-empty { text-align: center; padding: 30px; color: ' + TEXT_MUTED + '; font-style: italic; }',
      '.cpe-import-input { display: none; }'
    ].join('\n');
    document.head.appendChild(style);
  }



  // --- Form Rendering ---
  function renderForm(container) {
    var pattern = editingPatternId ? loadPatterns().find(function (p) { return p.id === editingPatternId; }) : null;
    var formHtml = '<div class="cpe-form">';
    formHtml += '<div class="cpe-field"><label>Pattern Name *</label><input type="text" id="cpe-name" placeholder="e.g., Disk Full Alert" value="' + (pattern ? escapeAttr(pattern.name) : '') + '"></div>';
    formHtml += '<div class="cpe-field"><label>Regex *</label><div class="cpe-regex-wrap"><input type="text" id="cpe-regex" placeholder="e.g., disk\\s+full|no space left" value="' + (pattern ? escapeAttr(pattern.regex) : '') + '"><span id="cpe-regex-indicator" class="cpe-regex-indicator"></span></div><div id="cpe-regex-error" style="color:#ff4d6a;font-size:0.8rem;margin-top:4px;"></div></div>';
    formHtml += '<div class="cpe-field"><label>Severity</label><select id="cpe-severity">';
    SEVERITIES.forEach(function (s) {
      var selected = pattern && pattern.severity === s ? ' selected' : '';
      formHtml += '<option value="' + s + '"' + selected + '>' + s + '</option>';
    });
    formHtml += '</select></div>';
    formHtml += '<div class="cpe-field"><label>Category</label><input type="text" id="cpe-category" placeholder="e.g., storage, network, cluster" value="' + (pattern ? escapeAttr(pattern.category) : '') + '"></div>';
    formHtml += '<div class="cpe-field"><label>Description</label><textarea id="cpe-description" placeholder="What does this pattern detect?">' + (pattern ? escapeHtml(pattern.description) : '') + '</textarea></div>';
    formHtml += '<div class="cpe-field"><label>Solution Hint</label><textarea id="cpe-solution" placeholder="What should an engineer do when this is found?">' + (pattern ? escapeHtml(pattern.solution_hint) : '') + '</textarea></div>';
    formHtml += '<div id="cpe-test-result" class="cpe-test-result" style="display:none;"></div>';
    formHtml += '<div class="cpe-btn-group">';
    formHtml += '<button class="cpe-btn cpe-btn-secondary" id="cpe-test-btn">🧪 Test Regex</button>';
    formHtml += '<button class="cpe-btn cpe-btn-primary" id="cpe-save-btn">' + (editingPatternId ? '💾 Update Pattern' : '💾 Save Pattern') + '</button>';
    if (editingPatternId) {
      formHtml += '<button class="cpe-btn cpe-btn-secondary" id="cpe-cancel-btn">Cancel Edit</button>';
    }
    formHtml += '</div>';
    formHtml += '</div>';
    container.innerHTML = formHtml;
    attachFormListeners(container);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }



  // --- Form Listeners ---
  function attachFormListeners(container) {
    var regexInput = container.querySelector('#cpe-regex');
    var indicator = container.querySelector('#cpe-regex-indicator');
    var errorEl = container.querySelector('#cpe-regex-error');

    if (regexInput) {
      regexInput.addEventListener('input', function () {
        var val = regexInput.value.trim();
        if (!val) {
          indicator.textContent = '';
          errorEl.textContent = '';
          return;
        }
        var result = validateRegex(val);
        if (result.valid) {
          indicator.textContent = '✔️';
          errorEl.textContent = '';
        } else {
          indicator.textContent = '❌';
          errorEl.textContent = result.error;
        }
      });
      // Trigger initial validation if editing
      if (regexInput.value.trim()) {
        regexInput.dispatchEvent(new Event('input'));
      }
    }

    var testBtn = container.querySelector('#cpe-test-btn');
    if (testBtn) {
      testBtn.addEventListener('click', function () {
        var regexVal = container.querySelector('#cpe-regex').value.trim();
        var resultEl = container.querySelector('#cpe-test-result');
        if (!regexVal) {
          resultEl.style.display = 'block';
          resultEl.style.color = '#ff4d6a';
          resultEl.textContent = '❌ Enter a regex first.';
          return;
        }
        var testResult = testRegexAgainstFindings(regexVal);
        resultEl.style.display = 'block';
        if (testResult.error) {
          resultEl.style.color = '#ff4d6a';
          resultEl.textContent = '❌ Invalid regex: ' + testResult.error;
        } else {
          resultEl.style.color = ACCENT;
          resultEl.textContent = '✔️ Regex matched ' + testResult.matches + ' finding(s) in current scan data.';
        }
      });
    }

    var saveBtn = container.querySelector('#cpe-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        handleSave();
      });
    }

    var cancelBtn = container.querySelector('#cpe-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        editingPatternId = null;
        renderCustomPatternPanel();
      });
    }
  }

  function handleSave() {
    var nameVal = document.querySelector('#cpe-name').value.trim();
    var regexVal = document.querySelector('#cpe-regex').value.trim();
    var severityVal = document.querySelector('#cpe-severity').value;
    var categoryVal = document.querySelector('#cpe-category').value.trim();
    var descVal = document.querySelector('#cpe-description').value.trim();
    var solutionVal = document.querySelector('#cpe-solution').value.trim();

    if (!nameVal) {
      alert('Pattern Name is required.');
      return;
    }
    if (!regexVal) {
      alert('Regex is required.');
      return;
    }
    var validation = validateRegex(regexVal);
    if (!validation.valid) {
      alert('Invalid regex: ' + validation.error);
      return;
    }

    var patterns = loadPatterns();

    if (editingPatternId) {
      var idx = patterns.findIndex(function (p) { return p.id === editingPatternId; });
      if (idx !== -1) {
        patterns[idx].name = nameVal;
        patterns[idx].regex = regexVal;
        patterns[idx].severity = severityVal;
        patterns[idx].category = categoryVal || 'general';
        patterns[idx].description = descVal;
        patterns[idx].solution_hint = solutionVal;
      }
      editingPatternId = null;
    } else {
      patterns.push({
        id: generateId(),
        name: nameVal,
        regex: regexVal,
        severity: severityVal,
        category: categoryVal || 'general',
        description: descVal,
        solution_hint: solutionVal,
        created_at: new Date().toISOString(),
        enabled: true
      });
    }

    savePatterns(patterns);
    renderCustomPatternPanel();
  }



  // --- Pattern List ---
  function renderPatternList(container) {
    var patterns = loadPatterns();
    var activeCount = patterns.filter(function (p) { return p.enabled; }).length;
    var html = '<div class="cpe-list">';
    html += '<div class="cpe-list-header">';
    html += '<span class="cpe-list-count">' + activeCount + ' custom pattern' + (activeCount !== 1 ? 's' : '') + ' active</span>';
    html += '<div class="cpe-btn-group" style="margin-top:0;">';
    html += '<button class="cpe-btn cpe-btn-secondary" id="cpe-export-btn">📤 Export All</button>';
    html += '<button class="cpe-btn cpe-btn-secondary" id="cpe-import-btn">📥 Import</button>';
    html += '<input type="file" accept=".json" class="cpe-import-input" id="cpe-import-file">';
    html += '</div></div>';

    if (patterns.length === 0) {
      html += '<div class="cpe-empty">No custom patterns defined. Create your first rule above.</div>';
    } else {
      patterns.forEach(function (p) {
        var sevColor = SEVERITY_COLORS[p.severity] || TEXT_MUTED;
        html += '<div class="cpe-pattern-card" data-id="' + p.id + '">';
        html += '<div class="cpe-pattern-header">';
        html += '<span class="cpe-pattern-name">' + escapeHtml(p.name) + '</span>';
        html += '<span class="cpe-severity-badge" style="background:' + sevColor + '22;color:' + sevColor + ';border:1px solid ' + sevColor + '44;">' + p.severity + '</span>';
        html += '</div>';
        html += '<div><code class="cpe-pattern-regex">' + escapeHtml(p.regex) + '</code></div>';
        if (p.category) {
          html += '<div class="cpe-pattern-meta">Category: ' + escapeHtml(p.category) + '</div>';
        }
        if (p.description) {
          html += '<div class="cpe-pattern-meta">' + escapeHtml(p.description) + '</div>';
        }
        html += '<div class="cpe-pattern-actions">';
        html += '<label class="cpe-toggle"><input type="checkbox" ' + (p.enabled ? 'checked' : '') + ' data-toggle-id="' + p.id + '"><span class="cpe-toggle-slider"></span></label>';
        html += '<button class="cpe-btn cpe-btn-secondary" data-edit-id="' + p.id + '" style="padding:6px 12px;font-size:0.8rem;">✏️ Edit</button>';
        html += '<button class="cpe-btn cpe-btn-danger" data-delete-id="' + p.id + '" style="padding:6px 12px;font-size:0.8rem;">🗑️ Delete</button>';
        html += '</div>';
        html += '</div>';
      });
    }

    html += '</div>';
    container.innerHTML = html;
    attachListListeners(container);
  }



  // --- List Listeners ---
  function attachListListeners(container) {
    // Toggle enable/disable
    container.querySelectorAll('[data-toggle-id]').forEach(function (toggle) {
      toggle.addEventListener('change', function () {
        var id = toggle.getAttribute('data-toggle-id');
        var patterns = loadPatterns();
        var p = patterns.find(function (x) { return x.id === id; });
        if (p) {
          p.enabled = toggle.checked;
          savePatterns(patterns);
          renderCustomPatternPanel();
        }
      });
    });

    // Edit
    container.querySelectorAll('[data-edit-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        editingPatternId = btn.getAttribute('data-edit-id');
        renderCustomPatternPanel();
      });
    });

    // Delete
    container.querySelectorAll('[data-delete-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-delete-id');
        if (!confirm('Delete this custom pattern?')) return;
        var patterns = loadPatterns().filter(function (p) { return p.id !== id; });
        savePatterns(patterns);
        if (editingPatternId === id) editingPatternId = null;
        renderCustomPatternPanel();
      });
    });

    // Export
    var exportBtn = container.querySelector('#cpe-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        var patterns = loadPatterns();
        if (patterns.length === 0) {
          alert('No patterns to export.');
          return;
        }
        var blob = new Blob([JSON.stringify(patterns, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'logsherlock_custom_patterns_' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

    // Import
    var importBtn = container.querySelector('#cpe-import-btn');
    var importFile = container.querySelector('#cpe-import-file');
    if (importBtn && importFile) {
      importBtn.addEventListener('click', function () {
        importFile.click();
      });
      importFile.addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (evt) {
          try {
            var imported = JSON.parse(evt.target.result);
            if (!Array.isArray(imported)) throw new Error('Expected JSON array');
            var existing = loadPatterns();
            var existingIds = new Set(existing.map(function (p) { return p.id; }));
            var added = 0;
            imported.forEach(function (p) {
              if (!p.name || !p.regex) return;
              var validation = validateRegex(p.regex);
              if (!validation.valid) return;
              if (existingIds.has(p.id)) {
                p.id = generateId();
              }
              existing.push({
                id: p.id || generateId(),
                name: p.name,
                regex: p.regex,
                severity: SEVERITIES.indexOf(p.severity) !== -1 ? p.severity : 'MEDIUM',
                category: p.category || 'general',
                description: p.description || '',
                solution_hint: p.solution_hint || '',
                created_at: p.created_at || new Date().toISOString(),
                enabled: p.enabled !== false
              });
              added++;
            });
            savePatterns(existing);
            alert('Imported ' + added + ' pattern(s).');
            renderCustomPatternPanel();
          } catch (err) {
            alert('Import failed: ' + err.message);
          }
        };
        reader.readAsText(file);
      });
    }
  }



  // --- Main Render Function ---
  function renderCustomPatternPanel(targetSelector) {
    injectStyles();
    var target = targetSelector
      ? document.querySelector(targetSelector)
      : document.getElementById('custom-pattern-editor');

    if (!target) {
      target = document.createElement('div');
      target.id = 'custom-pattern-editor';
      var mainContent = document.querySelector('.main-content') || document.querySelector('#app') || document.body;
      mainContent.appendChild(target);
    }

    target.innerHTML = '';
    target.className = 'cpe-panel';

    // Title
    var titleEl = document.createElement('div');
    titleEl.className = 'cpe-title';
    titleEl.textContent = '✏️ Custom Pattern Editor — Your Rules';
    target.appendChild(titleEl);

    // Form section
    var formSection = document.createElement('div');
    formSection.id = 'cpe-form-section';
    target.appendChild(formSection);
    renderForm(formSection);

    // List section
    var listSection = document.createElement('div');
    listSection.id = 'cpe-list-section';
    target.appendChild(listSection);
    renderPatternList(listSection);
  }

  // --- Self-Initialize ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      // Panel will render when explicitly called
    });
  }

  // --- Window Exports ---
  window.renderCustomPatternPanel = renderCustomPatternPanel;
  window.getCustomPatterns = getCustomPatterns;

})();
