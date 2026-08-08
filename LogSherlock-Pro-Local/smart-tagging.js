(function() {
  'use strict';

  var STYLE_ID = 'lsp-smart-tagging-style';
  var TAGS_KEY = 'lsp_custom_tags';
  var TAGGED_KEY = 'lsp_tagged_findings';
  var ORDER_KEY = 'lsp_tag_group_order';
  var CSS = '.lsp-smart-tagging-panel{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;border:1px solid #e0e0e0;border-radius:8px;margin:12px 0;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.06)}.lsp-smart-tagging-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;cursor:pointer;background:#f8f9fa;border-radius:8px 8px 0 0;user-select:none}.lsp-smart-tagging-header h3{margin:0;font-size:16px}.lsp-smart-tagging-header .toggle{font-size:18px;transition:transform 0.2s}.lsp-smart-tagging-header .toggle.collapsed{transform:rotate(-90deg)}.lsp-smart-tagging-body{padding:18px;display:block}.lsp-smart-tagging-body.hidden{display:none}.lsp-st-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center}.lsp-st-input{padding:6px 10px;border:1px solid #d1d5db;border-radius:5px;font-size:13px;flex:1;min-width:120px}.lsp-st-btn{padding:6px 12px;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:500;background:#4f46e5;color:#fff}.lsp-st-btn:hover{background:#4338ca}.lsp-st-btn-export{background:#10b981}.lsp-st-btn-export:hover{background:#059669}.lsp-st-tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}.lsp-st-tag{padding:4px 10px;border-radius:12px;font-size:11px;background:#e0e7ff;color:#4338ca;cursor:pointer;user-select:none;border:1px solid transparent}.lsp-st-tag:hover{border-color:#4338ca}.lsp-st-tag.active{background:#4338ca;color:#fff}.lsp-st-tag .remove{margin-left:4px;font-weight:bold;cursor:pointer}.lsp-st-group{border:1px solid #e5e7eb;border-radius:6px;margin:8px 0;overflow:hidden;cursor:grab}.lsp-st-group.dragging{opacity:0.5;border-color:#4f46e5}.lsp-st-group.drag-over{border-color:#4f46e5;border-style:dashed}.lsp-st-group-header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f9fafb;cursor:pointer;user-select:none}.lsp-st-group-header h4{margin:0;font-size:14px}.lsp-st-group-header .sev-info{font-size:11px;color:#6b7280}.lsp-st-group-body{padding:0;max-height:0;overflow:hidden;transition:max-height 0.3s}.lsp-st-group-body.open{max-height:2000px;padding:8px 14px}.lsp-st-finding{padding:8px 10px;margin:4px 0;background:#fff;border:1px solid #e5e7eb;border-radius:4px;font-size:12px;cursor:pointer;transition:background 0.15s}.lsp-st-finding:hover{background:#eff6ff}.lsp-st-finding-tags{margin-top:4px;display:flex;gap:4px;flex-wrap:wrap}.lsp-st-finding-tag{font-size:10px;padding:2px 6px;background:#fef3c7;color:#92400e;border-radius:8px}.lsp-st-filter-label{font-size:11px;color:#6b7280;margin-right:4px}.lsp-st-status{margin-top:8px;padding:6px 12px;border-radius:4px;font-size:12px;color:#065f46;background:#d1fae5;display:none}';

  function loadJSON(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch(e) { return fallback; }
  }

  function saveJSON(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  window.renderSmartTaggingPanel = function(findings) {
    findings = findings || [];

    if (!document.getElementById(STYLE_ID)) {
      var style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    var customTags = loadJSON(TAGS_KEY, []);
    var taggedFindings = loadJSON(TAGGED_KEY, {});
    var groupOrder = loadJSON(ORDER_KEY, []);
    var activeFilter = null;

    var panel = document.createElement('div');
    panel.className = 'lsp-smart-tagging-panel';

    var header = document.createElement('div');
    header.className = 'lsp-smart-tagging-header';
    header.innerHTML = '<h3>\uD83C\uDFF7\uFE0F Smart Tagging</h3><span class="toggle">\u25BC</span>';

    var body = document.createElement('div');
    body.className = 'lsp-smart-tagging-body';

    var collapsed = false;
    header.addEventListener('click', function() {
      collapsed = !collapsed;
      body.classList.toggle('hidden', collapsed);
      header.querySelector('.toggle').classList.toggle('collapsed', collapsed);
    });

    // Group findings by category
    var groups = {};
    findings.forEach(function(f, idx) {
      var cat = (f.category || 'unknown').toLowerCase();
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ finding: f, index: idx });
    });

    var allCats = Object.keys(groups);
    // Apply stored order
    var orderedCats = [];
    groupOrder.forEach(function(cat) { if (groups[cat]) orderedCats.push(cat); });
    allCats.forEach(function(cat) { if (orderedCats.indexOf(cat) === -1) orderedCats.push(cat); });

    // Toolbar: add custom tag
    var toolbar = document.createElement('div');
    toolbar.className = 'lsp-st-toolbar';

    var tagInput = document.createElement('input');
    tagInput.className = 'lsp-st-input';
    tagInput.placeholder = 'New custom tag name...';
    tagInput.setAttribute('aria-label', 'New custom tag name');

    var addBtn = document.createElement('button');
    addBtn.className = 'lsp-st-btn';
    addBtn.textContent = '+ Add Tag';

    var exportBtn = document.createElement('button');
    exportBtn.className = 'lsp-st-btn lsp-st-btn-export';
    exportBtn.textContent = '\uD83D\uDCE4 Export JSON';

    toolbar.appendChild(tagInput);
    toolbar.appendChild(addBtn);
    toolbar.appendChild(exportBtn);
    body.appendChild(toolbar);

    // Tags display
    var tagsContainer = document.createElement('div');
    tagsContainer.className = 'lsp-st-tags';
    body.appendChild(tagsContainer);

    // Filter label
    var filterRow = document.createElement('div');
    filterRow.style.cssText = 'margin-bottom:8px;display:flex;align-items:center;';
    var filterLabel = document.createElement('span');
    filterLabel.className = 'lsp-st-filter-label';
    filterLabel.textContent = 'Filter by tag:';
    var clearFilterBtn = document.createElement('button');
    clearFilterBtn.className = 'lsp-st-btn';
    clearFilterBtn.style.cssText = 'font-size:11px;padding:3px 8px;margin-left:8px;background:#6b7280;display:none;';
    clearFilterBtn.textContent = 'Clear Filter';
    filterRow.appendChild(filterLabel);
    filterRow.appendChild(clearFilterBtn);
    body.appendChild(filterRow);

    // Groups container
    var groupsContainer = document.createElement('div');
    body.appendChild(groupsContainer);

    // Status
    var statusEl = document.createElement('div');
    statusEl.className = 'lsp-st-status';
    body.appendChild(statusEl);

    function showStatus(msg) {
      statusEl.textContent = msg;
      statusEl.style.display = 'block';
      setTimeout(function() { statusEl.style.display = 'none'; }, 3000);
    }

    function renderTags() {
      tagsContainer.innerHTML = '';
      customTags.forEach(function(tag, ti) {
        var el = document.createElement('span');
        el.className = 'lsp-st-tag' + (activeFilter === tag ? ' active' : '');
        el.innerHTML = tag + '<span class="remove">\u00D7</span>';
        el.addEventListener('click', function(e) {
          if (e.target.classList.contains('remove')) {
            customTags.splice(ti, 1);
            saveJSON(TAGS_KEY, customTags);
            renderTags();
            renderGroups();
            return;
          }
          activeFilter = activeFilter === tag ? null : tag;
          clearFilterBtn.style.display = activeFilter ? 'inline-block' : 'none';
          renderTags();
          renderGroups();
        });
        tagsContainer.appendChild(el);
      });
    }

    function getFindingKey(f) {
      return f.text + '|' + (f.line || '') + '|' + (f.file || '');
    }

    function renderGroups() {
      groupsContainer.innerHTML = '';
      var dragSrcEl = null;

      orderedCats.forEach(function(cat) {
        var items = groups[cat];
        if (!items) return;

        // Filter
        if (activeFilter) {
          items = items.filter(function(item) {
            var key = getFindingKey(item.finding);
            var tags = taggedFindings[key] || [];
            return tags.indexOf(activeFilter) !== -1;
          });
          if (items.length === 0) return;
        }

        var sevBreakdown = {};
        items.forEach(function(item) {
          var sev = (item.finding.severity || 'info').toLowerCase();
          sevBreakdown[sev] = (sevBreakdown[sev] || 0) + 1;
        });
        var sevStr = Object.keys(sevBreakdown).map(function(s) { return s + ':' + sevBreakdown[s]; }).join(' | ');

        var groupEl = document.createElement('div');
        groupEl.className = 'lsp-st-group';
        groupEl.setAttribute('draggable', 'true');
        groupEl.setAttribute('data-cat', cat);

        var ghdr = document.createElement('div');
        ghdr.className = 'lsp-st-group-header';
        ghdr.innerHTML = '<h4>' + cat.charAt(0).toUpperCase() + cat.slice(1) + ' (' + items.length + ')</h4><span class="sev-info">' + sevStr + '</span>';

        var gbody = document.createElement('div');
        gbody.className = 'lsp-st-group-body';

        var groupOpen = false;
        ghdr.addEventListener('click', function() {
          groupOpen = !groupOpen;
          gbody.classList.toggle('open', groupOpen);
        });

        items.forEach(function(item) {
          var fEl = document.createElement('div');
          fEl.className = 'lsp-st-finding';
          fEl.textContent = '[' + (item.finding.severity || 'info').toUpperCase() + '] ' + item.finding.text;

          var key = getFindingKey(item.finding);
          var fTags = taggedFindings[key] || [];

          if (fTags.length > 0) {
            var ftContainer = document.createElement('div');
            ftContainer.className = 'lsp-st-finding-tags';
            fTags.forEach(function(t) {
              var ft = document.createElement('span');
              ft.className = 'lsp-st-finding-tag';
              ft.textContent = t;
              ftContainer.appendChild(ft);
            });
            fEl.appendChild(ftContainer);
          }

          fEl.addEventListener('click', function() {
            if (customTags.length === 0) { showStatus('Create a custom tag first.'); return; }
            var opts = customTags.filter(function(t) { return fTags.indexOf(t) === -1; });
            if (opts.length === 0) { showStatus('All tags already applied to this finding.'); return; }
            var tag = opts[0];
            if (opts.length > 1) {
              tag = prompt('Choose tag to apply:\n' + opts.join(', '));
              if (!tag || opts.indexOf(tag) === -1) return;
            }
            fTags.push(tag);
            taggedFindings[key] = fTags;
            saveJSON(TAGGED_KEY, taggedFindings);
            renderGroups();
            showStatus('Tagged with "' + tag + '"');
          });

          gbody.appendChild(fEl);
        });

        // Drag-and-drop
        groupEl.addEventListener('dragstart', function(e) {
          dragSrcEl = groupEl;
          groupEl.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', cat);
        });
        groupEl.addEventListener('dragend', function() {
          groupEl.classList.remove('dragging');
          var allGroups = groupsContainer.querySelectorAll('.lsp-st-group');
          allGroups.forEach(function(g) { g.classList.remove('drag-over'); });
        });
        groupEl.addEventListener('dragover', function(e) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          groupEl.classList.add('drag-over');
        });
        groupEl.addEventListener('dragleave', function() {
          groupEl.classList.remove('drag-over');
        });
        groupEl.addEventListener('drop', function(e) {
          e.preventDefault();
          groupEl.classList.remove('drag-over');
          if (dragSrcEl && dragSrcEl !== groupEl) {
            var srcCat = dragSrcEl.getAttribute('data-cat');
            var destCat = groupEl.getAttribute('data-cat');
            var srcIdx = orderedCats.indexOf(srcCat);
            var destIdx = orderedCats.indexOf(destCat);
            if (srcIdx !== -1 && destIdx !== -1) {
              orderedCats.splice(srcIdx, 1);
              orderedCats.splice(destIdx, 0, srcCat);
              saveJSON(ORDER_KEY, orderedCats);
              renderGroups();
            }
          }
        });

        groupEl.appendChild(ghdr);
        groupEl.appendChild(gbody);
        groupsContainer.appendChild(groupEl);
      });
    }

    addBtn.addEventListener('click', function() {
      var val = tagInput.value.trim();
      if (!val) return;
      if (customTags.indexOf(val) !== -1) { showStatus('Tag already exists.'); return; }
      customTags.push(val);
      saveJSON(TAGS_KEY, customTags);
      tagInput.value = '';
      renderTags();
      showStatus('Tag "' + val + '" added.');
    });

    tagInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') addBtn.click();
    });

    clearFilterBtn.addEventListener('click', function() {
      activeFilter = null;
      clearFilterBtn.style.display = 'none';
      renderTags();
      renderGroups();
    });

    exportBtn.addEventListener('click', function() {
      var exportData = { tags: customTags, taggedFindings: taggedFindings, findings: findings };
      var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'tagged-findings-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showStatus('Exported tagged view as JSON.');
    });

    renderTags();
    renderGroups();

    panel.appendChild(header);
    panel.appendChild(body);

    return panel;
  };
})();
