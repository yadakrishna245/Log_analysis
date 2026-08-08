(function() {
  'use strict';

  var STYLE_ID = 'logsherlock-root-cause-chain-style';
  var LS_PREFIX = 'logsherlock_rcc_';

  // Editable causal chain rules: [causeCategory, effectCategory]
  var CAUSAL_RULES = [
    ['storage', 'service'],
    ['storage', 'database'],
    ['storage', 'crash'],
    ['network', 'timeout'],
    ['network', 'service'],
    ['network', 'connection'],
    ['memory', 'crash'],
    ['memory', 'oom'],
    ['memory', 'service'],
    ['auth', 'access'],
    ['auth', 'permission'],
    ['auth', 'denied'],
    ['cpu', 'timeout'],
    ['cpu', 'service'],
    ['disk', 'storage'],
    ['disk', 'service'],
    ['dns', 'network'],
    ['dns', 'timeout'],
    ['config', 'service'],
    ['config', 'crash'],
    ['certificate', 'auth'],
    ['certificate', 'connection'],
    ['database', 'service'],
    ['database', 'timeout']
  ];

  var CSS = `
    .rcc-panel { border: 1px solid #334155; border-radius: 8px; margin: 12px 0; background: #1e293b; font-family: 'Segoe UI', sans-serif; }
    .rcc-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer; background: #0f172a; border-radius: 8px 8px 0 0; user-select: none; }
    .rcc-header h3 { margin: 0; color: #e2e8f0; font-size: 15px; }
    .rcc-header .rcc-toggle { color: #94a3b8; font-size: 18px; transition: transform 0.2s; }
    .rcc-header .rcc-toggle.collapsed { transform: rotate(-90deg); }
    .rcc-body { padding: 16px; }
    .rcc-body.hidden { display: none; }
    .rcc-chain { margin-bottom: 20px; padding: 12px; border: 1px solid #334155; border-radius: 6px; background: #0f172a; }
    .rcc-chain-title { font-size: 13px; color: #f59e0b; margin-bottom: 10px; font-weight: 600; }
    .rcc-node { position: relative; padding: 10px 12px; border-radius: 6px; background: #1e293b; border: 1px solid #475569; margin-bottom: 0; }
    .rcc-node-wrapper { position: relative; }
    .rcc-connector { display: flex; flex-direction: column; align-items: center; padding: 4px 0; }
    .rcc-connector-line { width: 2px; height: 20px; background: #3b82f6; }
    .rcc-connector-arrow { color: #3b82f6; font-size: 14px; line-height: 1; }
    .rcc-node-ts { font-size: 11px; color: #64748b; margin-bottom: 4px; }
    .rcc-node-text { font-size: 13px; color: #e2e8f0; word-break: break-word; }
    .rcc-severity { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; margin-left: 8px; text-transform: uppercase; }
    .rcc-severity-critical { background: #dc2626; color: #fff; }
    .rcc-severity-error { background: #ea580c; color: #fff; }
    .rcc-severity-warning { background: #ca8a04; color: #fff; }
    .rcc-severity-info { background: #2563eb; color: #fff; }
    .rcc-no-data { color: #64748b; text-align: center; padding: 24px; font-style: italic; }
    .rcc-stats { color: #94a3b8; font-size: 12px; margin-bottom: 10px; }
    .rcc-rule-tag { display: inline-block; font-size: 10px; color: #94a3b8; background: #334155; padding: 1px 5px; border-radius: 3px; margin-top: 4px; }
  `;

  function injectStyle() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function parseTs(ts) {
    if (!ts) return null;
    var d = new Date(ts);
    if (isNaN(d.getTime())) return null;
    return d;
  }

  function getSeverityClass(severity) {
    if (!severity) return 'rcc-severity-info';
    var s = severity.toLowerCase();
    if (s === 'critical' || s === 'fatal') return 'rcc-severity-critical';
    if (s === 'error' || s === 'err') return 'rcc-severity-error';
    if (s === 'warning' || s === 'warn') return 'rcc-severity-warning';
    return 'rcc-severity-info';
  }

  function categoryMatches(causeCategory, effectCategory, ruleFrom, ruleTo) {
    if (!causeCategory || !effectCategory) return false;
    var cc = causeCategory.toLowerCase();
    var ec = effectCategory.toLowerCase();
    return (cc.indexOf(ruleFrom) !== -1 && ec.indexOf(ruleTo) !== -1);
  }

  function detectChains(findings) {
    var timed = [];
    findings.forEach(function(f, idx) {
      var d = parseTs(f.timestamp);
      if (d && f.category) {
        timed.push({ date: d, finding: f, idx: idx });
      }
    });

    timed.sort(function(a, b) { return a.date - b.date; });

    var chains = [];
    var usedAsEffect = {};

    for (var i = 0; i < timed.length; i++) {
      if (usedAsEffect[timed[i].idx]) continue;
      for (var j = i + 1; j < timed.length; j++) {
        if (usedAsEffect[timed[j].idx]) continue;
        // Check if cause → effect relationship exists
        for (var r = 0; r < CAUSAL_RULES.length; r++) {
          var rule = CAUSAL_RULES[r];
          if (categoryMatches(timed[i].finding.category, timed[j].finding.category, rule[0], rule[1])) {
            // Check time ordering (cause must be before or same time as effect)
            if (timed[i].date <= timed[j].date) {
              // Check if this can extend an existing chain
              var extended = false;
              for (var c = 0; c < chains.length; c++) {
                var lastInChain = chains[c][chains[c].length - 1];
                if (lastInChain.idx === timed[i].idx) {
                  chains[c].push(timed[j]);
                  usedAsEffect[timed[j].idx] = true;
                  extended = true;
                  break;
                }
              }
              if (!extended) {
                chains.push([timed[i], timed[j]]);
                usedAsEffect[timed[j].idx] = true;
              }
              break;
            }
          }
        }
      }
    }

    return chains;
  }

  function truncateText(text, maxLen) {
    if (!text) return '';
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen) + '...';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  window.renderRootCauseChainPanel = function(findings) {
    injectStyle();

    var container = document.createElement('div');
    container.className = 'rcc-panel';

    var collapsed = false;
    if (typeof localStorage !== 'undefined') {
      collapsed = localStorage.getItem(LS_PREFIX + 'collapsed') === 'true';
    }

    function saveState() {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LS_PREFIX + 'collapsed', String(collapsed));
      }
    }

    function render() {
      container.innerHTML = '';

      // Header
      var header = document.createElement('div');
      header.className = 'rcc-header';
      header.innerHTML = '<h3>\uD83D\uDD0D Root Cause Chain Analysis</h3><span class="rcc-toggle ' + (collapsed ? 'collapsed' : '') + '">\u25BC</span>';
      header.addEventListener('click', function() {
        collapsed = !collapsed;
        saveState();
        render();
      });
      container.appendChild(header);

      if (collapsed) return;

      var body = document.createElement('div');
      body.className = 'rcc-body';

      if (!findings || findings.length === 0) {
        body.innerHTML = '<div class="rcc-no-data">No findings to analyze for causal chains</div>';
        container.appendChild(body);
        return;
      }

      var chains = detectChains(findings);

      if (chains.length === 0) {
        body.innerHTML = '<div class="rcc-no-data">No causal chains detected in current findings</div>';
        container.appendChild(body);
        return;
      }

      // Stats
      var stats = document.createElement('div');
      stats.className = 'rcc-stats';
      stats.textContent = '\u26A1 ' + chains.length + ' potential causal chain(s) detected from ' + findings.length + ' findings';
      body.appendChild(stats);

      // Render chains
      chains.forEach(function(chain, ci) {
        var chainDiv = document.createElement('div');
        chainDiv.className = 'rcc-chain';

        var title = document.createElement('div');
        title.className = 'rcc-chain-title';
        title.textContent = '\u26D3\uFE0F Chain #' + (ci + 1) + ' (' + chain.length + ' events)';
        chainDiv.appendChild(title);

        chain.forEach(function(item, ni) {
          var wrapper = document.createElement('div');
          wrapper.className = 'rcc-node-wrapper';

          var node = document.createElement('div');
          node.className = 'rcc-node';

          var tsLine = document.createElement('div');
          tsLine.className = 'rcc-node-ts';
          tsLine.textContent = item.date.toISOString();

          var sevBadge = '<span class="rcc-severity ' + getSeverityClass(item.finding.severity) + '">' + escapeHtml(item.finding.severity || 'info') + '</span>';
          var catTag = item.finding.category ? ' <span class="rcc-rule-tag">' + escapeHtml(item.finding.category) + '</span>' : '';

          node.innerHTML = '';
          node.appendChild(tsLine);

          var textLine = document.createElement('div');
          textLine.className = 'rcc-node-text';
          textLine.innerHTML = escapeHtml(truncateText(item.finding.text, 150)) + ' ' + sevBadge + catTag;
          node.appendChild(textLine);

          wrapper.appendChild(node);

          // Connector arrow (not after last node)
          if (ni < chain.length - 1) {
            var connector = document.createElement('div');
            connector.className = 'rcc-connector';
            connector.innerHTML = '<div class="rcc-connector-line"></div><div class="rcc-connector-arrow">\u25BC</div>';
            wrapper.appendChild(connector);
          }

          chainDiv.appendChild(wrapper);
        });

        body.appendChild(chainDiv);
      });

      container.appendChild(body);
    }

    render();
    return container;
  };

})();
