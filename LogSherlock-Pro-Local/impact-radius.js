(function() {
  'use strict';

  var STYLE_ID = 'lsp-impact-radius-styles';

  var LAYERS = {
    'Compute': ['cpu', 'process', 'thread', 'crash', 'oom', 'memory', 'core'],
    'Storage': ['disk', 'filesystem', 'mount', 'inode', 'io', 'write', 'read', 'nfs', 'san'],
    'Network': ['network', 'tcp', 'udp', 'dns', 'timeout', 'connection', 'socket', 'port', 'firewall'],
    'Security': ['auth', 'permission', 'denied', 'certificate', 'ssl', 'tls', 'key', 'token'],
    'Services': ['service', 'daemon', 'systemd', 'container', 'pod', 'deploy', 'restart'],
    'Database': ['database', 'query', 'deadlock', 'replication', 'mysql', 'postgres', 'oracle']
  };

  var LAYER_COLORS = {
    'Compute': '#f38ba8',
    'Storage': '#fab387',
    'Network': '#89b4fa',
    'Security': '#f9e2af',
    'Services': '#a6e3a1',
    'Database': '#cba6f7'
  };

  function injectStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.lsp-ir-panel{background:#1e1e2e;border:1px solid #3a3a5a;border-radius:8px;margin:10px 0;font-family:monospace;color:#cdd6f4}' +
      '.lsp-ir-header{padding:12px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:#2a2a3e;border-radius:8px 8px 0 0}' +
      '.lsp-ir-header:hover{background:#3a3a5a}' +
      '.lsp-ir-header h3{margin:0;font-size:16px}' +
      '.lsp-ir-body{padding:16px;display:none}' +
      '.lsp-ir-body.open{display:block}' +
      '.lsp-ir-visual{display:flex;justify-content:center;margin-bottom:20px}' +
      '.lsp-ir-rings{position:relative;width:300px;height:300px}' +
      '.lsp-ir-ring{position:absolute;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #3a3a5a;transition:all 0.3s}' +
      '.lsp-ir-ring.active{border-width:3px}' +
      '.lsp-ir-ring-label{position:absolute;font-size:10px;font-weight:bold;text-align:center}' +
      '.lsp-ir-center{position:absolute;width:70px;height:70px;border-radius:50%;background:#2a2a3e;display:flex;align-items:center;justify-content:center;flex-direction:column;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10}' +
      '.lsp-ir-center-num{font-size:22px;font-weight:bold;color:#f38ba8}' +
      '.lsp-ir-center-lbl{font-size:9px;color:#a6adc8}' +
      '.lsp-ir-summary{margin:16px 0;padding:12px;background:#2a2a3e;border-radius:6px;font-size:13px}' +
      '.lsp-ir-blast{color:#f38ba8;font-weight:bold;font-size:14px;margin-bottom:8px}' +
      '.lsp-ir-contained{color:#a6e3a1;font-weight:bold;font-size:14px;margin-bottom:8px}' +
      '.lsp-ir-layers{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}' +
      '.lsp-ir-layer{padding:4px 10px;border-radius:4px;font-size:12px;border:1px solid}' +
      '.lsp-ir-layer-active{opacity:1}' +
      '.lsp-ir-layer-clean{opacity:0.4;border-style:dashed}' +
      '.lsp-ir-chevron{transition:transform 0.2s}' +
      '.lsp-ir-chevron.open{transform:rotate(180deg)}';
    document.head.appendChild(style);
  }

  function classifyFinding(finding) {
    var text = ((finding.text || '') + ' ' + (finding.category || '')).toLowerCase();
    var matched = [];
    Object.keys(LAYERS).forEach(function(layer) {
      var keywords = LAYERS[layer];
      for (var i = 0; i < keywords.length; i++) {
        if (text.indexOf(keywords[i]) > -1) {
          matched.push(layer);
          break;
        }
      }
    });
    return matched;
  }

  function renderImpactRadiusPanel(findings) {
    if (typeof document === 'undefined') return;
    injectStyles();

    var container = document.getElementById('lsp-ir-panel');
    if (!container) {
      container = document.createElement('div');
      container.id = 'lsp-ir-panel';
      document.body.appendChild(container);
    }

    var items = Array.isArray(findings) ? findings : [];
    var layerCounts = {};
    Object.keys(LAYERS).forEach(function(l) { layerCounts[l] = 0; });

    items.forEach(function(f) {
      var layers = classifyFinding(f);
      layers.forEach(function(l) { layerCounts[l]++; });
    });

    var affectedLayers = Object.keys(layerCounts).filter(function(l) { return layerCounts[l] > 0; });
    var cleanLayers = Object.keys(layerCounts).filter(function(l) { return layerCounts[l] === 0; });
    var affectedCount = affectedLayers.length;
    var totalLayers = Object.keys(LAYERS).length;

    var html = '<div class="lsp-ir-panel">';
    html += '<div class="lsp-ir-header" id="lsp-ir-toggle"><h3>\uD83C\uDFAF Impact Radius</h3>';
    html += '<span class="lsp-ir-chevron" id="lsp-ir-chevron">\u25BC</span></div>';
    html += '<div class="lsp-ir-body open" id="lsp-ir-body">';

    // Concentric rings visual
    html += '<div class="lsp-ir-visual"><div class="lsp-ir-rings">';
    var layerNames = Object.keys(LAYERS);
    var ringSizes = [280, 240, 200, 160, 120, 90];
    layerNames.forEach(function(layer, idx) {
      var size = ringSizes[idx] || 80;
      var isActive = layerCounts[layer] > 0;
      var color = LAYER_COLORS[layer];
      var bgColor = isActive ? (color + '33') : 'transparent';
      var borderColor = isActive ? color : '#3a3a5a';
      var offset = (300 - size) / 2;
      html += '<div class="lsp-ir-ring' + (isActive ? ' active' : '') + '" style="';
      html += 'width:' + size + 'px;height:' + size + 'px;';
      html += 'top:' + offset + 'px;left:' + offset + 'px;';
      html += 'background:' + bgColor + ';border-color:' + borderColor + ';">';
      html += '<span class="lsp-ir-ring-label" style="color:' + color + ';top:-14px;left:50%;transform:translateX(-50%)">';
      html += layer + (isActive ? ' (' + layerCounts[layer] + ')' : '') + '</span>';
      html += '</div>';
    });
    html += '<div class="lsp-ir-center"><span class="lsp-ir-center-num">' + affectedCount + '</span>';
    html += '<span class="lsp-ir-center-lbl">layers hit</span></div>';
    html += '</div></div>';

    // Summary
    html += '<div class="lsp-ir-summary">';
    html += '<div>' + affectedCount + ' of ' + totalLayers + ' infrastructure layers affected</div>';

    if (affectedCount === 1) {
      html += '<div class="lsp-ir-contained">Isolated impact - contained to ' + affectedLayers[0] + '</div>';
    } else if (affectedCount >= 4) {
      html += '<div class="lsp-ir-blast">WIDE BLAST RADIUS - multiple systems affected</div>';
    }

    html += '<div class="lsp-ir-layers">';
    affectedLayers.forEach(function(l) {
      html += '<span class="lsp-ir-layer lsp-ir-layer-active" style="border-color:' + LAYER_COLORS[l] + ';color:' + LAYER_COLORS[l] + '">';
      html += '\u26A0\uFE0F ' + l + ' (' + layerCounts[l] + ')</span>';
    });
    cleanLayers.forEach(function(l) {
      html += '<span class="lsp-ir-layer lsp-ir-layer-clean" style="border-color:' + LAYER_COLORS[l] + ';color:' + LAYER_COLORS[l] + '">';
      html += '\u2705 ' + l + ' (clean)</span>';
    });
    html += '</div></div>';

    html += '</div></div>';
    container.innerHTML = html;

    var toggle = document.getElementById('lsp-ir-toggle');
    var body = document.getElementById('lsp-ir-body');
    var chevron = document.getElementById('lsp-ir-chevron');
    if (toggle) {
      toggle.addEventListener('click', function() {
        body.classList.toggle('open');
        chevron.classList.toggle('open');
      });
    }
  }

  if (typeof window !== 'undefined') {
    window.renderImpactRadiusPanel = renderImpactRadiusPanel;
  }
})();
