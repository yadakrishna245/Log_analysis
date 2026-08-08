/**
 * LogSherlock Pro — SOP Compliance Checker
 * Define Standard Operating Procedures as checklists.
 * After scan, shows which SOPs are triggered by findings and tracks completion.
 * ZERO fake data — all content from user-defined SOPs + scan findings only.
 */
(function () {
  if (typeof window === 'undefined') return;

  // ─── Storage Keys ───────────────────────────────────────────────────────────
  const STORAGE_SOPS = 'logsherlock_sops';
  const STORAGE_SESSIONS = 'logsherlock_sop_sessions';

  // ─── Theme Constants ────────────────────────────────────────────────────────
  const THEME = {
    bg: '#1e1e2e',
    bgLight: '#2a2a3e',
    bgLighter: '#35354a',
    accent: '#01a982',
    accentDim: 'rgba(1,169,130,0.15)',
    text: '#e0e0e0',
    textDim: '#a0a0b0',
    border: '#3a3a4e',
    danger: '#e74c3c',
    warning: '#f39c12',
    white: '#ffffff'
  };

  // ─── Categories ─────────────────────────────────────────────────────────────
  const CATEGORIES = [
    'Incident Response',
    'Change Management',
    'Security',
    'Compliance',
    'Maintenance',
    'Custom'
  ];

  // ─── Utility Functions ──────────────────────────────────────────────────────
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  function loadSOPs() {
    try {
      const data = localStorage.getItem(STORAGE_SOPS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveSOPs(sops) {
    localStorage.setItem(STORAGE_SOPS, JSON.stringify(sops));
  }

  function loadSessions() {
    try {
      const data = localStorage.getItem(STORAGE_SESSIONS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveSessions(sessions) {
    localStorage.setItem(STORAGE_SESSIONS, JSON.stringify(sessions));
  }

  function getFindingsFingerprint(findings) {
    if (!findings || !findings.length) return '';
    const patterns = findings.map(f => f.pattern_name || f.patternName || f.name || '').sort();
    return patterns.join('|');
  }

  function getActivatedSOPs(findings) {
    const sops = loadSOPs();
    if (!sops.length || !findings || !findings.length) return [];
    const findingPatterns = new Set();
    findings.forEach(f => {
      const name = f.pattern_name || f.patternName || f.name || '';
      if (name) findingPatterns.add(name.toLowerCase());
    });
    return sops
      .map(sop => {
        const matchedPatterns = (sop.trigger_patterns || []).filter(tp =>
          findingPatterns.has(tp.toLowerCase())
        );
        if (matchedPatterns.length > 0) {
          return { ...sop, matched_patterns: matchedPatterns };
        }
        return null;
      })
      .filter(Boolean);
  }

  // ─── Active Session Management ─────────────────────────────────────────────
  const activeSessions = {};

  function getOrCreateSession(sopId, findingsFingerprint) {
    if (activeSessions[sopId]) return activeSessions[sopId];
    const session = {
      id: generateId(),
      sop_id: sopId,
      started_at: new Date().toISOString(),
      completed_at: null,
      completed_steps: [],
      notes: '',
      findings_fingerprint: findingsFingerprint
    };
    activeSessions[sopId] = session;
    return session;
  }

  function toggleStep(sopId, stepId, findingsFingerprint) {
    const session = getOrCreateSession(sopId, findingsFingerprint);
    const idx = session.completed_steps.indexOf(stepId);
    if (idx === -1) {
      session.completed_steps.push(stepId);
    } else {
      session.completed_steps.splice(idx, 1);
    }
    return session;
  }

  function updateNotes(sopId, notes, findingsFingerprint) {
    const session = getOrCreateSession(sopId, findingsFingerprint);
    session.notes = notes;
  }

  function markComplete(sopId) {
    const session = activeSessions[sopId];
    if (!session) return;
    session.completed_at = new Date().toISOString();
    const sessions = loadSessions();
    sessions.push({ ...session });
    saveSessions(sessions);
    delete activeSessions[sopId];
  }



  // ─── CSS Injection ──────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('logsherlock-sop-styles')) return;
    const style = document.createElement('style');
    style.id = 'logsherlock-sop-styles';
    style.textContent = `
      .sop-panel {
        background: ${THEME.bg};
        color: ${THEME.text};
        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
        padding: 24px;
        border-radius: 12px;
        border: 1px solid ${THEME.border};
        max-width: 900px;
        margin: 20px auto;
      }
      .sop-panel * { box-sizing: border-box; }
      .sop-panel-title {
        font-size: 1.5rem;
        font-weight: 700;
        margin-bottom: 24px;
        color: ${THEME.white};
      }
      .sop-section {
        margin-bottom: 28px;
        padding: 20px;
        background: ${THEME.bgLight};
        border-radius: 8px;
        border: 1px solid ${THEME.border};
      }
      .sop-section-title {
        font-size: 1.1rem;
        font-weight: 600;
        margin-bottom: 16px;
        color: ${THEME.accent};
      }
      .sop-card {
        background: ${THEME.bgLighter};
        border: 1px solid ${THEME.border};
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
      }
      .sop-card-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
        flex-wrap: wrap;
      }
      .sop-card-name {
        font-size: 1rem;
        font-weight: 600;
        color: ${THEME.white};
      }
      .sop-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        background: ${THEME.accentDim};
        color: ${THEME.accent};
        border: 1px solid ${THEME.accent};
      }
      .sop-trigger-info {
        font-size: 0.85rem;
        color: ${THEME.textDim};
        margin-bottom: 12px;
      }
      .sop-trigger-info span {
        color: ${THEME.warning};
        font-weight: 500;
      }
      .sop-checklist {
        list-style: none;
        padding: 0;
        margin: 0 0 12px 0;
      }
      .sop-checklist li {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 0;
        border-bottom: 1px solid ${THEME.border};
      }
      .sop-checklist li:last-child { border-bottom: none; }
      .sop-checklist input[type="checkbox"] {
        accent-color: ${THEME.accent};
        width: 16px;
        height: 16px;
        cursor: pointer;
      }
      .sop-checklist label {
        cursor: pointer;
        flex: 1;
        color: ${THEME.text};
        font-size: 0.9rem;
      }
      .sop-checklist label.completed {
        text-decoration: line-through;
        color: ${THEME.textDim};
      }
      .sop-required-mark {
        color: ${THEME.danger};
        font-weight: 700;
        margin-left: 4px;
      }
      .sop-progress-container {
        background: ${THEME.bg};
        border-radius: 4px;
        height: 8px;
        overflow: hidden;
        margin: 8px 0;
      }
      .sop-progress-bar {
        height: 100%;
        background: ${THEME.accent};
        border-radius: 4px;
        transition: width 0.3s ease;
      }
      .sop-progress-text {
        font-size: 0.8rem;
        color: ${THEME.textDim};
        margin-bottom: 8px;
      }
      .sop-notes {
        width: 100%;
        min-height: 60px;
        background: ${THEME.bg};
        border: 1px solid ${THEME.border};
        border-radius: 6px;
        color: ${THEME.text};
        padding: 10px;
        font-size: 0.85rem;
        resize: vertical;
        margin: 8px 0;
      }
      .sop-notes:focus { outline: none; border-color: ${THEME.accent}; }
      .sop-btn {
        display: inline-block;
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
      }
      .sop-btn:hover { opacity: 0.85; }
      .sop-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .sop-btn-primary {
        background: ${THEME.accent};
        color: ${THEME.bg};
      }
      .sop-btn-danger {
        background: ${THEME.danger};
        color: ${THEME.white};
      }
      .sop-btn-secondary {
        background: ${THEME.bgLighter};
        color: ${THEME.text};
        border: 1px solid ${THEME.border};
      }
      .sop-form-group {
        margin-bottom: 14px;
      }
      .sop-form-group label {
        display: block;
        font-size: 0.85rem;
        font-weight: 600;
        color: ${THEME.textDim};
        margin-bottom: 4px;
      }
      .sop-input, .sop-select, .sop-textarea {
        width: 100%;
        padding: 8px 12px;
        background: ${THEME.bg};
        border: 1px solid ${THEME.border};
        border-radius: 6px;
        color: ${THEME.text};
        font-size: 0.9rem;
      }
      .sop-input:focus, .sop-select:focus, .sop-textarea:focus {
        outline: none;
        border-color: ${THEME.accent};
      }
      .sop-textarea { min-height: 60px; resize: vertical; }
      .sop-step-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .sop-step-row input[type="text"] { flex: 1; }
      .sop-step-row input[type="checkbox"] {
        accent-color: ${THEME.accent};
      }
      .sop-step-row button {
        background: ${THEME.danger};
        color: ${THEME.white};
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        cursor: pointer;
        font-size: 0.8rem;
      }
      .sop-existing-list {
        margin-top: 16px;
      }
      .sop-existing-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        background: ${THEME.bg};
        border: 1px solid ${THEME.border};
        border-radius: 6px;
        margin-bottom: 8px;
      }
      .sop-existing-item-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .sop-existing-item-name {
        font-weight: 600;
        color: ${THEME.white};
        font-size: 0.9rem;
      }
      .sop-existing-item-meta {
        font-size: 0.75rem;
        color: ${THEME.textDim};
      }
      .sop-existing-item-actions {
        display: flex;
        gap: 6px;
      }
      .sop-history-item {
        padding: 10px 12px;
        background: ${THEME.bg};
        border: 1px solid ${THEME.border};
        border-radius: 6px;
        margin-bottom: 8px;
      }
      .sop-history-item-title {
        font-weight: 600;
        color: ${THEME.white};
        font-size: 0.9rem;
      }
      .sop-history-item-meta {
        font-size: 0.8rem;
        color: ${THEME.textDim};
        margin-top: 4px;
      }
      .sop-empty-msg {
        font-size: 0.9rem;
        color: ${THEME.textDim};
        font-style: italic;
        padding: 12px 0;
      }
    `;
    document.head.appendChild(style);
  }



  // ─── Section A: Render Active SOPs ──────────────────────────────────────────
  function renderActiveSOPs(container, findings) {
    const sops = loadSOPs();
    const section = document.createElement('div');
    section.className = 'sop-section';

    const title = document.createElement('div');
    title.className = 'sop-section-title';
    title.textContent = '⚡ Active SOPs (Triggered by Scan)';
    section.appendChild(title);

    if (sops.length === 0) {
      const msg = document.createElement('div');
      msg.className = 'sop-empty-msg';
      msg.textContent = 'No SOPs defined yet. Create your first SOP below.';
      section.appendChild(msg);
      container.appendChild(section);
      return;
    }

    const activated = getActivatedSOPs(findings);

    if (activated.length === 0) {
      const msg = document.createElement('div');
      msg.className = 'sop-empty-msg';
      msg.textContent = 'No SOPs triggered by current findings. Your defined SOPs did not match any detected patterns.';
      section.appendChild(msg);
      container.appendChild(section);
      return;
    }

    const fingerprint = getFindingsFingerprint(findings);

    activated.forEach(sop => {
      const card = document.createElement('div');
      card.className = 'sop-card';

      // Header
      const header = document.createElement('div');
      header.className = 'sop-card-header';
      const nameEl = document.createElement('span');
      nameEl.className = 'sop-card-name';
      nameEl.textContent = sop.name;
      header.appendChild(nameEl);
      const badge = document.createElement('span');
      badge.className = 'sop-badge';
      badge.textContent = sop.category || 'Custom';
      header.appendChild(badge);
      card.appendChild(header);

      // Trigger info
      const triggerInfo = document.createElement('div');
      triggerInfo.className = 'sop-trigger-info';
      triggerInfo.innerHTML = 'Triggered by: <span>' + sop.matched_patterns.join(', ') + '</span>';
      card.appendChild(triggerInfo);

      // Session
      const session = getOrCreateSession(sop.id, fingerprint);

      // Checklist
      const checklist = document.createElement('ul');
      checklist.className = 'sop-checklist';
      (sop.steps || []).forEach(step => {
        const li = document.createElement('li');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = 'sop-step-' + sop.id + '-' + step.id;
        cb.checked = session.completed_steps.includes(step.id);
        cb.addEventListener('change', function () {
          toggleStep(sop.id, step.id, fingerprint);
          renderSOPPanel(findings);
        });
        li.appendChild(cb);
        const lbl = document.createElement('label');
        lbl.setAttribute('for', cb.id);
        lbl.textContent = step.text;
        if (session.completed_steps.includes(step.id)) {
          lbl.classList.add('completed');
        }
        li.appendChild(lbl);
        if (step.required) {
          const req = document.createElement('span');
          req.className = 'sop-required-mark';
          req.textContent = '❗';
          req.title = 'Required step';
          li.appendChild(req);
        }
        checklist.appendChild(li);
      });
      card.appendChild(checklist);

      // Progress
      const totalSteps = (sop.steps || []).length;
      const completedCount = session.completed_steps.length;
      const pct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
      const progressText = document.createElement('div');
      progressText.className = 'sop-progress-text';
      progressText.textContent = completedCount + ' of ' + totalSteps + ' steps completed (' + pct + '%)';
      card.appendChild(progressText);
      const progressContainer = document.createElement('div');
      progressContainer.className = 'sop-progress-container';
      const progressBar = document.createElement('div');
      progressBar.className = 'sop-progress-bar';
      progressBar.style.width = pct + '%';
      progressContainer.appendChild(progressBar);
      card.appendChild(progressContainer);

      // Notes
      const notes = document.createElement('textarea');
      notes.className = 'sop-notes';
      notes.placeholder = 'Add notes for this SOP session...';
      notes.value = session.notes || '';
      notes.addEventListener('input', function () {
        updateNotes(sop.id, this.value, fingerprint);
      });
      card.appendChild(notes);

      // Mark Complete button
      const requiredSteps = (sop.steps || []).filter(s => s.required).map(s => s.id);
      const allRequiredDone = requiredSteps.every(id => session.completed_steps.includes(id));
      const completeBtn = document.createElement('button');
      completeBtn.className = 'sop-btn sop-btn-primary';
      completeBtn.textContent = 'Mark Complete';
      completeBtn.disabled = !allRequiredDone;
      if (!allRequiredDone) {
        completeBtn.title = 'Complete all required steps (❗) to enable';
      }
      completeBtn.addEventListener('click', function () {
        markComplete(sop.id);
        renderSOPPanel(findings);
      });
      card.appendChild(completeBtn);

      section.appendChild(card);
    });

    container.appendChild(section);
  }



  // ─── Section B: Define SOPs ─────────────────────────────────────────────────
  function renderDefineSOPs(container, findings) {
    const section = document.createElement('div');
    section.className = 'sop-section';

    const title = document.createElement('div');
    title.className = 'sop-section-title';
    title.textContent = '✏️ Define SOPs';
    section.appendChild(title);

    // Form state
    let formSteps = [{ id: generateId(), text: '', required: false }];
    let editingId = null;

    function buildForm() {
      const formWrapper = document.createElement('div');
      formWrapper.id = 'sop-define-form';

      // SOP Name
      const nameGroup = document.createElement('div');
      nameGroup.className = 'sop-form-group';
      const nameLabel = document.createElement('label');
      nameLabel.textContent = 'SOP Name *';
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'sop-input';
      nameInput.id = 'sop-form-name';
      nameInput.placeholder = 'e.g., Critical Error Response Procedure';
      nameGroup.appendChild(nameLabel);
      nameGroup.appendChild(nameInput);
      formWrapper.appendChild(nameGroup);

      // Description
      const descGroup = document.createElement('div');
      descGroup.className = 'sop-form-group';
      const descLabel = document.createElement('label');
      descLabel.textContent = 'Description';
      const descInput = document.createElement('textarea');
      descInput.className = 'sop-textarea';
      descInput.id = 'sop-form-desc';
      descInput.placeholder = 'Describe the purpose of this SOP...';
      descGroup.appendChild(descLabel);
      descGroup.appendChild(descInput);
      formWrapper.appendChild(descGroup);

      // Category
      const catGroup = document.createElement('div');
      catGroup.className = 'sop-form-group';
      const catLabel = document.createElement('label');
      catLabel.textContent = 'Category';
      const catSelect = document.createElement('select');
      catSelect.className = 'sop-select';
      catSelect.id = 'sop-form-category';
      CATEGORIES.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        catSelect.appendChild(opt);
      });
      catGroup.appendChild(catLabel);
      catGroup.appendChild(catSelect);
      formWrapper.appendChild(catGroup);

      // Trigger Patterns
      const trigGroup = document.createElement('div');
      trigGroup.className = 'sop-form-group';
      const trigLabel = document.createElement('label');
      trigLabel.textContent = 'Trigger Patterns (comma-separated pattern names)';
      const trigInput = document.createElement('input');
      trigInput.type = 'text';
      trigInput.className = 'sop-input';
      trigInput.id = 'sop-form-triggers';
      trigInput.placeholder = 'e.g., ERROR, CRITICAL_FAILURE, TIMEOUT';
      trigGroup.appendChild(trigLabel);
      trigGroup.appendChild(trigInput);
      formWrapper.appendChild(trigGroup);

      // Steps
      const stepsGroup = document.createElement('div');
      stepsGroup.className = 'sop-form-group';
      const stepsLabel = document.createElement('label');
      stepsLabel.textContent = 'Steps';
      stepsGroup.appendChild(stepsLabel);

      const stepsContainer = document.createElement('div');
      stepsContainer.id = 'sop-form-steps';

      function renderSteps() {
        stepsContainer.innerHTML = '';
        formSteps.forEach((step, idx) => {
          const row = document.createElement('div');
          row.className = 'sop-step-row';
          const textInput = document.createElement('input');
          textInput.type = 'text';
          textInput.className = 'sop-input';
          textInput.placeholder = 'Step ' + (idx + 1) + ' description';
          textInput.value = step.text;
          textInput.addEventListener('input', function () {
            formSteps[idx].text = this.value;
          });
          row.appendChild(textInput);

          const reqLabel = document.createElement('label');
          reqLabel.style.cssText = 'font-size:0.75rem;color:' + THEME.textDim + ';white-space:nowrap;display:flex;align-items:center;gap:4px;';
          const reqCb = document.createElement('input');
          reqCb.type = 'checkbox';
          reqCb.checked = step.required;
          reqCb.addEventListener('change', function () {
            formSteps[idx].required = this.checked;
          });
          reqLabel.appendChild(reqCb);
          reqLabel.appendChild(document.createTextNode('Required'));
          row.appendChild(reqLabel);

          if (formSteps.length > 1) {
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', function () {
              formSteps.splice(idx, 1);
              renderSteps();
            });
            row.appendChild(removeBtn);
          }
          stepsContainer.appendChild(row);
        });

        const addBtn = document.createElement('button');
        addBtn.className = 'sop-btn sop-btn-secondary';
        addBtn.textContent = '+ Add Step';
        addBtn.style.marginTop = '8px';
        addBtn.addEventListener('click', function () {
          formSteps.push({ id: generateId(), text: '', required: false });
          renderSteps();
        });
        stepsContainer.appendChild(addBtn);
      }

      renderSteps();
      stepsGroup.appendChild(stepsContainer);
      formWrapper.appendChild(stepsGroup);

      // Save button
      const saveBtn = document.createElement('button');
      saveBtn.className = 'sop-btn sop-btn-primary';
      saveBtn.textContent = editingId ? 'Update SOP' : 'Save SOP';
      saveBtn.style.marginTop = '12px';
      saveBtn.addEventListener('click', function () {
        const name = document.getElementById('sop-form-name').value.trim();
        if (!name) {
          alert('SOP Name is required.');
          return;
        }
        const desc = document.getElementById('sop-form-desc').value.trim();
        const category = document.getElementById('sop-form-category').value;
        const triggersRaw = document.getElementById('sop-form-triggers').value.trim();
        const triggers = triggersRaw ? triggersRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
        const steps = formSteps
          .filter(s => s.text.trim())
          .map(s => ({ id: s.id, text: s.text.trim(), required: s.required }));

        if (steps.length === 0) {
          alert('Add at least one step.');
          return;
        }

        const sops = loadSOPs();
        if (editingId) {
          const idx = sops.findIndex(s => s.id === editingId);
          if (idx !== -1) {
            sops[idx].name = name;
            sops[idx].description = desc;
            sops[idx].category = category;
            sops[idx].trigger_patterns = triggers;
            sops[idx].steps = steps;
          }
          editingId = null;
        } else {
          sops.push({
            id: generateId(),
            name: name,
            description: desc,
            trigger_patterns: triggers,
            steps: steps,
            created_at: new Date().toISOString(),
            category: category
          });
        }
        saveSOPs(sops);
        formSteps = [{ id: generateId(), text: '', required: false }];
        renderSOPPanel(findings);
      });
      formWrapper.appendChild(saveBtn);

      return formWrapper;
    }

    section.appendChild(buildForm());

    // Existing SOPs list
    const sops = loadSOPs();
    if (sops.length > 0) {
      const listTitle = document.createElement('div');
      listTitle.style.cssText = 'font-weight:600;color:' + THEME.textDim + ';margin-top:20px;margin-bottom:10px;font-size:0.9rem;';
      listTitle.textContent = 'Existing SOPs (' + sops.length + ')';
      section.appendChild(listTitle);

      const list = document.createElement('div');
      list.className = 'sop-existing-list';
      sops.forEach(sop => {
        const item = document.createElement('div');
        item.className = 'sop-existing-item';
        const info = document.createElement('div');
        info.className = 'sop-existing-item-info';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'sop-existing-item-name';
        nameSpan.textContent = sop.name;
        info.appendChild(nameSpan);
        const meta = document.createElement('span');
        meta.className = 'sop-existing-item-meta';
        meta.textContent = (sop.trigger_patterns || []).length + ' trigger(s) · ' + (sop.steps || []).length + ' step(s) · ' + (sop.category || 'Custom');
        info.appendChild(meta);
        item.appendChild(info);

        const actions = document.createElement('div');
        actions.className = 'sop-existing-item-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'sop-btn sop-btn-secondary';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', function () {
          // Populate form with SOP data
          editingId = sop.id;
          formSteps = (sop.steps || []).map(s => ({ ...s }));
          if (formSteps.length === 0) formSteps = [{ id: generateId(), text: '', required: false }];
          renderSOPPanel(findings);
          setTimeout(function () {
            const nameEl = document.getElementById('sop-form-name');
            const descEl = document.getElementById('sop-form-desc');
            const catEl = document.getElementById('sop-form-category');
            const trigEl = document.getElementById('sop-form-triggers');
            if (nameEl) nameEl.value = sop.name || '';
            if (descEl) descEl.value = sop.description || '';
            if (catEl) catEl.value = sop.category || 'Custom';
            if (trigEl) trigEl.value = (sop.trigger_patterns || []).join(', ');
          }, 50);
        });
        actions.appendChild(editBtn);

        const delBtn = document.createElement('button');
        delBtn.className = 'sop-btn sop-btn-danger';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', function () {
          if (confirm('Delete SOP "' + sop.name + '"? This cannot be undone.')) {
            const all = loadSOPs().filter(s => s.id !== sop.id);
            saveSOPs(all);
            renderSOPPanel(findings);
          }
        });
        actions.appendChild(delBtn);

        item.appendChild(actions);
        list.appendChild(item);
      });
      section.appendChild(list);
    }

    container.appendChild(section);
  }



  // ─── Section C: Completion History ──────────────────────────────────────────
  function renderHistory(container) {
    const section = document.createElement('div');
    section.className = 'sop-section';

    const title = document.createElement('div');
    title.className = 'sop-section-title';
    title.textContent = '📜 Completion History';
    section.appendChild(title);

    const sessions = loadSessions();

    if (sessions.length === 0) {
      const msg = document.createElement('div');
      msg.className = 'sop-empty-msg';
      msg.textContent = 'No SOP sessions completed yet.';
      section.appendChild(msg);
      container.appendChild(section);
      return;
    }

    const sops = loadSOPs();
    const sopMap = {};
    sops.forEach(s => { sopMap[s.id] = s; });

    sessions.slice().reverse().forEach(sess => {
      const sop = sopMap[sess.sop_id];
      const item = document.createElement('div');
      item.className = 'sop-history-item';

      const titleEl = document.createElement('div');
      titleEl.className = 'sop-history-item-title';
      titleEl.textContent = sop ? sop.name : 'Unknown SOP';
      item.appendChild(titleEl);

      const meta = document.createElement('div');
      meta.className = 'sop-history-item-meta';
      const startDate = new Date(sess.started_at).toLocaleString();
      const endDate = sess.completed_at ? new Date(sess.completed_at).toLocaleString() : 'N/A';
      let duration = '';
      if (sess.started_at && sess.completed_at) {
        const diffMs = new Date(sess.completed_at) - new Date(sess.started_at);
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        duration = mins > 0 ? mins + 'm ' + secs + 's' : secs + 's';
      }
      meta.textContent = 'Completed: ' + endDate + ' · Steps: ' + sess.completed_steps.length + ' · Duration: ' + (duration || 'N/A');
      item.appendChild(meta);

      if (sess.notes) {
        const notesEl = document.createElement('div');
        notesEl.style.cssText = 'font-size:0.8rem;color:' + THEME.textDim + ';margin-top:4px;font-style:italic;';
        notesEl.textContent = 'Notes: ' + sess.notes;
        item.appendChild(notesEl);
      }

      section.appendChild(item);
    });

    // Export button
    const exportBtn = document.createElement('button');
    exportBtn.className = 'sop-btn sop-btn-secondary';
    exportBtn.textContent = '📥 Export History (CSV)';
    exportBtn.style.marginTop = '12px';
    exportBtn.addEventListener('click', function () {
      const rows = [['SOP Name', 'Started At', 'Completed At', 'Steps Completed', 'Duration', 'Notes']];
      sessions.forEach(sess => {
        const sop = sopMap[sess.sop_id];
        let duration = '';
        if (sess.started_at && sess.completed_at) {
          const diffMs = new Date(sess.completed_at) - new Date(sess.started_at);
          const mins = Math.floor(diffMs / 60000);
          const secs = Math.floor((diffMs % 60000) / 1000);
          duration = mins > 0 ? mins + 'm ' + secs + 's' : secs + 's';
        }
        rows.push([
          sop ? sop.name : 'Unknown',
          sess.started_at || '',
          sess.completed_at || '',
          String(sess.completed_steps.length),
          duration,
          (sess.notes || '').replace(/"/g, '""')
        ]);
      });
      const csv = rows.map(r => r.map(c => '"' + c + '"').join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'logsherlock_sop_history_' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
    section.appendChild(exportBtn);

    container.appendChild(section);
  }

  // ─── Main Render Function ──────────────────────────────────────────────────
  function renderSOPPanel(findings) {
    injectStyles();

    const containerId = 'logsherlock-sop-panel';
    let container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    } else {
      container = document.createElement('div');
      container.id = containerId;
      container.className = 'sop-panel';
      document.body.appendChild(container);
    }

    // Title
    const panelTitle = document.createElement('div');
    panelTitle.className = 'sop-panel-title';
    panelTitle.textContent = '📋 SOP Compliance Checker';
    container.appendChild(panelTitle);

    // Render all sections
    renderActiveSOPs(container, findings || []);
    renderDefineSOPs(container, findings || []);
    renderHistory(container);
  }

  // ─── DOMContentLoaded Guard ─────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window.renderSOPPanel = renderSOPPanel;
    });
  } else {
    window.renderSOPPanel = renderSOPPanel;
  }

})();
