/* LogSherlock Pro — Custom Theme Panel (File 14) */
(function () {
  'use strict';

  var BUILT_IN_THEMES = {
    dark: {
      name: 'Dark',
      vars: {
        '--bg-primary': '#0d0d1a',
        '--bg-secondary': '#1e1e2e',
        '--text-primary': '#e0e0e0',
        '--text-secondary': '#a0a0b0',
        '--accent': '#7c3aed',
        '--success': '#22c55e',
        '--warning': '#eab308',
        '--danger': '#ef4444',
        '--border': '#333345'
      }
    },
    light: {
      name: 'Light',
      vars: {
        '--bg-primary': '#ffffff',
        '--bg-secondary': '#f5f5f7',
        '--text-primary': '#1a1a2e',
        '--text-secondary': '#555566',
        '--accent': '#6d28d9',
        '--success': '#16a34a',
        '--warning': '#ca8a04',
        '--danger': '#dc2626',
        '--border': '#d4d4d8'
      }
    },
    highcontrast: {
      name: 'High Contrast',
      vars: {
        '--bg-primary': '#000000',
        '--bg-secondary': '#1a1a1a',
        '--text-primary': '#ffffff',
        '--text-secondary': '#f0f0f0',
        '--accent': '#ffff00',
        '--success': '#00ff00',
        '--warning': '#ffff00',
        '--danger': '#ff0000',
        '--border': '#ffffff'
      }
    },
    solarized: {
      name: 'Solarized',
      vars: {
        '--bg-primary': '#002b36',
        '--bg-secondary': '#073642',
        '--text-primary': '#fdf6e3',
        '--text-secondary': '#93a1a1',
        '--accent': '#268bd2',
        '--success': '#859900',
        '--warning': '#b58900',
        '--danger': '#dc322f',
        '--border': '#586e75'
      }
    },
    nord: {
      name: 'Nord',
      vars: {
        '--bg-primary': '#2e3440',
        '--bg-secondary': '#3b4252',
        '--text-primary': '#eceff4',
        '--text-secondary': '#d8dee9',
        '--accent': '#88c0d0',
        '--success': '#a3be8c',
        '--warning': '#ebcb8b',
        '--danger': '#bf616a',
        '--border': '#4c566a'
      }
    }
  };

  var VAR_LABELS = {
    '--bg-primary': 'Background Primary',
    '--bg-secondary': 'Background Secondary',
    '--text-primary': 'Text Primary',
    '--text-secondary': 'Text Secondary',
    '--accent': 'Accent',
    '--success': 'Success',
    '--warning': 'Warning',
    '--danger': 'Danger',
    '--border': 'Border'
  };

  function injectStyles() {
    if (document.getElementById('lsp-custom-theme-styles')) return;
    var style = document.createElement('style');
    style.id = 'lsp-custom-theme-styles';
    style.textContent = [
      '.lsp-theme-panel { background: var(--bg-secondary, #1e1e2e); border: 1px solid var(--border, #333); border-radius: 8px; margin: 10px 0; font-family: system-ui, sans-serif; color: var(--text-primary, #e0e0e0); }',
      '.lsp-theme-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer; user-select: none; border-radius: 8px; transition: background 0.2s; }',
      '.lsp-theme-header:hover { background: var(--bg-primary, #121220); }',
      '.lsp-theme-header h3 { margin: 0; font-size: 16px; }',
      '.lsp-theme-header .chevron { transition: transform 0.3s; }',
      '.lsp-theme-header .chevron.collapsed { transform: rotate(-90deg); }',
      '.lsp-theme-body { padding: 16px; display: none; border-top: 1px solid var(--border, #333); }',
      '.lsp-theme-body.open { display: block; }',
      '.lsp-theme-section { margin-bottom: 16px; }',
      '.lsp-theme-section h4 { margin: 0 0 8px 0; font-size: 13px; color: var(--text-secondary, #aaa); text-transform: uppercase; letter-spacing: 0.5px; }',
      '.lsp-theme-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }',
      '.lsp-theme-card { padding: 10px; border-radius: 8px; border: 2px solid transparent; cursor: pointer; transition: all 0.2s; text-align: center; font-size: 12px; font-weight: 600; }',
      '.lsp-theme-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }',
      '.lsp-theme-card.active { border-color: var(--accent, #7c3aed); }',
      '.lsp-theme-card .swatch-row { display: flex; gap: 3px; justify-content: center; margin-top: 6px; }',
      '.lsp-theme-card .swatch { width: 14px; height: 14px; border-radius: 3px; border: 1px solid rgba(128,128,128,0.3); }',
      '.lsp-theme-builder { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }',
      '.lsp-theme-var { display: flex; align-items: center; gap: 8px; }',
      '.lsp-theme-var label { font-size: 11px; color: var(--text-secondary, #aaa); flex: 1; }',
      '.lsp-theme-var input[type="color"] { width: 32px; height: 28px; border: none; border-radius: 4px; cursor: pointer; background: none; }',
      '.lsp-theme-var .hex-display { font-size: 11px; color: var(--text-secondary, #aaa); font-family: monospace; width: 62px; }',
      '.lsp-theme-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }',
      '.lsp-theme-actions button { padding: 7px 14px; border-radius: 6px; border: 1px solid var(--border, #444); background: var(--bg-primary, #121220); color: var(--text-primary, #e0e0e0); cursor: pointer; font-size: 12px; transition: all 0.2s; }',
      '.lsp-theme-actions button:hover { border-color: var(--accent, #7c3aed); }',
      '.lsp-theme-actions button.primary { background: var(--accent, #7c3aed); color: #fff; border-color: var(--accent, #7c3aed); }',
      '.lsp-theme-import-area { margin-top: 10px; }',
      '.lsp-theme-import-area textarea { width: 100%; box-sizing: border-box; min-height: 60px; padding: 8px; border-radius: 6px; border: 1px solid var(--border, #444); background: var(--bg-primary, #121220); color: var(--text-primary, #e0e0e0); font-size: 11px; font-family: monospace; resize: vertical; }',
      '.lsp-theme-custom-list { margin-top: 8px; }',
      '.lsp-theme-custom-item { display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-radius: 4px; margin-bottom: 4px; background: var(--bg-primary, #0d0d1a); font-size: 12px; }',
      '.lsp-theme-custom-item button { background: none; border: none; color: var(--danger, #ef4444); cursor: pointer; font-size: 14px; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function applyTheme(vars) {
    var root = document.documentElement;
    Object.keys(vars).forEach(function (key) {
      root.style.setProperty(key, vars[key]);
    });
  }

  function getCustomThemes() {
    try {
      return JSON.parse(localStorage.getItem('lsp_custom_themes') || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveCustomThemes(themes) {
    localStorage.setItem('lsp_custom_themes', JSON.stringify(themes));
  }

  function getActiveThemeId() {
    return localStorage.getItem('lsp_active_theme') || 'dark';
  }

  function setActiveThemeId(id) {
    localStorage.setItem('lsp_active_theme', id);
  }

  function resolveThemeVars(themeId) {
    if (BUILT_IN_THEMES[themeId]) return BUILT_IN_THEMES[themeId].vars;
    var customs = getCustomThemes();
    var found = customs.find(function (t) { return t.id === themeId; });
    return found ? found.vars : BUILT_IN_THEMES.dark.vars;
  }

  window.renderCustomThemePanel = function (findings) {
    injectStyles();

    var panel = document.createElement('div');
    panel.className = 'lsp-theme-panel';

    var header = document.createElement('div');
    header.className = 'lsp-theme-header';
    header.innerHTML = '<h3>\uD83C\uDFA8 Custom Theme</h3><span class="chevron">\u25BC</span>';
    panel.appendChild(header);

    var body = document.createElement('div');
    body.className = 'lsp-theme-body open';
    panel.appendChild(body);

    var chevron = header.querySelector('.chevron');
    header.addEventListener('click', function () {
      var isOpen = body.classList.toggle('open');
      chevron.classList.toggle('collapsed', !isOpen);
    });

    var activeId = getActiveThemeId();

    // --- Built-in Themes ---
    var builtInSection = document.createElement('div');
    builtInSection.className = 'lsp-theme-section';
    builtInSection.innerHTML = '<h4>Built-in Themes</h4>';
    var grid = document.createElement('div');
    grid.className = 'lsp-theme-grid';

    function renderBuiltInCards() {
      grid.innerHTML = '';
      activeId = getActiveThemeId();
      Object.keys(BUILT_IN_THEMES).forEach(function (key) {
        var theme = BUILT_IN_THEMES[key];
        var card = document.createElement('div');
        card.className = 'lsp-theme-card' + (activeId === key ? ' active' : '');
        card.style.background = theme.vars['--bg-secondary'];
        card.style.color = theme.vars['--text-primary'];
        card.innerHTML = '<div>' + theme.name + '</div>';
        var swatchRow = document.createElement('div');
        swatchRow.className = 'swatch-row';
        ['--accent', '--success', '--warning', '--danger'].forEach(function (v) {
          var sw = document.createElement('div');
          sw.className = 'swatch';
          sw.style.background = theme.vars[v];
          swatchRow.appendChild(sw);
        });
        card.appendChild(swatchRow);
        card.addEventListener('click', function () {
          applyTheme(theme.vars);
          setActiveThemeId(key);
          renderBuiltInCards();
          renderCustomList();
        });
        grid.appendChild(card);
      });

      // Also render custom theme cards
      var customs = getCustomThemes();
      customs.forEach(function (ct) {
        var card = document.createElement('div');
        card.className = 'lsp-theme-card' + (activeId === ct.id ? ' active' : '');
        card.style.background = ct.vars['--bg-secondary'];
        card.style.color = ct.vars['--text-primary'];
        card.innerHTML = '<div>' + ct.name + '</div>';
        var swatchRow = document.createElement('div');
        swatchRow.className = 'swatch-row';
        ['--accent', '--success', '--warning', '--danger'].forEach(function (v) {
          var sw = document.createElement('div');
          sw.className = 'swatch';
          sw.style.background = ct.vars[v] || '#666';
          swatchRow.appendChild(sw);
        });
        card.appendChild(swatchRow);
        card.addEventListener('click', function () {
          applyTheme(ct.vars);
          setActiveThemeId(ct.id);
          renderBuiltInCards();
          renderCustomList();
        });
        grid.appendChild(card);
      });
    }

    builtInSection.appendChild(grid);
    body.appendChild(builtInSection);
    renderBuiltInCards();

    // --- Custom Theme Builder ---
    var builderSection = document.createElement('div');
    builderSection.className = 'lsp-theme-section';
    builderSection.innerHTML = '<h4>Custom Theme Builder</h4>';

    var builderGrid = document.createElement('div');
    builderGrid.className = 'lsp-theme-builder';

    var currentVars = Object.assign({}, resolveThemeVars(activeId));
    var colorInputs = {};

    Object.keys(VAR_LABELS).forEach(function (varName) {
      var row = document.createElement('div');
      row.className = 'lsp-theme-var';

      var label = document.createElement('label');
      label.textContent = VAR_LABELS[varName];
      row.appendChild(label);

      var input = document.createElement('input');
      input.type = 'color';
      input.value = currentVars[varName] || '#000000';
      colorInputs[varName] = input;

      var hexSpan = document.createElement('span');
      hexSpan.className = 'hex-display';
      hexSpan.textContent = input.value;

      input.addEventListener('input', function () {
        currentVars[varName] = input.value;
        hexSpan.textContent = input.value;
      });

      row.appendChild(input);
      row.appendChild(hexSpan);
      builderGrid.appendChild(row);
    });

    builderSection.appendChild(builderGrid);

    // Builder actions
    var builderActions = document.createElement('div');
    builderActions.className = 'lsp-theme-actions';

    var previewBtn = document.createElement('button');
    previewBtn.textContent = '\uD83D\uDC41\uFE0F Preview';
    previewBtn.addEventListener('click', function () {
      applyTheme(currentVars);
    });
    builderActions.appendChild(previewBtn);

    var saveBtn = document.createElement('button');
    saveBtn.className = 'primary';
    saveBtn.textContent = '\uD83D\uDCBE Save Theme';
    saveBtn.addEventListener('click', function () {
      var name = prompt('Theme name:');
      if (!name) return;
      var customs = getCustomThemes();
      var id = 'custom_' + Date.now();
      customs.push({ id: id, name: name, vars: Object.assign({}, currentVars) });
      saveCustomThemes(customs);
      applyTheme(currentVars);
      setActiveThemeId(id);
      renderBuiltInCards();
      renderCustomList();
    });
    builderActions.appendChild(saveBtn);

    var resetBtn = document.createElement('button');
    resetBtn.textContent = '\u21A9\uFE0F Reset to Default';
    resetBtn.addEventListener('click', function () {
      applyTheme(BUILT_IN_THEMES.dark.vars);
      setActiveThemeId('dark');
      Object.keys(colorInputs).forEach(function (v) {
        colorInputs[v].value = BUILT_IN_THEMES.dark.vars[v];
        colorInputs[v].nextElementSibling.textContent = BUILT_IN_THEMES.dark.vars[v];
        currentVars[v] = BUILT_IN_THEMES.dark.vars[v];
      });
      renderBuiltInCards();
      renderCustomList();
    });
    builderActions.appendChild(resetBtn);

    builderSection.appendChild(builderActions);
    body.appendChild(builderSection);

    // --- Custom Themes List ---
    var customListSection = document.createElement('div');
    customListSection.className = 'lsp-theme-section';
    customListSection.innerHTML = '<h4>Saved Custom Themes</h4>';
    var customListContainer = document.createElement('div');
    customListContainer.className = 'lsp-theme-custom-list';

    function renderCustomList() {
      customListContainer.innerHTML = '';
      var customs = getCustomThemes();
      if (customs.length === 0) {
        customListContainer.innerHTML = '<div style="font-size:12px;color:var(--text-secondary,#888);font-style:italic;">No custom themes saved yet.</div>';
        return;
      }
      customs.forEach(function (ct) {
        var item = document.createElement('div');
        item.className = 'lsp-theme-custom-item';
        var nameSpan = document.createElement('span');
        nameSpan.textContent = ct.name + (getActiveThemeId() === ct.id ? ' \u2705' : '');
        item.appendChild(nameSpan);
        var delBtn = document.createElement('button');
        delBtn.textContent = '\uD83D\uDDD1\uFE0F';
        delBtn.title = 'Delete theme';
        delBtn.addEventListener('click', function () {
          var updated = getCustomThemes().filter(function (t) { return t.id !== ct.id; });
          saveCustomThemes(updated);
          if (getActiveThemeId() === ct.id) {
            setActiveThemeId('dark');
            applyTheme(BUILT_IN_THEMES.dark.vars);
          }
          renderBuiltInCards();
          renderCustomList();
        });
        item.appendChild(delBtn);
        customListContainer.appendChild(item);
      });
    }

    customListSection.appendChild(customListContainer);
    body.appendChild(customListSection);
    renderCustomList();

    // --- Export / Import ---
    var ioSection = document.createElement('div');
    ioSection.className = 'lsp-theme-section';
    ioSection.innerHTML = '<h4>Export / Import</h4>';

    var ioActions = document.createElement('div');
    ioActions.className = 'lsp-theme-actions';

    var exportBtn = document.createElement('button');
    exportBtn.textContent = '\uD83D\uDCE4 Export All Themes';
    exportBtn.addEventListener('click', function () {
      var data = {
        builtIn: Object.keys(BUILT_IN_THEMES),
        custom: getCustomThemes(),
        activeTheme: getActiveThemeId()
      };
      var json = JSON.stringify(data, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(json).then(function () {
          exportBtn.textContent = '\u2705 Copied JSON!';
          setTimeout(function () { exportBtn.textContent = '\uD83D\uDCE4 Export All Themes'; }, 2000);
        });
      } else {
        importArea.value = json;
      }
    });
    ioActions.appendChild(exportBtn);

    var importBtn = document.createElement('button');
    importBtn.textContent = '\uD83D\uDCE5 Import Themes';
    importBtn.addEventListener('click', function () {
      var raw = importArea.value.trim();
      if (!raw) return;
      try {
        var data = JSON.parse(raw);
        if (data.custom && Array.isArray(data.custom)) {
          var existing = getCustomThemes();
          var existingIds = existing.map(function (t) { return t.id; });
          data.custom.forEach(function (t) {
            if (!existingIds.includes(t.id)) existing.push(t);
          });
          saveCustomThemes(existing);
        }
        if (data.activeTheme) {
          setActiveThemeId(data.activeTheme);
          applyTheme(resolveThemeVars(data.activeTheme));
        }
        renderBuiltInCards();
        renderCustomList();
        importBtn.textContent = '\u2705 Imported!';
        setTimeout(function () { importBtn.textContent = '\uD83D\uDCE5 Import Themes'; }, 2000);
      } catch (e) {
        importBtn.textContent = '\u274C Invalid JSON';
        setTimeout(function () { importBtn.textContent = '\uD83D\uDCE5 Import Themes'; }, 2000);
      }
    });
    ioActions.appendChild(importBtn);

    ioSection.appendChild(ioActions);

    var importAreaDiv = document.createElement('div');
    importAreaDiv.className = 'lsp-theme-import-area';
    var importArea = document.createElement('textarea');
    importArea.placeholder = 'Paste theme JSON here to import...';
    importAreaDiv.appendChild(importArea);
    ioSection.appendChild(importAreaDiv);

    body.appendChild(ioSection);

    return panel;
  };

  // Auto-apply saved theme on page load
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      var savedId = localStorage.getItem('lsp_active_theme');
      if (savedId) {
        var vars = resolveThemeVars(savedId);
        applyTheme(vars);
      }
    });
  }
})();
