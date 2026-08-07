/**
 * LogSherlock Pro - Comparison Page
 * 'Why LogSherlock vs Alternatives' decision-helper page
 * Standalone, no external dependencies
 */

(function () {
  'use strict';

  // ─── Data ───────────────────────────────────────────────────────────────────

  const products = ['LogSherlock Pro', 'Splunk', 'Datadog', 'ELK Stack', 'Manual grep', 'ServiceNow'];

  const criteria = [
    { label: 'Setup Time', values: ['Instant', 'Days', 'Days', 'Hours', 'None', 'Days'], winner: 0 },
    { label: 'Data Privacy', values: ['Zero upload', 'Cloud stored', 'Cloud stored', 'Self-hosted', 'Local', 'Cloud'], winner: 0 },
    { label: 'Cost (Annual)', values: ['$588/user', '$50,000+', '$30,000+', 'Free (infra cost)', 'Free', '$100,000+'], winner: 0 },
    { label: 'Pattern Detection', values: ['455 built-in', 'Custom only', 'Custom only', 'Custom only', 'Manual', 'None'], winner: 0 },
    { label: 'RCA Report', values: ['Auto 8-section', 'Manual', 'Manual', 'Manual', 'Manual', 'Template'], winner: 0 },
    { label: 'Air-Gap Capable', values: ['Yes', 'No', 'No', 'Yes', 'Yes', 'No'], winner: 0 },
    { label: 'Knowledge Base', values: ['120 issues', 'None', 'None', 'None', 'None', 'Separate module'], winner: 0 },
    { label: 'Predictive Warnings', values: ['Yes', 'Paid add-on', 'Paid add-on', 'No', 'No', 'No'], winner: 0 },
    { label: 'Jira Integration', values: ['Built-in', 'Plugin', 'Plugin', 'Plugin', 'No', 'Built-in'], winner: 0 },
    { label: 'Learning Curve', values: ['5 minutes', 'Weeks', 'Weeks', 'Days', 'None', 'Weeks'], winner: 0 },
    { label: 'Works Offline', values: ['Yes', 'No', 'No', 'Yes', 'Yes', 'No'], winner: 0 },
    { label: 'Compliance Approval', values: ['0 days', 'Months', 'Months', 'Weeks', '0 days', 'Months'], winner: 0 },
  ];

  // LogSherlock wins in these rows (0-indexed): 0,1,3,4,6,7,8,9 plus 2(cost among paid),10(offline+privacy),11
  // Per spec: wins 10/12
  const winnerRows = [0, 1, 2, 3, 4, 6, 7, 8, 9, 11]; // 10 rows

  const booleanValues = { 'Yes': '✅', 'No': '❌' };

  // ─── Styles ─────────────────────────────────────────────────────────────────

  const STYLES = `
    .ls-comparison-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.85);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .ls-comparison-overlay.active {
      opacity: 1;
      visibility: visible;
    }
    .ls-comparison-modal {
      background: #1e1e2e;
      width: 95vw;
      height: 92vh;
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6);
      border: 1px solid #3a3a4e;
    }
    .ls-comparison-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 30px;
      border-bottom: 1px solid #3a3a4e;
      flex-shrink: 0;
    }
    .ls-comparison-header h1 {
      margin: 0;
      font-size: 1.5rem;
      color: #ffffff;
      font-weight: 700;
    }
    .ls-comparison-header h1 span {
      color: #01a982;
    }
    .ls-comparison-close-btn {
      background: #3a3a4e;
      border: none;
      color: #ccc;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      font-size: 1.4rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s, color 0.2s;
    }
    .ls-comparison-close-btn:hover {
      background: #e74c3c;
      color: #fff;
    }
    .ls-comparison-body {
      flex: 1;
      overflow-y: auto;
      overflow-x: auto;
      padding: 20px 30px 30px;
    }
    .ls-comparison-table-wrapper {
      overflow-x: auto;
      border-radius: 12px;
      border: 1px solid #3a3a4e;
    }
    .ls-comparison-table {
      width: 100%;
      min-width: 900px;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    .ls-comparison-table thead th {
      background: #2a2a3e;
      color: #ccc;
      padding: 14px 16px;
      text-align: center;
      font-weight: 600;
      border-bottom: 2px solid #3a3a4e;
      white-space: nowrap;
    }
    .ls-comparison-table thead th:first-child {
      text-align: left;
      min-width: 160px;
    }
    .ls-comparison-table thead th.ls-highlight-col {
      color: #01a982;
      border-left: 2px solid #01a982;
      border-right: 2px solid #01a982;
      border-top: 2px solid #01a982;
      background: rgba(1, 169, 130, 0.08);
      box-shadow: 0 0 15px rgba(1, 169, 130, 0.15);
    }
    .ls-comparison-table tbody tr {
      border-bottom: 1px solid #2f2f42;
      transition: background 0.15s;
    }
    .ls-comparison-table tbody tr:hover {
      background: rgba(255, 255, 255, 0.03);
    }
    .ls-comparison-table tbody td {
      padding: 13px 16px;
      text-align: center;
      color: #ddd;
      background: #1e1e2e;
    }
    .ls-comparison-table tbody td:first-child {
      text-align: left;
      font-weight: 600;
      color: #fff;
      background: #242438;
    }
    .ls-comparison-table tbody td.ls-highlight-col {
      border-left: 2px solid #01a982;
      border-right: 2px solid #01a982;
      background: rgba(1, 169, 130, 0.05);
    }
    .ls-comparison-table tbody tr:last-child td.ls-highlight-col {
      border-bottom: 2px solid #01a982;
    }
    .ls-winner-badge {
      display: inline-block;
      background: linear-gradient(135deg, #01a982, #00c9a7);
      color: #000;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      vertical-align: middle;
    }
    .ls-comparison-summary {
      margin-top: 30px;
      padding: 24px;
      background: linear-gradient(135deg, rgba(1, 169, 130, 0.1), rgba(1, 169, 130, 0.03));
      border: 1px solid rgba(1, 169, 130, 0.3);
      border-radius: 12px;
    }
    .ls-comparison-summary h2 {
      margin: 0 0 6px;
      font-size: 1.3rem;
      color: #01a982;
    }
    .ls-comparison-summary p {
      margin: 0;
      color: #aaa;
      font-size: 0.95rem;
    }
    .ls-usecases {
      margin-top: 24px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }
    .ls-usecase-card {
      background: #2a2a3e;
      border-radius: 10px;
      padding: 18px 20px;
      border: 1px solid #3a3a4e;
    }
    .ls-usecase-card h3 {
      margin: 0 0 8px;
      font-size: 0.95rem;
      color: #fff;
    }
    .ls-usecase-card h3.ls-green {
      color: #01a982;
    }
    .ls-usecase-card p {
      margin: 0;
      color: #aaa;
      font-size: 0.85rem;
      line-height: 1.5;
    }
    .ls-compare-nav-btn {
      background: linear-gradient(135deg, #01a982, #00c9a7);
      color: #000;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
      white-space: nowrap;
    }
    .ls-compare-nav-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 15px rgba(1, 169, 130, 0.4);
    }
    @media (max-width: 768px) {
      .ls-comparison-modal {
        width: 100vw;
        height: 100vh;
        border-radius: 0;
      }
      .ls-comparison-header {
        padding: 15px 20px;
      }
      .ls-comparison-body {
        padding: 15px;
      }
      .ls-comparison-header h1 {
        font-size: 1.1rem;
      }
    }
  `;

  // ─── Utility ────────────────────────────────────────────────────────────────

  function formatCellValue(value) {
    if (booleanValues[value] !== undefined) {
      return booleanValues[value];
    }
    return value;
  }

  function injectStyles() {
    if (document.getElementById('ls-comparison-styles')) return;
    const style = document.createElement('style');
    style.id = 'ls-comparison-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  function buildTableHTML() {
    let headerCells = '<th>Criteria</th>';
    products.forEach(function (product, idx) {
      const cls = idx === 0 ? ' class="ls-highlight-col"' : '';
      headerCells += '<th' + cls + '>' + product + '</th>';
    });

    let bodyRows = '';
    criteria.forEach(function (row, rowIdx) {
      let cells = '<td>' + row.label + '</td>';
      row.values.forEach(function (val, colIdx) {
        const cls = colIdx === 0 ? ' class="ls-highlight-col"' : '';
        let display = formatCellValue(val);
        if (colIdx === 0 && winnerRows.indexOf(rowIdx) !== -1) {
          display += '<span class="ls-winner-badge">Winner</span>';
        }
        cells += '<td' + cls + '>' + display + '</td>';
      });
      bodyRows += '<tr>' + cells + '</tr>';
    });

    return '<div class="ls-comparison-table-wrapper">' +
      '<table class="ls-comparison-table">' +
      '<thead><tr>' + headerCells + '</tr></thead>' +
      '<tbody>' + bodyRows + '</tbody>' +
      '</table></div>';
  }

  function buildSummaryHTML() {
    return '<div class="ls-comparison-summary">' +
      '<h2>🏆 LogSherlock Pro wins in 10/12 categories</h2>' +
      '<p>Purpose-built for HPE support engineers who need instant, private, offline-capable log analysis with zero setup.</p>' +
      '</div>';
  }

  function buildUseCasesHTML() {
    return '<div class="ls-usecases">' +
      '<div class="ls-usecase-card">' +
        '<h3 class="ls-green">✅ Choose LogSherlock if:</h3>' +
        '<p>HPE VME support, compliance-sensitive environments, need instant results without cloud uploads or lengthy setup.</p>' +
      '</div>' +
      '<div class="ls-usecase-card">' +
        '<h3>Choose Splunk if:</h3>' +
        '<p>Massive multi-TB log aggregation across hundreds of sources, existing Splunk investment and trained team.</p>' +
      '</div>' +
      '<div class="ls-usecase-card">' +
        '<h3>Choose ELK if:</h3>' +
        '<p>Full-text search across petabytes, dedicated engineering team available for setup and maintenance.</p>' +
      '</div>' +
    '</div>';
  }

  function buildModalHTML() {
    return '<div class="ls-comparison-overlay" id="ls-comparison-overlay">' +
      '<div class="ls-comparison-modal">' +
        '<div class="ls-comparison-header">' +
          '<h1>Why <span>LogSherlock Pro</span> vs Alternatives</h1>' +
          '<button class="ls-comparison-close-btn" id="ls-comparison-close-btn" title="Close (Esc)">✕</button>' +
        '</div>' +
        '<div class="ls-comparison-body">' +
          buildTableHTML() +
          buildSummaryHTML() +
          buildUseCasesHTML() +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ─── Modal Management ───────────────────────────────────────────────────────

  let modalInjected = false;

  function ensureModal() {
    if (modalInjected) return;
    injectStyles();
    const container = document.createElement('div');
    container.innerHTML = buildModalHTML();
    document.body.appendChild(container.firstElementChild);
    modalInjected = true;

    // Bind close button
    document.getElementById('ls-comparison-close-btn').addEventListener('click', closeComparisonPage);

    // Bind backdrop click
    document.getElementById('ls-comparison-overlay').addEventListener('click', function (e) {
      if (e.target === this) {
        closeComparisonPage();
      }
    });

    // Bind Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var overlay = document.getElementById('ls-comparison-overlay');
        if (overlay && overlay.classList.contains('active')) {
          closeComparisonPage();
        }
      }
    });
  }

  // ─── Exported Functions ─────────────────────────────────────────────────────

  /**
   * Returns HTML string for a 'Compare Tools' navigation button
   */
  function renderComparisonButton() {
    return '<button class="ls-compare-nav-btn" onclick="openComparisonPage()">⚖️ Compare Tools</button>';
  }

  /**
   * Opens the comparison page as a fullscreen modal
   */
  function openComparisonPage() {
    ensureModal();
    var overlay = document.getElementById('ls-comparison-overlay');
    if (overlay) {
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  /**
   * Closes the comparison page modal
   */
  function closeComparisonPage() {
    var overlay = document.getElementById('ls-comparison-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // ─── Expose globally and as module exports ──────────────────────────────────

  // Global scope (for onclick and direct usage)
  window.renderComparisonButton = renderComparisonButton;
  window.openComparisonPage = openComparisonPage;
  window.closeComparisonPage = closeComparisonPage;

  // CommonJS/module export support
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      renderComparisonButton: renderComparisonButton,
      openComparisonPage: openComparisonPage,
      closeComparisonPage: closeComparisonPage
    };
  }

  // ─── Self-initialize on DOMContentLoaded ────────────────────────────────────

  function init() {
    injectStyles();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
