/**
 * LogSherlock Pro — Session Persistence Module
 * Auto-saves scan results to IndexedDB for seamless resume after page reload.
 * Dark theme: #1e1e2e background, #01a982 green accent
 */
(function () {
  if (typeof window === 'undefined') return;

  const DB_NAME = 'LogSherlockSessions';
  const DB_VERSION = 1;
  const STORE_NAME = 'sessions';
  const MAX_SESSIONS = 5;
  const CONFIG_KEY = 'logsherlock_session_config';

  // ─── IndexedDB Helper ───────────────────────────────────────────────────────

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB not available'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function dbTransaction(mode, callback) {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const result = callback(store);
        tx.oncomplete = () => {
          db.close();
          resolve(result._result || result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
        // Handle IDBRequest results
        if (result instanceof IDBRequest) {
          result.onsuccess = () => {
            result._result = result.result;
          };
        }
      });
    });
  }

  function getAllSessions() {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          db.close();
          resolve(req.result || []);
        };
        req.onerror = () => {
          db.close();
          reject(req.error);
        };
      });
    });
  }

  function addSession(session) {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.add(session);
        req.onsuccess = () => {
          db.close();
          resolve(req.result);
        };
        req.onerror = () => {
          db.close();
          reject(req.error);
        };
      });
    });
  }

  function deleteSession(id) {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      });
    });
  }

  function clearAllSessions() {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      });
    });
  }

  function getSessionById(id) {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => {
          db.close();
          resolve(req.result || null);
        };
        req.onerror = () => {
          db.close();
          reject(req.error);
        };
      });
    });
  }

  // ─── Utilities ──────────────────────────────────────────────────────────────

  function timeAgo(isoString) {
    const now = Date.now();
    const then = new Date(isoString).getTime();
    const diff = Math.floor((now - then) / 1000);

    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }

  function formatTimestamp(isoString) {
    const d = new Date(isoString);
    return d.toLocaleString();
  }

  function estimateSize(sessions) {
    const json = JSON.stringify(sessions);
    const bytes = new Blob([json]).size;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }

  function saveConfig(key, value) {
    try {
      localStorage.setItem(CONFIG_KEY + '_' + key, JSON.stringify(value));
    } catch (e) {
      // localStorage not available
    }
  }

  function loadConfig(key) {
    try {
      const val = localStorage.getItem(CONFIG_KEY + '_' + key);
      return val ? JSON.parse(val) : null;
    } catch (e) {
      return null;
    }
  }

  // ─── Auto-Cleanup ──────────────────────────────────────────────────────────

  async function enforceMaxSessions() {
    try {
      const sessions = await getAllSessions();
      if (sessions.length > MAX_SESSIONS) {
        // Sort by timestamp ascending (oldest first)
        sessions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        const toDelete = sessions.slice(0, sessions.length - MAX_SESSIONS);
        for (const s of toDelete) {
          await deleteSession(s.id);
        }
      }
    } catch (e) {
      console.warn('[LogSherlock] Auto-cleanup failed:', e.message);
    }
  }

  // ─── Save Session ──────────────────────────────────────────────────────────

  async function saveSession(data) {
    if (!data || typeof data !== 'object') {
      console.warn('[LogSherlock] saveSession: invalid data');
      return null;
    }

    const session = {
      timestamp: new Date().toISOString(),
      filename: data.filename || 'unknown',
      findings: Array.isArray(data.findings) ? data.findings : [],
      findings_count: typeof data.findings_count === 'number' ? data.findings_count : (Array.isArray(data.findings) ? data.findings.length : 0),
      files_analyzed: typeof data.files_analyzed === 'number' ? data.files_analyzed : 1,
      total_lines: typeof data.total_lines === 'number' ? data.total_lines : 0,
      pins: Array.isArray(data.pins) ? data.pins : [],
      scroll_position: typeof data.scroll_position === 'number' ? data.scroll_position : 0
    };

    try {
      const id = await addSession(session);
      saveConfig('last_saved', session.timestamp);
      await enforceMaxSessions();
      console.log('[LogSherlock] Session saved:', session.filename);
      return id;
    } catch (e) {
      console.warn('[LogSherlock] Failed to save session:', e.message);
      return null;
    }
  }

  // ─── Resume Banner ─────────────────────────────────────────────────────────

  function showResumeBanner(session) {
    // Remove existing banner if any
    const existing = document.getElementById('logsherlock-resume-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'logsherlock-resume-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 10000;
      background: #2a2a3e;
      border-bottom: 2px solid #01a982;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 14px;
      color: #e0e0e0;
      box-shadow: 0 2px 12px rgba(0,0,0,0.4);
      animation: slideDown 0.3s ease-out;
    `;

    const info = document.createElement('span');
    info.textContent = '\u{1F4BE} Previous session available: ' + session.filename + ' \u2022 ' + session.findings_count + ' findings \u2022 ' + timeAgo(session.timestamp);
    info.style.cssText = 'flex: 1;';

    const btnResume = document.createElement('button');
    btnResume.textContent = 'Resume';
    btnResume.style.cssText = `
      background: #01a982;
      color: #fff;
      border: none;
      padding: 6px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      margin-left: 12px;
      transition: background 0.2s;
    `;
    btnResume.onmouseenter = () => { btnResume.style.background = '#02c49a'; };
    btnResume.onmouseleave = () => { btnResume.style.background = '#01a982'; };
    btnResume.onclick = () => {
      banner.remove();
      resumeSession(session);
    };

    const btnDismiss = document.createElement('button');
    btnDismiss.textContent = 'Dismiss';
    btnDismiss.style.cssText = `
      background: transparent;
      color: #888;
      border: 1px solid #555;
      padding: 6px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      margin-left: 8px;
      transition: border-color 0.2s, color 0.2s;
    `;
    btnDismiss.onmouseenter = () => { btnDismiss.style.borderColor = '#01a982'; btnDismiss.style.color = '#ccc'; };
    btnDismiss.onmouseleave = () => { btnDismiss.style.borderColor = '#555'; btnDismiss.style.color = '#888'; };
    btnDismiss.onclick = () => {
      banner.style.animation = 'slideUp 0.2s ease-in forwards';
      setTimeout(() => banner.remove(), 200);
    };

    banner.appendChild(info);
    banner.appendChild(btnResume);
    banner.appendChild(btnDismiss);

    // Inject animation keyframes
    if (!document.getElementById('logsherlock-banner-styles')) {
      const style = document.createElement('style');
      style.id = 'logsherlock-banner-styles';
      style.textContent = `
        @keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }
        @keyframes slideUp { from { transform: translateY(0); } to { transform: translateY(-100%); } }
      `;
      document.head.appendChild(style);
    }

    document.body.prepend(banner);
  }

  // ─── Resume Session ────────────────────────────────────────────────────────

  function resumeSession(session) {
    if (typeof window.render === 'function') {
      window.render(session);
    } else {
      console.warn('[LogSherlock] window.render not available. Session data:', session);
    }

    // Restore scroll position
    if (session.scroll_position && session.scroll_position > 0) {
      setTimeout(() => {
        window.scrollTo({ top: session.scroll_position, behavior: 'smooth' });
      }, 300);
    }
  }

  // ─── Session History Panel ─────────────────────────────────────────────────

  async function renderSessionPanel(container) {
    const target = container || document.getElementById('logsherlock-session-panel');
    if (!target) {
      console.warn('[LogSherlock] No container for session panel');
      return;
    }

    let sessions = [];
    let dbAvailable = true;

    try {
      sessions = await getAllSessions();
      // Sort by timestamp descending (newest first)
      sessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      // Limit to max 5
      sessions = sessions.slice(0, MAX_SESSIONS);
    } catch (e) {
      dbAvailable = false;
    }

    const lastSaved = loadConfig('last_saved');

    let html = `
      <div style="background:#1e1e2e; border:1px solid #333; border-radius:8px; padding:20px; font-family:'Segoe UI',system-ui,sans-serif; color:#e0e0e0;">
        <h3 style="margin:0 0 16px 0; font-size:16px; color:#01a982;">\u{1F4BE} Session Persistence</h3>
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:8px 12px; background:#2a2a3e; border-radius:6px;">
          <span style="color:#ccc; font-size:13px;">Auto-save: <span style="color:#01a982; font-weight:600;">Active \u2713</span></span>
          <span style="color:#888; font-size:12px;">Last saved: ${lastSaved ? formatTimestamp(lastSaved) : 'Never'}</span>
        </div>
    `;

    if (!dbAvailable) {
      html += `
        <div style="padding:16px; text-align:center; color:#ff6b6b; font-size:13px; background:#2a2a3e; border-radius:6px;">
          \u26A0\uFE0F IndexedDB unavailable (private browsing mode?)
        </div>
      `;
    } else if (sessions.length === 0) {
      html += `
        <div style="padding:24px 16px; text-align:center; color:#888; font-size:13px; background:#2a2a3e; border-radius:6px;">
          No saved sessions. Scan results will auto-save for easy resume.
        </div>
      `;
    } else {
      html += `<div style="margin-bottom:12px;">`;
      sessions.forEach((s) => {
        html += `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; margin-bottom:6px; background:#2a2a3e; border-radius:6px; border-left:3px solid #01a982;">
            <div style="flex:1; min-width:0;">
              <div style="font-size:13px; font-weight:600; color:#e0e0e0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(s.filename)}</div>
              <div style="font-size:11px; color:#888; margin-top:2px;">${timeAgo(s.timestamp)} \u2022 ${s.findings_count} findings</div>
            </div>
            <div style="display:flex; gap:6px; margin-left:12px;">
              <button onclick="window._loadSession(${s.id})" style="background:#01a982; color:#fff; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:11px; font-weight:600;">Load</button>
              <button onclick="window._deleteSession(${s.id})" style="background:transparent; color:#ff6b6b; border:1px solid #ff6b6b; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:11px;">Delete</button>
            </div>
          </div>
        `;
      });
      html += `</div>`;

      // Storage usage
      const size = estimateSize(sessions);
      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding-top:12px; border-top:1px solid #333;">
          <span style="font-size:12px; color:#888;">Storage: ${size} \u2022 ${sessions.length}/${MAX_SESSIONS} sessions</span>
          <button onclick="window._clearAllSessions()" style="background:transparent; color:#ff6b6b; border:1px solid #ff6b6b; padding:4px 12px; border-radius:4px; cursor:pointer; font-size:11px;">Clear All Sessions</button>
        </div>
      `;
    }

    html += `</div>`;
    target.innerHTML = html;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ─── Panel Action Handlers ─────────────────────────────────────────────────

  window._loadSession = async function (id) {
    try {
      const session = await getSessionById(id);
      if (session) {
        resumeSession(session);
      }
    } catch (e) {
      console.warn('[LogSherlock] Failed to load session:', e.message);
    }
  };

  window._deleteSession = async function (id) {
    try {
      await deleteSession(id);
      // Re-render panel
      renderSessionPanel();
    } catch (e) {
      console.warn('[LogSherlock] Failed to delete session:', e.message);
    }
  };

  window._clearAllSessions = async function () {
    try {
      await clearAllSessions();
      saveConfig('last_saved', null);
      // Re-render panel
      renderSessionPanel();
    } catch (e) {
      console.warn('[LogSherlock] Failed to clear sessions:', e.message);
    }
  };

  // ─── Initialization ────────────────────────────────────────────────────────

  async function initSessionPersistence() {
    try {
      const sessions = await getAllSessions();
      if (sessions.length > 0) {
        // Sort by timestamp descending, get most recent
        sessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const latest = sessions[0];
        showResumeBanner(latest);
      }
    } catch (e) {
      console.warn('[LogSherlock] Session persistence unavailable:', e.message);
    }
  }

  // ─── Self-Initialize ───────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSessionPersistence);
  } else {
    initSessionPersistence();
  }

  // ─── Exports ───────────────────────────────────────────────────────────────

  window.saveSession = saveSession;
  window.renderSessionPanel = renderSessionPanel;
  window.initSessionPersistence = initSessionPersistence;

})();
