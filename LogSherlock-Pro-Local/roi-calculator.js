/**
 * ROI Calculator — LogSherlock Pro
 * Calculates and displays time/money savings from automated log analysis.
 */

(function () {
  'use strict';

  const DEFAULTS = {
    hourlyRate: 150,          // CONFIGURABLE ESTIMATE — adjust to your team's rate
    timeSavedPerScan: 2.5,    // CONFIGURABLE ESTIMATE — average time without tool per ticket
    resolutionRate: 0.80,     // CONFIGURABLE ESTIMATE — fraction of scans that reduce MTTR
    monthlyCost: 299          // CONFIGURABLE ESTIMATE — your subscription tier
  };

  /**
   * calculateROI - Reads localStorage scan history and computes savings.
   * @param {object} [options] - Optional overrides
   * @param {number} [options.hourlyRate] - Engineer hourly rate (default $150)
   * @param {number} [options.timeSavedPerScan] - Hours saved per scan (default 2.5)
   * @param {number} [options.resolutionRate] - Fraction of scans that accelerate tickets (default 0.80)
   * @param {number} [options.monthlyCost] - Monthly tool cost (default $299)
   * @returns {object} ROI metrics or null if no history
   */
  function calculateROI(options) {
    var config = Object.assign({}, DEFAULTS, options || {});

    var historyRaw = null;
    try {
      historyRaw = localStorage.getItem('ls_history');
    } catch (e) {
      // localStorage unavailable (SSR or restricted context)
      return null;
    }

    if (!historyRaw) {
      return null;
    }

    var history;
    try {
      history = JSON.parse(historyRaw);
    } catch (e) {
      return null;
    }

    if (!Array.isArray(history) || history.length === 0) {
      return null;
    }

    var totalScans = history.length;
    var totalHoursSaved = totalScans * config.timeSavedPerScan;
    var totalMoneySaved = totalHoursSaved * config.hourlyRate;
    var ticketsAccelerated = Math.round(totalScans * config.resolutionRate);

    // Net ROI: (saved - cost) / cost × 100%
    var netROI = config.monthlyCost > 0
      ? ((totalMoneySaved - config.monthlyCost) / config.monthlyCost) * 100
      : 0;

    // First scan date
    var firstScanDate = null;
    for (var i = 0; i < history.length; i++) {
      var entry = history[i];
      var ts = entry.timestamp || entry.date || entry.time || null;
      if (ts) {
        var d = new Date(ts);
        if (!firstScanDate || d < firstScanDate) {
          firstScanDate = d;
        }
      }
    }
    if (!firstScanDate) {
      firstScanDate = new Date();
    }

    // Monthly projection (scans per month extrapolation)
    var daysSinceFirst = Math.max(1, Math.ceil((Date.now() - firstScanDate.getTime()) / (1000 * 60 * 60 * 24)));
    var scansPerDay = totalScans / daysSinceFirst;
    var projectedMonthlyScans = Math.round(scansPerDay * 30);
    var projectedMonthlyHours = projectedMonthlyScans * config.timeSavedPerScan;
    var projectedMonthlySavings = projectedMonthlyHours * config.hourlyRate;

    return {
      totalScans: totalScans,
      totalHoursSaved: totalHoursSaved,
      totalMoneySaved: totalMoneySaved,
      ticketsAccelerated: ticketsAccelerated,
      netROI: netROI,
      firstScanDate: firstScanDate,
      monthlyCost: config.monthlyCost,
      hourlyRate: config.hourlyRate,
      projection: {
        scansPerMonth: projectedMonthlyScans,
        hoursSavedPerMonth: projectedMonthlyHours,
        moneySavedPerMonth: projectedMonthlySavings
      }
    };
  }

  /**
   * renderROIPanel - Returns an HTML string for the ROI dashboard panel.
   * @param {object} [options] - Optional config overrides passed to calculateROI
   * @returns {string} HTML string
   */
  function renderROIPanel(options) {
    var roi = calculateROI(options);

    // Styles (dark theme, gradient cards, green savings)
    var styles = ''
      + '<style>'
      + '.roi-panel { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f1419; border-radius: 16px; padding: 32px; max-width: 800px; margin: 0 auto; color: #e1e8ed; }'
      + '.roi-panel h2 { text-align: center; font-size: 1.6rem; margin-bottom: 28px; color: #fff; }'
      + '.roi-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 16px; margin-bottom: 24px; }'
      + '.roi-card { background: linear-gradient(135deg, #1a2332 0%, #0d1b2a 100%); border: 1px solid #1e3a5f; border-radius: 12px; padding: 20px; text-align: center; transition: transform 0.2s; }'
      + '.roi-card:hover { transform: translateY(-2px); }'
      + '.roi-card .roi-icon { font-size: 1.8rem; margin-bottom: 8px; }'
      + '.roi-card .roi-value { font-size: 2rem; font-weight: 700; color: #00e676; animation: countUp 1.5s ease-out forwards; }'
      + '.roi-card .roi-label { font-size: 0.85rem; color: #8899a6; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; }'
      + '.roi-projection { background: linear-gradient(135deg, #1b3a26 0%, #0f2318 100%); border: 1px solid #2e7d50; border-radius: 12px; padding: 20px; margin-bottom: 20px; text-align: center; }'
      + '.roi-projection h3 { color: #69f0ae; margin-bottom: 10px; font-size: 1.1rem; }'
      + '.roi-projection p { color: #b2dfdb; margin: 4px 0; font-size: 0.95rem; }'
      + '.roi-compare { background: #151f2b; border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 16px; border: 1px solid #263545; }'
      + '.roi-compare .slow { color: #ff5252; font-weight: 600; }'
      + '.roi-compare .fast { color: #00e676; font-weight: 600; }'
      + '.roi-footer { text-align: center; color: #657786; font-size: 0.82rem; margin-top: 16px; }'
      + '.roi-empty { text-align: center; padding: 60px 20px; color: #8899a6; font-size: 1.1rem; }'
      + '.roi-empty .roi-empty-icon { font-size: 3rem; margin-bottom: 16px; }'
      + '@keyframes countUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }'
      + '</style>';

    // No history state
    if (!roi) {
      return styles
        + '<div class="roi-panel">'
        + '  <h2>\uD83D\uDCCA ROI Calculator \u2014 Your Savings</h2>'
        + '  <div class="roi-empty">'
        + '    <div class="roi-empty-icon">\uD83D\uDD0D</div>'
        + '    <p>Start scanning logs to track your usage. ROI estimates use configurable assumptions.</p>'
        + '  </div>'
        + '</div>';
    }

    var formattedMoney = formatCurrency(roi.totalMoneySaved);
    var formattedROI = roi.netROI.toFixed(0);
    var formattedDate = roi.firstScanDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    var projectedMonthlySavings = formatCurrency(roi.projection.moneySavedPerMonth);

    var html = styles
      + '<div class="roi-panel">'
      + '  <h2>\uD83D\uDCCA ROI Calculator \u2014 Your Savings</h2>'
      + '  <div class="roi-cards">'
      + '    <div class="roi-card">'
      + '      <div class="roi-icon">\u23F1\uFE0F</div>'
      + '      <div class="roi-value">' + roi.totalHoursSaved.toFixed(1) + ' hrs</div>'
      + '      <div class="roi-label">Hours Saved</div>'
      + '    </div>'
      + '    <div class="roi-card">'
      + '      <div class="roi-icon">\uD83D\uDCB0</div>'
      + '      <div class="roi-value">' + formattedMoney + '</div>'
      + '      <div class="roi-label">Money Saved</div>'
      + '    </div>'
      + '    <div class="roi-card">'
      + '      <div class="roi-icon">\uD83C\uDFAB</div>'
      + '      <div class="roi-value">' + roi.ticketsAccelerated + '</div>'
      + '      <div class="roi-label">Tickets Accelerated</div>'
      + '    </div>'
      + '    <div class="roi-card">'
      + '      <div class="roi-icon">\uD83D\uDCC8</div>'
      + '      <div class="roi-value">' + formattedROI + '%</div>'
      + '      <div class="roi-label">ROI</div>'
      + '    </div>'
      + '  </div>'
      + '  <div class="roi-projection">'
      + '    <h3>\uD83D\uDE80 Monthly Projection</h3>'
      + '    <p>\uD83D\uDCC5 ~' + roi.projection.scansPerMonth + ' scans/month</p>'
      + '    <p>\u23F0 ~' + roi.projection.hoursSavedPerMonth.toFixed(1) + ' hours saved/month</p>'
      + '    <p>\uD83D\uDCB5 ~' + projectedMonthlySavings + ' saved/month</p>'
      + '    <p>\uD83D\uDCB3 Tool cost: $' + roi.monthlyCost + '/month \u2014 <span style="color:#00e676;font-weight:600;">Net positive!</span></p>'
      + '  </div>'
      + '  <div class="roi-compare">'
      + '    <span class="slow">Without tool: ~2.5 hrs (estimated avg)</span>'
      + '    &nbsp; | &nbsp;'
      + '    <span class="fast">With LogSherlock: &lt;10 seconds</span>'
      + '  </div>'
      + '  <div class="roi-footer">'
      + '    Based on ' + roi.totalScans + ' actual scans since ' + formattedDate + ' · Time/cost estimates are configurable assumptions, not measurements'
      + '  </div>'
      + '</div>';

    return html;
  }

  /**
   * Format a number as USD currency string.
   * @param {number} amount
   * @returns {string}
   */
  function formatCurrency(amount) {
    if (amount >= 1000000) {
      return '$' + (amount / 1000000).toFixed(1) + 'M';
    }
    if (amount >= 1000) {
      return '$' + amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    return '$' + amount.toFixed(0);
  }

  // Expose globally
  window.calculateROI = calculateROI;
  window.renderROIPanel = renderROIPanel;

})();
