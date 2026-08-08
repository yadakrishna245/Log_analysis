(function() {
  'use strict';

  var STYLE_ID = 'lsp-multi-file-timeline-styles';
  var FILE_COLORS = [
    '#4fc3f7', '#81c784', '#ffb74d', '#e57373', '#ba68c8',
    '#4db6ac', '#fff176', '#f06292', '#aed581', '#7986cb',
    '#ff8a65', '#a1887f', '#90a4ae', '#dce775', '#64b5f6'
  ];

  function injectStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.lsp-mft-panel{background:#1e1e2e;border:1px solid #3a3a5a;border-radius:8px;margin:10px 0;font-family:monospace;color:#cdd6f4}' +
      '.lsp-mft-header{padding:12px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:#2a2a3e;border-radius:8px 8px 0 0}' +
      '.lsp-mft-header:hover{background:#3a3a5a}' +
      '.lsp-mft-header h3{margin:0;font-size:16px}' +
      '.lsp-mft-body{padding:16px;display:none}' +
      '.lsp-mft-body.open{display:block}' +
      '.lsp-mft-stats{display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap}' +
      '.lsp-mft-stat{background:#2a2a3e;padding:6px 12px;border-radius:4px;font-size:13px}' +
      '.lsp-mft-filters{display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;align-items:center}' +
      '.lsp-mft-filters select,.lsp-mft-filters input{background:#2a2a3e;color:#cdd6f4;border:1px solid #3a3a5a;padding:4px 8px;border-radius:4px;font-size:12px}' +
      '.lsp-mft-timeline{max-height:400px;overflow-y:auto;border:1px solid #3a3a5a;border-radius:4px}' +
      '.lsp-mft-row{display:flex;gap:10px;padding:6px 10px;border-bottom:1px solid #2a2a3e;font-size:12px;align-items:center}' +
      '.lsp-mft-row:hover{background:#2a2a3e}' +
      '.lsp-mft-ts{color:#89b4fa;min-width:160px;white-space:nowrap}' +
      '.lsp-mft-file{min-width:120px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:bold}' +
      '.lsp-mft-sev{min-width:70px;padding:2px 6px;border-radius:3px;text-align:center;font-size:11px;font-weight:bold}' +
      '.lsp-mft-sev-critical{background:#f38ba8;color:#1e1e2e}' +
      '.lsp-mft-sev-high{background:#fab387;color:#1e1e2e}' +
      '.lsp-mft-sev-medium{background:#f9e2af;color:#1e1e2e}' +
      '.lsp-mft-sev-low{background:#a6e3a1;color:#1e1e2e}' +
      '.lsp-mft-text{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.lsp-mft-export{margin-top:10px;padding:6px 14px;background:#89b4fa;color:#1e1e2e;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-size:12px}' +
      '.lsp-mft-export:hover{background:#74c7ec}' +
      '.lsp-mft-msg{padding:20px;text-align:center;color:#a6adc8;font-style:italic}' +
      '.lsp-mft-chevron{transition:transform 0.2s}' +
      '.lsp-mft-chevron.open{transform:rotate(180deg)}';
    document.head.appendChild(style);
  }

  function getFileColor(fileName, fileMap) {
    if (!fileMap.has(fileName)) {
      fileMap.set(fileName, FILE_COLORS[fileMap.size % FILE_COLORS.length]);
    }
    return fileMap.get(fileName);
  }

  function truncText(text, maxLen) {
    if (!text) return '';
    return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
  }

  function escCSV(val) {
    var str = String(val || '');
    if (str.indexOf(',') > -1 || str.indexOf('"') > -1 || str.indexOf('\n') > -1) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function renderMultiFileTimelinePanel(findings) {
    if (typeof document === 'undefined') return;
    injectStyles();

    var container = document.getElementById('lsp-mft-panel');
    if (!container) {
      container = document.createElement('div');
      container.id = 'lsp-mft-panel';
      document.body.appendChild(container);
    }

    var items = Array.isArray(findings) ? findings : [];
    var hasTimestamps = items.some(function(f) { return f.timestamp; });
    var fileMap = new Map();
    var files = [];
    var severities = [];

    items.forEach(function(f) {
      var fname = f.file || 'Unknown Source';
      if (files.indexOf(fname) === -1) files.push(fname);
      var sev = (f.severity || '').toUpperCase();
      if (sev && severities.indexOf(sev) === -1) severities.push(sev);
      getFileColor(fname, fileMap);
    });

    var sorted = items.slice().sort(function(a, b) {
      var ta = a.timestamp || '';
      var tb = b.timestamp || '';
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });

    var html = '<div class="lsp-mft-panel">';
    html += '<div class="lsp-mft-header" id="lsp-mft-toggle"><h3>\u23F1\uFE0F Multi-File Timeline</h3>';
    html += '<span class="lsp-mft-chevron" id="lsp-mft-chevron">\u25BC</span></div>';
    html += '<div class="lsp-mft-body open" id="lsp-mft-body">';
    html += '<div class="lsp-mft-stats">';
    html += '<span class="lsp-mft-stat">\uD83D\uDCCA Total Findings: ' + items.length + '</span>';
    html += '<span class="lsp-mft-stat">\uD83D\uDCC1 Files: ' + files.length + '</span></div>';

    if (!hasTimestamps) {
      html += '<div class="lsp-mft-msg">No timestamps available for timeline merge</div>';
    } else {
      html += '<div class="lsp-mft-filters">';
      html += '<label>File: <select id="lsp-mft-filter-file"><option value="">All</option>';
      files.forEach(function(f) { html += '<option value="' + f.replace(/"/g, '&quot;') + '">' + truncText(f, 30) + '</option>'; });
      html += '</select></label>';
      html += '<label>Severity: <select id="lsp-mft-filter-sev"><option value="">All</option>';
      severities.forEach(function(s) { html += '<option value="' + s + '">' + s + '</option>'; });
      html += '</select></label>';
      html += '<label>From: <input type="text" id="lsp-mft-filter-from" placeholder="start timestamp"></label>';
      html += '<label>To: <input type="text" id="lsp-mft-filter-to" placeholder="end timestamp"></label>';
      html += '<button class="lsp-mft-export" id="lsp-mft-apply-filter">Apply</button></div>';

      html += '<div class="lsp-mft-timeline" id="lsp-mft-timeline-list">';
      sorted.forEach(function(f) {
        var fname = f.file || 'Unknown Source';
        var color = getFileColor(fname, fileMap);
        var sev = (f.severity || 'LOW').toUpperCase();
        html += '<div class="lsp-mft-row" data-file="' + fname.replace(/"/g, '&quot;') + '" data-sev="' + sev + '" data-ts="' + (f.timestamp || '') + '">';
        html += '<span class="lsp-mft-ts">' + (f.timestamp || 'N/A') + '</span>';
        html += '<span class="lsp-mft-file" style="color:' + color + '">' + truncText(fname, 25) + '</span>';
        html += '<span class="lsp-mft-sev lsp-mft-sev-' + sev.toLowerCase() + '">' + sev + '</span>';
        html += '<span class="lsp-mft-text">' + truncText(f.text, 80) + '</span></div>';
      });
      html += '</div>';
      html += '<button class="lsp-mft-export" id="lsp-mft-export-csv">\uD83D\uDCE5 Export CSV</button>';
    }

    html += '</div></div>';
    container.innerHTML = html;

    var toggle = document.getElementById('lsp-mft-toggle');
    var body = document.getElementById('lsp-mft-body');
    var chevron = document.getElementById('lsp-mft-chevron');
    if (toggle) {
      toggle.addEventListener('click', function() {
        body.classList.toggle('open');
        chevron.classList.toggle('open');
      });
    }

    var applyBtn = document.getElementById('lsp-mft-apply-filter');
    if (applyBtn) {
      applyBtn.addEventListener('click', function() {
        var fileF = document.getElementById('lsp-mft-filter-file').value;
        var sevF = document.getElementById('lsp-mft-filter-sev').value;
        var fromF = document.getElementById('lsp-mft-filter-from').value;
        var toF = document.getElementById('lsp-mft-filter-to').value;
        var rows = document.querySelectorAll('#lsp-mft-timeline-list .lsp-mft-row');
        rows.forEach(function(row) {
          var show = true;
          if (fileF && row.getAttribute('data-file') !== fileF) show = false;
          if (sevF && row.getAttribute('data-sev') !== sevF) show = false;
          if (fromF && row.getAttribute('data-ts') < fromF) show = false;
          if (toF && row.getAttribute('data-ts') > toF) show = false;
          row.style.display = show ? '' : 'none';
        });
      });
    }

    var exportBtn = document.getElementById('lsp-mft-export-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', function() {
        var csv = 'timestamp,file,severity,text\n';
        sorted.forEach(function(f) {
          csv += escCSV(f.timestamp) + ',' + escCSV(f.file || 'Unknown Source') + ',' + escCSV(f.severity) + ',' + escCSV(f.text) + '\n';
        });
        var blob = new Blob([csv], { type: 'text/csv' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'timeline_export.csv';
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  }

  if (typeof window !== 'undefined') {
    window.renderMultiFileTimelinePanel = renderMultiFileTimelinePanel;
  }
})();
