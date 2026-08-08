(function() {
  'use strict';

  var STYLE_ID = 'lsp-recurring-tracker-styles';
  var LS_KEY = 'lsp_recurring_tracker';

  function injectStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.lsp-rt-panel{background:#1e1e2e;border:1px solid #3a3a5a;border-radius:8px;margin:10px 0;font-family:monospace;color:#cdd6f4}' +
      '.lsp-rt-header{padding:12px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:#2a2a3e;border-radius:8px 8px 0 0}' +
      '.lsp-rt-header:hover{background:#3a3a5a}' +
      '.lsp-rt-header h3{margin:0;font-size:16px}' +
      '.lsp-rt-body{padding:16px;display:none}' +
      '.lsp-rt-body.open{display:block}' +
      '.lsp-rt-msg{padding:20px;text-align:center;color:#a6adc8;font-style:italic}' +
      '.lsp-rt-table{width:100%;border-collapse:collapse;font-size:12px}' +
      '.lsp-rt-table th{text-align:left;padding:8px;background:#2a2a3e;border-bottom:1px solid #3a3a5a;color:#89b4fa}' +
      '.lsp-rt-table td{padding:6px 8px;border-bottom:1px solid #2a2a3e}' +
      '.lsp-rt-chronic{background:#f38ba822;border-left:3px solid #f38ba8}' +
      '.lsp-rt-badge{display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:bold;background:#f38ba8;color:#1e1e2e;margin-left:6px}' +
      '.lsp-rt-btn{padding:4px 10px;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-weight:bold}' +
      '.lsp-rt-btn-ack{background:#a6e3a1;color:#1e1e2e}' +
      '.lsp-rt-btn-ack:hover{background:#94e2d5}' +
      '.lsp-rt-btn-clear{background:#f38ba8;color:#1e1e2e;margin-top:12px;padding:6px 14px;font-size:12px}' +
      '.lsp-rt-btn-clear:hover{background:#eba0ac}' +
      '.lsp-rt-chevron{transition:transform 0.2s}' +
      '.lsp-rt-chevron.open{transform:rotate(180deg)}' +
      '.lsp-rt-acked{opacity:0.5;text-decoration:line-through}';
    document.head.appendChild(style);
  }

  function getSignature(finding) {
    var cat = (finding.category || 'unknown').toLowerCase().trim();
    var txt = (finding.text || '').toLowerCase().trim().substring(0, 50);
    return cat + '|' + txt;
  }

  function loadTracker() {
    if (typeof localStorage === 'undefined') return { patterns: {}, scanCount: 0 };
    try {
      var data = localStorage.getItem(LS_KEY);
      return data ? JSON.parse(data) : { patterns: {}, scanCount: 0 };
    } catch(e) { return { patterns: {}, scanCount: 0 }; }
  }

  function saveTracker(tracker) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(tracker));
    } catch(e) {}
  }

  function renderRecurringIssueTrackerPanel(findings) {
    if (typeof document === 'undefined') return;
    injectStyles();

    var container = document.getElementById('lsp-rt-panel');
    if (!container) {
      container = document.createElement('div');
      container.id = 'lsp-rt-panel';
      document.body.appendChild(container);
    }

    var items = Array.isArray(findings) ? findings : [];
    var tracker = loadTracker();
    var now = new Date().toISOString();
    var isFirstScan = tracker.scanCount === 0;

    tracker.scanCount++;
    var currentSigs = {};
    items.forEach(function(f) {
      var sig = getSignature(f);
      currentSigs[sig] = true;
      if (!tracker.patterns[sig]) {
        tracker.patterns[sig] = { count: 0, firstSeen: now, lastSeen: now, acknowledged: false, ackCount: 0 };
      }
    });

    Object.keys(currentSigs).forEach(function(sig) {
      tracker.patterns[sig].count++;
      tracker.patterns[sig].lastSeen = now;
    });

    saveTracker(tracker);

    var sorted = Object.keys(tracker.patterns).sort(function(a, b) {
      return tracker.patterns[b].count - tracker.patterns[a].count;
    });

    var html = '<div class="lsp-rt-panel">';
    html += '<div class="lsp-rt-header" id="lsp-rt-toggle"><h3>\uD83D\uDD01 Recurring Issue Tracker</h3>';
    html += '<span class="lsp-rt-chevron" id="lsp-rt-chevron">\u25BC</span></div>';
    html += '<div class="lsp-rt-body open" id="lsp-rt-body">';

    if (isFirstScan) {
      html += '<div class="lsp-rt-msg">First scan recorded. Recurring patterns will appear after 2+ scans.</div>';
    } else if (sorted.length === 0) {
      html += '<div class="lsp-rt-msg">No recurring patterns detected yet.</div>';
    } else {
      html += '<table class="lsp-rt-table"><thead><tr>';
      html += '<th>Pattern</th><th>Count</th><th>First Seen</th><th>Last Seen</th><th>Status</th><th>Action</th>';
      html += '</tr></thead><tbody>';

      sorted.forEach(function(sig, idx) {
        var p = tracker.patterns[sig];
        var isChronic = p.count >= 3;
        var isAcked = p.acknowledged && p.ackCount >= p.count;
        var rowClass = isChronic ? ' class="lsp-rt-chronic"' : '';
        if (isAcked) rowClass = ' class="lsp-rt-acked"';
        html += '<tr' + rowClass + '>';
        html += '<td>' + sig.substring(0, 60) + (isChronic ? '<span class="lsp-rt-badge">CHRONIC</span>' : '') + '</td>';
        html += '<td>' + p.count + '</td>';
        html += '<td>' + p.firstSeen.substring(0, 10) + '</td>';
        html += '<td>' + p.lastSeen.substring(0, 10) + '</td>';
        html += '<td>' + (isAcked ? 'Acknowledged' : (isChronic ? 'Chronic' : 'Active')) + '</td>';
        html += '<td><button class="lsp-rt-btn lsp-rt-btn-ack" data-sig="' + idx + '">Acknowledge</button></td>';
        html += '</tr>';
      });

      html += '</tbody></table>';
    }

    html += '<button class="lsp-rt-btn lsp-rt-btn-clear" id="lsp-rt-clear">\uD83D\uDDD1\uFE0F Clear History</button>';
    html += '</div></div>';
    container.innerHTML = html;

    var toggle = document.getElementById('lsp-rt-toggle');
    var body = document.getElementById('lsp-rt-body');
    var chevron = document.getElementById('lsp-rt-chevron');
    if (toggle) {
      toggle.addEventListener('click', function() {
        body.classList.toggle('open');
        chevron.classList.toggle('open');
      });
    }

    var ackBtns = container.querySelectorAll('.lsp-rt-btn-ack');
    ackBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.getAttribute('data-sig'), 10);
        var sig = sorted[idx];
        if (sig && tracker.patterns[sig]) {
          tracker.patterns[sig].acknowledged = true;
          tracker.patterns[sig].ackCount = tracker.patterns[sig].count;
          saveTracker(tracker);
          renderRecurringIssueTrackerPanel(findings);
        }
      });
    });

    var clearBtn = document.getElementById('lsp-rt-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to clear all recurring issue history?')) {
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(LS_KEY);
          }
          renderRecurringIssueTrackerPanel(findings);
        }
      });
    }
  }

  if (typeof window !== 'undefined') {
    window.renderRecurringIssueTrackerPanel = renderRecurringIssueTrackerPanel;
  }
})();
