/**
 * LogSherlock Pro - Health Score Module
 * Calculates a system health score (0-100) from scan findings.
 */

/**
 * Calculate health score from an array of findings.
 * @param {Array} findings - Array of finding objects with a `severity` property.
 * @returns {{score: number, grade: string, color: string, summary: string}}
 */
function calculateHealthScore(findings) {
  const deductions = {
    CRITICAL: 15,
    HIGH: 8,
    MEDIUM: 3,
    LOW: 1
  };

  let totalDeduction = 0;

  if (Array.isArray(findings)) {
    for (const finding of findings) {
      const severity = (finding.severity || '').toUpperCase();
      if (deductions[severity] !== undefined) {
        totalDeduction += deductions[severity];
      }
    }
  }

  const score = Math.max(0, 100 - totalDeduction);

  let grade, color, summary;

  if (score >= 90) {
    grade = 'A';
    color = '#00e676';
    summary = 'System is healthy';
  } else if (score >= 70) {
    grade = 'B';
    color = '#ffea00';
    summary = 'Minor issues detected';
  } else if (score >= 50) {
    grade = 'C';
    color = '#ff9100';
    summary = 'Significant problems';
  } else if (score >= 25) {
    grade = 'D';
    color = '#ff1744';
    summary = 'Critical state';
  } else {
    grade = 'F';
    color = '#8b0000';
    summary = 'System failure';
  }

  return { score, grade, color, summary };
}

/**
 * Render a beautiful HTML circular gauge for the health score.
 * @param {Array} findings - Array of finding objects with a `severity` property.
 * @returns {string} HTML string
 */
function renderHealthScore(findings) {
  const result = calculateHealthScore(findings);
  const { score, grade, color, summary } = result;

  // Count severities
  let critical = 0, high = 0, medium = 0, low = 0;
  if (Array.isArray(findings)) {
    for (const finding of findings) {
      const severity = (finding.severity || '').toUpperCase();
      if (severity === 'CRITICAL') critical++;
      else if (severity === 'HIGH') high++;
      else if (severity === 'MEDIUM') medium++;
      else if (severity === 'LOW') low++;
    }
  }

  const percentage = score / 100;
  const degrees = percentage * 360;

  return `
<div class="health-score-widget" style="
  background: #0c0c0f;
  color: #fafafa;
  border-radius: 16px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  font-family: 'Inter', 'Segoe UI', sans-serif;
  box-shadow: 0 0 30px ${color}22, 0 4px 24px rgba(0,0,0,0.5);
  border: 1px solid ${color}33;
  max-width: 340px;
  margin: 0 auto;
">
  <!-- Circular Gauge -->
  <div style="
    position: relative;
    width: 180px;
    height: 180px;
    border-radius: 50%;
    background: conic-gradient(${color} 0deg, ${color} ${degrees}deg, #1a1a2e ${degrees}deg, #1a1a2e 360deg);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 20px ${color}44;
    animation: healthPulse 2s ease-in-out infinite alternate;
  ">
    <div style="
      width: 140px;
      height: 140px;
      border-radius: 50%;
      background: #0c0c0f;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    ">
      <span style="
        font-size: 48px;
        font-weight: 800;
        color: ${color};
        line-height: 1;
        letter-spacing: -2px;
      ">${grade}</span>
      <span style="
        font-size: 22px;
        font-weight: 600;
        color: #fafafa;
        margin-top: 4px;
      ">${score}/100</span>
    </div>
  </div>

  <!-- Summary -->
  <div style="
    text-align: center;
  ">
    <div style="
      font-size: 18px;
      font-weight: 600;
      color: ${color};
      margin-bottom: 4px;
    ">${summary}</div>
    <div style="
      font-size: 13px;
      color: #aaaaaa;
    ">Health Score Assessment</div>
  </div>

  <!-- Breakdown -->
  <div style="
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
  ">
    ${critical > 0 ? `<span style="
      background: #ff174422;
      color: #ff1744;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
    ">${critical} Critical</span>` : ''}
    ${high > 0 ? `<span style="
      background: #ff910022;
      color: #ff9100;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
    ">${high} High</span>` : ''}
    ${medium > 0 ? `<span style="
      background: #ffea0022;
      color: #ffea00;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
    ">${medium} Medium</span>` : ''}
    ${low > 0 ? `<span style="
      background: #00e67622;
      color: #00e676;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
    ">${low} Low</span>` : ''}
    ${(critical + high + medium + low) === 0 ? `<span style="
      background: #00e67622;
      color: #00e676;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
    ">No issues found</span>` : ''}
  </div>

  <style>
    @keyframes healthPulse {
      0% { box-shadow: 0 0 20px ${color}44; }
      100% { box-shadow: 0 0 35px ${color}66; }
    }
  </style>
</div>`;
}

// Expose on window for browser usage
if (typeof window !== 'undefined') {
  window.renderHealthScore = renderHealthScore;
  window.calculateHealthScore = calculateHealthScore;
}

// Export for Node.js/module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calculateHealthScore, renderHealthScore };
}
