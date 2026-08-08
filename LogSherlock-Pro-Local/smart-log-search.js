/**
 * LogSherlock Pro — Smart Log Search (Regex Builder)
 * Visual regex construction for non-regex users + saved searches.
 * ZERO fake data — all results from real scan findings + localStorage.
 */
(function () {
  if (typeof window === 'undefined') return;

  const STORAGE_KEY = 'logsherlock_saved_searches';

  // ─── Styles ───────────────────────────────────────────────────────────────────
  const STYLES = `
    .smart-search-panel {
      background: #1e1e2e;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 24px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #e0e0e0;
      max-width: 900px;
      margin: 16px auto;
    }
    .smart-search-panel h2 {
      color: #01a982;
      margin: 0 0 20px 0;
      font-size: 1.4em;
      border-bottom: 1px solid #333;
      padding-bottom: 12px;
    }
    .smart-search-panel h3 {
      color: #01a982;
      margin: 18px 0 10px 0;
      font-size: 1.1em;
    }
    .ss-builder-row {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }
    .ss-builder-row select,
    .ss-builder-row input[type="text"] {
      background: #2a2a3e;
      border: 1px solid #444;
      color: #e0e0e0;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 0.9em;
    }
    .ss-builder-row select:focus,
    .ss-builder-row input[type="text"]:focus {
      outline: none;
      border-color: #01a982;
    }
    .ss-builder-row input[type="text"] {
      flex: 1;
      min-width: 200px;
    }
    .ss-checkbox-row {
      display: flex;
      gap: 16px;
      align-items: center;
      margin-bottom: 10px;
    }
    .ss-checkbox-row label {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.85em;
      color: #ccc;
      cursor: pointer;
    }
    .ss-checkbox-row input[type="checkbox"] {
      accent-color: #01a982;
    }
    .ss-conditions-list {
      margin: 10px 0;
    }
    .ss-condition-item {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
      padding: 6px 10px;
      background: #2a2a3e;
      border-radius: 4px;
      font-size: 0.85em;
    }
    .ss-condition-item .ss-operator-badge {
      background: #01a982;
      color: #1e1e2e;
      padding: 2px 8px;
      border-radius: 3px;
      font-weight: bold;
      font-size: 0.8em;
    }
    .ss-condition-item .ss-remove-condition {
      margin-left: auto;
      background: none;
      border: none;
      color: #ff6b6b;
      cursor: pointer;
      font-size: 1.1em;
    }
    .ss-preview-box {
      background: #12121e;
      border: 1px solid #444;
      border-radius: 4px;
      padding: 10px 14px;
      margin: 10px 0;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 0.9em;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .ss-preview-box .ss-validity {
      font-size: 1.2em;
    }
    .ss-preview-box code {
      color: #f9e2af;
      word-break: break-all;
    }
    .ss-btn {
      background: #01a982;
      color: #1e1e2e;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: bold;
      cursor: pointer;
      font-size: 0.9em;
      transition: opacity 0.2s;
    }
    .ss-btn:hover {
      opacity: 0.85;
    }
    .ss-btn-secondary {
      background: #333;
      color: #e0e0e0;
    }
    .ss-btn-danger {
      background: #ff6b6b;
      color: #fff;
    }
    .ss-btn-small {
      padding: 4px 10px;
      font-size: 0.8em;
    }
    .ss-scope-row {
      margin: 12px 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .ss-scope-row label {
      font-size: 0.85em;
      color: #aaa;
    }
    .ss-scope-row select {
      background: #2a2a3e;
      border: 1px solid #444;
      color: #e0e0e0;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 0.85em;
    }
    .ss-results-summary {
      color: #01a982;
      font-weight: bold;
      margin: 14px 0 8px 0;
      font-size: 0.95em;
    }
    .ss-results-list {
      max-height: 350px;
      overflow-y: auto;
      margin: 8px 0;
    }
    .ss-result-item {
      background: #2a2a3e;
      border: 1px solid #333;
      border-radius: 4px;
      padding: 10px 12px;
      margin-bottom: 6px;
    }
    .ss-result-item .ss-severity-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 0.75em;
      font-weight: bold;
      text-transform: uppercase;
      margin-right: 8px;
    }
    .ss-severity-critical { background: #ff4444; color: #fff; }
    .ss-severity-high { background: #ff6b35; color: #fff; }
    .ss-severity-medium { background: #ffa500; color: #1e1e2e; }
    .ss-severity-low { background: #4ecdc4; color: #1e1e2e; }
    .ss-severity-info { background: #45b7d1; color: #1e1e2e; }
    .ss-result-pattern {
      color: #cba6f7;
      font-weight: bold;
      font-size: 0.85em;
    }
    .ss-result-file {
      color: #89b4fa;
      font-size: 0.8em;
      margin-top: 4px;
    }
    .ss-result-line {
      font-family: 'Consolas', monospace;
      font-size: 0.8em;
      color: #bbb;
      margin-top: 4px;
      word-break: break-all;
    }
    .ss-result-line mark {
      background: #01a982;
      color: #1e1e2e;
      padding: 0 2px;
      border-radius: 2px;
    }
    .ss-saved-list {
      margin: 10px 0;
    }
    .ss-saved-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: #2a2a3e;
      border-radius: 4px;
      margin-bottom: 6px;
      flex-wrap: wrap;
    }
    .ss-saved-item .ss-saved-name {
      color: #01a982;
      font-weight: bold;
      font-size: 0.9em;
    }
    .ss-saved-item .ss-saved-regex {
      font-family: 'Consolas', monospace;
      color: #f9e2af;
      font-size: 0.8em;
    }
    .ss-saved-item .ss-saved-meta {
      color: #888;
      font-size: 0.75em;
      margin-left: auto;
    }
    .ss-save-row {
      display: flex;
      gap: 8px;
      align-items: center;
      margin: 10px 0;
    }
    .ss-save-row input[type="text"] {
      background: #2a2a3e;
      border: 1px solid #444;
      color: #e0e0e0;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 0.85em;
      flex: 1;
      max-width: 250px;
    }
    .ss-templates-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 8px;
      margin: 10px 0;
    }
    .ss-template-item {
      background: #2a2a3e;
      border: 1px solid #444;
      border-radius: 4px;
      padding: 10px;
      cursor: pointer;
      transition: border-color 0.2s;
    }
    .ss-template-item:hover {
      border-color: #01a982;
    }
    .ss-template-item .ss-tmpl-name {
      color: #01a982;
      font-weight: bold;
      font-size: 0.85em;
      margin-bottom: 4px;
    }
    .ss-template-item .ss-tmpl-regex {
      font-family: 'Consolas', monospace;
      color: #f9e2af;
      font-size: 0.75em;
      word-break: break-all;
    }
    .ss-empty-msg {
      color: #888;
      font-style: italic;
      font-size: 0.85em;
      padding: 10px;
    }
    .ss-operator-toggle {
      background: #333;
      color: #01a982;
      border: 1px solid #01a982;
      padding: 4px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8em;
      font-weight: bold;
    }
  `;



  // ─── Utility Functions ────────────────────────────────────────────────────────

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function getSavedSearches() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveSavedSearches(searches) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
  }

  function saveSearch(name, regex, description) {
    const searches = getSavedSearches();
    searches.push({
      id: generateId(),
      name: name,
      regex: regex,
      description: description || '',
      created_at: new Date().toISOString(),
      last_used: new Date().toISOString(),
      use_count: 0
    });
    saveSavedSearches(searches);
  }

  function deleteSearch(id) {
    const searches = getSavedSearches().filter(function (s) { return s.id !== id; });
    saveSavedSearches(searches);
  }

  function markSearchUsed(id) {
    const searches = getSavedSearches();
    for (var i = 0; i < searches.length; i++) {
      if (searches[i].id === id) {
        searches[i].use_count++;
        searches[i].last_used = new Date().toISOString();
        break;
      }
    }
    saveSavedSearches(searches);
  }

  function isValidRegex(pattern) {
    try {
      new RegExp(pattern);
      return true;
    } catch (e) {
      return false;
    }
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function buildRegexFromCondition(matchType, term, caseInsensitive, wholeWord) {
    var pattern = '';
    var escapedTerm = escapeRegex(term);

    switch (matchType) {
      case 'contains':
        pattern = escapedTerm;
        break;
      case 'starts_with':
        pattern = '^' + escapedTerm;
        break;
      case 'ends_with':
        pattern = escapedTerm + '$';
        break;
      case 'exact':
        pattern = '^' + escapedTerm + '$';
        break;
      case 'regex':
        pattern = term; // raw regex, no escaping
        break;
      default:
        pattern = escapedTerm;
    }

    if (wholeWord && matchType !== 'regex') {
      pattern = '\\b' + pattern + '\\b';
    }

    return pattern;
  }

  function buildCombinedRegex(conditions, operator) {
    if (conditions.length === 0) return '';
    if (conditions.length === 1) return conditions[0].pattern;

    if (operator === 'AND') {
      // AND: use lookaheads
      return conditions.map(function (c) { return '(?=.*' + c.pattern + ')'; }).join('') + '.*';
    } else {
      // OR: use alternation
      return conditions.map(function (c) { return '(?:' + c.pattern + ')'; }).join('|');
    }
  }

  function getSeverityClass(severity) {
    if (!severity) return 'ss-severity-info';
    var s = severity.toLowerCase();
    if (s === 'critical') return 'ss-severity-critical';
    if (s === 'high') return 'ss-severity-high';
    if (s === 'medium') return 'ss-severity-medium';
    if (s === 'low') return 'ss-severity-low';
    return 'ss-severity-info';
  }

  function highlightMatch(text, regex) {
    if (!text || !regex) return text || '';
    try {
      var re = new RegExp('(' + regex + ')', 'gi');
      return text.replace(re, '<mark>$1</mark>');
    } catch (e) {
      return text;
    }
  }

  function searchFindings(findings, regex, scope, flags) {
    if (!findings || !Array.isArray(findings) || !regex) return [];
    var re;
    try {
      re = new RegExp(regex, flags || 'i');
    } catch (e) {
      return [];
    }

    var results = [];
    for (var i = 0; i < findings.length; i++) {
      var f = findings[i];
      var matched = false;

      if (scope === 'pattern' || scope === 'all') {
        if (f.pattern_name && re.test(f.pattern_name)) matched = true;
      }
      if (scope === 'file' || scope === 'all') {
        if (f.file && re.test(f.file)) matched = true;
        if (f.file_name && re.test(f.file_name)) matched = true;
      }
      if (scope === 'line' || scope === 'all') {
        if (f.line_content && re.test(f.line_content)) matched = true;
        if (f.line && re.test(f.line)) matched = true;
      }

      if (matched) {
        results.push(f);
      }
    }
    return results;
  }

  // ─── Regex Templates (tools, NOT fake data) ──────────────────────────────────

  var REGEX_TEMPLATES = [
    { name: 'IP Address', regex: '\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b' },
    { name: 'Timestamp', regex: '\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}:\\d{2}' },
    { name: 'Error Codes', regex: '(?:error|errno|rc)\\s*[=:]\\s*-?\\d+' },
    { name: 'File Paths', regex: '/[\\w/.-]+' },
    { name: 'Memory Values', regex: '\\d+\\s*[KMGT]B' }
  ];



  // ─── Main Render Function ─────────────────────────────────────────────────────

  function renderSmartSearchPanel(findings) {
    findings = findings || [];

    // Inject styles once
    if (!document.getElementById('ss-styles')) {
      var styleEl = document.createElement('style');
      styleEl.id = 'ss-styles';
      styleEl.textContent = STYLES;
      document.head.appendChild(styleEl);
    }

    var panel = document.createElement('div');
    panel.className = 'smart-search-panel';

    // State
    var conditions = [];
    var operator = 'AND';
    var currentResults = [];

    // ─── Title ──────────────────────────────────────────────────────────────────
    var title = document.createElement('h2');
    title.textContent = '\uD83D\uDD0D Smart Log Search \u2014 Regex Builder';
    panel.appendChild(title);

    // ─── Visual Regex Builder ───────────────────────────────────────────────────
    var builderSection = document.createElement('div');

    // Match type + search term row
    var builderRow = document.createElement('div');
    builderRow.className = 'ss-builder-row';

    var matchSelect = document.createElement('select');
    var matchOptions = [
      { value: 'contains', label: 'Contains' },
      { value: 'starts_with', label: 'Starts with' },
      { value: 'ends_with', label: 'Ends with' },
      { value: 'exact', label: 'Exact match' },
      { value: 'regex', label: 'Regex' }
    ];
    matchOptions.forEach(function (opt) {
      var o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      matchSelect.appendChild(o);
    });
    builderRow.appendChild(matchSelect);

    var termInput = document.createElement('input');
    termInput.type = 'text';
    termInput.placeholder = 'Enter search term...';
    builderRow.appendChild(termInput);

    builderSection.appendChild(builderRow);

    // Checkboxes row
    var checkRow = document.createElement('div');
    checkRow.className = 'ss-checkbox-row';

    var caseLabel = document.createElement('label');
    var caseCheck = document.createElement('input');
    caseCheck.type = 'checkbox';
    caseCheck.checked = true;
    caseLabel.appendChild(caseCheck);
    caseLabel.appendChild(document.createTextNode(' Case insensitive'));
    checkRow.appendChild(caseLabel);

    var wordLabel = document.createElement('label');
    var wordCheck = document.createElement('input');
    wordCheck.type = 'checkbox';
    wordLabel.appendChild(wordCheck);
    wordLabel.appendChild(document.createTextNode(' Whole word'));
    checkRow.appendChild(wordLabel);

    builderSection.appendChild(checkRow);

    // Add condition button + operator toggle
    var condBtnRow = document.createElement('div');
    condBtnRow.className = 'ss-builder-row';

    var addCondBtn = document.createElement('button');
    addCondBtn.className = 'ss-btn ss-btn-secondary ss-btn-small';
    addCondBtn.textContent = '+ Add condition';
    condBtnRow.appendChild(addCondBtn);

    var operatorBtn = document.createElement('button');
    operatorBtn.className = 'ss-operator-toggle';
    operatorBtn.textContent = 'AND';
    operatorBtn.title = 'Toggle between AND/OR for combining conditions';
    condBtnRow.appendChild(operatorBtn);

    builderSection.appendChild(condBtnRow);

    // Conditions list
    var conditionsList = document.createElement('div');
    conditionsList.className = 'ss-conditions-list';
    builderSection.appendChild(conditionsList);

    // Live preview
    var previewBox = document.createElement('div');
    previewBox.className = 'ss-preview-box';
    var validitySpan = document.createElement('span');
    validitySpan.className = 'ss-validity';
    previewBox.appendChild(validitySpan);
    var previewLabel = document.createElement('span');
    previewLabel.textContent = 'Pattern: ';
    previewLabel.style.color = '#888';
    previewBox.appendChild(previewLabel);
    var previewCode = document.createElement('code');
    previewCode.textContent = '(enter a search term)';
    previewBox.appendChild(previewCode);
    builderSection.appendChild(previewBox);

    // Search scope
    var scopeRow = document.createElement('div');
    scopeRow.className = 'ss-scope-row';
    var scopeLabel = document.createElement('label');
    scopeLabel.textContent = 'Search in:';
    scopeRow.appendChild(scopeLabel);
    var scopeSelect = document.createElement('select');
    var scopeOptions = [
      { value: 'all', label: 'All fields' },
      { value: 'pattern', label: 'Pattern names' },
      { value: 'file', label: 'File names' },
      { value: 'line', label: 'Line content' }
    ];
    scopeOptions.forEach(function (opt) {
      var o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      scopeSelect.appendChild(o);
    });
    scopeRow.appendChild(scopeSelect);
    builderSection.appendChild(scopeRow);

    // Search button
    var searchBtnRow = document.createElement('div');
    searchBtnRow.className = 'ss-builder-row';
    searchBtnRow.style.marginTop = '12px';
    var searchBtn = document.createElement('button');
    searchBtn.className = 'ss-btn';
    searchBtn.textContent = '\uD83D\uDD0D Search';
    searchBtnRow.appendChild(searchBtn);
    builderSection.appendChild(searchBtnRow);

    panel.appendChild(builderSection);

    // ─── Results Section ────────────────────────────────────────────────────────
    var resultsSummary = document.createElement('div');
    resultsSummary.className = 'ss-results-summary';
    resultsSummary.style.display = 'none';
    panel.appendChild(resultsSummary);

    var resultsList = document.createElement('div');
    resultsList.className = 'ss-results-list';
    panel.appendChild(resultsList);



    // ─── Saved Searches Section ─────────────────────────────────────────────────
    var savedTitle = document.createElement('h3');
    savedTitle.textContent = '\uD83D\uDCBE Saved Searches';
    panel.appendChild(savedTitle);

    var saveRow = document.createElement('div');
    saveRow.className = 'ss-save-row';
    var saveNameInput = document.createElement('input');
    saveNameInput.type = 'text';
    saveNameInput.placeholder = 'Search name...';
    saveRow.appendChild(saveNameInput);
    var saveBtn = document.createElement('button');
    saveBtn.className = 'ss-btn ss-btn-small';
    saveBtn.textContent = 'Save Current Search';
    saveRow.appendChild(saveBtn);
    panel.appendChild(saveRow);

    var savedList = document.createElement('div');
    savedList.className = 'ss-saved-list';
    panel.appendChild(savedList);

    // ─── Quick Search Templates ─────────────────────────────────────────────────
    var tmplTitle = document.createElement('h3');
    tmplTitle.textContent = '\uD83D\uDCD0 Regex Templates';
    panel.appendChild(tmplTitle);

    var tmplNote = document.createElement('div');
    tmplNote.style.cssText = 'font-size:0.8em;color:#888;margin-bottom:8px;';
    tmplNote.textContent = 'Click a template to load it into the regex builder. These are regex pattern tools, not sample data.';
    panel.appendChild(tmplNote);

    var tmplGrid = document.createElement('div');
    tmplGrid.className = 'ss-templates-grid';
    REGEX_TEMPLATES.forEach(function (tmpl) {
      var item = document.createElement('div');
      item.className = 'ss-template-item';
      item.innerHTML = '<div class="ss-tmpl-name">' + tmpl.name + '</div>' +
        '<div class="ss-tmpl-regex">' + tmpl.regex.replace(/</g, '&lt;') + '</div>';
      item.addEventListener('click', function () {
        matchSelect.value = 'regex';
        termInput.value = tmpl.regex;
        updatePreview();
      });
      tmplGrid.appendChild(item);
    });
    panel.appendChild(tmplGrid);

    // ─── Event Handlers ─────────────────────────────────────────────────────────

    function getCurrentPattern() {
      var term = termInput.value.trim();
      if (!term && conditions.length === 0) return '';

      var allConditions = conditions.slice();
      if (term) {
        allConditions.push({
          pattern: buildRegexFromCondition(matchSelect.value, term, caseCheck.checked, wordCheck.checked),
          term: term,
          matchType: matchSelect.value
        });
      }

      return buildCombinedRegex(allConditions, operator);
    }

    function updatePreview() {
      var pattern = getCurrentPattern();
      if (!pattern) {
        previewCode.textContent = '(enter a search term)';
        validitySpan.textContent = '';
        return;
      }
      previewCode.textContent = pattern;
      if (isValidRegex(pattern)) {
        validitySpan.textContent = '\u2705';
        validitySpan.title = 'Valid regex';
      } else {
        validitySpan.textContent = '\u274C';
        validitySpan.title = 'Invalid regex';
      }
    }

    function renderConditions() {
      conditionsList.innerHTML = '';
      conditions.forEach(function (cond, idx) {
        var item = document.createElement('div');
        item.className = 'ss-condition-item';
        if (idx > 0) {
          var badge = document.createElement('span');
          badge.className = 'ss-operator-badge';
          badge.textContent = operator;
          item.appendChild(badge);
        }
        var text = document.createElement('span');
        text.textContent = cond.matchType + ': "' + cond.term + '"';
        item.appendChild(text);
        var removeBtn = document.createElement('button');
        removeBtn.className = 'ss-remove-condition';
        removeBtn.textContent = '\u00D7';
        removeBtn.addEventListener('click', function () {
          conditions.splice(idx, 1);
          renderConditions();
          updatePreview();
        });
        item.appendChild(removeBtn);
        conditionsList.appendChild(item);
      });
    }

    function renderResults(results, regexPattern) {
      resultsList.innerHTML = '';
      if (results.length === 0) {
        resultsSummary.textContent = 'No matches found.';
        resultsSummary.style.display = 'block';
        return;
      }

      var uniqueFiles = {};
      results.forEach(function (r) {
        var f = r.file || r.file_name || 'unknown';
        uniqueFiles[f] = true;
      });

      resultsSummary.textContent = 'Found ' + results.length + ' matches in ' + Object.keys(uniqueFiles).length + ' findings';
      resultsSummary.style.display = 'block';

      results.forEach(function (r) {
        var item = document.createElement('div');
        item.className = 'ss-result-item';

        var severity = r.severity || 'info';
        var severityBadge = '<span class="ss-severity-badge ' + getSeverityClass(severity) + '">' + severity + '</span>';
        var patternName = r.pattern_name || r.pattern || 'Unknown pattern';
        var fileName = r.file || r.file_name || 'unknown';
        var lineNum = r.line_number || r.line_num || '';
        var lineContent = r.line_content || r.line || '';

        var fileLine = fileName + (lineNum ? ':' + lineNum : '');
        var highlightedContent = highlightMatch(lineContent, regexPattern);

        item.innerHTML =
          severityBadge +
          '<span class="ss-result-pattern">' + patternName.replace(/</g, '&lt;') + '</span>' +
          '<div class="ss-result-file">' + fileLine.replace(/</g, '&lt;') + '</div>' +
          (lineContent ? '<div class="ss-result-line">' + highlightedContent + '</div>' : '');

        resultsList.appendChild(item);
      });
    }

    function renderSavedSearches() {
      savedList.innerHTML = '';
      var searches = getSavedSearches();
      if (searches.length === 0) {
        var emptyMsg = document.createElement('div');
        emptyMsg.className = 'ss-empty-msg';
        emptyMsg.textContent = 'No saved searches. Build a regex and save it for reuse.';
        savedList.appendChild(emptyMsg);
        return;
      }

      searches.forEach(function (s) {
        var item = document.createElement('div');
        item.className = 'ss-saved-item';

        var nameSpan = document.createElement('span');
        nameSpan.className = 'ss-saved-name';
        nameSpan.textContent = s.name;
        item.appendChild(nameSpan);

        var regexSpan = document.createElement('span');
        regexSpan.className = 'ss-saved-regex';
        regexSpan.textContent = s.regex;
        item.appendChild(regexSpan);

        var metaSpan = document.createElement('span');
        metaSpan.className = 'ss-saved-meta';
        metaSpan.textContent = 'Used ' + s.use_count + 'x | Last: ' + (s.last_used ? new Date(s.last_used).toLocaleDateString() : 'never');
        item.appendChild(metaSpan);

        var runBtn = document.createElement('button');
        runBtn.className = 'ss-btn ss-btn-small';
        runBtn.textContent = 'Run';
        runBtn.addEventListener('click', function () {
          markSearchUsed(s.id);
          matchSelect.value = 'regex';
          termInput.value = s.regex;
          conditions = [];
          renderConditions();
          updatePreview();
          executeSearch();
          renderSavedSearches();
        });
        item.appendChild(runBtn);

        var delBtn = document.createElement('button');
        delBtn.className = 'ss-btn ss-btn-small ss-btn-danger';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', function () {
          deleteSearch(s.id);
          renderSavedSearches();
        });
        item.appendChild(delBtn);

        savedList.appendChild(item);
      });
    }

    function executeSearch() {
      var pattern = getCurrentPattern();
      if (!pattern) {
        resultsSummary.textContent = 'Enter a search term to begin.';
        resultsSummary.style.display = 'block';
        resultsList.innerHTML = '';
        return;
      }
      if (!isValidRegex(pattern)) {
        resultsSummary.textContent = 'Invalid regex pattern. Please fix the pattern.';
        resultsSummary.style.display = 'block';
        resultsList.innerHTML = '';
        return;
      }

      var flags = caseCheck.checked ? 'i' : '';
      var scope = scopeSelect.value;
      currentResults = searchFindings(findings, pattern, scope, flags);
      renderResults(currentResults, pattern);
    }

    // Wire up events
    termInput.addEventListener('input', updatePreview);
    matchSelect.addEventListener('change', updatePreview);
    caseCheck.addEventListener('change', updatePreview);
    wordCheck.addEventListener('change', updatePreview);

    operatorBtn.addEventListener('click', function () {
      operator = operator === 'AND' ? 'OR' : 'AND';
      operatorBtn.textContent = operator;
      updatePreview();
    });

    addCondBtn.addEventListener('click', function () {
      var term = termInput.value.trim();
      if (!term) return;
      conditions.push({
        pattern: buildRegexFromCondition(matchSelect.value, term, caseCheck.checked, wordCheck.checked),
        term: term,
        matchType: matchSelect.value
      });
      termInput.value = '';
      renderConditions();
      updatePreview();
    });

    searchBtn.addEventListener('click', executeSearch);

    termInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') executeSearch();
    });

    saveBtn.addEventListener('click', function () {
      var pattern = getCurrentPattern();
      var name = saveNameInput.value.trim();
      if (!pattern) return;
      if (!name) {
        saveNameInput.style.borderColor = '#ff6b6b';
        saveNameInput.placeholder = 'Enter a name!';
        return;
      }
      saveNameInput.style.borderColor = '#444';
      saveSearch(name, pattern, 'Scope: ' + scopeSelect.value);
      saveNameInput.value = '';
      renderSavedSearches();
    });

    // Initial render
    renderSavedSearches();
    updatePreview();

    return panel;
  }



  // ─── DOMContentLoaded Guard & Export ──────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window.renderSmartSearchPanel = renderSmartSearchPanel;
    });
  } else {
    window.renderSmartSearchPanel = renderSmartSearchPanel;
  }

})();
