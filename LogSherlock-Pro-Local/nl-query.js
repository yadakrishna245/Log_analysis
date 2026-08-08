/**
 * LogSherlock Pro — Natural Language Query Module
 * 100% offline plain-English query parser for scan findings.
 * No AI APIs, no fake data — filters ONLY real scan results.
 */
(function () {
  if (typeof window === 'undefined') return;

  // ─── Query Parser ───────────────────────────────────────────────────────────
  function parseQuery(query, findings) {
    if (!findings || !findings.length) return [];
    let results = [...findings];
    const q = query.toLowerCase().trim();

    // Count query detection
    const isCountQuery = /^(how many|count|total|number of)\b/.test(q);

    // Negation — collect negated terms early
    const negTerms = [];
    const negMatches = q.matchAll(/(?:not|exclude|without)\s+(\S+)/gi);
    for (const m of negMatches) {
      negTerms.push(m[1].toLowerCase());
    }

    // Severity filter
    const severities = ['critical', 'high', 'medium', 'low', 'info'];
    for (const s of severities) {
      if (q.includes(s) && !negTerms.includes(s)) {
        results = results.filter(f => (f.severity || '').toLowerCase() === s);
      }
    }

    // Category filter
    const categories = ['storage', 'network', 'cluster', 'memory', 'kernel', 'filesystem', 'security', 'hardware'];
    for (const c of categories) {
      if (q.includes(c) && !negTerms.includes(c)) {
        results = results.filter(f => (f.category || '').toLowerCase().includes(c));
      }
    }

    // File filter
    const fileMatch = q.match(/(?:in|from|file)\s+(\S+)/i);
    if (fileMatch) {
      const fileToken = fileMatch[1].toLowerCase();
      // Don't apply if the token is a category or severity we already handled
      if (!severities.includes(fileToken) && !categories.includes(fileToken)) {
        results = results.filter(f => (f.file || '').toLowerCase().includes(fileToken));
      }
    }

    // Time filter
    const timeAfter = q.match(/after\s+(\d{1,2})\s*(am|pm)?/i);
    const timeBefore = q.match(/before\s+(\d{1,2})\s*(am|pm)?/i);
    const timeBetween = q.match(/between\s+(\d{1,2})\s*(am|pm)?\s+and\s+(\d{1,2})\s*(am|pm)?/i);

    if (timeBetween) {
      const startHr = parseHour(timeBetween[1], timeBetween[2]);
      const endHr = parseHour(timeBetween[3], timeBetween[4]);
      results = results.filter(f => {
        const hr = extractHour(f.log_timestamp);
        return hr !== null && hr >= startHr && hr <= endHr;
      });
    } else if (timeAfter) {
      const hr = parseHour(timeAfter[1], timeAfter[2]);
      results = results.filter(f => {
        const fh = extractHour(f.log_timestamp);
        return fh !== null && fh >= hr;
      });
    } else if (timeBefore) {
      let hr = parseHour(timeBefore[1], timeBefore[2]);
      if (q.includes('noon')) hr = 12;
      results = results.filter(f => {
        const fh = extractHour(f.log_timestamp);
        return fh !== null && fh < hr;
      });
    } else if (q.includes('before noon')) {
      results = results.filter(f => {
        const fh = extractHour(f.log_timestamp);
        return fh !== null && fh < 12;
      });
    }

    // Pattern / keyword filter (only if no other filter reduced results)
    const stopWords = ['show', 'find', 'errors', 'issues', 'findings', 'from', 'with',
      'that', 'have', 'the', 'many', 'count', 'total', 'number', 'after',
      'before', 'between', 'exclude', 'without', 'severity', 'category',
      'file', 'noon', ...severities, ...categories, ...negTerms];
    const keywords = q.split(/\s+/).filter(w => w.length > 3 && !stopWords.includes(w));

    if (keywords.length > 0 && results.length === findings.length) {
      results = results.filter(f => keywords.some(kw =>
        (f.pattern_name || '').toLowerCase().includes(kw) ||
        (f.line_content || '').toLowerCase().includes(kw)
      ));
    }

    // Apply negation
    if (negTerms.length > 0) {
      results = results.filter(f => {
        return negTerms.every(neg =>
          !(f.severity || '').toLowerCase().includes(neg) &&
          !(f.category || '').toLowerCase().includes(neg) &&
          !(f.pattern_name || '').toLowerCase().includes(neg)
        );
      });
    }

    // Return count result wrapped if count query
    if (isCountQuery) {
      results._countQuery = true;
    }

    return results;
  }

  function parseHour(numStr, meridiem) {
    let h = parseInt(numStr, 10);
    if (meridiem) {
      const m = meridiem.toLowerCase();
      if (m === 'pm' && h < 12) h += 12;
      if (m === 'am' && h === 12) h = 0;
    }
    return h;
  }

  function extractHour(timestamp) {
    if (!timestamp) return null;
    const match = String(timestamp).match(/(\d{1,2}):\d{2}/);
    if (match) return parseInt(match[1], 10);
    return null;
  }

  // ─── Suggestion Generator (ONLY from real data) ─────────────────────────────
  function generateSuggestions(findings) {
    if (!findings || !findings.length) return [];
    const suggestions = [];

    // Severity-based suggestions
    const severityCounts = {};
    findings.forEach(f => {
      const s = (f.severity || '').toLowerCase();
      if (s) severityCounts[s] = (severityCounts[s] || 0) + 1;
    });
    if (severityCounts['critical']) suggestions.push('show critical');
    if (severityCounts['high']) suggestions.push('high severity');

    // Category-based suggestions
    const categoryCounts = {};
    findings.forEach(f => {
      const c = (f.category || '').toLowerCase();
      if (c) categoryCounts[c] = (categoryCounts[c] || 0) + 1;
    });
    if (categoryCounts['storage']) suggestions.push('storage errors');
    if (categoryCounts['network']) suggestions.push('network issues');
    if (categoryCounts['cluster']) suggestions.push('cluster problems');
    if (categoryCounts['kernel']) suggestions.push('kernel errors');
    if (categoryCounts['security']) suggestions.push('security findings');

    // File-based suggestions
    const files = new Set();
    findings.forEach(f => {
      if (f.file) {
        const name = f.file.split('/').pop().split('\\').pop();
        if (name) files.add(name.toLowerCase());
      }
    });
    const fileArr = [...files];
    if (fileArr.length > 0) {
      suggestions.push('findings in ' + fileArr[0]);
      if (fileArr.length > 1) suggestions.push('from ' + fileArr[1]);
    }

    // Pattern-based suggestions
    const patterns = new Set();
    findings.forEach(f => {
      if (f.pattern_name) patterns.add(f.pattern_name.toLowerCase());
    });
    const patArr = [...patterns];
    if (patArr.length > 0) suggestions.push('show ' + patArr[0]);

    // Count suggestion
    if (findings.length > 5) suggestions.push('how many critical');

    return suggestions.slice(0, 8);
  }

  // ─── Recent Queries (localStorage) ──────────────────────────────────────────
  const LS_KEY = 'logsherlock_nl_queries';

  function getRecentQueries() {
    try {
      const stored = localStorage.getItem(LS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  function saveQuery(query) {
    try {
      let recent = getRecentQueries();
      recent = recent.filter(q => q !== query);
      recent.unshift(query);
      recent = recent.slice(0, 5);
      localStorage.setItem(LS_KEY, JSON.stringify(recent));
      return recent;
    } catch (e) {
      return [];
    }
  }

  // ─── Severity Badge Renderer ────────────────────────────────────────────────
  function severityBadge(severity) {
    const s = (severity || 'info').toLowerCase();
    const colors = {
      critical: '#ff4444',
      high: '#ff8800',
      medium: '#ffbb33',
      low: '#00C851',
      info: '#33b5e5'
    };
    const color = colors[s] || '#888';
    return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;color:#fff;background:${color};text-transform:uppercase;margin-right:8px;">${severity || 'INFO'}</span>`;
  }

  // ─── Main Render Function ───────────────────────────────────────────────────
  function renderNLQueryPanel(findings) {
    const container = document.getElementById('nl-query-panel');
    if (!container) return;

    const safeFindings = Array.isArray(findings) ? findings : [];

    container.innerHTML = `
      <div style="background:#1e1e2e;border:1px solid #333;border-radius:12px;padding:24px;margin:16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <h3 style="margin:0 0 16px 0;color:#01a982;font-size:18px;font-weight:700;">💬 Natural Language Query</h3>
        <p style="color:#999;font-size:13px;margin:0 0 16px 0;">Type plain English to search findings — works 100% offline</p>
        
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <input type="text" id="nl-query-input"
            placeholder='Ask anything... e.g., "show critical storage errors in messages"'
            style="flex:1;padding:14px 18px;font-size:15px;border-radius:8px;border:1px solid #444;background:#2a2a3e;color:#e0e0e0;outline:none;transition:border-color 0.2s;"
          />
          <button id="nl-query-btn"
            style="padding:14px 24px;background:#01a982;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:background 0.2s;white-space:nowrap;">
            Search
          </button>
        </div>

        <div id="nl-query-suggestions" style="margin-bottom:12px;"></div>
        <div id="nl-query-recent" style="margin-bottom:16px;"></div>
        <div id="nl-query-results"></div>
      </div>
    `;

    const input = document.getElementById('nl-query-input');
    const btn = document.getElementById('nl-query-btn');
    const suggestionsEl = document.getElementById('nl-query-suggestions');
    const recentEl = document.getElementById('nl-query-recent');
    const resultsEl = document.getElementById('nl-query-results');

    // Focus styling
    input.addEventListener('focus', () => { input.style.borderColor = '#01a982'; });
    input.addEventListener('blur', () => { input.style.borderColor = '#444'; });

    // Render suggestions from REAL data only
    function renderSuggestions() {
      const suggestions = generateSuggestions(safeFindings);
      if (suggestions.length === 0) {
        suggestionsEl.innerHTML = '';
        return;
      }
      suggestionsEl.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
          <span style="color:#888;font-size:12px;margin-right:4px;">Try:</span>
          ${suggestions.map(s => `<button class="nl-suggestion-btn" style="padding:4px 12px;font-size:12px;border-radius:16px;border:1px solid #444;background:#2a2a3e;color:#ccc;cursor:pointer;transition:all 0.2s;">${s}</button>`).join('')}
        </div>
      `;
      suggestionsEl.querySelectorAll('.nl-suggestion-btn').forEach(b => {
        b.addEventListener('mouseenter', () => { b.style.borderColor = '#01a982'; b.style.color = '#01a982'; });
        b.addEventListener('mouseleave', () => { b.style.borderColor = '#444'; b.style.color = '#ccc'; });
        b.addEventListener('click', () => { input.value = b.textContent; executeQuery(); });
      });
    }

    // Render recent queries
    function renderRecent() {
      const recent = getRecentQueries();
      if (recent.length === 0) {
        recentEl.innerHTML = '';
        return;
      }
      recentEl.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
          <span style="color:#666;font-size:11px;margin-right:4px;">Recent:</span>
          ${recent.map(r => `<button class="nl-recent-btn" style="padding:3px 10px;font-size:11px;border-radius:12px;border:1px dashed #555;background:transparent;color:#888;cursor:pointer;transition:all 0.2s;">${escapeHtml(r)}</button>`).join('')}
        </div>
      `;
      recentEl.querySelectorAll('.nl-recent-btn').forEach(b => {
        b.addEventListener('mouseenter', () => { b.style.borderColor = '#01a982'; b.style.color = '#01a982'; });
        b.addEventListener('mouseleave', () => { b.style.borderColor = '#555'; b.style.color = '#888'; });
        b.addEventListener('click', () => { input.value = b.textContent; executeQuery(); });
      });
    }

    // Execute query
    function executeQuery() {
      const query = (input.value || '').trim();
      if (!query) {
        resultsEl.innerHTML = '';
        return;
      }

      if (safeFindings.length === 0) {
        resultsEl.innerHTML = `<p style="color:#ff8800;font-size:14px;margin:8px 0;">⚠️ Run a scan first, then query your results.</p>`;
        return;
      }

      const results = parseQuery(query, safeFindings);
      saveQuery(query);
      renderRecent();

      if (results._countQuery) {
        resultsEl.innerHTML = `
          <div style="padding:16px;background:#2a2a3e;border-radius:8px;border-left:4px solid #01a982;">
            <p style="color:#e0e0e0;font-size:15px;margin:0;"><strong style="color:#01a982;">${results.length}</strong> findings matching: "<em>${escapeHtml(query)}</em>"</p>
          </div>
        `;
        return;
      }

      if (results.length === 0) {
        resultsEl.innerHTML = `
          <div style="padding:16px;background:#2a2a3e;border-radius:8px;border-left:4px solid #ff8800;">
            <p style="color:#ccc;font-size:14px;margin:0;">No findings match your query. Try different terms.</p>
          </div>
        `;
        return;
      }

      const displayResults = results.slice(0, 50);
      resultsEl.innerHTML = `
        <div style="margin-bottom:12px;">
          <p style="color:#01a982;font-size:14px;font-weight:600;margin:0 0 12px 0;">Found ${results.length} finding${results.length !== 1 ? 's' : ''} matching: "<em style="color:#ccc;">${escapeHtml(query)}</em>"${results.length > 50 ? ' <span style="color:#888;">(showing first 50)</span>' : ''}</p>
          <div style="max-height:400px;overflow-y:auto;border:1px solid #333;border-radius:8px;">
            ${displayResults.map((f, i) => `
              <div style="padding:10px 14px;border-bottom:1px solid #2a2a3e;${i % 2 === 0 ? 'background:#1a1a2a;' : 'background:#1e1e2e;'}">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  ${severityBadge(f.severity)}
                  <span style="color:#01a982;font-size:13px;font-weight:600;">${escapeHtml(f.pattern_name || 'Unknown Pattern')}</span>
                  <span style="color:#666;font-size:12px;">|</span>
                  <span style="color:#888;font-size:12px;font-family:monospace;">${escapeHtml(f.file || 'unknown')}</span>
                  ${f.line_number ? `<span style="color:#555;font-size:11px;">:${f.line_number}</span>` : ''}
                </div>
                ${f.line_content ? `<p style="margin:6px 0 0 0;color:#aaa;font-size:12px;font-family:monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${escapeHtml(f.line_content.substring(0, 150))}</p>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Event listeners
    btn.addEventListener('click', executeQuery);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') executeQuery();
    });

    // Initial render
    renderSuggestions();
    renderRecent();

    // Show initial state if no findings
    if (safeFindings.length === 0) {
      resultsEl.innerHTML = `<p style="color:#888;font-size:13px;margin:8px 0;">Run a scan first, then query your results.</p>`;
    }
  }

  // ─── Utility ────────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ─── Initialize on DOMContentLoaded ─────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.renderNLQueryPanel = renderNLQueryPanel;
    });
  } else {
    window.renderNLQueryPanel = renderNLQueryPanel;
  }

  // Export immediately as well for script load order flexibility
  window.renderNLQueryPanel = renderNLQueryPanel;
})();
