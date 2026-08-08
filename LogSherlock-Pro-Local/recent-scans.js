/**
 * LogSherlock Pro — Recent Scans Library
 * Caches last 10 scan results for instant re-open without re-uploading.
 * Storage: localStorage (metadata) + IndexedDB session-persistence (full results)
 */
(function () {
  if (typeof window === 'undefined') return;

  const STORAGE_KEY = 'logsherlock_recent_scans';
  const MAX_SCANS = 10;
  const DB_NAME = 'LogSherlockPersistence';
  const DB_STORE = 'sessions';

  // ─── Time Formatting ───────────────────────────────────────────────────────

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    if (days < 7) return days + 'd ago';
    return new Date(dateStr).toLocaleDateString();
  }

  // ─── Storage Helpers ───────────────────────────────────────────────────────

  function loadScans() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('[RecentScans] Failed to load from localStorage:', e);
      return [];
    }
  }

  function saveScans(scans) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scans));
    } catch (e) {
      console.warn('[RecentScans] Failed to save to localStorage:', e);
    }
  }

  // ─── IndexedDB Helpers ─────────────────────────────────────────────────────

  function openDB() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = function (e) { resolve(e.target.result); };
      request.onerror = function (e) { reject(e.target.error); };
    });
  }

  function loadFullResultFromDB(scanId) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(DB_STORE, 'readonly');
        var store = tx.objectStore(DB_STORE);
        var request = store.get(scanId);
        request.onsuccess = function () { resolve(request.result || null); };
        request.onerror = function () { reject(request.error); };
      });
    });
  }

  // ─── Core API ──────────────────────────────────────────────────────────────

  function getRecentScans() {
    return loadScans();
  }

  function addRecentScan(data) {
    if (!data) return;

    var entry = {
      id: data.id || ('scan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)),
      filename: data.filename || 'Unknown file',
      timestamp: data.timestamp || new Date().toISOString(),
      findings_count: typeof data.findings_count === 'number' ? data.findings_count : (data.findings ? data.findings.length : 0),
      files_analyzed: typeof data.files_analyzed === 'number' ? data.files_analyzed : 0,
      total_lines: typeof data.total_lines === 'number' ? data.total_lines : 0,
      critical_count: typeof data.critical_count === 'number' ? data.critical_count : 0,
      high_count: typeof data.high_count === 'number' ? data.high_count : 0,
      top_patterns: Array.isArray(data.top_patterns) ? data.top_patterns.slice(0, 5) : []
    };

    var scans = loadScans();

    // Remove duplicate if same id exists
    scans = scans.filter(function (s) { return s.id !== entry.id; });

    // Add to front
    scans.unshift(entry);

    // Keep max 10
    if (scans.length > MAX_SCANS) {
      scans = scans.slice(0, MAX_SCANS);
    }

    saveScans(scans);
    return entry;
  }

  function removeScan(scanId) {
    var scans = loadScans();
    scans = scans.filter(function (s) { return s.id !== scanId; });
    saveScans(scans);
  }

  function clearAllScans() {
    saveScans([]);
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  function renderRecentScansPanel(containerSelector) {
    var container = containerSelector
      ? document.querySelector(containerSelector)
      : document.getElementById('recent-scans-panel');

    if (!container) {
      container = document.createElement('div');
      container.id = 'recent-scans-panel';
      var mainContent = document.querySelector('.main-content') || document.querySelector('main') || document.body;
      mainContent.appendChild(container);
    }

    var scans = loadScans();

    var styles = '\
      .rs-panel {\
        background: #1e1e2e;\
        border: 1px solid #333346;\
        border-radius: 12px;\
        padding: 24px;\
        margin: 16px 0;\
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;\
        color: #cdd6f4;\
      }\
      .rs-title {\
        font-size: 1.3rem;\
        font-weight: 700;\
        color: #01a982;\
        margin-bottom: 16px;\
      }\
      .rs-empty {\
        color: #6c7086;\
        font-style: italic;\
        padding: 20px 0;\
        text-align: center;\
      }\
      .rs-card {\
        background: #181825;\
        border: 1px solid #333346;\
        border-radius: 8px;\
        padding: 16px;\
        margin-bottom: 12px;\
        transition: border-color 0.2s;\
      }\
      .rs-card:hover {\
        border-color: #01a982;\
      }\
      .rs-card-header {\
        display: flex;\
        justify-content: space-between;\
        align-items: flex-start;\
        margin-bottom: 8px;\
      }\
      .rs-filename {\
        font-weight: 600;\
        color: #cdd6f4;\
        font-size: 0.95rem;\
        word-break: break-all;\
      }\
      .rs-time {\
        color: #6c7086;\
        font-size: 0.8rem;\
        white-space: nowrap;\
        margin-left: 12px;\
      }\
      .rs-stats {\
        display: flex;\
        gap: 12px;\
        flex-wrap: wrap;\
        margin-bottom: 8px;\
        font-size: 0.82rem;\
      }\
      .rs-stat {\
        color: #a6adc8;\
      }\
      .rs-stat-value {\
        font-weight: 600;\
        color: #cdd6f4;\
      }\
      .rs-badge {\
        display: inline-block;\
        padding: 2px 8px;\
        border-radius: 10px;\
        font-size: 0.72rem;\
        font-weight: 600;\
        margin-right: 6px;\
      }\
      .rs-badge-critical {\
        background: rgba(243, 67, 67, 0.15);\
        color: #f34343;\
        border: 1px solid rgba(243, 67, 67, 0.3);\
      }\
      .rs-badge-high {\
        background: rgba(250, 176, 5, 0.15);\
        color: #fab005;\
        border: 1px solid rgba(250, 176, 5, 0.3);\
      }\
      .rs-patterns {\
        display: flex;\
        gap: 6px;\
        flex-wrap: wrap;\
        margin: 8px 0;\
      }\
      .rs-pattern-tag {\
        background: rgba(1, 169, 130, 0.1);\
        color: #01a982;\
        border: 1px solid rgba(1, 169, 130, 0.25);\
        padding: 2px 8px;\
        border-radius: 4px;\
        font-size: 0.72rem;\
      }\
      .rs-actions {\
        display: flex;\
        gap: 8px;\
        margin-top: 10px;\
      }\
      .rs-btn {\
        padding: 6px 14px;\
        border-radius: 6px;\
        font-size: 0.8rem;\
        font-weight: 500;\
        cursor: pointer;\
        border: none;\
        transition: all 0.2s;\
      }\
      .rs-btn-load {\
        background: #01a982;\
        color: #1e1e2e;\
      }\
      .rs-btn-load:hover {\
        background: #00c896;\
      }\
      .rs-btn-remove {\
        background: transparent;\
        color: #6c7086;\
        border: 1px solid #333346;\
      }\
      .rs-btn-remove:hover {\
        color: #f34343;\
        border-color: #f34343;\
      }\
      .rs-clear-all {\
        display: block;\
        margin: 16px auto 0;\
        padding: 8px 20px;\
        background: transparent;\
        color: #6c7086;\
        border: 1px solid #333346;\
        border-radius: 6px;\
        font-size: 0.82rem;\
        cursor: pointer;\
        transition: all 0.2s;\
      }\
      .rs-clear-all:hover {\
        color: #f34343;\
        border-color: #f34343;\
      }\
      .rs-note {\
        color: #6c7086;\
        font-size: 0.75rem;\
        text-align: center;\
        margin-top: 14px;\
        font-style: italic;\
      }\
    ';

    var html = '<style>' + styles + '</style>';
    html += '<div class="rs-panel">';
    html += '<div class="rs-title">🕐 Recent Scans Library</div>';

    if (scans.length === 0) {
      html += '<div class="rs-empty">No recent scans. Scan a log bundle and it will appear here for quick reference.</div>';
    } else {
      scans.forEach(function (scan) {
        html += '<div class="rs-card" data-scan-id="' + scan.id + '">';
        html += '<div class="rs-card-header">';
        html += '<span class="rs-filename">' + escapeHtml(scan.filename) + '</span>';
        html += '<span class="rs-time">' + timeAgo(scan.timestamp) + '</span>';
        html += '</div>';

        // Stats row
        html += '<div class="rs-stats">';
        html += '<span class="rs-stat"><span class="rs-stat-value">' + scan.findings_count + '</span> findings</span>';
        html += '<span class="rs-stat"><span class="rs-stat-value">' + scan.files_analyzed + '</span> files</span>';
        html += '<span class="rs-stat"><span class="rs-stat-value">' + formatNumber(scan.total_lines) + '</span> lines</span>';
        html += '</div>';

        // Severity badges
        if (scan.critical_count > 0 || scan.high_count > 0) {
          html += '<div>';
          if (scan.critical_count > 0) {
            html += '<span class="rs-badge rs-badge-critical">' + scan.critical_count + ' Critical</span>';
          }
          if (scan.high_count > 0) {
            html += '<span class="rs-badge rs-badge-high">' + scan.high_count + ' High</span>';
          }
          html += '</div>';
        }

        // Top 3 patterns
        if (scan.top_patterns && scan.top_patterns.length > 0) {
          html += '<div class="rs-patterns">';
          scan.top_patterns.slice(0, 3).forEach(function (pattern) {
            html += '<span class="rs-pattern-tag">' + escapeHtml(pattern) + '</span>';
          });
          html += '</div>';
        }

        // Action buttons
        html += '<div class="rs-actions">';
        html += '<button class="rs-btn rs-btn-load" data-action="load" data-id="' + scan.id + '">Load Results</button>';
        html += '<button class="rs-btn rs-btn-remove" data-action="remove" data-id="' + scan.id + '">Remove</button>';
        html += '</div>';

        html += '</div>'; // .rs-card
      });

      html += '<button class="rs-clear-all" data-action="clear-all">Clear All History</button>';
      html += '<div class="rs-note">Scan metadata stored locally. Full results available for reload if Session Persistence is active.</div>';
    }

    html += '</div>'; // .rs-panel
    container.innerHTML = html;

    // Attach event listeners
    attachPanelEvents(container);
  }

  // ─── Event Handlers ────────────────────────────────────────────────────────

  function attachPanelEvents(container) {
    container.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;

      var action = btn.getAttribute('data-action');
      var id = btn.getAttribute('data-id');

      if (action === 'load' && id) {
        handleLoadScan(id);
      } else if (action === 'remove' && id) {
        removeScan(id);
        renderRecentScansPanel();
      } else if (action === 'clear-all') {
        if (confirm('Clear all recent scan history? This cannot be undone.')) {
          clearAllScans();
          renderRecentScansPanel();
        }
      }
    });
  }

  function handleLoadScan(scanId) {
    loadFullResultFromDB(scanId).then(function (result) {
      if (result) {
        // Dispatch custom event with loaded data for the app to handle
        var event = new CustomEvent('logsherlock:scan-loaded', {
          detail: { scanId: scanId, data: result }
        });
        window.dispatchEvent(event);
        console.log('[RecentScans] Loaded full results for scan:', scanId);
      } else {
        // No full results in IndexedDB — notify user
        var event = new CustomEvent('logsherlock:scan-load-unavailable', {
          detail: { scanId: scanId }
        });
        window.dispatchEvent(event);
        console.warn('[RecentScans] Full results not available in IndexedDB for scan:', scanId, '— Session Persistence may not have been active.');
        alert('Full results not available. Session Persistence must be active during the scan to reload results.');
      }
    }).catch(function (err) {
      console.error('[RecentScans] Error loading scan from IndexedDB:', err);
      alert('Failed to load scan results. The data may no longer be available.');
    });
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function formatNumber(num) {
    if (typeof num !== 'number') return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  // ─── Self-Initialize ───────────────────────────────────────────────────────

  function init() {
    console.log('[RecentScans] Module initialized. ' + loadScans().length + ' cached scan(s) available.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  window.addRecentScan = addRecentScan;
  window.renderRecentScansPanel = renderRecentScansPanel;
  window.getRecentScans = getRecentScans;

})();
