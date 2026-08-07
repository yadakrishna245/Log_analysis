/**
 * LogSherlock Pro - Pattern Update Subscription Feature
 * Simulates antivirus-style signature updates for log pattern detection.
 * Standalone module — no network calls, all data embedded.
 */

(function () {
  'use strict';

  // ─── Embedded Pattern Update History ───────────────────────────────────────────
  const PATTERN_UPDATES = [
    {
      version: 455,
      date: '2026-08-07',
      dateLabel: 'Aug 7, 2026',
      added: 12,
      current: true,
      categories: ['Morpheus 7.x errors', 'GFS2 v5 changes'],
      patterns: [
        'Morpheus 7.x appliance boot failure',
        'Morpheus 7.x API timeout on provisioning',
        'Morpheus 7.x task engine deadlock',
        'Morpheus 7.x integration token expiry',
        'Morpheus 7.x catalog sync corruption',
        'Morpheus 7.x network pool exhaustion',
        'GFS2 v5 journal recovery stall',
        'GFS2 v5 dlm lock contention',
        'GFS2 v5 quota enforcement error',
        'GFS2 v5 withdraw on metadata corruption',
        'GFS2 v5 fence race condition',
        'GFS2 v5 resource group bitmap overflow'
      ]
    },
    {
      version: 443,
      date: '2026-07-28',
      dateLabel: 'Jul 28, 2026',
      added: 8,
      current: false,
      categories: ['RHEL 9.4 kernel panics', 'New OOM variants'],
      patterns: [
        'RHEL 9.4 kernel NULL pointer dereference in nf_conntrack',
        'RHEL 9.4 kernel BUG in slab allocator',
        'RHEL 9.4 kernel softlockup in virtio_net',
        'RHEL 9.4 kernel RCU stall on NUMA node',
        'OOM killer invoked by cgroup memory.max',
        'OOM killer triggered by tmpfs exhaustion',
        'OOM reaper stuck on locked pages',
        'OOM cascading kill in container namespace'
      ]
    },
    {
      version: 435,
      date: '2026-07-15',
      dateLabel: 'Jul 15, 2026',
      added: 15,
      current: false,
      categories: ['VMware 8.0u3 migration', 'vSAN health'],
      patterns: [
        'VMware 8.0u3 vMotion stun time exceeded',
        'VMware 8.0u3 migration pre-check failure',
        'VMware 8.0u3 EVC mode incompatibility',
        'VMware 8.0u3 snapshot consolidation hang',
        'VMware 8.0u3 CBRC digest mismatch',
        'VMware 8.0u3 DVS port binding error',
        'VMware 8.0u3 VMFS heartbeat loss',
        'VMware 8.0u3 host isolation response',
        'vSAN health: disk group decommission stall',
        'vSAN health: object compliance failure',
        'vSAN health: witness partition detected',
        'vSAN health: encryption KMS unreachable',
        'vSAN health: stretched cluster split-brain',
        'vSAN health: capacity imbalance critical',
        'vSAN health: resync throttling deadlock'
      ]
    },
    {
      version: 420,
      date: '2026-07-01',
      dateLabel: 'Jul 1, 2026',
      added: 20,
      current: false,
      categories: ['Storage multipath improvements'],
      patterns: [
        'DM-Multipath path failover timeout',
        'DM-Multipath all paths down',
        'DM-Multipath ghost path detected',
        'DM-Multipath queue_if_no_path overload',
        'PowerPath dead path recovery loop',
        'PowerPath license validation failure',
        'HPE 3PAR ALUA state transition',
        'HPE 3PAR port failover incomplete',
        'NetApp ONTAP LIF migration failure',
        'NetApp ONTAP aggregate offline',
        'Pure Storage multipath priority conflict',
        'Pure Storage replication lag critical',
        'iSCSI session timeout on initiator',
        'iSCSI login redirect loop',
        'FC RSCN fabric notification storm',
        'FC zone merge conflict',
        'NVMe-oF path error recovery',
        'NVMe-oF controller reset triggered',
        'SAN switch ISL congestion detected',
        'SAN switch zone database inconsistency'
      ]
    },
    {
      version: 400,
      date: '2026-06-15',
      dateLabel: 'Jun 15, 2026',
      added: 400,
      current: false,
      categories: ['Initial pattern set'],
      patterns: []
    }
  ];

  const TOTAL_SIGNATURES = 455;
  const CURRENT_VERSION = 455;
  const LATEST_VERSION = 455;
  const LAST_UPDATED = '2026-08-07';
  const NEXT_UPDATE_DATE = new Date('2026-08-30');
  const AUTO_UPDATE_KEY = 'logsherlock_auto_update_enabled';

  // ─── Utility Functions ─────────────────────────────────────────────────────────

  function getAutoUpdateEnabled() {
    try {
      const stored = localStorage.getItem(AUTO_UPDATE_KEY);
      return stored === null ? true : stored === 'true';
    } catch (e) {
      return true;
    }
  }

  function setAutoUpdateEnabled(enabled) {
    try {
      localStorage.setItem(AUTO_UPDATE_KEY, String(enabled));
    } catch (e) { /* localStorage unavailable */ }
  }

  function getDaysUntilNextUpdate() {
    const now = new Date();
    const diff = NEXT_UPDATE_DATE - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── Styles ────────────────────────────────────────────────────────────────────

  function getStyles() {
    return `
      .lsp-updates-panel {
        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
        background: #1e1e2e;
        color: #e0e0e0;
        padding: 28px;
        border-radius: 12px;
        max-width: 720px;
        margin: 0 auto;
        box-sizing: border-box;
      }
      .lsp-updates-panel * { box-sizing: border-box; }

      .lsp-updates-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 20px;
      }
      .lsp-updates-title {
        font-size: 22px;
        font-weight: 700;
        color: #ffffff;
        margin: 0;
      }
      .lsp-version-badge {
        background: linear-gradient(135deg, #01a982, #00875a);
        color: #ffffff;
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.3px;
      }

      .lsp-status-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 20px;
        padding: 14px 18px;
        background: #2a2a3e;
        border-radius: 8px;
        border-left: 3px solid #01a982;
      }
      .lsp-status-compare {
        font-size: 14px;
        color: #b0b0c0;
      }
      .lsp-status-compare .lsp-uptodate {
        color: #01a982;
        font-weight: 600;
      }
      .lsp-status-subscription {
        font-size: 12px;
        color: #8888a0;
        margin-top: 4px;
      }
      .lsp-last-updated {
        font-size: 12px;
        color: #8888a0;
      }

      .lsp-actions-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 14px;
        margin-bottom: 24px;
      }
      .lsp-check-btn {
        background: #01a982;
        color: #ffffff;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: background 0.2s, transform 0.1s;
      }
      .lsp-check-btn:hover { background: #00875a; transform: translateY(-1px); }
      .lsp-check-btn:active { transform: translateY(0); }
      .lsp-check-btn:disabled { opacity: 0.6; cursor: not-allowed; }

      .lsp-spinner {
        display: none;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: lsp-spin 0.7s linear infinite;
      }
      .lsp-spinner.active { display: inline-block; }
      @keyframes lsp-spin {
        to { transform: rotate(360deg); }
      }

      .lsp-auto-toggle {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
        color: #b0b0c0;
      }
      .lsp-toggle-switch {
        position: relative;
        width: 40px;
        height: 22px;
        background: #3a3a50;
        border-radius: 11px;
        cursor: pointer;
        transition: background 0.2s;
      }
      .lsp-toggle-switch.on { background: #01a982; }
      .lsp-toggle-switch::after {
        content: '';
        position: absolute;
        top: 3px;
        left: 3px;
        width: 16px;
        height: 16px;
        background: #ffffff;
        border-radius: 50%;
        transition: transform 0.2s;
      }
      .lsp-toggle-switch.on::after { transform: translateX(18px); }

      .lsp-countdown {
        font-size: 12px;
        color: #8888a0;
        text-align: right;
      }
      .lsp-countdown-value {
        color: #01a982;
        font-weight: 600;
      }

      .lsp-highlight-card {
        background: #2a2a3e;
        border: 1px solid #01a98233;
        border-radius: 10px;
        padding: 18px;
        margin-bottom: 24px;
      }
      .lsp-highlight-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      }
      .lsp-highlight-title {
        font-size: 15px;
        font-weight: 600;
        color: #01a982;
      }
      .lsp-highlight-count {
        background: #01a98222;
        color: #01a982;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
      }
      .lsp-highlight-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 16px;
      }
      .lsp-highlight-list li {
        font-size: 12px;
        color: #c0c0d0;
        padding: 3px 0;
        border-bottom: 1px solid #3a3a50;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .lsp-highlight-list li::before {
        content: '+ ';
        color: #01a982;
        font-weight: 700;
      }

      .lsp-timeline {
        position: relative;
        padding-left: 28px;
      }
      .lsp-timeline::before {
        content: '';
        position: absolute;
        left: 8px;
        top: 6px;
        bottom: 6px;
        width: 2px;
        background: #01a982;
        border-radius: 1px;
      }
      .lsp-timeline-item {
        position: relative;
        margin-bottom: 22px;
        padding: 14px 16px;
        background: #2a2a3e;
        border-radius: 8px;
        border: 1px solid #3a3a50;
        transition: border-color 0.2s;
      }
      .lsp-timeline-item:hover { border-color: #01a98266; }
      .lsp-timeline-item.current { border-color: #01a982; }
      .lsp-timeline-item::before {
        content: '';
        position: absolute;
        left: -24px;
        top: 18px;
        width: 12px;
        height: 12px;
        background: #1e1e2e;
        border: 2px solid #01a982;
        border-radius: 50%;
      }
      .lsp-timeline-item.current::before {
        background: #01a982;
        box-shadow: 0 0 8px #01a98266;
      }
      .lsp-timeline-item-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 6px;
      }
      .lsp-timeline-version {
        font-size: 14px;
        font-weight: 700;
        color: #ffffff;
      }
      .lsp-timeline-date {
        font-size: 12px;
        color: #8888a0;
      }
      .lsp-timeline-current-tag {
        background: #01a982;
        color: #ffffff;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .lsp-timeline-added {
        font-size: 13px;
        color: #01a982;
        font-weight: 600;
        margin-bottom: 4px;
      }
      .lsp-timeline-categories {
        font-size: 12px;
        color: #b0b0c0;
      }
      .lsp-timeline-cat-tag {
        display: inline-block;
        background: #3a3a50;
        padding: 2px 8px;
        border-radius: 4px;
        margin-right: 6px;
        margin-top: 4px;
        font-size: 11px;
        color: #c0c0d0;
      }

      .lsp-section-title {
        font-size: 16px;
        font-weight: 600;
        color: #ffffff;
        margin-bottom: 16px;
        padding-bottom: 8px;
        border-bottom: 1px solid #3a3a50;
      }

      .lsp-update-result {
        display: none;
        padding: 10px 14px;
        margin-bottom: 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
      }
      .lsp-update-result.show { display: block; }
      .lsp-update-result.success {
        background: #01a98218;
        color: #01a982;
        border: 1px solid #01a98244;
      }
    `;
  }

  // ─── Render Functions ──────────────────────────────────────────────────────────

  function renderPatternUpdatesPanel() {
    const autoUpdateOn = getAutoUpdateEnabled();
    const daysUntil = getDaysUntilNextUpdate();
    const newestPatterns = PATTERN_UPDATES[0].patterns;

    let html = `<style>${getStyles()}</style>`;
    html += `<div class="lsp-updates-panel" id="lsp-updates-panel">`;

    // Header
    html += `
      <div class="lsp-updates-header">
        <h2 class="lsp-updates-title">🛡️ Pattern Updates</h2>
        <span class="lsp-version-badge">Pattern DB v${CURRENT_VERSION} — ${TOTAL_SIGNATURES} signatures</span>
      </div>
    `;

    // Status row
    html += `
      <div class="lsp-status-row">
        <div>
          <div class="lsp-status-compare">
            Your version: <strong>v${CURRENT_VERSION}</strong> | Latest: <strong>v${LATEST_VERSION}</strong>
            <span class="lsp-uptodate"> ✅ Up to date</span>
          </div>
          <div class="lsp-status-subscription">Active — Pattern updates included with your license</div>
        </div>
        <div class="lsp-last-updated">Last updated: ${LAST_UPDATED}</div>
      </div>
    `;

    // Update result message (hidden by default)
    html += `<div class="lsp-update-result" id="lsp-update-result"></div>`;

    // Actions row
    html += `
      <div class="lsp-actions-row">
        <button class="lsp-check-btn" id="lsp-check-btn" onclick="window.__lspCheckForUpdates()">
          <span class="lsp-spinner" id="lsp-spinner"></span>
          <span id="lsp-check-label">Check for Updates</span>
        </button>
        <div class="lsp-auto-toggle">
          <div class="lsp-toggle-switch ${autoUpdateOn ? 'on' : ''}" id="lsp-auto-toggle" onclick="window.__lspToggleAutoUpdate()" role="switch" aria-checked="${autoUpdateOn}" aria-label="Auto-update toggle" tabindex="0"></div>
          <span>Auto-update enabled</span>
        </div>
        <div class="lsp-countdown">
          Next update in <span class="lsp-countdown-value">${daysUntil} days</span>
        </div>
      </div>
    `;

    // New patterns this month highlight card
    html += `
      <div class="lsp-highlight-card">
        <div class="lsp-highlight-header">
          <span class="lsp-highlight-title">🆕 New Patterns This Month</span>
          <span class="lsp-highlight-count">${newestPatterns.length} patterns</span>
        </div>
        <ul class="lsp-highlight-list">
          ${newestPatterns.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
        </ul>
      </div>
    `;

    // Timeline section
    html += `<div class="lsp-section-title">📜 Update History</div>`;
    html += `<div class="lsp-timeline">`;

    for (const update of PATTERN_UPDATES) {
      const isCurrent = update.current;
      html += `
        <div class="lsp-timeline-item ${isCurrent ? 'current' : ''}">
          <div class="lsp-timeline-item-header">
            <span class="lsp-timeline-version">v${update.version}</span>
            <span class="lsp-timeline-date">${update.dateLabel}</span>
            ${isCurrent ? '<span class="lsp-timeline-current-tag">Current</span>' : ''}
          </div>
          <div class="lsp-timeline-added">+${update.added} patterns</div>
          <div class="lsp-timeline-categories">
            ${update.categories.map(c => `<span class="lsp-timeline-cat-tag">${escapeHtml(c)}</span>`).join('')}
          </div>
        </div>
      `;
    }

    html += `</div>`; // .lsp-timeline
    html += `</div>`; // .lsp-updates-panel

    return html;
  }

  // ─── Check for Updates (Simulated) ─────────────────────────────────────────────

  function checkForUpdates() {
    return new Promise((resolve) => {
      const btn = document.getElementById('lsp-check-btn');
      const spinner = document.getElementById('lsp-spinner');
      const label = document.getElementById('lsp-check-label');
      const result = document.getElementById('lsp-update-result');

      if (btn) btn.disabled = true;
      if (spinner) spinner.classList.add('active');
      if (label) label.textContent = 'Checking...';
      if (result) { result.classList.remove('show'); }

      // Simulate network delay
      setTimeout(() => {
        if (spinner) spinner.classList.remove('active');
        if (label) label.textContent = 'Check for Updates';
        if (btn) btn.disabled = false;

        if (result) {
          result.textContent = '✅ Pattern database is up to date. v455 — 455 signatures loaded.';
          result.className = 'lsp-update-result show success';
        }

        resolve({
          upToDate: true,
          currentVersion: CURRENT_VERSION,
          latestVersion: LATEST_VERSION,
          totalSignatures: TOTAL_SIGNATURES,
          message: 'Pattern database is up to date.'
        });
      }, 2200);
    });
  }

  // ─── Get Pattern Version Info ──────────────────────────────────────────────────

  function getPatternVersion() {
    return {
      currentVersion: CURRENT_VERSION,
      latestVersion: LATEST_VERSION,
      totalSignatures: TOTAL_SIGNATURES,
      lastUpdated: LAST_UPDATED,
      isUpToDate: CURRENT_VERSION >= LATEST_VERSION,
      autoUpdateEnabled: getAutoUpdateEnabled(),
      daysUntilNextUpdate: getDaysUntilNextUpdate(),
      subscriptionStatus: 'Active',
      updateHistory: PATTERN_UPDATES.map(u => ({
        version: u.version,
        date: u.date,
        added: u.added,
        categories: u.categories
      }))
    };
  }

  // ─── Toggle Auto-Update ────────────────────────────────────────────────────────

  function toggleAutoUpdate() {
    const toggle = document.getElementById('lsp-auto-toggle');
    const current = getAutoUpdateEnabled();
    const next = !current;
    setAutoUpdateEnabled(next);
    if (toggle) {
      toggle.classList.toggle('on', next);
      toggle.setAttribute('aria-checked', String(next));
    }
  }

  // ─── Expose to Window for DOM Events ───────────────────────────────────────────

  window.__lspCheckForUpdates = checkForUpdates;
  window.__lspToggleAutoUpdate = toggleAutoUpdate;

  // ─── Self-Initialize on DOMContentLoaded ───────────────────────────────────────

  function init() {
    // If a container with id 'pattern-updates-root' exists, render into it
    let root = document.getElementById('pattern-updates-root');
    if (!root) {
      // Create a root container and append to body
      root = document.createElement('div');
      root.id = 'pattern-updates-root';
      document.body.appendChild(root);
    }
    root.innerHTML = renderPatternUpdatesPanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─── Module Exports ────────────────────────────────────────────────────────────

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { renderPatternUpdatesPanel, checkForUpdates, getPatternVersion };
  }

  // Also expose on window for browser use
  window.LogSherlockPatternUpdates = {
    renderPatternUpdatesPanel,
    checkForUpdates,
    getPatternVersion
  };

})();
