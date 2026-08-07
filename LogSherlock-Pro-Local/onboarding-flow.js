/**
 * LogSherlock Pro — First-Time Onboarding Flow
 * Standalone tour with spotlight + tooltip, pure CSS animations, no dependencies.
 * Shows only on first visit (localStorage). Accessible (focus trap, Escape to skip).
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'logsherlock_onboarding_complete';

  // --- Tour Step Definitions ---
  const TOUR_STEPS = [
    {
      id: 'welcome',
      target: null, // No target — centered welcome
      text: 'Welcome to LogSherlock Pro! Let me show you around.',
      autoAdvance: 3000,
    },
    {
      id: 'upload-zone',
      target: '#upload-zone, #dropzone, [data-tour="upload"]',
      text: 'Drop your .tar.gz or .zip log files here — supports files up to 3GB+',
    },
    {
      id: 'ticket-context',
      target: '#ticket-context, #jira-input, [data-tour="ticket"]',
      text: 'Paste your Jira ticket description here for better accuracy',
    },
    {
      id: 'scan-button',
      target: '#scan-btn, #run-scan, [data-tour="scan"]',
      text: 'Click Run Scan to start analysis — results in seconds',
    },
    {
      id: 'results-area',
      target: '#results, #results-area, [data-tour="results"]',
      text: 'Your findings appear here with severity, file, and line numbers',
    },
    {
      id: 'export-buttons',
      target: '#export-buttons, .export-group, [data-tour="export"]',
      text: 'Export as PDF, CSV, or copy as Jira wiki markup',
    },
    {
      id: 'ai-chat',
      target: '#ai-chat, #chat-panel, [data-tour="chat"]',
      text: 'Ask AI questions about your logs — works with Ollama or GitHub Copilot',
    },
    {
      id: 'verdict-panel',
      target: '#verdict, #verdict-panel, [data-tour="verdict"]',
      text: 'Get a one-sentence root cause diagnosis after every scan',
    },
    {
      id: 'pattern-dictionary',
      target: '#pattern-dict, #patterns, [data-tour="patterns"]',
      text: 'Look up any pattern to understand what it means',
    },
    {
      id: 'finish',
      target: null, // No target — centered finish message
      text: "You're all set! Drop a log file to get started. Happy investigating! 🔍",
    },
  ];

  // --- Inject Styles ---
  function injectStyles() {
    if (document.getElementById('logsherlock-onboarding-styles')) return;
    const style = document.createElement('style');
    style.id = 'logsherlock-onboarding-styles';
    style.textContent = `
      /* Overlay */
      .ls-onboarding-overlay {
        position: fixed;
        inset: 0;
        z-index: 99990;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.35s ease;
      }
      .ls-onboarding-overlay.active {
        opacity: 1;
        pointer-events: auto;
      }

      /* SVG overlay for spotlight cutout */
      .ls-onboarding-overlay svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }

      /* Tooltip */
      .ls-onboarding-tooltip {
        position: fixed;
        z-index: 99999;
        background: #2a2a3e;
        border: 2px solid #01a982;
        border-radius: 12px;
        padding: 20px 24px 16px;
        color: #e0e0e0;
        max-width: 380px;
        min-width: 280px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(1, 169, 130, 0.2);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        opacity: 0;
        transform: translateY(10px) scale(0.96);
        transition: opacity 0.3s ease, transform 0.3s ease;
      }
      .ls-onboarding-tooltip.visible {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      .ls-onboarding-tooltip.center {
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) scale(1) !important;
      }
      .ls-onboarding-tooltip.center.visible {
        transform: translate(-50%, -50%) scale(1) !important;
      }

      /* Arrow */
      .ls-onboarding-arrow {
        position: absolute;
        width: 14px;
        height: 14px;
        background: #2a2a3e;
        border: 2px solid #01a982;
        transform: rotate(45deg);
        z-index: -1;
      }
      .ls-onboarding-arrow.arrow-top {
        top: -9px;
        left: 50%;
        margin-left: -7px;
        border-bottom: none;
        border-right: none;
      }
      .ls-onboarding-arrow.arrow-bottom {
        bottom: -9px;
        left: 50%;
        margin-left: -7px;
        border-top: none;
        border-left: none;
      }
      .ls-onboarding-arrow.arrow-left {
        left: -9px;
        top: 50%;
        margin-top: -7px;
        border-right: none;
        border-bottom: none;
      }
      .ls-onboarding-arrow.arrow-right {
        right: -9px;
        top: 50%;
        margin-top: -7px;
        border-left: none;
        border-top: none;
      }

      /* Tooltip content */
      .ls-onboarding-text {
        margin-bottom: 14px;
        font-size: 15px;
      }
      .ls-onboarding-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .ls-onboarding-counter {
        font-size: 12px;
        color: #8a8a9e;
        font-weight: 500;
      }
      .ls-onboarding-buttons {
        display: flex;
        gap: 8px;
      }
      .ls-onboarding-btn {
        padding: 6px 14px;
        border-radius: 6px;
        border: none;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s, transform 0.1s;
      }
      .ls-onboarding-btn:active {
        transform: scale(0.96);
      }
      .ls-onboarding-btn:focus-visible {
        outline: 2px solid #01a982;
        outline-offset: 2px;
      }
      .ls-onboarding-btn-skip {
        background: transparent;
        color: #8a8a9e;
        border: 1px solid #444;
      }
      .ls-onboarding-btn-skip:hover {
        background: rgba(255,255,255,0.05);
        color: #c0c0c0;
      }
      .ls-onboarding-btn-next {
        background: #01a982;
        color: #fff;
      }
      .ls-onboarding-btn-next:hover {
        background: #00c896;
      }

      /* Highlighted target element */
      .ls-onboarding-spotlight-target {
        position: relative;
        z-index: 99995 !important;
        border-radius: 6px;
        box-shadow: 0 0 0 4px rgba(1, 169, 130, 0.4);
        transition: box-shadow 0.3s ease;
      }

      /* Pulse animation for welcome / finish */
      @keyframes ls-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(1, 169, 130, 0.4); }
        50% { box-shadow: 0 0 0 20px rgba(1, 169, 130, 0); }
      }
      .ls-onboarding-tooltip.center {
        animation: ls-pulse 2s ease infinite;
      }
    `;
    document.head.appendChild(style);
  }

  // --- State ---
  let currentStep = 0;
  let overlayEl = null;
  let tooltipEl = null;
  let previouslyFocused = null;
  let isActive = false;
  let autoAdvanceTimer = null;

  // --- Utility: find target element from comma-separated selectors ---
  function findTarget(selectorStr) {
    if (!selectorStr) return null;
    const selectors = selectorStr.split(',').map((s) => s.trim());
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) return el;
      } catch (e) {
        // Invalid selector, skip
      }
    }
    return null;
  }

  // --- Create overlay with SVG spotlight ---
  function createOverlay() {
    overlayEl = document.createElement('div');
    overlayEl.className = 'ls-onboarding-overlay';
    overlayEl.setAttribute('role', 'dialog');
    overlayEl.setAttribute('aria-modal', 'true');
    overlayEl.setAttribute('aria-label', 'LogSherlock Pro onboarding tour');
    overlayEl.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <defs>
          <mask id="ls-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white"/>
            <rect id="ls-spotlight-hole" x="0" y="0" width="0" height="0" rx="8" ry="8" fill="black"/>
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.75)" mask="url(#ls-spotlight-mask)"/>
      </svg>
    `;
    document.body.appendChild(overlayEl);
  }

  // --- Create tooltip ---
  function createTooltip() {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'ls-onboarding-tooltip';
    tooltipEl.setAttribute('role', 'alertdialog');
    tooltipEl.setAttribute('aria-live', 'polite');
    tooltipEl.innerHTML = `
      <div class="ls-onboarding-arrow"></div>
      <div class="ls-onboarding-text"></div>
      <div class="ls-onboarding-footer">
        <span class="ls-onboarding-counter"></span>
        <div class="ls-onboarding-buttons">
          <button class="ls-onboarding-btn ls-onboarding-btn-skip" type="button">Skip</button>
          <button class="ls-onboarding-btn ls-onboarding-btn-next" type="button">Next</button>
        </div>
      </div>
    `;
    document.body.appendChild(tooltipEl);

    // Button handlers
    tooltipEl.querySelector('.ls-onboarding-btn-skip').addEventListener('click', skipOnboarding);
    tooltipEl.querySelector('.ls-onboarding-btn-next').addEventListener('click', nextStep);
  }

  // --- Position spotlight cutout around target ---
  function positionSpotlight(targetEl) {
    const hole = document.getElementById('ls-spotlight-hole');
    if (!targetEl) {
      hole.setAttribute('width', '0');
      hole.setAttribute('height', '0');
      return;
    }
    const rect = targetEl.getBoundingClientRect();
    const padding = 8;
    hole.setAttribute('x', rect.left - padding);
    hole.setAttribute('y', rect.top - padding);
    hole.setAttribute('width', rect.width + padding * 2);
    hole.setAttribute('height', rect.height + padding * 2);
  }

  // --- Position tooltip relative to target ---
  function positionTooltip(targetEl, step) {
    const arrow = tooltipEl.querySelector('.ls-onboarding-arrow');
    arrow.className = 'ls-onboarding-arrow'; // reset

    if (!targetEl) {
      // Center tooltip (welcome / finish)
      tooltipEl.classList.add('center');
      tooltipEl.style.top = '';
      tooltipEl.style.left = '';
      arrow.style.display = 'none';
      return;
    }

    tooltipEl.classList.remove('center');
    arrow.style.display = '';

    const rect = targetEl.getBoundingClientRect();
    const tipRect = tooltipEl.getBoundingClientRect();
    const gap = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top, left, arrowDir;

    // Prefer below
    if (rect.bottom + gap + tipRect.height < vh) {
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - tipRect.width / 2;
      arrowDir = 'arrow-top';
    }
    // Try above
    else if (rect.top - gap - tipRect.height > 0) {
      top = rect.top - gap - tipRect.height;
      left = rect.left + rect.width / 2 - tipRect.width / 2;
      arrowDir = 'arrow-bottom';
    }
    // Try right
    else if (rect.right + gap + tipRect.width < vw) {
      top = rect.top + rect.height / 2 - tipRect.height / 2;
      left = rect.right + gap;
      arrowDir = 'arrow-left';
    }
    // Fallback left
    else {
      top = rect.top + rect.height / 2 - tipRect.height / 2;
      left = rect.left - gap - tipRect.width;
      arrowDir = 'arrow-right';
    }

    // Clamp within viewport
    left = Math.max(12, Math.min(left, vw - tipRect.width - 12));
    top = Math.max(12, Math.min(top, vh - tipRect.height - 12));

    tooltipEl.style.top = top + 'px';
    tooltipEl.style.left = left + 'px';
    arrow.classList.add(arrowDir);
  }

  // --- Show a specific step ---
  function showStep(index) {
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }

    // Remove spotlight from previous target
    const prevSpotlight = document.querySelector('.ls-onboarding-spotlight-target');
    if (prevSpotlight) prevSpotlight.classList.remove('ls-onboarding-spotlight-target');

    // Find the next valid step (skip if target doesn't exist)
    while (index < TOUR_STEPS.length) {
      const step = TOUR_STEPS[index];
      const targetEl = findTarget(step.target);
      if (step.target === null || targetEl) break; // null target = centered (welcome/finish)
      index++; // Skip step — target not found
    }

    if (index >= TOUR_STEPS.length) {
      completeOnboarding();
      return;
    }

    currentStep = index;
    const step = TOUR_STEPS[index];
    const targetEl = findTarget(step.target);

    // Spotlight target
    if (targetEl) {
      targetEl.classList.add('ls-onboarding-spotlight-target');
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Update tooltip content
    tooltipEl.querySelector('.ls-onboarding-text').textContent = step.text;
    tooltipEl.querySelector('.ls-onboarding-counter').textContent = `${index + 1}/${TOUR_STEPS.length}`;

    const nextBtn = tooltipEl.querySelector('.ls-onboarding-btn-next');
    if (index === TOUR_STEPS.length - 1) {
      nextBtn.textContent = 'Finish';
    } else {
      nextBtn.textContent = 'Next';
    }

    // Hide tooltip for reposition, then show
    tooltipEl.classList.remove('visible');
    positionSpotlight(targetEl);

    // Allow layout recalc before positioning
    requestAnimationFrame(() => {
      positionTooltip(targetEl, step);
      tooltipEl.classList.add('visible');
      // Focus next button for accessibility
      nextBtn.focus();
    });

    // Auto-advance for welcome step
    if (step.autoAdvance) {
      autoAdvanceTimer = setTimeout(() => nextStep(), step.autoAdvance);
    }
  }

  // --- Next step ---
  function nextStep() {
    showStep(currentStep + 1);
  }

  // --- Complete onboarding ---
  function completeOnboarding() {
    localStorage.setItem(STORAGE_KEY, 'true');
    teardown();
  }

  // --- Teardown ---
  function teardown() {
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }
    isActive = false;

    // Remove spotlight class
    const spotlighted = document.querySelector('.ls-onboarding-spotlight-target');
    if (spotlighted) spotlighted.classList.remove('ls-onboarding-spotlight-target');

    // Animate out
    if (overlayEl) overlayEl.classList.remove('active');
    if (tooltipEl) tooltipEl.classList.remove('visible');

    setTimeout(() => {
      if (overlayEl) { overlayEl.remove(); overlayEl = null; }
      if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
    }, 400);

    // Restore focus
    if (previouslyFocused && previouslyFocused.focus) {
      previouslyFocused.focus();
    }

    // Remove event listeners
    document.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('resize', handleResize);
  }

  // --- Keyboard handler ---
  function handleKeydown(e) {
    if (!isActive) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      skipOnboarding();
      return;
    }

    // Focus trap within tooltip
    if (e.key === 'Tab' && tooltipEl) {
      const focusable = tooltipEl.querySelectorAll('button');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }

  // --- Resize handler ---
  let resizeDebounce = null;
  function handleResize() {
    if (!isActive) return;
    clearTimeout(resizeDebounce);
    resizeDebounce = setTimeout(() => {
      const step = TOUR_STEPS[currentStep];
      const targetEl = findTarget(step.target);
      positionSpotlight(targetEl);
      positionTooltip(targetEl, step);
    }, 100);
  }

  // --- Public: Render Onboarding ---
  function renderOnboarding() {
    if (isActive) return;
    isActive = true;
    previouslyFocused = document.activeElement;

    injectStyles();
    createOverlay();
    createTooltip();

    // Activate overlay
    requestAnimationFrame(() => {
      overlayEl.classList.add('active');
      showStep(0);
    });

    // Bind events
    document.addEventListener('keydown', handleKeydown);
    window.addEventListener('resize', handleResize);
  }

  // --- Public: Skip Onboarding ---
  function skipOnboarding() {
    localStorage.setItem(STORAGE_KEY, 'true');
    teardown();
  }

  // --- Public: Reset Onboarding ---
  function resetOnboarding() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // --- Self-initialize on DOMContentLoaded ---
  function init() {
    if (localStorage.getItem(STORAGE_KEY) === 'true') return;
    // Small delay to let the app render its elements
    setTimeout(() => renderOnboarding(), 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // --- Export to global scope and module ---
  if (typeof window !== 'undefined') {
    window.LogSherlockOnboarding = {
      renderOnboarding,
      skipOnboarding,
      resetOnboarding,
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { renderOnboarding, skipOnboarding, resetOnboarding };
  }
})();
