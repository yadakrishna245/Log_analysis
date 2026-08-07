/**
 * LogSherlock Pro - Changelog / What's New Feature
 * Standalone module - no external dependencies
 * Shows version history and new features with notification badges
 */

(function () {
  'use strict';

  // ─── Version History Data ───────────────────────────────────────────────────
  const CHANGELOG_DATA = [
    {
      version: '5.0',
      date: 'Aug 7, 2026',
      features: [
        { name: 'Smart Verdict Panel', emoji: '⚖️', category: 'Core' },
        { name: 'Health Score', emoji: '💚', category: 'Analytics' },
        { name: 'Predictive Warnings', emoji: '🔮', category: 'AI' },
        { name: 'Before/After Compare', emoji: '🔄', category: 'Core' },
        { name: 'Customer Email Generator', emoji: '📧', category: 'AI' },
        { name: 'ROI Calculator', emoji: '💰', category: 'Analytics' },
        { name: 'Live Demo Mode', emoji: '🎬', category: 'UX' },
        { name: 'Pattern Dictionary', emoji: '📖', category: 'Core' },
        { name: 'Audit Trail', emoji: '📋', category: 'Core' },
        { name: 'SLA Dashboard', emoji: '📊', category: 'Analytics' },
        { name: 'Guided Mode', emoji: '🧭', category: 'UX' },
        { name: 'Training Mode', emoji: '🎓', category: 'UX' },
        { name: 'Topology Map', emoji: '🗺️', category: 'Core' },
        { name: 'Multi-Log Correlation', emoji: '🔗', category: 'Core' },
        { name: 'Usage Reports', emoji: '📈', category: 'Analytics' }
      ]
    },
    {
      version: '4.0',
      date: 'Aug 5, 2026',
      features: [
        { name: 'Incident Replay Cinema', emoji: '🎥', category: 'UX' },
        { name: 'Advanced Insights (Root Cause Graph, Timeline, Log Memory)', emoji: '🧠', category: 'AI' },
        { name: 'Per-Machine License System', emoji: '🔑', category: 'Core' },
        { name: 'Multi-Provider AI Chat', emoji: '🤖', category: 'AI' },
        { name: 'GitHub Copilot Integration', emoji: '🐙', category: 'Integration' }
      ]
    },
    {
      version: '3.0',
      date: 'Jul 28, 2026',
      features: [
        { name: 'Streaming Engine (3GB+ files)', emoji: '⚡', category: 'Core' },
        { name: 'Multi-File Drop', emoji: '📂', category: 'UX' },
        { name: 'Multi-Folder Scan', emoji: '🗂️', category: 'UX' },
        { name: 'Interactive Line Navigation', emoji: '🧭', category: 'UX' },
        { name: 'Jira Integration', emoji: '🎫', category: 'Integration' },
        { name: 'AI Comment Reply', emoji: '💬', category: 'AI' }
      ]
    },
    {
      version: '2.0',
      date: 'Jul 15, 2026',
      features: [
        { name: 'Intelligence Layer', emoji: '🧠', category: 'AI' },
        { name: 'Knowledge Base (120 issues)', emoji: '📚', category: 'Core' },
        { name: 'Runbooks (12)', emoji: '📒', category: 'Core' },
        { name: 'VME Guide (41 entries)', emoji: '📗', category: 'Core' },
        { name: 'Ticket Advisor', emoji: '🎟️', category: 'AI' }
      ]
    },
    {
      version: '1.0',
      date: 'Jul 1, 2026',
      features: [
        { name: '455 Patterns', emoji: '🔍', category: 'Core' },
        { name: 'Severity Heatmap', emoji: '🌡️', category: 'Analytics' },
        { name: 'Cascade Chain', emoji: '⛓️', category: 'Analytics' },
        { name: 'CSV/PDF Export', emoji: '📄', category: 'Core' },
        { name: 'Dark/Light Theme', emoji: '🌗', category: 'UX' }
      ]
    }
  ];

  const STORAGE_KEY = 'logsherlock_last_seen_version';
  const LATEST_VERSION = CHANGELOG_DATA[0].version;

  // ─── Category Colors ───────────────────────────────────────────────────────
  const CATEGORY_COLORS = {
    Core: '#01a982',
    AI: '#a855f7',
    UX: '#f59e0b',
    Integration: '#3b82f6',
    Analytics: '#ec4899'
  };

  // ─── Utility Functions ──────────────────────────────────────────────────────

  function getLastSeenVersion() {
    try {
      return localStorage.getItem(STORAGE_KEY) || '0.0';
    } catch (e) {
      return '0.0';
    }
  }

  function setLastSeenVersion(version) {
    try {
      localStorage.setItem(STORAGE_KEY, version);
    } catch (e) {
      // localStorage unavailable
    }
  }

  function versionToNumber(v) {
    const parts = v.split('.');
    return parseInt(parts[0], 10) * 1000 + parseInt(parts[1] || '0', 10);
  }

  function isVersionNewer(version, thanVersion) {
    return versionToNumber(version) > versionToNumber(thanVersion);
  }

  // ─── Exported: getUnseenCount ───────────────────────────────────────────────

  function getUnseenCount() {
    const lastSeen = getLastSeenVersion();
    let count = 0;
    for (const release of CHANGELOG_DATA) {
      if (isVersionNewer(release.version, lastSeen)) {
        count += release.features.length;
      }
    }
    return count;
  }

  // ─── Exported: renderChangelogButton ────────────────────────────────────────

  function renderChangelogButton() {
    const unseenCount = getUnseenCount();
    const badgeHtml = unseenCount > 0
      ? `<span class="changelog-badge">${unseenCount}</span>`
      : '';

    return `
      <button class="changelog-btn" onclick="openChangelog()" title="What's New in LogSherlock Pro">
        <span class="changelog-btn-icon">🆕</span>
        <span class="changelog-btn-text">What's New</span>
        ${badgeHtml}
      </button>
    `;
  }

  // ─── Exported: openChangelog ────────────────────────────────────────────────

  function openChangelog() {
    // Remove existing modal if any
    const existing = document.getElementById('changelog-modal-backdrop');
    if (existing) existing.remove();

    const lastSeen = getLastSeenVersion();

    // Build modal HTML
    const backdrop = document.createElement('div');
    backdrop.id = 'changelog-modal-backdrop';
    backdrop.className = 'changelog-backdrop';
    backdrop.innerHTML = `
      <div class="changelog-modal" id="changelog-modal">
        <div class="changelog-header">
          <div class="changelog-header-left">
            <span class="changelog-header-icon">📋</span>
            <h2 class="changelog-title">What's New</h2>
          </div>
          <button class="changelog-close-btn" onclick="closeChangelog()" title="Close (Esc)">✕</button>
        </div>
        <div class="changelog-body">
          ${CHANGELOG_DATA.map(release => {
            const isNew = isVersionNewer(release.version, lastSeen);
            return `
              <div class="changelog-version-card ${isNew ? 'changelog-version-new' : ''}">
                <div class="changelog-version-header">
                  <span class="changelog-version-number">v${release.version}</span>
                  ${isNew ? '<span class="changelog-new-tag">NEW</span>' : ''}
                  <span class="changelog-version-date">${release.date}</span>
                </div>
                <ul class="changelog-feature-list">
                  ${release.features.map(f => `
                    <li class="changelog-feature-item">
                      <span class="changelog-feature-emoji">${f.emoji}</span>
                      <span class="changelog-feature-name">${f.name}</span>
                      ${isNew ? '<span class="changelog-feature-new-badge">NEW</span>' : ''}
                      <span class="changelog-category-tag" style="background:${CATEGORY_COLORS[f.category] || '#555'}20;color:${CATEGORY_COLORS[f.category] || '#555'};border:1px solid ${CATEGORY_COLORS[f.category] || '#555'}40">${f.category}</span>
                    </li>
                  `).join('')}
                </ul>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    // Trigger animation
    requestAnimationFrame(() => {
      backdrop.classList.add('changelog-backdrop-visible');
      document.getElementById('changelog-modal').classList.add('changelog-modal-visible');
    });

    // Close on backdrop click
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) {
        closeChangelog();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', handleEscapeKey);

    // Mark as read
    setLastSeenVersion(LATEST_VERSION);

    // Update button badge if present
    updateButtonBadge();
  }

  // ─── Exported: closeChangelog ───────────────────────────────────────────────

  function closeChangelog() {
    const backdrop = document.getElementById('changelog-modal-backdrop');
    const modal = document.getElementById('changelog-modal');
    if (!backdrop) return;

    if (modal) modal.classList.remove('changelog-modal-visible');
    backdrop.classList.remove('changelog-backdrop-visible');

    setTimeout(() => {
      backdrop.remove();
    }, 300);

    document.removeEventListener('keydown', handleEscapeKey);
  }

  // ─── Internal Helpers ───────────────────────────────────────────────────────

  function handleEscapeKey(e) {
    if (e.key === 'Escape') {
      closeChangelog();
    }
  }

  function updateButtonBadge() {
    const badges = document.querySelectorAll('.changelog-badge');
    badges.forEach(badge => {
      badge.style.display = 'none';
    });
  }

  // ─── Inject Styles ─────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('changelog-styles')) return;

    const style = document.createElement('style');
    style.id = 'changelog-styles';
    style.textContent = `
      /* Changelog Button */
      .changelog-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        background: #2a2a3e;
        border: 1px solid #01a98240;
        border-radius: 8px;
        color: #e0e0e0;
        font-size: 13px;
        font-family: inherit;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .changelog-btn:hover {
        background: #01a98220;
        border-color: #01a982;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px #01a98230;
      }
      .changelog-btn-icon {
        font-size: 16px;
      }
      .changelog-btn-text {
        font-weight: 500;
      }
      .changelog-badge {
        position: absolute;
        top: -6px;
        right: -6px;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        background: #ef4444;
        border-radius: 9px;
        color: #fff;
        font-size: 10px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: changelog-pulse 2s infinite;
      }

      @keyframes changelog-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }

      /* Backdrop */
      .changelog-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0);
        z-index: 99999;
        display: flex;
        justify-content: flex-end;
        transition: background 0.3s ease;
      }
      .changelog-backdrop-visible {
        background: rgba(0, 0, 0, 0.5);
      }

      /* Modal */
      .changelog-modal {
        width: 480px;
        max-width: 90vw;
        height: 100vh;
        background: #1e1e2e;
        box-shadow: -8px 0 30px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        transform: translateX(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        overflow: hidden;
      }
      .changelog-modal-visible {
        transform: translateX(0);
      }

      /* Header */
      .changelog-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border-bottom: 1px solid #ffffff10;
        background: #2a2a3e;
      }
      .changelog-header-left {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .changelog-header-icon {
        font-size: 22px;
      }
      .changelog-title {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        color: #ffffff;
      }
      .changelog-close-btn {
        width: 32px;
        height: 32px;
        border: none;
        background: #ffffff10;
        border-radius: 6px;
        color: #999;
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .changelog-close-btn:hover {
        background: #ef444440;
        color: #ef4444;
      }

      /* Body */
      .changelog-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px 24px;
      }
      .changelog-body::-webkit-scrollbar {
        width: 6px;
      }
      .changelog-body::-webkit-scrollbar-track {
        background: transparent;
      }
      .changelog-body::-webkit-scrollbar-thumb {
        background: #ffffff20;
        border-radius: 3px;
      }

      /* Version Card */
      .changelog-version-card {
        background: #2a2a3e;
        border: 1px solid #ffffff10;
        border-radius: 12px;
        padding: 18px 20px;
        margin-bottom: 16px;
        transition: border-color 0.2s;
      }
      .changelog-version-card:hover {
        border-color: #01a98240;
      }
      .changelog-version-new {
        border-color: #01a98260;
        box-shadow: 0 0 20px #01a98210;
      }

      /* Version Header */
      .changelog-version-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
      }
      .changelog-version-number {
        font-size: 16px;
        font-weight: 700;
        color: #01a982;
      }
      .changelog-new-tag {
        padding: 2px 8px;
        background: #01a98220;
        border: 1px solid #01a98260;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 700;
        color: #01a982;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .changelog-version-date {
        margin-left: auto;
        font-size: 12px;
        color: #888;
      }

      /* Feature List */
      .changelog-feature-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .changelog-feature-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 0;
        border-bottom: 1px solid #ffffff06;
        font-size: 13px;
        color: #d0d0d0;
      }
      .changelog-feature-item:last-child {
        border-bottom: none;
      }
      .changelog-feature-emoji {
        font-size: 15px;
        flex-shrink: 0;
      }
      .changelog-feature-name {
        flex: 1;
      }
      .changelog-feature-new-badge {
        padding: 1px 5px;
        background: #ef4444;
        border-radius: 3px;
        font-size: 9px;
        font-weight: 700;
        color: #fff;
        text-transform: uppercase;
        flex-shrink: 0;
      }
      .changelog-category-tag {
        padding: 2px 7px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
        flex-shrink: 0;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Self-Initialize ────────────────────────────────────────────────────────

  function init() {
    injectStyles();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─── Export to Global Scope ─────────────────────────────────────────────────

  window.renderChangelogButton = renderChangelogButton;
  window.openChangelog = openChangelog;
  window.closeChangelog = closeChangelog;
  window.getUnseenCount = getUnseenCount;

})();
