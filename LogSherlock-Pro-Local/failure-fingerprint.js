/**
 * LogSherlock Pro — Failure Fingerprinting Module
 * Creates deterministic hashes of incident error pattern sequences
 * so engineers can instantly recognize recurring incidents.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined') return;

  // ─── FNV-1a Hash ───────────────────────────────────────────────────────────
  function fnv1a(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  // ─── IndexedDB Helpers ─────────────────────────────────────────────────────
  const DB_NAME = 'LogSherlockFingerprints';
  const STORE_NAME = 'fingerprints';
  const DB_VERSION = 1;

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function getAllFingerprints() {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    });
  }

  function getFingerprint(id) {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    });
  }

  function putFingerprint(record) {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  }

  function deleteFingerprint(id) {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  }


  // ─── Core Logic ────────────────────────────────────────────────────────────

  function extractPatterns(findings) {
    if (!findings || !Array.isArray(findings) || findings.length === 0) return [];
    const patternSet = new Set();
    findings.forEach((f) => {
      if (f && f.pattern_name) patternSet.add(f.pattern_name);
    });
    return Array.from(patternSet).sort();
  }

  function buildSeverityProfile(findings) {
    const profile = { critical: 0, high: 0, medium: 0, low: 0 };
    if (!findings || !Array.isArray(findings)) return profile;
    findings.forEach((f) => {
      if (f && f.severity) {
        const sev = f.severity.toLowerCase();
        if (sev in profile) profile[sev]++;
      }
    });
    return profile;
  }

  function extractCategories(findings) {
    if (!findings || !Array.isArray(findings)) return [];
    const cats = new Set();
    findings.forEach((f) => {
      if (f && f.category) cats.add(f.category);
    });
    return Array.from(cats).sort();
  }

  /**
   * generateFingerprint(findings)
   * Takes scan findings array, extracts unique pattern_names,
   * sorts alphabetically, creates FNV-1a hash of the joined string.
   */
  function generateFingerprint(findings) {
    const patterns = extractPatterns(findings);
    if (patterns.length === 0) return null;
    const hashInput = patterns.join('|');
    const hash = fnv1a(hashInput);
    return {
      id: hash,
      patterns: patterns,
      severity_profile: buildSeverityProfile(findings),
      categories: extractCategories(findings)
    };
  }

  /**
   * matchFingerprint(findings)
   * Generates fingerprint from current findings, checks IndexedDB for exact match.
   * Also does partial matching: if 80%+ of patterns match a stored fingerprint,
   * flags as 'similar' with percentage.
   */
  async function matchFingerprint(findings) {
    const current = generateFingerprint(findings);
    if (!current) return { type: 'none', message: 'No patterns to fingerprint.' };

    const stored = await getAllFingerprints();
    if (stored.length === 0) {
      return { type: 'new', fingerprint: current, message: 'No stored fingerprints to compare against.' };
    }

    // Exact match
    const exact = stored.find((s) => s.id === current.id);
    if (exact) {
      return {
        type: 'exact',
        fingerprint: current,
        match: exact,
        message: `✅ MATCH FOUND: ${exact.name} (seen ${exact.times_seen} times, last: ${exact.last_seen})`
      };
    }

    // Partial matching — 80%+ threshold
    let bestMatch = null;
    let bestPercentage = 0;

    for (const entry of stored) {
      const storedPatterns = new Set(entry.patterns);
      const currentPatterns = current.patterns;
      let matchCount = 0;
      currentPatterns.forEach((p) => {
        if (storedPatterns.has(p)) matchCount++;
      });
      const maxLen = Math.max(currentPatterns.length, entry.patterns.length);
      const percentage = maxLen > 0 ? Math.round((matchCount / maxLen) * 100) : 0;
      if (percentage >= 80 && percentage > bestPercentage) {
        bestPercentage = percentage;
        bestMatch = entry;
      }
    }

    if (bestMatch) {
      return {
        type: 'similar',
        fingerprint: current,
        match: bestMatch,
        percentage: bestPercentage,
        message: `⚠️ Similar to: ${bestMatch.name} (${bestPercentage}% match)`
      };
    }

    return { type: 'new', fingerprint: current, message: '❓ New incident pattern — not seen before' };
  }

  /**
   * saveFingerprint(findings, name, notes)
   * Saves current incident fingerprint to IndexedDB library.
   */
  async function saveFingerprint(findings, name, notes) {
    const current = generateFingerprint(findings);
    if (!current) throw new Error('No patterns found in findings to save.');

    const existing = await getFingerprint(current.id);
    const now = new Date().toISOString();

    if (existing) {
      existing.times_seen = (existing.times_seen || 1) + 1;
      existing.last_seen = now;
      if (name) existing.name = name;
      if (notes) existing.resolution_notes = notes;
      await putFingerprint(existing);
      return existing;
    }

    const record = {
      id: current.id,
      name: name || 'Unnamed Incident',
      patterns: current.patterns,
      severity_profile: current.severity_profile,
      categories: current.categories,
      first_seen: now,
      last_seen: now,
      times_seen: 1,
      resolution_notes: notes || ''
    };
    await putFingerprint(record);
    return record;
  }


  // ─── UI Panel ──────────────────────────────────────────────────────────────

  const STYLES = `
    .fp-panel {
      background: #1e1e2e;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 20px;
      margin: 16px 0;
      font-family: 'Segoe UI', -apple-system, sans-serif;
      color: #e0e0e0;
    }
    .fp-panel h2 {
      color: #01a982;
      margin: 0 0 16px 0;
      font-size: 1.4em;
      border-bottom: 1px solid #01a982;
      padding-bottom: 8px;
    }
    .fp-panel h3 {
      color: #01a982;
      margin: 16px 0 8px 0;
      font-size: 1.1em;
    }
    .fp-hash {
      font-family: 'Cascadia Code', 'Fira Code', monospace;
      background: #2a2a3e;
      padding: 4px 10px;
      border-radius: 4px;
      color: #01a982;
      font-size: 1.1em;
      display: inline-block;
      margin: 4px 0;
    }
    .fp-severity-bar {
      display: flex;
      gap: 8px;
      margin: 8px 0;
      flex-wrap: wrap;
    }
    .fp-severity-badge {
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.8em;
      font-weight: 600;
    }
    .fp-sev-critical { background: #dc3545; color: #fff; }
    .fp-sev-high { background: #fd7e14; color: #fff; }
    .fp-sev-medium { background: #ffc107; color: #1e1e2e; }
    .fp-sev-low { background: #28a745; color: #fff; }
    .fp-match-status {
      padding: 12px;
      border-radius: 6px;
      margin: 12px 0;
      font-size: 0.95em;
    }
    .fp-match-exact { background: #1a3a2a; border: 1px solid #01a982; }
    .fp-match-similar { background: #3a3a1a; border: 1px solid #ffc107; }
    .fp-match-new { background: #2a2a3e; border: 1px solid #666; }
    .fp-resolution-notes {
      background: #2a2a3e;
      padding: 10px;
      border-radius: 4px;
      margin-top: 8px;
      font-style: italic;
      color: #aaa;
      white-space: pre-wrap;
    }
    .fp-save-section {
      background: #2a2a3e;
      padding: 16px;
      border-radius: 6px;
      margin: 16px 0;
    }
    .fp-save-section input,
    .fp-save-section textarea {
      width: 100%;
      padding: 8px 12px;
      margin: 6px 0;
      border: 1px solid #555;
      border-radius: 4px;
      background: #1e1e2e;
      color: #e0e0e0;
      font-family: inherit;
      font-size: 0.9em;
      box-sizing: border-box;
    }
    .fp-save-section textarea {
      min-height: 60px;
      resize: vertical;
    }
    .fp-btn {
      background: #01a982;
      color: #1e1e2e;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
      font-size: 0.9em;
    }
    .fp-btn:hover { background: #02c497; }
    .fp-btn-danger {
      background: #dc3545;
      color: #fff;
      border: none;
      padding: 4px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8em;
    }
    .fp-btn-danger:hover { background: #e04555; }
    .fp-library-item {
      background: #2a2a3e;
      border: 1px solid #444;
      border-radius: 6px;
      padding: 12px;
      margin: 8px 0;
    }
    .fp-library-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .fp-library-item-name {
      color: #01a982;
      font-weight: 600;
      font-size: 1em;
    }
    .fp-library-meta {
      color: #888;
      font-size: 0.8em;
      margin-top: 4px;
    }
    .fp-empty-state {
      text-align: center;
      color: #888;
      padding: 20px;
      font-style: italic;
    }
    .fp-categories {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin: 6px 0;
    }
    .fp-category-tag {
      background: #333;
      color: #ccc;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.75em;
    }
  `;


  function injectStyles() {
    if (document.getElementById('fp-styles')) return;
    const style = document.createElement('style');
    style.id = 'fp-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  function renderSeverityProfile(profile) {
    let html = '<div class="fp-severity-bar">';
    if (profile.critical > 0) html += `<span class="fp-severity-badge fp-sev-critical">Critical: ${profile.critical}</span>`;
    if (profile.high > 0) html += `<span class="fp-severity-badge fp-sev-high">High: ${profile.high}</span>`;
    if (profile.medium > 0) html += `<span class="fp-severity-badge fp-sev-medium">Medium: ${profile.medium}</span>`;
    if (profile.low > 0) html += `<span class="fp-severity-badge fp-sev-low">Low: ${profile.low}</span>`;
    if (profile.critical === 0 && profile.high === 0 && profile.medium === 0 && profile.low === 0) {
      html += '<span style="color:#888;">No severity data</span>';
    }
    html += '</div>';
    return html;
  }

  function renderCategories(categories) {
    if (!categories || categories.length === 0) return '';
    let html = '<div class="fp-categories">';
    categories.forEach((c) => { html += `<span class="fp-category-tag">${escapeHtml(c)}</span>`; });
    html += '</div>';
    return html;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * renderFingerprintPanel(findings)
   * Main UI renderer — call with current scan findings array.
   */
  async function renderFingerprintPanel(findings) {
    injectStyles();

    const container = document.getElementById('fp-panel-container') || document.createElement('div');
    container.id = 'fp-panel-container';

    const current = generateFingerprint(findings);
    const matchResult = await matchFingerprint(findings);
    const library = await getAllFingerprints();

    let html = '<div class="fp-panel">';
    html += '<h2>🔑 Failure Fingerprinting</h2>';

    // ─── Current Scan Fingerprint ──────────────────────────────────────────
    html += '<h3>Current Scan Fingerprint</h3>';
    if (!current) {
      html += '<div class="fp-empty-state">No patterns detected in current findings.</div>';
    } else {
      html += `<div>Hash: <span class="fp-hash">${current.id}</span></div>`;
      html += `<div style="margin-top:6px;color:#aaa;font-size:0.85em;">Patterns (${current.patterns.length}): ${current.patterns.map(escapeHtml).join(', ')}</div>`;
      html += renderSeverityProfile(current.severity_profile);
      html += renderCategories(current.categories);
    }

    // ─── Match Status ──────────────────────────────────────────────────────
    html += '<h3>Match Status</h3>';
    if (matchResult.type === 'exact') {
      html += `<div class="fp-match-status fp-match-exact">`;
      html += `<strong>${matchResult.message}</strong>`;
      if (matchResult.match.resolution_notes) {
        html += `<div class="fp-resolution-notes"><strong>Resolution Notes:</strong>\n${escapeHtml(matchResult.match.resolution_notes)}</div>`;
      }
      html += '</div>';
    } else if (matchResult.type === 'similar') {
      html += `<div class="fp-match-status fp-match-similar">`;
      html += `<strong>${matchResult.message}</strong>`;
      if (matchResult.match.resolution_notes) {
        html += `<div class="fp-resolution-notes"><strong>Resolution Notes:</strong>\n${escapeHtml(matchResult.match.resolution_notes)}</div>`;
      }
      html += '</div>';
    } else if (matchResult.type === 'new') {
      html += `<div class="fp-match-status fp-match-new"><strong>❓ New incident pattern — not seen before</strong></div>`;
    } else {
      html += `<div class="fp-match-status fp-match-new"><strong>${escapeHtml(matchResult.message)}</strong></div>`;
    }

    // ─── Save Section ──────────────────────────────────────────────────────
    if (current) {
      html += '<h3>Save as Known Incident</h3>';
      html += '<div class="fp-save-section">';
      html += '<input type="text" id="fp-save-name" placeholder="Incident name (e.g., Redis OOM Cascade)" />';
      html += '<textarea id="fp-save-notes" placeholder="Resolution notes — what fixed it?"></textarea>';
      html += '<button class="fp-btn" id="fp-save-btn">Save as Known Incident</button>';
      html += '</div>';
    }

    // ─── Library Section ───────────────────────────────────────────────────
    html += '<h3>Fingerprint Library</h3>';
    if (library.length === 0) {
      html += '<div class="fp-empty-state">No fingerprints saved yet. Save your first resolved incident to build your library.</div>';
    } else {
      library.forEach((entry) => {
        html += '<div class="fp-library-item">';
        html += '<div class="fp-library-item-header">';
        html += `<span class="fp-library-item-name">${escapeHtml(entry.name)}</span>`;
        html += `<button class="fp-btn-danger" data-fp-delete="${entry.id}">Delete</button>`;
        html += '</div>';
        html += `<div class="fp-library-meta">Hash: <span class="fp-hash" style="font-size:0.85em;">${entry.id}</span> · Seen ${entry.times_seen} time${entry.times_seen !== 1 ? 's' : ''} · Last: ${entry.last_seen ? new Date(entry.last_seen).toLocaleDateString() : 'N/A'}</div>`;
        html += renderSeverityProfile(entry.severity_profile);
        if (entry.resolution_notes) {
          html += `<div class="fp-resolution-notes">${escapeHtml(entry.resolution_notes)}</div>`;
        }
        html += '</div>';
      });
    }

    html += '</div>';
    container.innerHTML = html;

    // Append to DOM if not already present
    if (!document.getElementById('fp-panel-container')) {
      const target = document.getElementById('fingerprint-target') || document.body;
      target.appendChild(container);
    }

    // ─── Event Binding ─────────────────────────────────────────────────────
    if (current) {
      const saveBtn = document.getElementById('fp-save-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          const nameInput = document.getElementById('fp-save-name');
          const notesInput = document.getElementById('fp-save-notes');
          const name = (nameInput && nameInput.value.trim()) || 'Unnamed Incident';
          const notes = (notesInput && notesInput.value.trim()) || '';
          try {
            await saveFingerprint(findings, name, notes);
            await renderFingerprintPanel(findings);
          } catch (err) {
            console.error('[LogSherlock Fingerprint] Save error:', err);
          }
        });
      }
    }

    // Delete buttons
    container.querySelectorAll('[data-fp-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-fp-delete');
        if (id) {
          try {
            await deleteFingerprint(id);
            await renderFingerprintPanel(findings);
          } catch (err) {
            console.error('[LogSherlock Fingerprint] Delete error:', err);
          }
        }
      });
    });

    return container;
  }


  // ─── Exports ───────────────────────────────────────────────────────────────
  window.renderFingerprintPanel = renderFingerprintPanel;
  window.generateFingerprint = generateFingerprint;
  window.matchFingerprint = matchFingerprint;

  // ─── Self-Initialization ───────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectStyles();
      console.log('[LogSherlock] Failure Fingerprinting module loaded.');
    });
  } else {
    injectStyles();
    console.log('[LogSherlock] Failure Fingerprinting module loaded.');
  }

})();
