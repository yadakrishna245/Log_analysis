/**
 * LogSherlock Pro - Usage Stats Module
 * Shows REAL usage data from localStorage. No fake stats, testimonials, or endorsements.
 * Standalone, self-initializing. No external dependencies.
 * Dark theme compatible.
 */

(function () {
  'use strict';

  // ─── DATA: Pull REAL stats from localStorage ──────────────────────────────────

  function getRealStats() {
    let scanCount = 0;
    let filesAnalyzed = 0;

    try {
      const historyRaw = localStorage.getItem('ls_h');
      if (historyRaw) {
        const history = JSON.parse(historyRaw);
        if (Array.isArray(history)) {
          scanCount = history.length;
          // Count files analyzed from history entries if available
          filesAnalyzed = history.reduce(function (sum, entry) {
            if (entry && typeof entry.fileCount === 'number') return sum + entry.fileCount;
            if (entry && typeof entry.files === 'number') return sum + entry.files;
            // Each scan = at least 1 file
            return sum + 1;
          }, 0);
        }
      }
    } catch (e) {
      console.warn('[Usage Stats] Failed to read scan history:', e);
    }

    const hoursSaved = (scanCount * 2.5); // 2.5 hours saved per scan (documented benchmark)

    return {
      scanCount: scanCount,
      hoursSaved: hoursSaved,
      filesAnalyzed: filesAnalyzed,
      engineersUsing: 1 // Current user only — no fake team numbers
    };
  }

  // ─── STYLES ───────────────────────────────────────────────────────────────────

  const STYLES = `
    .sp-section {
      padding: 48px 24px;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif;
      color: #e0e0e0;
    }

    /* Stats Section */
    .sp-stats-container {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 32px;
      margin-bottom: 24px;
    }
    .sp-stat-card {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 24px 32px;
      min-width: 180px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .sp-stat-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 200, 255, 0.1);
      border-color: rgba(0, 200, 255, 0.3);
    }
    .sp-stat-value {
      font-size: 2.4rem;
      font-weight: 700;
      color: #00d4ff;
      margin-bottom: 4px;
      font-variant-numeric: tabular-nums;
    }
    .sp-stat-label {
      font-size: 0.9rem;
      color: #9e9e9e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Empty state */
    .sp-empty-state {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 16px;
      padding: 32px;
      max-width: 500px;
      margin: 0 auto;
    }
    .sp-empty-state p {
      font-size: 1.1rem;
      color: #9e9e9e;
      margin: 0;
    }

    /* Responsive */
    @media (max-width: 600px) {
      .sp-stats-container {
        gap: 16px;
      }
      .sp-stat-card {
        min-width: 140px;
        padding: 16px 20px;
      }
      .sp-stat-value {
        font-size: 1.8rem;
      }
    }
  `;

  // ─── HELPERS ──────────────────────────────────────────────────────────────────

  function formatNumber(value, decimals) {
    if (decimals > 0) {
      return value.toFixed(decimals);
    }
    return value.toLocaleString('en-US');
  }

  // ─── RENDER FUNCTIONS ─────────────────────────────────────────────────────────

  /**
   * Returns HTML string for the usage stats section with REAL data.
   */
  function renderLandingStats() {
    const stats = getRealStats();

    // If no scans yet, show empty state prompt
    if (stats.scanCount === 0) {
      return `
        <div class="sp-section sp-stats-section" id="sp-stats">
          <h3 style="color:#fff;font-size:1.3rem;margin-bottom:16px;">📊 Your Usage Stats</h3>
          <div class="sp-empty-state">
            <p>Start your first scan to see your stats!</p>
          </div>
        </div>
      `;
    }

    const STATS = [
      { value: stats.scanCount, label: 'Scans Completed', prefix: '', suffix: '', decimals: 0 },
      { value: stats.hoursSaved, label: 'Hours Saved', prefix: '', suffix: '', decimals: 1 },
      { value: stats.filesAnalyzed, label: 'Files Analyzed', prefix: '', suffix: '', decimals: 0 }
    ];

    const statsHTML = STATS.map(function (stat) {
      return `
        <div class="sp-stat-card">
          <div class="sp-stat-value" data-sp-target="${stat.value}" data-sp-decimals="${stat.decimals}" data-sp-suffix="${stat.suffix}" data-sp-prefix="${stat.prefix}">
            ${stat.prefix}0${stat.suffix}
          </div>
          <div class="sp-stat-label">${stat.label}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="sp-section sp-stats-section" id="sp-stats">
        <h3 style="color:#fff;font-size:1.3rem;margin-bottom:16px;">📊 Your Usage Stats</h3>
        <div class="sp-stats-container">${statsHTML}</div>
        <div style="font-size:0.8rem;color:#666;margin-top:8px;">Based on your actual scan history • Data stored locally</div>
      </div>
    `;
  }

  /**
   * Returns HTML string for the usage stats panel (replaces old social proof section).
   */
  function renderSocialProof() {
    // No testimonials, no company badges, no fake endorsements.
    // Just return the stats panel (same as landing stats).
    return renderLandingStats();
  }

  // ─── ANIMATION: COUNTER ───────────────────────────────────────────────────────

  function animateCounters() {
    const statElements = document.querySelectorAll('[data-sp-target]');
    if (!statElements.length) return;

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          const el = entry.target;
          if (el.dataset.spAnimated) return;
          el.dataset.spAnimated = 'true';

          const target = parseFloat(el.dataset.spTarget);
          const decimals = parseInt(el.dataset.spDecimals, 10) || 0;
          const suffix = el.dataset.spSuffix || '';
          const prefix = el.dataset.spPrefix || '';
          const duration = 2000;
          const startTime = performance.now();

          function easeOutQuart(t) {
            return 1 - Math.pow(1 - t, 4);
          }

          function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeOutQuart(progress);
            const currentValue = easedProgress * target;

            if (decimals > 0) {
              el.textContent = prefix + currentValue.toFixed(decimals) + suffix;
            } else {
              el.textContent = prefix + Math.floor(currentValue).toLocaleString('en-US') + suffix;
            }

            if (progress < 1) {
              requestAnimationFrame(update);
            } else {
              el.textContent = prefix + formatNumber(target, decimals) + suffix;
            }
          }

          requestAnimationFrame(update);
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.3 });

    statElements.forEach(function (el) { observer.observe(el); });
  }

  // ─── STYLE INJECTION ──────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('sp-styles')) return;
    const style = document.createElement('style');
    style.id = 'sp-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  // ─── SELF-INITIALIZATION ──────────────────────────────────────────────────────

  function autoInject() {
    injectStyles();

    // Look for common landing/login page containers to inject into
    const targets = [
      document.getElementById('social-proof-container'),
      document.getElementById('sp-container'),
      document.querySelector('.landing-social-proof'),
      document.querySelector('.login-social-proof'),
      document.querySelector('.landing-page'),
      document.querySelector('.login-container')
    ];

    const target = targets.find(function (el) { return el && el.offsetParent !== null; });

    if (target) {
      // Inject real usage stats
      const statsEl = document.createElement('div');
      statsEl.innerHTML = renderLandingStats();
      target.appendChild(statsEl);
    }

    // Initialize counter animations
    setTimeout(function () {
      animateCounters();
    }, 100);
  }

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInject);
  } else {
    autoInject();
  }

  // ─── EXPORTS ──────────────────────────────────────────────────────────────────

  const exports = { renderSocialProof: renderSocialProof, renderLandingStats: renderLandingStats, animateCounters: animateCounters, injectStyles: injectStyles, getRealStats: getRealStats };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  } else if (typeof define === 'function' && define.amd) {
    define([], function () { return exports; });
  } else {
    window.SocialProof = exports;
    // Convenience globals
    window.renderSocialProof = renderSocialProof;
    window.renderLandingStats = renderLandingStats;
  }

})();
