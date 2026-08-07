/**
 * LogSherlock Pro - Team Dashboard
 * Shows team-wide usage, performance metrics, and analytics
 * Designed for team leads and managers
 * Standalone - No external dependencies
 */

(function () {
  'use strict';

  // ============ SIMULATED TEAM DATA ============
  const TEAM_MEMBERS = [
    { name: 'Krishna Y.', scans: 8, avgResolution: 0.9, score: 96, active: true },
    { name: 'Ravi S.', scans: 6, avgResolution: 1.1, score: 91, active: true },
    { name: 'Priya M.', scans: 5, avgResolution: 1.0, score: 89, active: true },
    { name: 'Amit K.', scans: 5, avgResolution: 1.3, score: 85, active: true },
    { name: 'Chen W.', scans: 4, avgResolution: 1.2, score: 83, active: true },
    { name: 'Sarah L.', scans: 4, avgResolution: 1.5, score: 80, active: true },
    { name: 'Mike R.', scans: 4, avgResolution: 1.6, score: 78, active: false },
    { name: 'Neha P.', scans: 3, avgResolution: 1.4, score: 76, active: true },
    { name: 'Rahul D.', scans: 3, avgResolution: 1.8, score: 73, active: true },
    { name: 'Lisa T.', scans: 2, avgResolution: 1.7, score: 70, active: false },
    { name: 'Suresh K.', scans: 2, avgResolution: 2.0, score: 67, active: false },
    { name: 'Fatima A.', scans: 1, avgResolution: 2.2, score: 64, active: false }
  ];

  const PATTERN_TRENDS = [
    { pattern: 'NullPointerException', count: 34 },
    { pattern: 'Connection Timeout', count: 28 },
    { pattern: 'Memory Leak Detected', count: 22 },
    { pattern: 'Authentication Failure', count: 19 },
    { pattern: 'Disk I/O Bottleneck', count: 16 },
    { pattern: 'Thread Deadlock', count: 14 },
    { pattern: 'API Rate Limit Exceeded', count: 12 },
    { pattern: 'SSL Certificate Expiry', count: 10 },
    { pattern: 'Database Lock Contention', count: 8 },
    { pattern: 'Garbage Collection Pause', count: 6 }
  ];

  const TIME_DISTRIBUTION = [
    0, 0, 0, 0, 0, 1, 2, 4, 8, 9, 7, 6,
    5, 4, 6, 7, 8, 6, 4, 3, 2, 1, 0, 0
  ];

  const KNOWLEDGE_GAPS = [
    { pattern: 'Thread Deadlock', avgTime: 3.8, topic: 'Concurrency & Multi-threading' },
    { pattern: 'Memory Leak Detected', avgTime: 3.2, topic: 'JVM Memory Management & Profiling' },
    { pattern: 'Database Lock Contention', avgTime: 2.9, topic: 'Database Optimization & Locking' },
    { pattern: 'Garbage Collection Pause', avgTime: 2.7, topic: 'GC Tuning & Monitoring' },
    { pattern: 'SSL Certificate Expiry', avgTime: 2.4, topic: 'PKI & Certificate Management' }
  ];

  const LICENSE_INFO = {
    totalSeats: 15,
    usedSeats: 12,
    expiryDate: '2027-03-15',
    renewalDays: 220
  };



  // ============ STYLES ============
  const STYLES = `
    .td-modal-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.85); z-index: 99999;
      display: flex; align-items: center; justify-content: center;
      animation: td-fadeIn 0.3s ease;
    }
    @keyframes td-fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .td-modal {
      width: 95%; height: 92%; background: #1e1e2e; border-radius: 16px;
      overflow-y: auto; padding: 32px; box-sizing: border-box;
      color: #e0e0e0; font-family: 'Segoe UI', system-ui, sans-serif;
      border: 1px solid #3a3a5e;
    }
    .td-modal::-webkit-scrollbar { width: 8px; }
    .td-modal::-webkit-scrollbar-track { background: #1e1e2e; }
    .td-modal::-webkit-scrollbar-thumb { background: #01a982; border-radius: 4px; }
    .td-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 24px; border-bottom: 2px solid #01a982; padding-bottom: 16px;
    }
    .td-header h1 { margin: 0; font-size: 28px; color: #01a982; }
    .td-header-actions { display: flex; gap: 12px; align-items: center; }
    .td-btn {
      padding: 8px 16px; border: none; border-radius: 8px; cursor: pointer;
      font-size: 13px; font-weight: 600; transition: all 0.2s;
    }
    .td-btn-primary { background: #01a982; color: #fff; }
    .td-btn-primary:hover { background: #00c896; transform: translateY(-1px); }
    .td-btn-close {
      background: #ff5555; color: #fff; width: 36px; height: 36px;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 18px; border: none; cursor: pointer;
    }
    .td-btn-close:hover { background: #ff3333; }
    .td-filter-group { display: flex; gap: 8px; }
    .td-filter-btn {
      padding: 6px 14px; border: 1px solid #3a3a5e; border-radius: 20px;
      background: transparent; color: #aaa; cursor: pointer; font-size: 12px;
      transition: all 0.2s;
    }
    .td-filter-btn.active { border-color: #01a982; color: #01a982; background: rgba(1,169,130,0.1); }
    .td-filter-btn:hover { border-color: #01a982; color: #01a982; }
    .td-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px; margin-bottom: 24px;
    }
    .td-card {
      background: #2a2a3e; border-radius: 12px; padding: 20px;
      border: 1px solid #3a3a5e; transition: transform 0.2s, box-shadow 0.2s;
    }
    .td-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
    .td-card h3 { margin: 0 0 16px 0; color: #01a982; font-size: 16px; }
    .td-stat-card { text-align: center; }
    .td-stat-value { font-size: 36px; font-weight: 700; color: #01a982; }
    .td-stat-label { font-size: 13px; color: #888; margin-top: 4px; }
    .td-section { margin-bottom: 28px; }
    .td-section-title {
      font-size: 20px; color: #01a982; margin-bottom: 16px;
      padding-bottom: 8px; border-bottom: 1px solid #3a3a5e;
    }
    .td-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .td-table th {
      text-align: left; padding: 10px 12px; background: #1e1e2e;
      color: #01a982; border-bottom: 2px solid #3a3a5e; font-weight: 600;
    }
    .td-table td { padding: 10px 12px; border-bottom: 1px solid #2a2a3e; }
    .td-table tr:hover td { background: rgba(1,169,130,0.05); }
    .td-rank-1 { color: #ffd700; font-weight: 700; }
    .td-rank-2 { color: #c0c0c0; font-weight: 700; }
    .td-rank-3 { color: #cd7f32; font-weight: 700; }
    .td-medal { font-size: 18px; margin-right: 6px; }
    .td-bar-container { display: flex; align-items: center; gap: 10px; margin: 6px 0; }
    .td-bar-label { width: 180px; font-size: 12px; color: #ccc; text-align: right; }
    .td-bar {
      height: 22px; background: linear-gradient(90deg, #01a982, #00c896);
      border-radius: 4px; transition: width 0.5s ease; position: relative;
    }
    .td-bar-count {
      position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
      font-size: 11px; font-weight: 600; color: #fff;
    }
    .td-heatmap { display: grid; grid-template-columns: repeat(24, 1fr); gap: 3px; }
    .td-heat-cell {
      aspect-ratio: 1; border-radius: 4px; display: flex; align-items: center;
      justify-content: center; font-size: 9px; color: #fff; position: relative;
    }
    .td-heat-label {
      font-size: 10px; color: #666; text-align: center; margin-top: 4px;
    }
    .td-heat-0 { background: #1a1a2a; }
    .td-heat-1 { background: #1a3a2a; }
    .td-heat-2 { background: #1a5a3a; }
    .td-heat-3 { background: #01a982; }
    .td-heat-4 { background: #00c896; }
    .td-heat-peak { box-shadow: 0 0 8px #01a982; border: 1px solid #01a982; }
    .td-gap-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px; background: #1e1e2e; border-radius: 8px; margin: 8px 0;
      border-left: 3px solid #ff6b6b;
    }
    .td-gap-pattern { font-weight: 600; color: #ff6b6b; }
    .td-gap-time { color: #888; font-size: 12px; }
    .td-gap-topic {
      background: rgba(1,169,130,0.1); color: #01a982; padding: 4px 10px;
      border-radius: 12px; font-size: 11px;
    }
    .td-license-bar {
      height: 24px; background: #1e1e2e; border-radius: 12px; overflow: hidden;
      margin: 12px 0; position: relative;
    }
    .td-license-fill {
      height: 100%; background: linear-gradient(90deg, #01a982, #00c896);
      border-radius: 12px; transition: width 0.5s;
    }
    .td-license-text {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      font-size: 12px; font-weight: 600; color: #fff;
    }
    .td-access-denied {
      text-align: center; padding: 80px 20px; color: #ff5555;
    }
    .td-access-denied h2 { font-size: 48px; margin-bottom: 16px; }
    @media print {
      .td-modal-overlay { position: static; background: #fff; }
      .td-modal { background: #fff; color: #333; height: auto; border: none; }
      .td-card { background: #f5f5f5; border-color: #ddd; }
      .td-btn-close, .td-header-actions { display: none; }
      .td-stat-value, .td-section-title, .td-header h1, .td-card h3 { color: #01a982; }
    }
  `;



  // ============ RENDER FUNCTION ============
  function renderTeamDashboard(filter) {
    filter = filter || 'week';

    // Multiplier for different time ranges
    const multipliers = { week: 1, month: 4.2, thirty: 4.5 };
    const mul = multipliers[filter] || 1;
    const totalScans = Math.round(47 * mul);
    const activeToday = 8;
    const avgMTTR = (1.4 + (filter === 'thirty' ? 0.2 : filter === 'month' ? 0.1 : 0)).toFixed(1);

    // Access check
    const isAdmin = localStorage.getItem('logsherlock_admin') === 'true' ||
                    localStorage.getItem('admin') === 'true';
    if (!isAdmin) {
      return `<div class="td-access-denied">
        <h2>🔒</h2>
        <h3>Admin Access Required</h3>
        <p style="color:#888;margin-top:12px;">This dashboard is restricted to team leads and managers.<br>
        Contact your administrator for access.</p>
      </div>`;
    }

    const filterLabels = { week: 'This Week', month: 'This Month', thirty: 'Last 30 Days' };

    let html = '';

    // Header
    html += `<div class="td-header">
      <h1>👥 Team Dashboard</h1>
      <div class="td-header-actions">
        <div class="td-filter-group">
          <button class="td-filter-btn ${filter === 'week' ? 'active' : ''}" onclick="window._tdSetFilter('week')">This Week</button>
          <button class="td-filter-btn ${filter === 'month' ? 'active' : ''}" onclick="window._tdSetFilter('month')">This Month</button>
          <button class="td-filter-btn ${filter === 'thirty' ? 'active' : ''}" onclick="window._tdSetFilter('thirty')">Last 30 Days</button>
        </div>
        <button class="td-btn td-btn-primary" onclick="window._tdExportReport()">📄 Export Report</button>
        <button class="td-btn-close" onclick="window.closeTeamDashboard()">✕</button>
      </div>
    </div>`;

    // Section 1: Team Overview
    html += `<div class="td-section">
      <div class="td-grid">
        <div class="td-card td-stat-card">
          <div class="td-stat-value">12</div>
          <div class="td-stat-label">Team Members</div>
        </div>
        <div class="td-card td-stat-card">
          <div class="td-stat-value">${activeToday}</div>
          <div class="td-stat-label">Active Today</div>
        </div>
        <div class="td-card td-stat-card">
          <div class="td-stat-value">${totalScans}</div>
          <div class="td-stat-label">Total Scans (${filterLabels[filter]})</div>
        </div>
        <div class="td-card td-stat-card">
          <div class="td-stat-value">${avgMTTR}h</div>
          <div class="td-stat-label">Average MTTR</div>
        </div>
      </div>
    </div>`;

    // Section 2: Leaderboard
    html += `<div class="td-section">
      <h2 class="td-section-title">🏆 Leaderboard — Top Performers (${filterLabels[filter]})</h2>
      <div class="td-card">
        <table class="td-table">
          <thead><tr>
            <th>Rank</th><th>Name</th><th>Scans</th><th>Avg Resolution</th><th>Score</th>
          </tr></thead><tbody>`;

    TEAM_MEMBERS.forEach(function (m, i) {
      const rank = i + 1;
      let rankClass = '';
      let medal = '';
      if (rank === 1) { rankClass = 'td-rank-1'; medal = '<span class="td-medal">🥇</span>'; }
      else if (rank === 2) { rankClass = 'td-rank-2'; medal = '<span class="td-medal">🥈</span>'; }
      else if (rank === 3) { rankClass = 'td-rank-3'; medal = '<span class="td-medal">🥉</span>'; }

      const scans = Math.round(m.scans * mul);
      const score = Math.min(100, Math.round(m.score * (1 + (mul - 1) * 0.02)));

      html += `<tr>
        <td class="${rankClass}">${medal}#${rank}</td>
        <td>${m.name}</td>
        <td>${scans}</td>
        <td>${m.avgResolution.toFixed(1)}h</td>
        <td><strong>${score}</strong>/100</td>
      </tr>`;
    });

    html += `</tbody></table></div></div>`;

    // Section 3: Pattern Trends
    const maxCount = PATTERN_TRENDS[0].count;
    html += `<div class="td-section">
      <h2 class="td-section-title">📊 Pattern Trends — Most Common Issues</h2>
      <div class="td-card">`;

    PATTERN_TRENDS.forEach(function (p) {
      const width = Math.round((p.count / maxCount) * 100);
      html += `<div class="td-bar-container">
        <span class="td-bar-label">${p.pattern}</span>
        <div style="flex:1;background:#1e1e2e;border-radius:4px;overflow:hidden;">
          <div class="td-bar" style="width:${width}%;">
            <span class="td-bar-count">${p.count}</span>
          </div>
        </div>
      </div>`;
    });

    html += `</div></div>`;

    // Section 4: Time Distribution Heatmap
    html += `<div class="td-section">
      <h2 class="td-section-title">⏰ Time Distribution — Team Activity by Hour</h2>
      <div class="td-card">
        <div class="td-heatmap">`;

    const maxActivity = Math.max.apply(null, TIME_DISTRIBUTION);
    TIME_DISTRIBUTION.forEach(function (val, hour) {
      let level = 0;
      if (val > 0) level = 1;
      if (val >= 3) level = 2;
      if (val >= 6) level = 3;
      if (val >= 8) level = 4;
      const isPeak = val >= 8;
      html += `<div class="td-heat-cell td-heat-${level} ${isPeak ? 'td-heat-peak' : ''}" 
        title="${hour}:00 - ${val} scans">${val > 0 ? val : ''}</div>`;
    });

    html += `</div><div class="td-heatmap" style="margin-top:4px;">`;
    for (let h = 0; h < 24; h++) {
      html += `<div class="td-heat-label">${h}</div>`;
    }
    html += `</div>
        <p style="font-size:12px;color:#888;margin-top:12px;">
          🟢 Peak hours: 8:00–10:00 AM and 3:00–5:00 PM IST | Cells show scan count per hour
        </p>
      </div>
    </div>`;

    // Section 5: Knowledge Gaps
    html += `<div class="td-section">
      <h2 class="td-section-title">📚 Knowledge Gaps — Needs Training</h2>
      <div class="td-card">`;

    KNOWLEDGE_GAPS.forEach(function (g) {
      html += `<div class="td-gap-item">
        <div>
          <div class="td-gap-pattern">${g.pattern}</div>
          <div class="td-gap-time">Avg resolution: ${g.avgTime}h (team avg: 1.4h)</div>
        </div>
        <span class="td-gap-topic">📖 ${g.topic}</span>
      </div>`;
    });

    html += `<p style="font-size:12px;color:#888;margin-top:16px;">
      💡 Suggested action: Schedule team workshops on above topics to reduce MTTR
    </p></div></div>`;

    // Section 6: License Utilization
    const usagePercent = Math.round((LICENSE_INFO.usedSeats / LICENSE_INFO.totalSeats) * 100);
    html += `<div class="td-section">
      <h2 class="td-section-title">🔑 License Utilization</h2>
      <div class="td-card">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span>Seats Used</span>
          <span><strong>${LICENSE_INFO.usedSeats}</strong> / ${LICENSE_INFO.totalSeats}</span>
        </div>
        <div class="td-license-bar">
          <div class="td-license-fill" style="width:${usagePercent}%;"></div>
          <span class="td-license-text">${usagePercent}% utilized</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:16px;">
          <div style="text-align:center;">
            <div style="font-size:20px;font-weight:700;color:#01a982;">${LICENSE_INFO.usedSeats}</div>
            <div style="font-size:11px;color:#888;">Active Licenses</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:20px;font-weight:700;color:#ffa500;">${LICENSE_INFO.totalSeats - LICENSE_INFO.usedSeats}</div>
            <div style="font-size:11px;color:#888;">Available</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:20px;font-weight:700;color:#ff6b6b;">${LICENSE_INFO.renewalDays}d</div>
            <div style="font-size:11px;color:#888;">Until Renewal</div>
          </div>
        </div>
        <p style="font-size:12px;color:#888;margin-top:16px;padding-top:12px;border-top:1px solid #3a3a5e;">
          📅 License expires: <strong style="color:#ffa500;">${LICENSE_INFO.expiryDate}</strong> | 
          ⚠️ Consider upgrading — 80% seats utilized
        </p>
      </div>
    </div>`;

    // Footer
    html += `<div style="text-align:center;padding:16px;color:#555;font-size:11px;">
      LogSherlock Pro — Team Dashboard | Generated: ${new Date().toLocaleString()} | Filter: ${filter}
    </div>`;

    return html;
  }


  // ============ MODAL CONTROLS ============
  let currentFilter = 'week';

  function injectStyles() {
    if (document.getElementById('td-styles')) return;
    const style = document.createElement('style');
    style.id = 'td-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  function openTeamDashboard() {
    injectStyles();

    // Remove existing overlay
    const existing = document.getElementById('td-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'td-overlay';
    overlay.className = 'td-modal-overlay';
    overlay.innerHTML = `<div class="td-modal" id="td-modal-content">${renderTeamDashboard(currentFilter)}</div>`;

    // Close on overlay click (not modal click)
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeTeamDashboard();
    });

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // ESC key to close
    document.addEventListener('keydown', _tdEscHandler);
  }

  function closeTeamDashboard() {
    const overlay = document.getElementById('td-overlay');
    if (overlay) {
      overlay.style.animation = 'td-fadeIn 0.2s ease reverse';
      setTimeout(function () {
        overlay.remove();
        document.body.style.overflow = '';
      }, 200);
    }
    document.removeEventListener('keydown', _tdEscHandler);
  }

  function _tdEscHandler(e) {
    if (e.key === 'Escape') closeTeamDashboard();
  }

  function _tdSetFilter(filter) {
    currentFilter = filter;
    const modal = document.getElementById('td-modal-content');
    if (modal) {
      modal.innerHTML = renderTeamDashboard(currentFilter);
    }
  }

  function _tdExportReport() {
    window.print();
  }

  // ============ GLOBAL EXPORTS ============
  window.renderTeamDashboard = renderTeamDashboard;
  window.openTeamDashboard = openTeamDashboard;
  window.closeTeamDashboard = closeTeamDashboard;
  window._tdSetFilter = _tdSetFilter;
  window._tdExportReport = _tdExportReport;

  // ============ SELF-INITIALIZE ============
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      injectStyles();
      console.log('[LogSherlock Pro] Team Dashboard module loaded ✓');
    });
  } else {
    injectStyles();
    console.log('[LogSherlock Pro] Team Dashboard module loaded ✓');
  }

})();
