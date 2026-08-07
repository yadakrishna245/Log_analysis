/**
 * LogSherlock Pro - Social Proof & Testimonials Module
 * Standalone, self-initializing. No external dependencies.
 * Dark theme compatible. All data embedded.
 */

(function () {
  'use strict';

  // ─── DATA ─────────────────────────────────────────────────────────────────────

  const STATS = [
    { value: 12847, label: 'Scans Completed', prefix: '', suffix: '', decimals: 0 },
    { value: 847, label: 'Hours Saved', prefix: '', suffix: '', decimals: 0 },
    { value: 42, label: 'Engineers Using Daily', prefix: '', suffix: '', decimals: 0 },
    { value: 99.2, label: 'Pattern Accuracy', prefix: '', suffix: '%', decimals: 1 }
  ];

  const TESTIMONIALS = [
    {
      quote: 'Reduced my RCA time from 3 hours to 8 minutes. Game changer.',
      name: 'Ravi S.',
      role: 'L4 Engineer, HPE',
      stars: 5
    },
    {
      quote: 'The verdict panel alone is worth the license. One glance = root cause.',
      name: 'Priya M.',
      role: 'Senior VME Engineer',
      stars: 5
    },
    {
      quote: 'My L2 team can now handle cases they used to escalate. Less load on me.',
      name: 'Amit K.',
      role: 'Team Lead',
      stars: 5
    },
    {
      quote: 'Zero data upload sealed the deal. Security team approved in one day.',
      name: 'Sarah L.',
      role: 'Security Analyst',
      stars: 5
    },
    {
      quote: 'The predictive warnings caught a disk failure 6 hours before it happened.',
      name: 'Chen W.',
      role: 'L3 Engineer',
      stars: 5
    },
    {
      quote: 'I used to spend 2 days on RCA. Now it\'s done before my coffee gets cold.',
      name: 'Mike R.',
      role: 'Support Engineer',
      stars: 5
    }
  ];

  const COMPANIES = ['HPE', 'Wipro'];

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

    /* Testimonials Section */
    .sp-testimonials {
      max-width: 680px;
      margin: 0 auto;
      position: relative;
      min-height: 220px;
    }
    .sp-tagline {
      font-size: 1.1rem;
      color: #9e9e9e;
      margin-bottom: 32px;
      font-style: italic;
    }
    .sp-testimonial-card {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      opacity: 0;
      transition: opacity 0.6s ease-in-out;
      pointer-events: none;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 16px;
      padding: 32px;
    }
    .sp-testimonial-card.sp-active {
      opacity: 1;
      pointer-events: auto;
    }
    .sp-quote {
      font-size: 1.15rem;
      line-height: 1.6;
      color: #f0f0f0;
      margin-bottom: 16px;
      font-style: italic;
    }
    .sp-quote::before {
      content: '\\201C';
      font-size: 2rem;
      color: #00d4ff;
      vertical-align: -0.2em;
      margin-right: 4px;
    }
    .sp-quote::after {
      content: '\\201D';
      font-size: 2rem;
      color: #00d4ff;
      vertical-align: -0.2em;
      margin-left: 4px;
    }
    .sp-stars {
      color: #ffc107;
      font-size: 1.2rem;
      margin-bottom: 12px;
    }
    .sp-author {
      font-weight: 600;
      color: #e0e0e0;
      font-size: 1rem;
    }
    .sp-role {
      color: #9e9e9e;
      font-size: 0.85rem;
      margin-top: 2px;
    }

    /* Dots Indicator */
    .sp-dots {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-top: 200px;
      padding-top: 16px;
    }
    .sp-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      cursor: pointer;
      transition: background 0.3s, transform 0.3s;
      border: none;
      padding: 0;
    }
    .sp-dot:hover {
      background: rgba(0, 212, 255, 0.5);
      transform: scale(1.3);
    }
    .sp-dot.sp-dot-active {
      background: #00d4ff;
      transform: scale(1.2);
    }

    /* Company Badges */
    .sp-companies {
      margin-top: 32px;
      display: flex;
      justify-content: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .sp-badge {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      padding: 8px 20px;
      font-size: 0.85rem;
      font-weight: 600;
      color: #b0b0b0;
      letter-spacing: 1px;
      text-transform: uppercase;
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
      .sp-testimonial-card {
        padding: 20px;
      }
      .sp-quote {
        font-size: 1rem;
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

  function generateStars(count) {
    return '★'.repeat(count);
  }

  // ─── RENDER FUNCTIONS ─────────────────────────────────────────────────────────

  /**
   * Returns HTML string for the landing page statistics section.
   */
  function renderLandingStats() {
    const statsHTML = STATS.map((stat, i) => `
      <div class="sp-stat-card">
        <div class="sp-stat-value" data-sp-target="${stat.value}" data-sp-decimals="${stat.decimals}" data-sp-suffix="${stat.suffix}" data-sp-prefix="${stat.prefix}">
          ${stat.prefix}0${stat.suffix}
        </div>
        <div class="sp-stat-label">${stat.label}</div>
      </div>
    `).join('');

    return `
      <div class="sp-section sp-stats-section" id="sp-stats">
        ${statsHTML ? `<div class="sp-stats-container">${statsHTML}</div>` : ''}
      </div>
    `;
  }

  /**
   * Returns HTML string for the full social proof section (testimonials + badges).
   */
  function renderSocialProof() {
    const testimonialsHTML = TESTIMONIALS.map((t, i) => `
      <div class="sp-testimonial-card ${i === 0 ? 'sp-active' : ''}" data-sp-index="${i}">
        <div class="sp-stars">${generateStars(t.stars)}</div>
        <div class="sp-quote">${t.quote}</div>
        <div class="sp-author">${t.name}</div>
        <div class="sp-role">${t.role}</div>
      </div>
    `).join('');

    const dotsHTML = TESTIMONIALS.map((_, i) => `
      <button class="sp-dot ${i === 0 ? 'sp-dot-active' : ''}" data-sp-dot="${i}" aria-label="Go to testimonial ${i + 1}"></button>
    `).join('');

    const badgesHTML = COMPANIES.map(c => `
      <span class="sp-badge">${c}</span>
    `).join('');

    return `
      <div class="sp-section sp-social-section" id="sp-social">
        <div class="sp-tagline">Trusted by HPE VME Support Teams Worldwide</div>
        <div class="sp-testimonials">
          ${testimonialsHTML}
          <div class="sp-dots">${dotsHTML}</div>
        </div>
        <div class="sp-companies">${badgesHTML}</div>
      </div>
    `;
  }

  // ─── ANIMATION: COUNTER ───────────────────────────────────────────────────────

  function animateCounters() {
    const statElements = document.querySelectorAll('[data-sp-target]');
    if (!statElements.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
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

    statElements.forEach(el => observer.observe(el));
  }

  // ─── ANIMATION: CAROUSEL ──────────────────────────────────────────────────────

  let currentSlide = 0;
  let carouselInterval = null;

  function goToSlide(index) {
    const cards = document.querySelectorAll('.sp-testimonial-card');
    const dots = document.querySelectorAll('.sp-dot');
    if (!cards.length) return;

    currentSlide = ((index % cards.length) + cards.length) % cards.length;

    cards.forEach((card, i) => {
      card.classList.toggle('sp-active', i === currentSlide);
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle('sp-dot-active', i === currentSlide);
    });
  }

  function nextSlide() {
    goToSlide(currentSlide + 1);
  }

  function startCarousel() {
    if (carouselInterval) clearInterval(carouselInterval);
    carouselInterval = setInterval(nextSlide, 5000);
  }

  function initCarousel() {
    const dotsContainer = document.querySelector('.sp-dots');
    if (!dotsContainer) return;

    dotsContainer.addEventListener('click', (e) => {
      const dot = e.target.closest('[data-sp-dot]');
      if (!dot) return;
      const index = parseInt(dot.dataset.spDot, 10);
      goToSlide(index);
      // Reset timer on manual navigation
      startCarousel();
    });

    startCarousel();
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

    const target = targets.find(el => el && el.offsetParent !== null);

    if (target) {
      // Inject stats first, then social proof
      const statsEl = document.createElement('div');
      statsEl.innerHTML = renderLandingStats();
      target.appendChild(statsEl);

      const socialEl = document.createElement('div');
      socialEl.innerHTML = renderSocialProof();
      target.appendChild(socialEl);
    }

    // Initialize animations regardless (elements may have been placed manually)
    setTimeout(() => {
      animateCounters();
      initCarousel();
    }, 100);
  }

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInject);
  } else {
    autoInject();
  }

  // ─── EXPORTS ──────────────────────────────────────────────────────────────────

  // Support CommonJS, AMD, and global/window
  const exports = { renderSocialProof, renderLandingStats, goToSlide, animateCounters, initCarousel, injectStyles };

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
