(function() {
  'use strict';

  var STYLE_ID = 'lsp-scan-diff-style';
  var BASELINE_KEY = 'lsp_scan_diff_baseline';
  var CSS = '.lsp-scan-diff-panel{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;border:1px solid #e0e0e0;border-radius:8px;margin:12px 0;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.06)}.lsp-scan-diff-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;cursor:pointer;background:#f8f9fa;border-radius:8px 8px 0 0;user-select:none}.lsp-scan-diff-header h3{margin:0;font-size:16px}.lsp-scan-diff-header .toggle{font-size:18px;transition:transform 0.2s}.lsp-scan-diff-header .toggle.collapsed{transform:rotate(-90deg)}.lsp-scan-diff-body{padding:18px;display:block}.lsp-scan-diff-body.hidden{display:none}.lsp-sd-summary{display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap}.lsp-sd-badge{padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600}.lsp-sd-badge-new{background:#fee2e2;color:#dc2626}.lsp-sd-badge-resolved{background:#d1fae5;color:#059669}.lsp-sd-badge-unchanged{background:#f3f4f6;color:#6b7280}.lsp-sd-list{list-style:none;padding:0;margin:0;max-height:400px;overflow-y:auto}.lsp-sd-item{padding:10px 14px;margin:4px 0;border-radius:5px;font-size:13px;border-left:4px solid transparent}.lsp-sd-item-new{background:#fef2f2;border-left-color:#ef4444;color:#991b1b}.lsp-sd-item-resolved{background:#f0fdf4;border-left-color:#22c55e;color:#166534}.lsp-sd-item-unchanged{background:#f9fafb;border-left-color:#d1d5db;color:#6b7280}.lsp-sd-btn{padding:8px 14px;border:none;border-radius:5px;cursor:pointer;font-size:13px;font-weight:500;background:#4f46e5;color:#fff;margin-bottom:12px}.lsp-sd-btn:hover{background:#4338ca}.lsp-sd-status{margin-top:8px;padding:6px 12px;border-radius:4px;font-size:12px;color:#065f46;background:#d1fae5;display:none}.lsp-sd-label{font-size:11px;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin:12px 0 6px;color:#374151}';

  window.renderScanDiffPanel = function(findings) {
    findings = findings || [];

    if (!document.getElementById(STYLE_ID)) {
      var style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    var panel = document.createElement('div');
    panel.className = 'lsp-scan-diff-panel';

    var header = document.createElement('div');
    header.className = 'lsp-scan-diff-header';
    header.innerHTML = '<h3>\uD83D\uDD0D Scan Diff Comparison</h3><span class="toggle">\u25BC</span>';

    var body = document.createElement('div');
    body.className = 'lsp-scan-diff-body';

    var collapsed = false;
    header.addEventListener('click', function() {
      collapsed = !collapsed;
      body.classList.toggle('hidden', collapsed);
      header.querySelector('.toggle').classList.toggle('collapsed', collapsed);
    });

    // Get baseline from localStorage
    var baselineRaw = localStorage.getItem(BASELINE_KEY);
    var baseline = null;
    try { baseline = baselineRaw ? JSON.parse(baselineRaw) : null; } catch(e) { baseline = null; }

    var isFirstRun = baseline === null;

    if (isFirstRun) {
      // Store current as baseline
      localStorage.setItem(BASELINE_KEY, JSON.stringify(findings));
      var msg = document.createElement('div');
      msg.style.cssText = 'padding:16px;font-size:14px;color:#4b5563;text-align:center;';
      msg.textContent = '\uD83D\uDCE6 First scan recorded as baseline (' + findings.length + ' findings). Run another scan to see differences.';
      body.appendChild(msg);
    } else {
      // Compute diff
      var baselineTexts = {};
      baseline.forEach(function(f) { baselineTexts[f.text] = f; });

      var currentTexts = {};
      findings.forEach(function(f) { currentTexts[f.text] = f; });

      var newFindings = findings.filter(function(f) { return !baselineTexts.hasOwnProperty(f.text); });
      var resolvedFindings = baseline.filter(function(f) { return !currentTexts.hasOwnProperty(f.text); });
      var unchangedFindings = findings.filter(function(f) { return baselineTexts.hasOwnProperty(f.text); });

      // Summary badges
      var summary = document.createElement('div');
      summary.className = 'lsp-sd-summary';

      var badgeNew = document.createElement('span');
      badgeNew.className = 'lsp-sd-badge lsp-sd-badge-new';
      badgeNew.textContent = '+' + newFindings.length + ' new';

      var badgeResolved = document.createElement('span');
      badgeResolved.className = 'lsp-sd-badge lsp-sd-badge-resolved';
      badgeResolved.textContent = '-' + resolvedFindings.length + ' resolved';

      var badgeUnchanged = document.createElement('span');
      badgeUnchanged.className = 'lsp-sd-badge lsp-sd-badge-unchanged';
      badgeUnchanged.textContent = unchangedFindings.length + ' unchanged';

      summary.appendChild(badgeNew);
      summary.appendChild(badgeResolved);
      summary.appendChild(badgeUnchanged);
      body.appendChild(summary);

      // Set new baseline button
      var btn = document.createElement('button');
      btn.className = 'lsp-sd-btn';
      btn.textContent = '\uD83D\uDD04 Set Current as New Baseline';

      var statusEl = document.createElement('div');
      statusEl.className = 'lsp-sd-status';

      btn.addEventListener('click', function() {
        localStorage.setItem(BASELINE_KEY, JSON.stringify(findings));
        statusEl.textContent = 'Baseline updated with ' + findings.length + ' findings.';
        statusEl.style.display = 'block';
        setTimeout(function() { statusEl.style.display = 'none'; }, 3000);
      });
      body.appendChild(btn);

      // Findings lists
      var list = document.createElement('ul');
      list.className = 'lsp-sd-list';

      if (newFindings.length > 0) {
        var labelNew = document.createElement('div');
        labelNew.className = 'lsp-sd-label';
        labelNew.textContent = '\u26A0\uFE0F New Findings (' + newFindings.length + ')';
        body.appendChild(labelNew);
        var listNew = document.createElement('ul');
        listNew.className = 'lsp-sd-list';
        newFindings.forEach(function(f) {
          var li = document.createElement('li');
          li.className = 'lsp-sd-item lsp-sd-item-new';
          li.textContent = '[' + (f.severity || 'info').toUpperCase() + '] ' + f.text;
          listNew.appendChild(li);
        });
        body.appendChild(listNew);
      }

      if (resolvedFindings.length > 0) {
        var labelRes = document.createElement('div');
        labelRes.className = 'lsp-sd-label';
        labelRes.textContent = '\u2705 Resolved Findings (' + resolvedFindings.length + ')';
        body.appendChild(labelRes);
        var listRes = document.createElement('ul');
        listRes.className = 'lsp-sd-list';
        resolvedFindings.forEach(function(f) {
          var li = document.createElement('li');
          li.className = 'lsp-sd-item lsp-sd-item-resolved';
          li.textContent = '[' + (f.severity || 'info').toUpperCase() + '] ' + f.text;
          listRes.appendChild(li);
        });
        body.appendChild(listRes);
      }

      if (unchangedFindings.length > 0) {
        var labelUnc = document.createElement('div');
        labelUnc.className = 'lsp-sd-label';
        labelUnc.textContent = '\u2796 Unchanged (' + unchangedFindings.length + ')';
        body.appendChild(labelUnc);
        var listUnc = document.createElement('ul');
        listUnc.className = 'lsp-sd-list';
        unchangedFindings.forEach(function(f) {
          var li = document.createElement('li');
          li.className = 'lsp-sd-item lsp-sd-item-unchanged';
          li.textContent = '[' + (f.severity || 'info').toUpperCase() + '] ' + f.text;
          listUnc.appendChild(li);
        });
        body.appendChild(listUnc);
      }

      body.appendChild(statusEl);
    }

    panel.appendChild(header);
    panel.appendChild(body);

    return panel;
  };
})();
