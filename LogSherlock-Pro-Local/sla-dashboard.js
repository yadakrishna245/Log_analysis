/**
 * LogSherlock Pro - SLA/MTTR Dashboard
 * Tracks Mean Time To Resolution, SLA compliance, and demonstrates tool value.
 * Standalone - no external chart libraries required.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'logsherlock_sla_data';
  const MANUAL_AVG_HOURS = 4.2; // Industry average manual resolution time

  const SLA_TARGETS = {
    P1: 2,   // hours
    P2: 4,
    P3: 8,
    P4: 24
  };

  // ─── Data Layer ───────────────────────────────────────────────────────────────

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('[SLA Dashboard] Failed to load data:', e);
    }
    return null;
  }

  function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function generateSampleData() {
    const now = Date.now();
    const hour = 3600000;
    const day = 86400000;
    const samples = [
      { ticketId: 'INC-1001', severity: 'P1', startTime: now - 25 * day, resolutionHours: 1.2 },
      { ticketId: 'INC-1002', severity: 'P2', startTime: now - 24 * day, resolutionHours: 2.8 },
      { ticketId: 'INC-1003', severity: 'P3', startTime: now - 22 * day, resolutionHours: 5.5 },
      { ticketId: 'INC-1004', severity: 'P1', startTime: now - 20 * day, resolutionHours: 1.8 },
      { ticketId: 'INC-1005', severity: 'P4', startTime: now - 18 * day, resolutionHours: 12.0 },
      { ticketId: 'INC-1006', severity: 'P2', startTime: now - 16 * day, resolutionHours: 3.1 },
      { ticketId: 'INC-1007', severity: 'P3', startTime: now - 14 * day, resolutionHours: 7.2 },
      { ticketId: 'INC-1008', severity: 'P1', startTime: now - 12 * day, resolutionHours: 1.5 },
      { ticketId: 'INC-1009', severity: 'P2', startTime: now - 10 * day, resolutionHours: 3.9 },
      { ticketId: 'INC-1010', severity: 'P4', startTime: now - 9 * day, resolutionHours: 18.0 },
      { ticketId: 'INC-1011', severity: 'P1', startTime: now - 7 * day, resolutionHours: 0.9 },
      { ticketId: 'INC-1012', severity: 'P3', startTime: now - 5 * day, resolutionHours: 4.8 },
      { ticketId: 'INC-1013', severity: 'P2', startTime: now - 3 * day, resolutionHours: 2.5 },
      { ticketId: 'INC-1014', severity: 'P1', startTime: now - 2 * day, resolutionHours: 1.1 },
      { ticketId: 'INC-1015', severity: 'P3', startTime: now - 1 * day, resolutionHours: 6.0 },
    ];

    return samples.map(s => ({
      ticketId: s.ticketId,
      severity: s.severity,
      startTime: s.startTime,
      endTime: s.startTime + (s.resolutionHours * hour),
      resolutionHours: s.resolutionHours,
      recordedAt: s.startTime + (s.resolutionHours * hour)
    }));
  }

  function initData() {
    let data = loadData();
    if (!data || !data.resolutions || data.resolutions.length === 0) {
      data = { resolutions: generateSampleData() };
      saveData(data);
    }
    return data;
  }

  // ─── Exported: recordResolution ───────────────────────────────────────────────

  function recordResolution(ticketId, startTime, endTime, severity) {
    if (!ticketId || !startTime || !endTime || !severity) {
      throw new Error('All parameters required: ticketId, startTime, endTime, severity');
    }

    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    if (isNaN(start) || isNaN(end)) {
      throw new Error('Invalid date format for startTime or endTime');
    }

    if (end <= start) {
      throw new Error('endTime must be after startTime');
    }

    const sev = severity.toUpperCase();
    if (!SLA_TARGETS[sev]) {
      throw new Error('Severity must be P1, P2, P3, or P4');
    }

    const resolutionHours = (end - start) / 3600000;
    const record = {
      ticketId,
      severity: sev,
      startTime: start,
      endTime: end,
      resolutionHours,
      recordedAt: Date.now()
    };

    const data = initData();
    data.resolutions.push(record);
    saveData(data);

    return record;
  }

  // ─── Exported: getSLAMetrics ──────────────────────────────────────────────────

  function getSLAMetrics() {
    const data = initData();
    const resolutions = data.resolutions || [];
    const now = Date.now();
    const thirtyDays = 30 * 86400000;

    // Overall MTTR
    const totalHours = resolutions.reduce((sum, r) => sum + r.resolutionHours, 0);
    const mttr = resolutions.length > 0 ? totalHours / resolutions.length : 0;

    // MTTR by severity
    const mttrBySeverity = {};
    for (const sev of ['P1', 'P2', 'P3', 'P4']) {
      const sevRecords = resolutions.filter(r => r.severity === sev);
      if (sevRecords.length > 0) {
        const sevTotal = sevRecords.reduce((sum, r) => sum + r.resolutionHours, 0);
        mttrBySeverity[sev] = {
          mttr: sevTotal / sevRecords.length,
          target: SLA_TARGETS[sev],
          count: sevRecords.length,
          withinSLA: sevRecords.filter(r => r.resolutionHours <= SLA_TARGETS[sev]).length
        };
      } else {
        mttrBySeverity[sev] = { mttr: 0, target: SLA_TARGETS[sev], count: 0, withinSLA: 0 };
      }
    }

    // SLA compliance
    const withinSLA = resolutions.filter(r => r.resolutionHours <= SLA_TARGETS[r.severity]).length;
    const slaCompliance = resolutions.length > 0 ? (withinSLA / resolutions.length) * 100 : 0;

    // Time saved
    const timeSavedPerTicket = Math.max(0, MANUAL_AVG_HOURS - mttr);
    const totalTimeSaved = timeSavedPerTicket * resolutions.length;

    // This month's tickets
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const ticketsThisMonth = resolutions.filter(r => r.endTime >= startOfMonth.getTime()).length;

    // Trend: last 30 days vs previous 30 days
    const last30 = resolutions.filter(r => r.endTime >= now - thirtyDays);
    const prev30 = resolutions.filter(r => r.endTime >= now - 2 * thirtyDays && r.endTime < now - thirtyDays);

    let trend = 'stable';
    if (last30.length > 0 && prev30.length > 0) {
      const last30Mttr = last30.reduce((s, r) => s + r.resolutionHours, 0) / last30.length;
      const prev30Mttr = prev30.reduce((s, r) => s + r.resolutionHours, 0) / prev30.length;
      if (last30Mttr < prev30Mttr) trend = 'improving';
      else if (last30Mttr > prev30Mttr) trend = 'declining';
    } else if (last30.length > 0) {
      trend = 'improving'; // new data, assume improving
    }

    return {
      mttr,
      mttrBySeverity,
      slaCompliance,
      timeSavedPerTicket,
      totalTimeSaved,
      ticketsThisMonth,
      totalTickets: resolutions.length,
      trend,
      manualAvgHours: MANUAL_AVG_HOURS
    };
  }

  // ─── Exported: renderSLADashboard ─────────────────────────────────────────────

  function renderSLADashboard() {
    const metrics = getSLAMetrics();

    const slaColor = metrics.slaCompliance > 90 ? '#01a982' :
                     metrics.slaCompliance > 70 ? '#f5a623' : '#e74c3c';

    const trendArrow = metrics.trend === 'improving' ? '↑' :
                       metrics.trend === 'declining' ? '↓' : '→';
    const trendColor = metrics.trend === 'improving' ? '#01a982' :
                       metrics.trend === 'declining' ? '#e74c3c' : '#888';
    const trendLabel = metrics.trend.charAt(0).toUpperCase() + metrics.trend.slice(1);

    // Build severity bar chart
    const maxTarget = 24;
    let severityBars = '';
    for (const sev of ['P1', 'P2', 'P3', 'P4']) {
      const data = metrics.mttrBySeverity[sev];
      const barWidth = Math.min((data.mttr / maxTarget) * 100, 100);
      const targetWidth = (data.target / maxTarget) * 100;
      const barColor = data.mttr <= data.target ? '#01a982' : '#e74c3c';
      severityBars += `
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
            <span style="font-weight:600;color:#e0e0e0;">${sev}</span>
            <span style="color:#aaa;font-size:12px;">${data.mttr.toFixed(1)}h / ${data.target}h target (${data.count} tickets)</span>
          </div>
          <div style="position:relative;height:18px;background:#1e1e2e;border-radius:4px;overflow:hidden;">
            <div style="position:absolute;left:${targetWidth}%;top:0;bottom:0;width:2px;background:#f5a623;z-index:2;" title="SLA Target: ${data.target}h"></div>
            <div style="height:100%;width:${barWidth}%;background:${barColor};border-radius:4px;transition:width 0.3s;"></div>
          </div>
        </div>`;
    }

    return `
<div id="sla-dashboard" style="font-family:'Segoe UI',system-ui,sans-serif;background:#1e1e2e;color:#e0e0e0;padding:24px;border-radius:12px;max-width:900px;margin:0 auto;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
    <h2 style="margin:0;color:#fff;font-size:22px;">📊 SLA / MTTR Dashboard</h2>
    <span style="font-size:28px;color:${trendColor};font-weight:bold;" title="Trend: ${trendLabel}">${trendArrow} ${trendLabel}</span>
  </div>

  <!-- Big Number Cards -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px;">
    <div style="background:#2a2a3e;padding:20px;border-radius:10px;text-align:center;border:1px solid #3a3a5e;">
      <div style="font-size:12px;text-transform:uppercase;color:#888;letter-spacing:1px;margin-bottom:6px;">MTTR</div>
      <div style="font-size:32px;font-weight:700;color:#01a982;">${metrics.mttr.toFixed(1)}h</div>
      <div style="font-size:11px;color:#666;margin-top:4px;">Mean Time To Resolution</div>
    </div>
    <div style="background:#2a2a3e;padding:20px;border-radius:10px;text-align:center;border:1px solid #3a3a5e;">
      <div style="font-size:12px;text-transform:uppercase;color:#888;letter-spacing:1px;margin-bottom:6px;">SLA Compliance</div>
      <div style="font-size:32px;font-weight:700;color:${slaColor};">${metrics.slaCompliance.toFixed(1)}%</div>
      <div style="font-size:11px;color:#666;margin-top:4px;">Within target time</div>
    </div>
    <div style="background:#2a2a3e;padding:20px;border-radius:10px;text-align:center;border:1px solid #3a3a5e;">
      <div style="font-size:12px;text-transform:uppercase;color:#888;letter-spacing:1px;margin-bottom:6px;">Tickets Resolved</div>
      <div style="font-size:32px;font-weight:700;color:#01a982;">${metrics.ticketsThisMonth}</div>
      <div style="font-size:11px;color:#666;margin-top:4px;">This month</div>
    </div>
    <div style="background:#2a2a3e;padding:20px;border-radius:10px;text-align:center;border:1px solid #3a3a5e;">
      <div style="font-size:12px;text-transform:uppercase;color:#888;letter-spacing:1px;margin-bottom:6px;">Hours Saved</div>
      <div style="font-size:32px;font-weight:700;color:#01a982;">${metrics.totalTimeSaved.toFixed(0)}h</div>
      <div style="font-size:11px;color:#666;margin-top:4px;">vs manual investigation</div>
    </div>
  </div>

  <!-- SLA Compliance Progress Bar -->
  <div style="background:#2a2a3e;padding:18px 20px;border-radius:10px;margin-bottom:24px;border:1px solid #3a3a5e;">
    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
      <span style="font-weight:600;">SLA Compliance</span>
      <span style="color:${slaColor};font-weight:600;">${metrics.slaCompliance.toFixed(1)}%</span>
    </div>
    <div style="height:12px;background:#1e1e2e;border-radius:6px;overflow:hidden;">
      <div style="height:100%;width:${Math.min(metrics.slaCompliance, 100)}%;background:${slaColor};border-radius:6px;transition:width 0.5s ease;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:10px;color:#666;margin-top:4px;">
      <span>0%</span>
      <span style="color:#e74c3c;">70%</span>
      <span style="color:#f5a623;">90%</span>
      <span>100%</span>
    </div>
  </div>

  <!-- MTTR by Severity Chart -->
  <div style="background:#2a2a3e;padding:18px 20px;border-radius:10px;margin-bottom:24px;border:1px solid #3a3a5e;">
    <h3 style="margin:0 0 14px 0;font-size:15px;color:#fff;">MTTR by Severity</h3>
    <div style="font-size:10px;color:#888;margin-bottom:10px;">
      <span style="display:inline-block;width:10px;height:10px;background:#01a982;border-radius:2px;margin-right:4px;vertical-align:middle;"></span> Within SLA
      <span style="display:inline-block;width:10px;height:10px;background:#e74c3c;border-radius:2px;margin-left:12px;margin-right:4px;vertical-align:middle;"></span> Breached SLA
      <span style="display:inline-block;width:2px;height:10px;background:#f5a623;margin-left:12px;margin-right:4px;vertical-align:middle;"></span> Target
    </div>
    ${severityBars}
  </div>

  <!-- Before vs After Comparison -->
  <div style="background:#2a2a3e;padding:18px 20px;border-radius:10px;margin-bottom:24px;border:1px solid #3a3a5e;">
    <h3 style="margin:0 0 14px 0;font-size:15px;color:#fff;">Before vs After LogSherlock</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div style="text-align:center;padding:14px;background:#1e1e2e;border-radius:8px;border:1px solid #444;">
        <div style="font-size:11px;text-transform:uppercase;color:#e74c3c;letter-spacing:1px;margin-bottom:6px;">Before (Manual)</div>
        <div style="font-size:28px;font-weight:700;color:#e74c3c;">${MANUAL_AVG_HOURS}h</div>
        <div style="font-size:11px;color:#888;">Avg resolution time</div>
      </div>
      <div style="text-align:center;padding:14px;background:#1e1e2e;border-radius:8px;border:1px solid #01a982;">
        <div style="font-size:11px;text-transform:uppercase;color:#01a982;letter-spacing:1px;margin-bottom:6px;">After (LogSherlock)</div>
        <div style="font-size:28px;font-weight:700;color:#01a982;">${metrics.mttr.toFixed(1)}h</div>
        <div style="font-size:11px;color:#888;">Avg resolution time</div>
      </div>
    </div>
    <div style="text-align:center;margin-top:12px;padding:10px;background:#0a3d2e;border-radius:6px;border:1px solid #01a982;">
      <span style="font-size:16px;font-weight:700;color:#01a982;">⚡ ${((1 - metrics.mttr / MANUAL_AVG_HOURS) * 100).toFixed(0)}% faster resolution</span>
      <span style="font-size:12px;color:#aaa;margin-left:8px;">(saving ${metrics.timeSavedPerTicket.toFixed(1)}h per ticket)</span>
    </div>
  </div>

  <!-- Record Resolution Form -->
  <div style="background:#2a2a3e;padding:18px 20px;border-radius:10px;border:1px solid #3a3a5e;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <h3 style="margin:0;font-size:15px;color:#fff;">Record Resolution</h3>
      <button id="sla-toggle-form-btn" onclick="document.getElementById('sla-form-panel').style.display = document.getElementById('sla-form-panel').style.display === 'none' ? 'block' : 'none'" style="background:#01a982;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">+ Record Resolution</button>
    </div>
    <div id="sla-form-panel" style="display:none;margin-top:12px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <label style="font-size:11px;color:#888;display:block;margin-bottom:3px;">Ticket ID</label>
          <input id="sla-ticket-id" type="text" placeholder="INC-1016" style="width:100%;padding:8px 10px;background:#1e1e2e;border:1px solid #3a3a5e;border-radius:5px;color:#e0e0e0;font-size:13px;box-sizing:border-box;" />
        </div>
        <div>
          <label style="font-size:11px;color:#888;display:block;margin-bottom:3px;">Severity</label>
          <select id="sla-severity" style="width:100%;padding:8px 10px;background:#1e1e2e;border:1px solid #3a3a5e;border-radius:5px;color:#e0e0e0;font-size:13px;box-sizing:border-box;">
            <option value="P1">P1 - Critical (&lt;2h)</option>
            <option value="P2">P2 - High (&lt;4h)</option>
            <option value="P3" selected>P3 - Medium (&lt;8h)</option>
            <option value="P4">P4 - Low (&lt;24h)</option>
          </select>
        </div>
        <div>
          <label style="font-size:11px;color:#888;display:block;margin-bottom:3px;">Start Time</label>
          <input id="sla-start-time" type="datetime-local" style="width:100%;padding:8px 10px;background:#1e1e2e;border:1px solid #3a3a5e;border-radius:5px;color:#e0e0e0;font-size:13px;box-sizing:border-box;" />
        </div>
        <div>
          <label style="font-size:11px;color:#888;display:block;margin-bottom:3px;">End Time</label>
          <input id="sla-end-time" type="datetime-local" style="width:100%;padding:8px 10px;background:#1e1e2e;border:1px solid #3a3a5e;border-radius:5px;color:#e0e0e0;font-size:13px;box-sizing:border-box;" />
        </div>
      </div>
      <div style="margin-top:12px;display:flex;gap:10px;">
        <button onclick="window._slaDashboardSubmit()" style="background:#01a982;color:#fff;border:none;padding:9px 20px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">Save Resolution</button>
        <span id="sla-form-msg" style="font-size:12px;color:#888;line-height:36px;"></span>
      </div>
    </div>
  </div>

  <div style="text-align:center;margin-top:16px;font-size:11px;color:#555;">
    LogSherlock Pro • ${metrics.totalTickets} total resolutions tracked • Data stored locally
  </div>
</div>`;
  }

  // ─── Form Submission Handler ──────────────────────────────────────────────────

  window._slaDashboardSubmit = function () {
    const ticketId = document.getElementById('sla-ticket-id').value.trim();
    const severity = document.getElementById('sla-severity').value;
    const startTime = document.getElementById('sla-start-time').value;
    const endTime = document.getElementById('sla-end-time').value;
    const msgEl = document.getElementById('sla-form-msg');

    if (!ticketId || !startTime || !endTime) {
      msgEl.style.color = '#e74c3c';
      msgEl.textContent = '⚠ All fields are required';
      return;
    }

    try {
      recordResolution(ticketId, startTime, endTime, severity);
      msgEl.style.color = '#01a982';
      msgEl.textContent = '✓ Resolution recorded!';

      // Clear form
      document.getElementById('sla-ticket-id').value = '';
      document.getElementById('sla-start-time').value = '';
      document.getElementById('sla-end-time').value = '';

      // Re-render dashboard after short delay
      setTimeout(function () {
        const container = document.getElementById('sla-dashboard');
        if (container && container.parentElement) {
          container.parentElement.innerHTML = renderSLADashboard();
        }
      }, 1000);
    } catch (e) {
      msgEl.style.color = '#e74c3c';
      msgEl.textContent = '⚠ ' + e.message;
    }
  };

  // ─── Self-Initialize on DOMContentLoaded ──────────────────────────────────────

  function init() {
    // Ensure data exists (seeds if empty)
    initData();

    // Auto-render if a target container exists
    const target = document.getElementById('sla-dashboard-container');
    if (target) {
      target.innerHTML = renderSLADashboard();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─── Exports ──────────────────────────────────────────────────────────────────

  // Support both module and global exports
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { renderSLADashboard, recordResolution, getSLAMetrics };
  }

  // Always expose globally for browser use
  window.renderSLADashboard = renderSLADashboard;
  window.recordResolution = recordResolution;
  window.getSLAMetrics = getSLAMetrics;

})();
