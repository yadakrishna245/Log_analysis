/**
 * LogSherlock Pro — Confidence Feedback (Thumbs Up/Down)
 * Lets engineers rate findings to improve future relevance ranking.
 * Standalone IIFE • localStorage-backed • Dark theme
 */
(function () {
  if (typeof window === 'undefined') return;

  const STORAGE_KEY = 'logsherlock_feedback';
  const GREEN = '#01a982';
  const RED = '#e74c3c';
  const BG_DARK = '#1e1e2e';
  const BG_PANEL = '#2a2a3e';
  const TEXT_PRIMARY = '#e0e0e0';
  const TEXT_MUTED = '#a0a0b0';
  const BORDER = '#3a3a4e';

  // ─── Storage Helpers ────────────────────────────────────────────────────────

  function loadFeedback() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveFeedback(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[LogSherlock] Failed to save feedback:', e);
    }
  }

  // ─── Extract Pattern Name from Finding Element ──────────────────────────────

  function getPatternName(findingEl) {
    // Try common selectors for pattern/title within a finding
    const titleEl =
      findingEl.querySelector('.finding-title') ||
      findingEl.querySelector('.finding-name') ||
      findingEl.querySelector('.pattern-name') ||
      findingEl.querySelector('h3') ||
      findingEl.querySelector('h4') ||
      findingEl.querySelector('strong');
    if (titleEl) return titleEl.textContent.trim();
    // Fallback: first meaningful text content
    const text = findingEl.textContent.trim();
    return text.substring(0, 80) || 'Unknown Pattern';
  }

  // ─── Inject Feedback Buttons into a Finding ─────────────────────────────────

  function injectButtons(findingEl) {
    if (findingEl.querySelector('.ls-feedback-btn-group')) return;

    const patternName = getPatternName(findingEl);

    const group = document.createElement('div');
    group.className = 'ls-feedback-btn-group';
    group.style.cssText = `
      display: inline-flex;
      gap: 6px;
      margin-left: 12px;
      vertical-align: middle;
    `;

    const btnUp = createFeedbackButton('👍', 'up', patternName);
    const btnDown = createFeedbackButton('👎', 'down', patternName);

    group.appendChild(btnUp);
    group.appendChild(btnDown);
    findingEl.appendChild(group);
  }

  function createFeedbackButton(emoji, direction, patternName) {
    const btn = document.createElement('button');
    btn.className = `ls-feedback-btn ls-feedback-${direction}`;
    btn.textContent = emoji;
    btn.title = direction === 'up' ? 'Relevant / useful finding' : 'Not relevant / false positive';
    btn.style.cssText = `
      background: ${BG_PANEL};
      border: 1px solid ${BORDER};
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      padding: 2px 8px;
      transition: background 0.2s, border-color 0.2s;
      line-height: 1.4;
    `;

    btn.addEventListener('mouseenter', function () {
      btn.style.borderColor = direction === 'up' ? GREEN : RED;
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.borderColor = BORDER;
      btn.style.background = BG_PANEL;
    });

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      recordFeedback(patternName, direction);
      // Visual confirmation
      const highlightColor = direction === 'up' ? GREEN : RED;
      btn.style.background = highlightColor;
      btn.style.borderColor = highlightColor;
      setTimeout(function () {
        btn.style.background = BG_PANEL;
        btn.style.borderColor = BORDER;
      }, 600);
    });

    return btn;
  }

  // ─── Record Feedback ────────────────────────────────────────────────────────

  function recordFeedback(patternName, direction) {
    const data = loadFeedback();
    if (!data[patternName]) {
      data[patternName] = { up: 0, down: 0, last_feedback: null };
    }
    data[patternName][direction]++;
    data[patternName].last_feedback = new Date().toISOString();
    saveFeedback(data);
  }

  // ─── MutationObserver to Inject Buttons on New Findings ─────────────────────

  function initConfidenceFeedback() {
    const findingsList = document.getElementById('findingsList');
    if (!findingsList) {
      // Retry once after a short delay in case DOM isn't ready
      setTimeout(function () {
        const retryEl = document.getElementById('findingsList');
        if (retryEl) observeFindings(retryEl);
      }, 1000);
      return;
    }
    observeFindings(findingsList);
  }

  function observeFindings(container) {
    // Inject into any existing findings
    const existingFindings = container.querySelectorAll('.finding');
    existingFindings.forEach(function (el) {
      injectButtons(el);
    });

    // Observe for new findings
    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.classList && node.classList.contains('finding')) {
            injectButtons(node);
          }
          // Also check children
          if (node.querySelectorAll) {
            node.querySelectorAll('.finding').forEach(function (child) {
              injectButtons(child);
            });
          }
        });
      });
    });

    observer.observe(container, { childList: true, subtree: true });
  }

  // ─── Render Feedback Panel ──────────────────────────────────────────────────

  function renderFeedbackPanel() {
    const data = loadFeedback();
    const patternNames = Object.keys(data);

    let html = '';

    // Section title
    html += `<div style="
      background: ${BG_DARK};
      color: ${TEXT_PRIMARY};
      padding: 24px;
      border-radius: 8px;
      font-family: 'Segoe UI', -apple-system, sans-serif;
      border: 1px solid ${BORDER};
    ">`;

    html += `<h2 style="margin: 0 0 16px 0; color: ${GREEN}; font-size: 18px; font-weight: 600;">
      👍 Confidence Feedback — Your Rating History
    </h2>`;

    // Empty state
    if (patternNames.length === 0) {
      html += `<p style="color: ${TEXT_MUTED}; font-style: italic; margin: 20px 0;">
        No ratings yet. Use 👍/👎 on findings to rate their relevance.
        Over time, frequently dismissed patterns will be flagged as low-confidence.
      </p>`;
      html += `</div>`;
      return html;
    }

    // Compute stats
    let totalUp = 0;
    let totalDown = 0;
    patternNames.forEach(function (name) {
      totalUp += data[name].up;
      totalDown += data[name].down;
    });

    html += `<p style="color: ${TEXT_MUTED}; margin: 0 0 16px 0; font-size: 13px;">
      ${patternNames.length} patterns rated • ${totalUp} total thumbs-up • ${totalDown} total thumbs-down
    </p>`;

    // Sort by most-rated first (total votes)
    const sorted = patternNames.slice().sort(function (a, b) {
      const totalA = data[a].up + data[a].down;
      const totalB = data[b].up + data[b].down;
      return totalB - totalA;
    });

    // Table
    html += `<div style="overflow-x: auto;">
    <table style="
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-bottom: 16px;
    ">
      <thead>
        <tr style="border-bottom: 2px solid ${BORDER};">
          <th style="text-align: left; padding: 8px 12px; color: ${TEXT_MUTED};">Pattern</th>
          <th style="text-align: center; padding: 8px 12px; color: ${TEXT_MUTED};">👍</th>
          <th style="text-align: center; padding: 8px 12px; color: ${TEXT_MUTED};">👎</th>
          <th style="text-align: center; padding: 8px 12px; color: ${TEXT_MUTED};">Net</th>
          <th style="text-align: center; padding: 8px 12px; color: ${TEXT_MUTED};">Confidence</th>
        </tr>
      </thead>
      <tbody>`;

    sorted.forEach(function (name) {
      const entry = data[name];
      const net = entry.up - entry.down;
      const confidence = getConfidenceLevel(entry.up, entry.down);
      const confidenceColor =
        confidence === 'HIGH' ? GREEN : confidence === 'LOW' ? RED : TEXT_MUTED;

      html += `<tr style="border-bottom: 1px solid ${BORDER};">
        <td style="padding: 8px 12px; color: ${TEXT_PRIMARY}; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(name)}</td>
        <td style="text-align: center; padding: 8px 12px; color: ${GREEN};">${entry.up}</td>
        <td style="text-align: center; padding: 8px 12px; color: ${RED};">${entry.down}</td>
        <td style="text-align: center; padding: 8px 12px; color: ${net >= 0 ? GREEN : RED}; font-weight: 600;">${net >= 0 ? '+' : ''}${net}</td>
        <td style="text-align: center; padding: 8px 12px; color: ${confidenceColor}; font-weight: 600;">${confidence}</td>
      </tr>`;
    });

    html += `</tbody></table></div>`;

    // Clear All button
    html += `<button id="ls-clear-feedback-btn" style="
      background: transparent;
      border: 1px solid ${RED};
      color: ${RED};
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      margin-top: 8px;
      transition: background 0.2s;
    " onmouseover="this.style.background='${RED}22'" onmouseout="this.style.background='transparent'">
      Clear All Feedback
    </button>`;

    // Note
    html += `<p style="color: ${TEXT_MUTED}; font-size: 12px; margin-top: 16px; font-style: italic;">
      Feedback is per-engineer (stored locally). Patterns with consistently negative feedback
      may indicate false positives in your environment.
    </p>`;

    html += `</div>`;

    return html;
  }

  // ─── Confidence Level Calculation ───────────────────────────────────────────

  function getConfidenceLevel(up, down) {
    const total = up + down;
    if (total === 0) return 'NEUTRAL';
    const ratio = (up - down) / total;
    if (ratio >= 0.5) return 'HIGH';
    if (ratio <= -0.5) return 'LOW';
    return 'NEUTRAL';
  }

  // ─── Pattern Confidence Adjustment ─────────────────────────────────────────

  function getPatternConfidenceAdjustment(patternName) {
    const data = loadFeedback();
    const entry = data[patternName];
    if (!entry) return 0;

    const total = entry.up + entry.down;
    if (total === 0) return 0;

    // Returns value between -1 and +1
    // Weighted by volume (more votes = stronger signal)
    const ratio = (entry.up - entry.down) / total;
    const volumeFactor = Math.min(total / 10, 1); // Caps at 10 votes for full weight
    return Math.max(-1, Math.min(1, ratio * volumeFactor));
  }

  // ─── Utility ────────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ─── Attach Clear Button Handler (delegated) ───────────────────────────────

  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'ls-clear-feedback-btn') {
      if (confirm('Clear all feedback data? This cannot be undone.')) {
        localStorage.removeItem(STORAGE_KEY);
        // Re-render if panel is visible
        var panelContainer = e.target.closest('[data-ls-feedback-panel]');
        if (panelContainer) {
          panelContainer.innerHTML = renderFeedbackPanel();
        }
      }
    }
  });

  // ─── Export ─────────────────────────────────────────────────────────────────

  window.initConfidenceFeedback = initConfidenceFeedback;
  window.renderFeedbackPanel = renderFeedbackPanel;
  window.getPatternConfidenceAdjustment = getPatternConfidenceAdjustment;

  // ─── Self-Initialize ────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConfidenceFeedback);
  } else {
    initConfidenceFeedback();
  }
})();
