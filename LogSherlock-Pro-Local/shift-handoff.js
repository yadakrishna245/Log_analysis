(function() {
  "use strict";

  var STORAGE_KEY = 'lsp_handoffs';
  var USER_KEY = 'lsp_handoff_engineer';

  function getHandoffs() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch(e) { return []; }
  }

  function saveHandoffs(handoffs) {
    // Keep last 5 only
    var trimmed = handoffs.slice(-5);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  }

  function getEngineerName() {
    return localStorage.getItem(USER_KEY) || '';
  }

  function setEngineerName(name) {
    localStorage.setItem(USER_KEY, name);
  }

  function promptEngineerName() {
    var stored = getEngineerName();
    if (stored) return stored;
    var name = prompt('Enter your engineer name for handoff reports:');
    if (name && name.trim()) {
      setEngineerName(name.trim());
      return name.trim();
    }
    return '';
  }

  function getRunbookActions() {
    try {
      var data = localStorage.getItem('lsp_runbooks');
      if (!data) return [];
      var runbooks = JSON.parse(data);
      var actions = [];
      runbooks.forEach(function(rb) {
        var completedSteps = rb.steps.filter(function(s) { return s.isCompleted; });
        if (completedSteps.length > 0) {
          actions.push({
            runbook: rb.name,
            category: rb.category,
            completedSteps: completedSteps.length,
            totalSteps: rb.steps.length,
            steps: completedSteps.map(function(s) { return s.text; })
          });
        }
      });
      return actions;
    } catch(e) { return []; }
  }

  function generateReport(findings, engineerName) {
    var now = new Date();
    var severityCounts = {};
    var categoryCounts = {};
    var criticalFindings = [];
    var highFindings = [];

    findings.forEach(function(f) {
      var sev = (f.severity || 'unknown').toLowerCase();
      severityCounts[sev] = (severityCounts[sev] || 0) + 1;
      var cat = f.category || 'uncategorized';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      if (sev === 'critical') criticalFindings.push(f);
      if (sev === 'high') highFindings.push(f);
    });

    var actions = getRunbookActions();

    // Recommended next steps based on categories
    var nextSteps = [];
    Object.keys(categoryCounts).forEach(function(cat) {
      nextSteps.push('Review ' + categoryCounts[cat] + ' ' + cat + ' finding(s) for resolution');
    });
    if (criticalFindings.length > 0) {
      nextSteps.unshift('URGENT: ' + criticalFindings.length + ' critical finding(s) require immediate attention');
    }

    // Overall status
    var status = 'GREEN';
    if (highFindings.length > 0) status = 'YELLOW';
    if (criticalFindings.length > 0) status = 'RED';

    var report = {
      engineerName: engineerName,
      generatedAt: now.toISOString(),
      shiftDate: now.toLocaleDateString(),
      shiftTime: now.toLocaleTimeString(),
      totalFindings: findings.length,
      severityCounts: severityCounts,
      categoryCounts: categoryCounts,
      criticalCount: criticalFindings.length,
      highCount: highFindings.length,
      openItems: criticalFindings.concat(highFindings).map(function(f) {
        return { line: f.line, severity: f.severity, text: f.text, file: f.file, category: f.category };
      }),
      actionsTaken: actions,
      recommendedNextSteps: nextSteps,
      overallStatus: status
    };

    return report;
  }

  function reportToText(report) {
    var lines = [];
    lines.push('═══════════════════════════════════════════════════');
    lines.push('        L4 → L4 SHIFT HANDOFF REPORT');
    lines.push('═══════════════════════════════════════════════════');
    lines.push('');
    lines.push('Engineer: ' + report.engineerName);
    lines.push('Date:     ' + report.shiftDate);
    lines.push('Time:     ' + report.shiftTime);
    lines.push('Status:   ' + report.overallStatus);
    lines.push('');
    lines.push('─── FINDINGS SUMMARY ───');
    lines.push('Total Findings: ' + report.totalFindings);
    Object.keys(report.severityCounts).forEach(function(sev) {
      lines.push('  ' + sev.toUpperCase() + ': ' + report.severityCounts[sev]);
    });
    lines.push('');
    lines.push('─── BY CATEGORY ───');
    Object.keys(report.categoryCounts).forEach(function(cat) {
      lines.push('  ' + cat + ': ' + report.categoryCounts[cat]);
    });
    lines.push('');
    lines.push('─── OPEN ITEMS (Critical/High) ───');
    if (report.openItems.length === 0) {
      lines.push('  None — all clear ✓');
    } else {
      report.openItems.forEach(function(item, i) {
        lines.push('  ' + (i + 1) + '. [' + (item.severity || '?').toUpperCase() + '] Line ' + (item.line || '?') + ': ' + item.text);
        if (item.file) lines.push('     File: ' + item.file);
      });
    }
    lines.push('');
    lines.push('─── ACTIONS TAKEN ───');
    if (report.actionsTaken.length === 0) {
      lines.push('  No runbook actions recorded this shift.');
    } else {
      report.actionsTaken.forEach(function(a) {
        lines.push('  Runbook: ' + a.runbook + ' (' + a.completedSteps + '/' + a.totalSteps + ' steps)');
        a.steps.forEach(function(s) {
          lines.push('    ✓ ' + s);
        });
      });
    }
    lines.push('');
    lines.push('─── RECOMMENDED NEXT STEPS ───');
    report.recommendedNextSteps.forEach(function(step, i) {
      lines.push('  ' + (i + 1) + '. ' + step);
    });
    lines.push('');
    lines.push('═══════════════════════════════════════════════════');
    lines.push('Generated: ' + report.generatedAt);
    lines.push('═══════════════════════════════════════════════════');
    return lines.join('\n');
  }

  function reportToMarkdown(report) {
    var lines = [];
    lines.push('# L4 → L4 Shift Handoff Report');
    lines.push('');
    lines.push('| Field | Value |');
    lines.push('|-------|-------|');
    lines.push('| Engineer | ' + report.engineerName + ' |');
    lines.push('| Date | ' + report.shiftDate + ' |');
    lines.push('| Time | ' + report.shiftTime + ' |');
    lines.push('| Overall Status | **' + report.overallStatus + '** |');
    lines.push('');
    lines.push('## Findings Summary');
    lines.push('');
    lines.push('**Total:** ' + report.totalFindings);
    lines.push('');
    Object.keys(report.severityCounts).forEach(function(sev) {
      lines.push('- **' + sev.toUpperCase() + ':** ' + report.severityCounts[sev]);
    });
    lines.push('');
    lines.push('## By Category');
    lines.push('');
    Object.keys(report.categoryCounts).forEach(function(cat) {
      lines.push('- ' + cat + ': ' + report.categoryCounts[cat]);
    });
    lines.push('');
    lines.push('## Open Items (Critical/High)');
    lines.push('');
    if (report.openItems.length === 0) {
      lines.push('None — all clear ✓');
    } else {
      report.openItems.forEach(function(item, i) {
        lines.push((i + 1) + '. **[' + (item.severity || '?').toUpperCase() + ']** Line ' + (item.line || '?') + ': `' + item.text + '`');
        if (item.file) lines.push('   - File: `' + item.file + '`');
      });
    }
    lines.push('');
    lines.push('## Actions Taken');
    lines.push('');
    if (report.actionsTaken.length === 0) {
      lines.push('No runbook actions recorded this shift.');
    } else {
      report.actionsTaken.forEach(function(a) {
        lines.push('### ' + a.runbook + ' (' + a.completedSteps + '/' + a.totalSteps + ' steps)');
        a.steps.forEach(function(s) {
          lines.push('- [x] ' + s);
        });
        lines.push('');
      });
    }
    lines.push('');
    lines.push('## Recommended Next Steps');
    lines.push('');
    report.recommendedNextSteps.forEach(function(step, i) {
      lines.push((i + 1) + '. ' + step);
    });
    lines.push('');
    lines.push('---');
    lines.push('*Generated: ' + report.generatedAt + '*');
    return lines.join('\n');
  }

  function injectStyles() {
    if (document.getElementById('lsp-handoff-styles')) return;
    var style = document.createElement('style');
    style.id = 'lsp-handoff-styles';
    style.textContent = [
      '.lsp-ho-panel { border:1px solid #444; border-radius:8px; margin:10px 0; background:#1a1a2e; color:#e0e0e0; font-family:monospace; }',
      '.lsp-ho-header { padding:12px 16px; cursor:pointer; font-size:16px; font-weight:bold; background:#16213e; border-radius:8px 8px 0 0; display:flex; justify-content:space-between; align-items:center; }',
      '.lsp-ho-header:hover { background:#1a2744; }',
      '.lsp-ho-body { padding:16px; display:none; }',
      '.lsp-ho-body.open { display:block; }',
      '.lsp-ho-generate-btn { padding:12px 24px; background:#0066cc; color:#fff; border:none; border-radius:6px; font-size:14px; font-weight:bold; cursor:pointer; display:block; width:100%; }',
      '.lsp-ho-generate-btn:hover { background:#0077ee; }',
      '.lsp-ho-report { background:#0a1a0a; border:1px solid #339933; border-radius:6px; padding:16px; margin-top:12px; white-space:pre-wrap; font-size:12px; line-height:1.5; max-height:400px; overflow-y:auto; }',
      '.lsp-ho-export-btns { display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; }',
      '.lsp-ho-btn { padding:8px 14px; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold; }',
      '.lsp-ho-btn-copy { background:#0066cc; color:#fff; }',
      '.lsp-ho-btn-txt { background:#339933; color:#fff; }',
      '.lsp-ho-btn-md { background:#9933cc; color:#fff; }',
      '.lsp-ho-history { margin-top:16px; }',
      '.lsp-ho-history-title { font-weight:bold; color:#88aacc; margin-bottom:8px; font-size:13px; }',
      '.lsp-ho-history-item { padding:8px 12px; background:#16213e; border-radius:4px; margin:4px 0; cursor:pointer; display:flex; justify-content:space-between; }',
      '.lsp-ho-history-item:hover { background:#1a2744; }',
      '.lsp-ho-history-date { color:#88ccff; font-size:12px; }',
      '.lsp-ho-history-status { font-size:11px; padding:2px 6px; border-radius:3px; }',
      '.lsp-ho-status-RED { background:#cc3333; color:#fff; }',
      '.lsp-ho-status-YELLOW { background:#cc9900; color:#fff; }',
      '.lsp-ho-status-GREEN { background:#339933; color:#fff; }',
      '.lsp-ho-name-section { margin-bottom:12px; }',
      '.lsp-ho-name-input { padding:6px 8px; border:1px solid #555; border-radius:4px; background:#1a1a2e; color:#e0e0e0; width:200px; font-family:monospace; }',
      '.lsp-ho-name-btn { padding:6px 12px; background:#555; color:#fff; border:none; border-radius:4px; cursor:pointer; margin-left:6px; font-size:12px; }',
      '.lsp-ho-toggle { font-size:18px; transition:transform 0.2s; }',
      '.lsp-ho-toggle.open { transform:rotate(90deg); }'
    ].join('\n');
    document.head.appendChild(style);
  }

  window.renderShiftHandoffPanel = function(findings) {
    injectStyles();
    var panel = document.createElement('div');
    panel.className = 'lsp-ho-panel';

    // Header
    var header = document.createElement('div');
    header.className = 'lsp-ho-header';
    var headerText = document.createElement('span');
    headerText.textContent = '🔄 Shift Handoff';
    var toggle = document.createElement('span');
    toggle.className = 'lsp-ho-toggle';
    toggle.textContent = '▶';
    header.appendChild(headerText);
    header.appendChild(toggle);

    var body = document.createElement('div');
    body.className = 'lsp-ho-body';

    header.addEventListener('click', function() {
      body.classList.toggle('open');
      toggle.classList.toggle('open');
    });

    // Engineer name section
    var nameSection = document.createElement('div');
    nameSection.className = 'lsp-ho-name-section';
    var currentName = getEngineerName();
    var nameLabel = document.createElement('span');
    nameLabel.style.cssText = 'font-size:12px;color:#88aacc;margin-right:8px;';
    nameLabel.textContent = '👤 Engineer: ';
    var nameInput = document.createElement('input');
    nameInput.className = 'lsp-ho-name-input';
    nameInput.type = 'text';
    nameInput.value = currentName;
    nameInput.placeholder = 'Enter your name';
    var nameBtn = document.createElement('button');
    nameBtn.className = 'lsp-ho-name-btn';
    nameBtn.textContent = '💾 Save';
    nameBtn.addEventListener('click', function() {
      var name = nameInput.value.trim();
      if (name) {
        setEngineerName(name);
        nameBtn.textContent = '✅ Saved';
        setTimeout(function() { nameBtn.textContent = '💾 Save'; }, 2000);
      }
    });
    nameSection.appendChild(nameLabel);
    nameSection.appendChild(nameInput);
    nameSection.appendChild(nameBtn);
    body.appendChild(nameSection);

    // Generate button
    var genBtn = document.createElement('button');
    genBtn.className = 'lsp-ho-generate-btn';
    genBtn.textContent = '📝 Generate Handoff Report';

    var reportArea = document.createElement('div');
    var exportBtns = document.createElement('div');
    exportBtns.className = 'lsp-ho-export-btns';
    exportBtns.style.display = 'none';

    var currentReport = null;
    var currentReportText = '';
    var currentReportMd = '';

    genBtn.addEventListener('click', function() {
      var engineerName = nameInput.value.trim() || promptEngineerName();
      if (!engineerName) {
        engineerName = 'Unknown Engineer';
      }
      nameInput.value = engineerName;
      setEngineerName(engineerName);

      currentReport = generateReport(findings, engineerName);
      currentReportText = reportToText(currentReport);
      currentReportMd = reportToMarkdown(currentReport);

      reportArea.innerHTML = '';
      var reportDiv = document.createElement('div');
      reportDiv.className = 'lsp-ho-report';
      reportDiv.textContent = currentReportText;
      reportArea.appendChild(reportDiv);
      exportBtns.style.display = 'flex';

      // Save to history
      var handoffs = getHandoffs();
      handoffs.push(currentReport);
      saveHandoffs(handoffs);
      renderHistory();
    });

    // Export buttons
    var copyBtn = document.createElement('button');
    copyBtn.className = 'lsp-ho-btn lsp-ho-btn-copy';
    copyBtn.textContent = '📋 Copy to Clipboard';
    copyBtn.addEventListener('click', function() {
      navigator.clipboard.writeText(currentReportText).then(function() {
        copyBtn.textContent = '✅ Copied!';
        setTimeout(function() { copyBtn.textContent = '📋 Copy to Clipboard'; }, 2000);
      });
    });

    var txtBtn = document.createElement('button');
    txtBtn.className = 'lsp-ho-btn lsp-ho-btn-txt';
    txtBtn.textContent = '📄 Download .txt';
    txtBtn.addEventListener('click', function() {
      var blob = new Blob([currentReportText], { type: 'text/plain' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'handoff-' + new Date().toISOString().split('T')[0] + '.txt';
      a.click();
      URL.revokeObjectURL(url);
    });

    var mdBtn = document.createElement('button');
    mdBtn.className = 'lsp-ho-btn lsp-ho-btn-md';
    mdBtn.textContent = '📝 Download .md';
    mdBtn.addEventListener('click', function() {
      var blob = new Blob([currentReportMd], { type: 'text/markdown' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'handoff-' + new Date().toISOString().split('T')[0] + '.md';
      a.click();
      URL.revokeObjectURL(url);
    });

    exportBtns.appendChild(copyBtn);
    exportBtns.appendChild(txtBtn);
    exportBtns.appendChild(mdBtn);

    body.appendChild(genBtn);
    body.appendChild(reportArea);
    body.appendChild(exportBtns);

    // History section
    var historySection = document.createElement('div');
    historySection.className = 'lsp-ho-history';

    function renderHistory() {
      historySection.innerHTML = '';
      var handoffs = getHandoffs();
      if (handoffs.length === 0) return;
      var histTitle = document.createElement('div');
      histTitle.className = 'lsp-ho-history-title';
      histTitle.textContent = '📜 Recent Handoffs (last 5)';
      historySection.appendChild(histTitle);

      handoffs.slice().reverse().forEach(function(h) {
        var item = document.createElement('div');
        item.className = 'lsp-ho-history-item';
        var dateSpan = document.createElement('span');
        dateSpan.className = 'lsp-ho-history-date';
        dateSpan.textContent = h.engineerName + ' — ' + h.shiftDate + ' ' + h.shiftTime;
        var statusSpan = document.createElement('span');
        statusSpan.className = 'lsp-ho-history-status lsp-ho-status-' + h.overallStatus;
        statusSpan.textContent = h.overallStatus;
        item.appendChild(dateSpan);
        item.appendChild(statusSpan);
        item.addEventListener('click', function() {
          reportArea.innerHTML = '';
          var reportDiv = document.createElement('div');
          reportDiv.className = 'lsp-ho-report';
          reportDiv.textContent = reportToText(h);
          reportArea.appendChild(reportDiv);
          currentReportText = reportToText(h);
          currentReportMd = reportToMarkdown(h);
          currentReport = h;
          exportBtns.style.display = 'flex';
        });
        historySection.appendChild(item);
      });
    }

    body.appendChild(historySection);
    renderHistory();

    panel.appendChild(header);
    panel.appendChild(body);

    return panel;
  };

})();
