/**
 * LogSherlock Pro - Audit Trail Module
 * ISO/SOC Compliance Audit Logging
 * 
 * Tracks all user actions in localStorage for enterprise compliance.
 * Self-initializing, standalone module.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'logsherlock_audit_log';
  const USER_KEY = 'logsherlock_user_name';
  const MAX_EVENTS = 1000;

  const VALID_ACTIONS = [
    'SCAN_STARTED',
    'SCAN_COMPLETED',
    'REPORT_EXPORTED',
    'LICENSE_ACTIVATED',
    'PATTERN_SEARCH',
    'AI_QUERY',
    'DEMO_MODE_USED',
    'SETTINGS_CHANGED'
  ];

  // ─── Core Functions ────────────────────────────────────────────────────────

  /**
   * Get the current user name from localStorage
   */
  function getCurrentUser() {
    return localStorage.getItem(USER_KEY) || 'Anonymous';
  }

  /**
   * Get all audit log events from localStorage
   * @returns {Array} Array of audit event objects
   */
  function getAuditLog() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('[AuditTrail] Failed to parse audit log:', e);
      return [];
    }
  }

  /**
   * Log an audit event to localStorage
   * @param {string} action - One of the VALID_ACTIONS
   * @param {object} details - Event-specific details
   */
  function logAuditEvent(action, details = {}) {
    if (!VALID_ACTIONS.includes(action)) {
      console.warn(`[AuditTrail] Unknown action: ${action}. Logging anyway.`);
    }

    const event = {
      id: generateEventId(),
      timestamp: new Date().toISOString(),
      user: getCurrentUser(),
      action: action,
      details: details
    };

    const log = getAuditLog();
    log.push(event);

    // FIFO: drop oldest events if over max
    while (log.length > MAX_EVENTS) {
      log.shift();
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
    } catch (e) {
      console.error('[AuditTrail] Failed to save audit log:', e);
      // If storage is full, drop oldest 100 and retry
      if (e.name === 'QuotaExceededError') {
        log.splice(0, 100);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
        } catch (e2) {
          console.error('[AuditTrail] Storage critically full:', e2);
        }
      }
    }

    return event;
  }

  /**
   * Export audit log as CSV string and trigger download
   * @returns {string} CSV content
   */
  function exportAuditLog() {
    const log = getAuditLog();
    const headers = ['Timestamp', 'User', 'Action', 'Details'];
    const rows = log.map(event => [
      event.timestamp,
      escapeCSV(event.user),
      event.action,
      escapeCSV(JSON.stringify(event.details))
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Trigger download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `logsherlock_audit_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logAuditEvent('REPORT_EXPORTED', { format: 'CSV', type: 'audit_log' });

    return csv;
  }

  /**
   * Clear the audit log with confirmation
   * @returns {boolean} Whether the log was cleared
   */
  function clearAuditLog() {
    const log = getAuditLog();
    const count = log.length;

    if (!confirm(`Are you sure you want to clear ${count} audit log entries?\n\nThis action cannot be undone and may affect compliance records.`)) {
      return false;
    }

    localStorage.removeItem(STORAGE_KEY);
    refreshAuditPanel();
    return true;
  }

  // ─── Panel Rendering ───────────────────────────────────────────────────────

  /**
   * Render the audit trail panel HTML
   * @returns {string} HTML string for the audit trail panel
   */
  function renderAuditTrailPanel() {
    const log = getAuditLog();
    const storageSize = getStorageSize();

    return `
      <div id="audit-trail-panel" style="
        background: #1e1e2e;
        border: 1px solid #01a982;
        border-radius: 8px;
        padding: 20px;
        margin-top: 20px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        color: #e0e0e0;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0; color: #01a982; font-size: 18px;">
            🛡️ Audit Trail <span style="font-size: 12px; color: #888; font-weight: normal;">(ISO/SOC Compliance)</span>
          </h3>
          <div style="font-size: 12px; color: #888;">
            <span>${log.length} events</span> · <span>${storageSize}</span>
          </div>
        </div>

        <!-- Filters -->
        <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; align-items: center;">
          <div>
            <label style="font-size: 11px; color: #888; display: block; margin-bottom: 2px;">Action Type</label>
            <select id="audit-filter-action" onchange="window.__auditTrail.applyFilters()" style="
              background: #2a2a3e;
              color: #e0e0e0;
              border: 1px solid #444;
              border-radius: 4px;
              padding: 6px 10px;
              font-size: 13px;
              cursor: pointer;
            ">
              <option value="">All Actions</option>
              ${VALID_ACTIONS.map(a => `<option value="${a}">${a}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size: 11px; color: #888; display: block; margin-bottom: 2px;">From</label>
            <input type="date" id="audit-filter-from" onchange="window.__auditTrail.applyFilters()" style="
              background: #2a2a3e;
              color: #e0e0e0;
              border: 1px solid #444;
              border-radius: 4px;
              padding: 6px 10px;
              font-size: 13px;
            " />
          </div>
          <div>
            <label style="font-size: 11px; color: #888; display: block; margin-bottom: 2px;">To</label>
            <input type="date" id="audit-filter-to" onchange="window.__auditTrail.applyFilters()" style="
              background: #2a2a3e;
              color: #e0e0e0;
              border: 1px solid #444;
              border-radius: 4px;
              padding: 6px 10px;
              font-size: 13px;
            " />
          </div>
          <div style="margin-left: auto; display: flex; gap: 8px; align-self: flex-end;">
            <button onclick="window.__auditTrail.exportAuditLog()" style="
              background: #01a982;
              color: #fff;
              border: none;
              border-radius: 4px;
              padding: 7px 14px;
              font-size: 13px;
              cursor: pointer;
              font-weight: 500;
            ">📥 Export CSV</button>
            <button onclick="window.__auditTrail.clearAuditLog()" style="
              background: #cc3333;
              color: #fff;
              border: none;
              border-radius: 4px;
              padding: 7px 14px;
              font-size: 13px;
              cursor: pointer;
              font-weight: 500;
            ">🗑️ Clear</button>
          </div>
        </div>

        <!-- Table -->
        <div id="audit-table-container" style="
          max-height: 400px;
          overflow-y: auto;
          border: 1px solid #333;
          border-radius: 4px;
        ">
          ${renderAuditTable(log)}
        </div>
      </div>
    `;
  }

  /**
   * Render the audit table HTML from a list of events
   * @param {Array} events - Array of audit events to render
   * @returns {string} HTML table string
   */
  function renderAuditTable(events) {
    if (events.length === 0) {
      return `
        <div style="padding: 40px; text-align: center; color: #666;">
          <p style="font-size: 16px; margin: 0;">No audit events recorded</p>
          <p style="font-size: 12px; margin-top: 8px;">Actions will appear here as they occur</p>
        </div>
      `;
    }

    const rows = events.slice().reverse().map((event, index) => {
      const bg = index % 2 === 0 ? '#2a2a3e' : '#1e1e2e';
      const formattedTime = formatTimestamp(event.timestamp);
      const detailsStr = formatDetails(event.details);

      return `
        <tr style="background: ${bg};">
          <td style="padding: 8px 12px; font-size: 12px; white-space: nowrap; color: #aaa;">${formattedTime}</td>
          <td style="padding: 8px 12px; font-size: 12px; color: #e0e0e0;">${escapeHTML(event.user)}</td>
          <td style="padding: 8px 12px; font-size: 12px;">
            <span style="
              background: ${getActionColor(event.action)};
              color: #fff;
              padding: 2px 8px;
              border-radius: 3px;
              font-size: 11px;
              font-weight: 500;
            ">${event.action}</span>
          </td>
          <td style="padding: 8px 12px; font-size: 12px; color: #bbb; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHTML(detailsStr)}">${escapeHTML(detailsStr)}</td>
        </tr>
      `;
    }).join('');

    return `
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background: #01a982; color: #fff; position: sticky; top: 0;">
            <th style="padding: 10px 12px; text-align: left; font-weight: 600; font-size: 12px;">Timestamp</th>
            <th style="padding: 10px 12px; text-align: left; font-weight: 600; font-size: 12px;">User</th>
            <th style="padding: 10px 12px; text-align: left; font-weight: 600; font-size: 12px;">Action</th>
            <th style="padding: 10px 12px; text-align: left; font-weight: 600; font-size: 12px;">Details</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  // ─── Filter Logic ──────────────────────────────────────────────────────────

  /**
   * Apply filters and re-render the audit table
   */
  function applyFilters() {
    const actionFilter = document.getElementById('audit-filter-action');
    const fromFilter = document.getElementById('audit-filter-from');
    const toFilter = document.getElementById('audit-filter-to');

    if (!actionFilter || !fromFilter || !toFilter) return;

    const selectedAction = actionFilter.value;
    const fromDate = fromFilter.value ? new Date(fromFilter.value + 'T00:00:00') : null;
    const toDate = toFilter.value ? new Date(toFilter.value + 'T23:59:59') : null;

    let log = getAuditLog();

    if (selectedAction) {
      log = log.filter(e => e.action === selectedAction);
    }

    if (fromDate) {
      log = log.filter(e => new Date(e.timestamp) >= fromDate);
    }

    if (toDate) {
      log = log.filter(e => new Date(e.timestamp) <= toDate);
    }

    const container = document.getElementById('audit-table-container');
    if (container) {
      container.innerHTML = renderAuditTable(log);
    }
  }

  /**
   * Refresh the entire audit panel if it exists in the DOM
   */
  function refreshAuditPanel() {
    const panel = document.getElementById('audit-trail-panel');
    if (panel) {
      panel.outerHTML = renderAuditTrailPanel();
    }
  }

  // ─── Utility Functions ─────────────────────────────────────────────────────

  function generateEventId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
  }

  function formatTimestamp(isoString) {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (e) {
      return isoString;
    }
  }

  function formatDetails(details) {
    if (!details || Object.keys(details).length === 0) return '—';
    const parts = [];
    for (const [key, value] of Object.entries(details)) {
      if (key === 'timestamp') continue; // Skip redundant timestamp in details
      if (Array.isArray(value)) {
        parts.push(`${key}: [${value.length} items]`);
      } else {
        parts.push(`${key}: ${value}`);
      }
    }
    return parts.join(' | ');
  }

  function getActionColor(action) {
    const colors = {
      'SCAN_STARTED': '#2196F3',
      'SCAN_COMPLETED': '#01a982',
      'REPORT_EXPORTED': '#9C27B0',
      'LICENSE_ACTIVATED': '#FF9800',
      'PATTERN_SEARCH': '#00BCD4',
      'AI_QUERY': '#E91E63',
      'DEMO_MODE_USED': '#607D8B',
      'SETTINGS_CHANGED': '#FFC107'
    };
    return colors[action] || '#555';
  }

  function getStorageSize() {
    const raw = localStorage.getItem(STORAGE_KEY) || '';
    const bytes = new Blob([raw]).size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function escapeCSV(str) {
    if (!str) return '';
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ─── Global Exposure & Self-Initialization ─────────────────────────────────

  // Expose API globally for other modules
  window.__auditTrail = {
    logAuditEvent,
    getAuditLog,
    exportAuditLog,
    clearAuditLog,
    renderAuditTrailPanel,
    applyFilters,
    refreshAuditPanel
  };

  // Also expose logAuditEvent directly for convenience
  window.logAuditEvent = logAuditEvent;

  // Self-initialize on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    console.log('[AuditTrail] ✅ Module initialized. Events tracked:', getAuditLog().length);
  }

  // ─── Module Exports (for ES module or CommonJS environments) ───────────────

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      renderAuditTrailPanel,
      logAuditEvent,
      getAuditLog,
      exportAuditLog,
      clearAuditLog
    };
  }

  if (typeof exports !== 'undefined') {
    exports.renderAuditTrailPanel = renderAuditTrailPanel;
    exports.logAuditEvent = logAuditEvent;
    exports.getAuditLog = getAuditLog;
    exports.exportAuditLog = exportAuditLog;
    exports.clearAuditLog = clearAuditLog;
  }

})();
