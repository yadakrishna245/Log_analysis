/**
 * LogSherlock Pro - Usage Reports Module
 * Generates monthly PDF-style reports showing tool usage, value delivered, and ROI.
 * Standalone - uses window.print() with @media print CSS for PDF generation.
 */

(function () {
  'use strict';

  // ─── Constants ───────────────────────────────────────────────────────────────
  const HISTORY_KEY = 'logsherlock_history';
  const AUDIT_KEY = 'logsherlock_audit_log';
  const HOURS_PER_SCAN = 2.5;
  const COST_PER_HOUR = 150;
  const MODAL_ID = 'logsherlock-usage-report-modal';

  // ─── Utility Functions ───────────────────────────────────────────────────────

  function getMonthYear(date) {
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }

  function getLastMonth(date) {
    const d = new Date(date);
    d.setMonth(d.getMonth() - 1);
    return d;
  }

  function isCurrentMonth(timestamp) {
    const now = new Date();
    const d = new Date(timestamp);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }

  function isLastMonth(timestamp) {
    const last = getLastMonth(new Date());
    const d = new Date(timestamp);
    return d.getMonth() === last.getMonth() && d.getFullYear() === last.getFullYear();
  }

  function loadFromStorage(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.warn(`[UsageReports] Failed to load ${key}:`, e);
      return null;
    }
  }

  function getSampleData() {
    const now = new Date();
    const entries = [];
    for (let i = 0; i < 45; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - Math.floor(Math.random() * 60));
      d.setHours(Math.floor(Math.random() * 24));
      const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      const patterns = [
        'NullPointerException', 'OutOfMemoryError', 'ConnectionTimeout',
        'DiskSpaceLow', 'HighCPUUsage', 'AuthenticationFailure',
        'SSLCertExpiry', 'DatabaseDeadlock', 'MemoryLeak', 'PermissionDenied',
        'ServiceUnavailable', 'RateLimitExceeded'
      ];
      const findings = [];
      const findingCount = Math.floor(Math.random() * 8) + 1;
      for (let f = 0; f < findingCount; f++) {
        findings.push({
          pattern: patterns[Math.floor(Math.random() * patterns.length)],
          severity: severities[Math.floor(Math.random() * severities.length)],
        });
      }
      entries.push({
        timestamp: d.toISOString(),
        filesAnalyzed: Math.floor(Math.random() * 20) + 1,
        findings: findings,
        scanDuration: Math.floor(Math.random() * 30) + 5,
      });
    }
    return entries;
  }

  function gatherReportData() {
    let history = loadFromStorage(HISTORY_KEY);
    let auditLog = loadFromStorage(AUDIT_KEY);
    let usingSample = false;

    if (!history || history.length === 0) {
      history = getSampleData();
      usingSample = true;
    }

    const now = new Date();
    const currentMonthEntries = history.filter(e => isCurrentMonth(e.timestamp));
    const lastMonthEntries = history.filter(e => isLastMonth(e.timestamp));

    // Basic metrics
    const totalScans = currentMonthEntries.length;
    const filesAnalyzed = currentMonthEntries.reduce((sum, e) => sum + (e.filesAnalyzed || 1), 0);
    const allFindings = currentMonthEntries.flatMap(e => e.findings || []);
    const findingsDetected = allFindings.length;

    // Hours saved
    const hoursSaved = totalScans * HOURS_PER_SCAN;
    const dollarsSaved = hoursSaved * COST_PER_HOUR;

    // Scans per day
    const scansPerDay = {};
    currentMonthEntries.forEach(e => {
      const day = new Date(e.timestamp).getDate();
      scansPerDay[day] = (scansPerDay[day] || 0) + 1;
    });

    // Peak usage hours
    const hourCounts = {};
    currentMonthEntries.forEach(e => {
      const hr = new Date(e.timestamp).getHours();
      hourCounts[hr] = (hourCounts[hr] || 0) + 1;
    });
    const peakHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hr]) => `${hr}:00`);

    // Most active days
    const dayCounts = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    currentMonthEntries.forEach(e => {
      const dayIdx = new Date(e.timestamp).getDay();
      dayCounts[dayNames[dayIdx]] = (dayCounts[dayNames[dayIdx]] || 0) + 1;
    });
    const mostActiveDays = Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([day]) => day);

    // Top patterns
    const patternCounts = {};
    allFindings.forEach(f => {
      const p = f.pattern || 'Unknown';
      patternCounts[p] = (patternCounts[p] || 0) + 1;
    });
    const topPatterns = Object.entries(patternCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Severity breakdown
    const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    allFindings.forEach(f => {
      const s = (f.severity || 'LOW').toUpperCase();
      if (severityCounts[s] !== undefined) severityCounts[s]++;
    });

    // Last month comparison
    const lastMonthScans = lastMonthEntries.length;
    const lastMonthFindings = lastMonthEntries.flatMap(e => e.findings || []).length;

    // SLA data (check if exists)
    const slaData = loadFromStorage('logsherlock_sla');

    return {
      usingSample,
      monthYear: getMonthYear(now),
      generatedDate: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      totalScans,
      filesAnalyzed,
      findingsDetected,
      hoursSaved,
      dollarsSaved,
      scansPerDay,
      peakHours,
      mostActiveDays,
      topPatterns,
      severityCounts,
      lastMonthScans,
      lastMonthFindings,
      slaData,
      daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    };
  }



  // ─── Styles ──────────────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('logsherlock-report-styles')) return;
    const style = document.createElement('style');
    style.id = 'logsherlock-report-styles';
    style.textContent = `
      /* Screen styles - Dark theme */
      #${MODAL_ID} {
        display: none;
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 99999;
        background: rgba(0,0,0,0.85);
        overflow-y: auto;
        padding: 20px;
      }
      #${MODAL_ID}.active { display: block; }
      #${MODAL_ID} .report-container {
        max-width: 900px;
        margin: 0 auto;
        background: #1a1a2e;
        border-radius: 12px;
        padding: 40px;
        color: #e0e0e0;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
      }
      #${MODAL_ID} .report-header {
        text-align: center;
        border-bottom: 2px solid #00d4aa;
        padding-bottom: 20px;
        margin-bottom: 30px;
      }
      #${MODAL_ID} .report-header h1 {
        color: #00d4aa;
        font-size: 1.8rem;
        margin: 0 0 5px 0;
      }
      #${MODAL_ID} .report-header h2 {
        color: #888;
        font-size: 1.1rem;
        font-weight: normal;
        margin: 0;
      }
      #${MODAL_ID} .report-section {
        margin-bottom: 30px;
        padding: 20px;
        background: #16213e;
        border-radius: 8px;
        border-left: 4px solid #00d4aa;
      }
      #${MODAL_ID} .report-section h3 {
        color: #00d4aa;
        margin: 0 0 15px 0;
        font-size: 1.2rem;
      }
      #${MODAL_ID} .metric-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 15px;
      }
      #${MODAL_ID} .metric-card {
        background: #0f3460;
        border-radius: 8px;
        padding: 15px;
        text-align: center;
      }
      #${MODAL_ID} .metric-card .metric-value {
        font-size: 2rem;
        font-weight: bold;
        color: #00d4aa;
      }
      #${MODAL_ID} .metric-card .metric-label {
        font-size: 0.85rem;
        color: #aaa;
        margin-top: 5px;
      }
      #${MODAL_ID} .bar-chart {
        display: flex;
        align-items: flex-end;
        gap: 3px;
        height: 120px;
        padding: 10px 0;
        border-bottom: 1px solid #333;
      }
      #${MODAL_ID} .bar-chart .bar {
        flex: 1;
        background: #00d4aa;
        border-radius: 3px 3px 0 0;
        min-width: 8px;
        position: relative;
        transition: background 0.2s;
      }
      #${MODAL_ID} .bar-chart .bar:hover { background: #00ffcc; }
      #${MODAL_ID} .bar-chart .bar .bar-label {
        position: absolute;
        bottom: -20px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 0.6rem;
        color: #888;
      }
      #${MODAL_ID} .severity-bar {
        display: flex;
        align-items: center;
        margin: 8px 0;
        gap: 10px;
      }
      #${MODAL_ID} .severity-bar .sev-label {
        width: 80px;
        font-size: 0.85rem;
        font-weight: bold;
      }
      #${MODAL_ID} .severity-bar .sev-bar-track {
        flex: 1;
        height: 24px;
        background: #0a0a1a;
        border-radius: 4px;
        overflow: hidden;
      }
      #${MODAL_ID} .severity-bar .sev-bar-fill {
        height: 100%;
        border-radius: 4px;
        display: flex;
        align-items: center;
        padding-left: 8px;
        font-size: 0.8rem;
        font-weight: bold;
        color: #fff;
      }
      #${MODAL_ID} .sev-critical { background: #ff4444; }
      #${MODAL_ID} .sev-high { background: #ff8800; }
      #${MODAL_ID} .sev-medium { background: #ffcc00; color: #333 !important; }
      #${MODAL_ID} .sev-low { background: #44cc44; }
      #${MODAL_ID} .pattern-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      #${MODAL_ID} .pattern-list li {
        display: flex;
        justify-content: space-between;
        padding: 8px 12px;
        border-bottom: 1px solid #1a1a3e;
        font-size: 0.9rem;
      }
      #${MODAL_ID} .pattern-list li:nth-child(odd) { background: #0f3460; border-radius: 4px; }
      #${MODAL_ID} .pattern-count {
        background: #00d4aa;
        color: #000;
        padding: 2px 10px;
        border-radius: 12px;
        font-weight: bold;
        font-size: 0.8rem;
      }
      #${MODAL_ID} .trend-comparison {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
      }
      #${MODAL_ID} .trend-item {
        padding: 12px;
        background: #0f3460;
        border-radius: 8px;
        text-align: center;
      }
      #${MODAL_ID} .trend-item .trend-arrow-up { color: #44cc44; font-size: 1.5rem; }
      #${MODAL_ID} .trend-item .trend-arrow-down { color: #ff4444; font-size: 1.5rem; }
      #${MODAL_ID} .recommendations-list {
        list-style: none;
        padding: 0;
      }
      #${MODAL_ID} .recommendations-list li {
        padding: 10px 15px;
        margin: 8px 0;
        background: #0f3460;
        border-radius: 6px;
        border-left: 3px solid #ffcc00;
      }
      #${MODAL_ID} .report-footer {
        text-align: center;
        padding-top: 20px;
        border-top: 1px solid #333;
        color: #666;
        font-size: 0.8rem;
      }
      #${MODAL_ID} .report-actions {
        position: sticky;
        top: 0;
        background: #1a1a2e;
        padding: 15px;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        border-radius: 12px 12px 0 0;
        z-index: 10;
      }
      #${MODAL_ID} .report-actions button {
        padding: 8px 18px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 600;
        transition: opacity 0.2s;
      }
      #${MODAL_ID} .report-actions button:hover { opacity: 0.85; }
      #${MODAL_ID} .btn-pdf { background: #00d4aa; color: #000; }
      #${MODAL_ID} .btn-email { background: #555; color: #fff; position: relative; }
      #${MODAL_ID} .btn-email:hover::after {
        content: 'Coming soon';
        position: absolute;
        top: -30px;
        left: 50%;
        transform: translateX(-50%);
        background: #333;
        color: #fff;
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 0.75rem;
        white-space: nowrap;
      }
      #${MODAL_ID} .btn-close { background: #ff4444; color: #fff; }
      #${MODAL_ID} .sample-badge {
        background: #ffcc00;
        color: #000;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: bold;
        display: inline-block;
        margin-top: 10px;
      }
      #${MODAL_ID} .money-saved {
        font-size: 2.5rem;
        font-weight: bold;
        color: #44cc44;
        text-align: center;
        margin: 15px 0;
      }

      /* Print styles - White/clean theme */
      @media print {
        body * { visibility: hidden; }
        #${MODAL_ID}, #${MODAL_ID} * { visibility: visible; }
        #${MODAL_ID} {
          position: absolute;
          top: 0; left: 0;
          width: 100%;
          background: #fff !important;
          padding: 0;
        }
        #${MODAL_ID} .report-container {
          background: #fff !important;
          color: #000 !important;
          padding: 20px;
          box-shadow: none;
        }
        #${MODAL_ID} .report-actions { display: none !important; }
        #${MODAL_ID} .report-section {
          background: #f9f9f9 !important;
          border-left-color: #007755 !important;
          break-inside: avoid;
        }
        #${MODAL_ID} .report-header h1 { color: #007755 !important; }
        #${MODAL_ID} .report-header h2 { color: #555 !important; }
        #${MODAL_ID} .report-section h3 { color: #007755 !important; }
        #${MODAL_ID} .metric-card {
          background: #f0f0f0 !important;
          border: 1px solid #ddd;
        }
        #${MODAL_ID} .metric-card .metric-value { color: #007755 !important; }
        #${MODAL_ID} .metric-card .metric-label { color: #555 !important; }
        #${MODAL_ID} .bar-chart .bar { background: #007755 !important; }
        #${MODAL_ID} .pattern-list li { color: #000 !important; }
        #${MODAL_ID} .pattern-list li:nth-child(odd) { background: #f0f0f0 !important; }
        #${MODAL_ID} .pattern-count { background: #007755 !important; color: #fff !important; }
        #${MODAL_ID} .trend-item { background: #f0f0f0 !important; color: #000 !important; }
        #${MODAL_ID} .recommendations-list li { background: #f9f9f9 !important; color: #000 !important; }
        #${MODAL_ID} .report-footer { color: #888 !important; }
        #${MODAL_ID} .money-saved { color: #007755 !important; }
        #${MODAL_ID} .sample-badge { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }

      /* Generate Report Button */
      .logsherlock-generate-report-btn {
        background: linear-gradient(135deg, #00d4aa, #007755);
        color: #fff;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .logsherlock-generate-report-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 15px rgba(0,212,170,0.3);
      }
    `;
    document.head.appendChild(style);
  }



  // ─── Report HTML Builder ─────────────────────────────────────────────────────

  function buildReportHTML(data) {
    const maxScansPerDay = Math.max(...Object.values(data.scansPerDay), 1);
    const totalSeverity = Object.values(data.severityCounts).reduce((a, b) => a + b, 0) || 1;

    // Scans per day bar chart
    let barChartHTML = '';
    for (let day = 1; day <= data.daysInMonth; day++) {
      const count = data.scansPerDay[day] || 0;
      const height = count > 0 ? Math.max((count / maxScansPerDay) * 100, 5) : 0;
      barChartHTML += `<div class="bar" style="height:${height}%" title="Day ${day}: ${count} scans"><span class="bar-label">${day}</span></div>`;
    }

    // Top patterns list
    let patternsHTML = '';
    data.topPatterns.forEach(([pattern, count]) => {
      patternsHTML += `<li><span>${pattern}</span><span class="pattern-count">${count}</span></li>`;
    });
    if (data.topPatterns.length === 0) {
      patternsHTML = '<li><span>No patterns detected this month</span></li>';
    }

    // Severity bars
    let severityHTML = '';
    const sevColors = { CRITICAL: 'sev-critical', HIGH: 'sev-high', MEDIUM: 'sev-medium', LOW: 'sev-low' };
    Object.entries(data.severityCounts).forEach(([sev, count]) => {
      const pct = (count / totalSeverity) * 100;
      severityHTML += `
        <div class="severity-bar">
          <span class="sev-label">${sev}</span>
          <div class="sev-bar-track">
            <div class="sev-bar-fill ${sevColors[sev]}" style="width:${Math.max(pct, 2)}%">${count}</div>
          </div>
        </div>`;
    });

    // Trend comparison
    const scanDiff = data.totalScans - data.lastMonthScans;
    const findingsDiff = data.findingsDetected - data.lastMonthFindings;
    const scanTrend = scanDiff >= 0 ? 'trend-arrow-up' : 'trend-arrow-down';
    const findingsTrend = findingsDiff >= 0 ? 'trend-arrow-up' : 'trend-arrow-down';
    const scanArrow = scanDiff >= 0 ? '↑' : '↓';
    const findingsArrow = findingsDiff >= 0 ? '↑' : '↓';

    // Recommendations
    let recommendationsHTML = '';
    if (data.severityCounts.CRITICAL > 3) {
      recommendationsHTML += '<li>🔴 <strong>Critical Alert:</strong> High number of CRITICAL findings. Prioritize root cause analysis for recurring critical patterns.</li>';
    }
    if (data.topPatterns.length > 0) {
      const topPattern = data.topPatterns[0][0];
      recommendationsHTML += `<li>🎯 <strong>Focus Area:</strong> "${topPattern}" is the most frequent issue. Consider creating automated remediation for this pattern.</li>`;
    }
    if (data.severityCounts.HIGH > 5) {
      recommendationsHTML += '<li>⚠️ <strong>High Severity Trend:</strong> Significant HIGH severity findings. Review deployment processes for common failure modes.</li>';
    }
    if (data.totalScans > 20) {
      recommendationsHTML += '<li>📈 <strong>Heavy Usage:</strong> High scan volume indicates active incident investigation. Consider proactive monitoring to reduce reactive scanning.</li>';
    }
    if (data.totalScans < 5) {
      recommendationsHTML += '<li>💡 <strong>Low Usage:</strong> Consider scheduling regular log reviews to catch issues proactively.</li>';
    }
    if (data.topPatterns.length >= 5) {
      recommendationsHTML += '<li>🔄 <strong>Pattern Diversity:</strong> Multiple distinct issue types detected. Cross-team knowledge sharing sessions could help.</li>';
    }
    if (!recommendationsHTML) {
      recommendationsHTML = '<li>✅ Operations running smoothly. Maintain current monitoring cadence.</li>';
    }

    // SLA section
    let slaHTML = '';
    if (data.slaData) {
      slaHTML = `
        <div class="report-section">
          <h3>📋 SLA Impact</h3>
          <div class="metric-grid">
            <div class="metric-card">
              <div class="metric-value">${data.slaData.mttr || 'N/A'}</div>
              <div class="metric-label">Avg MTTR (minutes)</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${data.slaData.improvement || 'N/A'}%</div>
              <div class="metric-label">MTTR Improvement</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${data.slaData.breaches || 0}</div>
              <div class="metric-label">SLA Breaches Prevented</div>
            </div>
          </div>
        </div>`;
    }

    return `
      <div class="report-actions">
        <button class="btn-pdf" onclick="window.LogSherlockReports.downloadReportAsPDF()">📄 Download as PDF</button>
        <button class="btn-email" onclick="void(0)">📧 Email Report</button>
        <button class="btn-close" onclick="window.LogSherlockReports.closeReport()">✕ Close</button>
      </div>
      <div class="report-container">
        <!-- Header -->
        <div class="report-header">
          <h1>🔍 LogSherlock Pro</h1>
          <h2>Monthly Usage Report — ${data.monthYear}</h2>
          ${data.usingSample ? '<span class="sample-badge">⚠️ SAMPLE DATA — No scan history found</span>' : ''}
        </div>

        <!-- Executive Summary -->
        <div class="report-section">
          <h3>📊 Executive Summary</h3>
          <div class="metric-grid">
            <div class="metric-card">
              <div class="metric-value">${data.totalScans}</div>
              <div class="metric-label">Total Scans</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${data.filesAnalyzed}</div>
              <div class="metric-label">Files Analyzed</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${data.findingsDetected}</div>
              <div class="metric-label">Findings Detected</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${data.hoursSaved.toFixed(1)}h</div>
              <div class="metric-label">Hours Saved</div>
            </div>
          </div>
        </div>

        <!-- Usage Metrics -->
        <div class="report-section">
          <h3>📈 Usage Metrics</h3>
          <p style="margin:0 0 10px;color:#aaa;font-size:0.85rem;">Scans per day this month:</p>
          <div class="bar-chart">${barChartHTML}</div>
          <div class="metric-grid" style="margin-top:15px;">
            <div class="metric-card">
              <div class="metric-value">${data.peakHours.join(', ') || 'N/A'}</div>
              <div class="metric-label">Peak Usage Hours</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${data.mostActiveDays.join(', ') || 'N/A'}</div>
              <div class="metric-label">Most Active Days</div>
            </div>
          </div>
        </div>

        <!-- Top Issues Found -->
        <div class="report-section">
          <h3>🐛 Top Issues Found</h3>
          <ul class="pattern-list">${patternsHTML}</ul>
        </div>

        <!-- Severity Breakdown -->
        <div class="report-section">
          <h3>⚡ Severity Breakdown</h3>
          ${severityHTML}
        </div>

        <!-- Time Saved Analysis -->
        <div class="report-section">
          <h3>⏱️ Time Saved Analysis</h3>
          <p style="color:#aaa;text-align:center;margin-bottom:5px;">
            ${data.totalScans} scans × ${HOURS_PER_SCAN} hrs/scan = <strong style="color:#00d4aa;">${data.hoursSaved.toFixed(1)} hours saved</strong>
          </p>
          <div class="money-saved">💰 $${data.dollarsSaved.toLocaleString()} saved</div>
          <p style="color:#888;text-align:center;font-size:0.8rem;">Based on estimated $${COST_PER_HOUR}/hr engineer time for manual log analysis</p>
        </div>

        <!-- SLA Impact -->
        ${slaHTML}

        <!-- Trend -->
        <div class="report-section">
          <h3>📉 Trend: This Month vs Last Month</h3>
          <div class="trend-comparison">
            <div class="trend-item">
              <span class="${scanTrend}">${scanArrow}</span>
              <div><strong>${Math.abs(scanDiff)}</strong> ${scanDiff >= 0 ? 'more' : 'fewer'} scans</div>
              <div style="color:#888;font-size:0.8rem;">${data.totalScans} vs ${data.lastMonthScans} last month</div>
            </div>
            <div class="trend-item">
              <span class="${findingsTrend}">${findingsArrow}</span>
              <div><strong>${Math.abs(findingsDiff)}</strong> ${findingsDiff >= 0 ? 'more' : 'fewer'} findings</div>
              <div style="color:#888;font-size:0.8rem;">${data.findingsDetected} vs ${data.lastMonthFindings} last month</div>
            </div>
          </div>
        </div>

        <!-- Recommendations -->
        <div class="report-section">
          <h3>💡 Recommendations</h3>
          <ul class="recommendations-list">${recommendationsHTML}</ul>
        </div>

        <!-- Footer -->
        <div class="report-footer">
          <p>Generated by <strong>LogSherlock Pro</strong> on ${data.generatedDate}</p>
          <p>Page 1 of 1 | Confidential — Internal Use Only</p>
        </div>
      </div>
    `;
  }



  // ─── Exported Functions ──────────────────────────────────────────────────────

  function renderUsageReportsButton() {
    return `<button class="logsherlock-generate-report-btn" onclick="window.LogSherlockReports.generateMonthlyReport()">
      📊 Generate Report
    </button>`;
  }

  function generateMonthlyReport() {
    injectStyles();

    // Create or get modal
    let modal = document.getElementById(MODAL_ID);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = MODAL_ID;
      document.body.appendChild(modal);
    }

    // Gather data and build report
    const data = gatherReportData();
    modal.innerHTML = buildReportHTML(data);
    modal.classList.add('active');

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Close on escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeReport();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  function downloadReportAsPDF() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal || !modal.classList.contains('active')) {
      generateMonthlyReport();
      setTimeout(() => window.print(), 300);
    } else {
      window.print();
    }
  }

  function closeReport() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  window.LogSherlockReports = {
    renderUsageReportsButton,
    generateMonthlyReport,
    downloadReportAsPDF,
    closeReport,
  };

  // ─── Self-Initialize on DOMContentLoaded ─────────────────────────────────────

  function init() {
    injectStyles();

    // Auto-inject button if a placeholder exists
    const placeholder = document.getElementById('logsherlock-report-button-placeholder');
    if (placeholder) {
      placeholder.innerHTML = renderUsageReportsButton();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
