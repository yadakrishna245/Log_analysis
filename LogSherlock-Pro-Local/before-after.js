/**
 * LogSherlock Pro - Before/After Comparison Feature
 * Engineers scan logs before a patch, then after, and see what changed.
 */

// Store mechanism
window._beforeSnapshot = null;
window._afterSnapshot = null;

/**
 * Shows a toast notification in the UI
 */
function _showToast(message) {
    // Check if a toast container exists, create one if not
    let toastContainer = document.getElementById('logsherlock-toast');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'logsherlock-toast';
        toastContainer.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 99999;
            padding: 14px 24px; border-radius: 8px;
            background: #1a1a2e; border: 1px solid #2a2a3a;
            color: #fafafa; font-family: monospace; font-size: 14px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(toastContainer);
    }
    toastContainer.textContent = message;
    toastContainer.style.opacity = '1';
    toastContainer.style.display = 'block';
    setTimeout(() => {
        toastContainer.style.opacity = '0';
        setTimeout(() => { toastContainer.style.display = 'none'; }, 300);
    }, 3000);
}

/**
 * Saves current window._allFindings as 'before' snapshot with timestamp.
 * Shows toast: 'Before snapshot saved (X findings)'
 */
function saveBeforeSnapshot() {
    const findings = window._allFindings || [];
    window._beforeSnapshot = {
        findings: JSON.parse(JSON.stringify(findings)),
        timestamp: new Date().toISOString(),
        count: findings.length
    };
    const msg = `Before snapshot saved (${findings.length} findings)`;
    _showToast(msg);
    return window._beforeSnapshot;
}

/**
 * Saves current window._allFindings as 'after' snapshot with timestamp.
 * Shows toast: 'After snapshot saved (X findings)'
 */
function saveAfterSnapshot() {
    const findings = window._allFindings || [];
    window._afterSnapshot = {
        findings: JSON.parse(JSON.stringify(findings)),
        timestamp: new Date().toISOString(),
        count: findings.length
    };
    const msg = `After snapshot saved (${findings.length} findings)`;
    _showToast(msg);
    return window._afterSnapshot;
}

/**
 * Calculates a simple health score based on findings count and severity.
 * Score is 100 minus weighted deductions per finding.
 */
function _calculateHealthScore(findings) {
    if (!findings || findings.length === 0) return 100;

    let deductions = 0;
    findings.forEach(f => {
        const severity = (f.severity || 'info').toLowerCase();
        if (severity === 'critical') deductions += 15;
        else if (severity === 'error' || severity === 'high') deductions += 10;
        else if (severity === 'warning' || severity === 'medium') deductions += 5;
        else deductions += 2;
    });

    return Math.max(0, Math.min(100, 100 - deductions));
}

/**
 * Renders Before/After comparison HTML.
 * Matches findings by pattern_name (not exact line match).
 */
function renderBeforeAfterComparison() {
    if (!window._beforeSnapshot || !window._afterSnapshot) {
        return `
            <div style="background:#0c0c0f; border:1px solid #2a2a3a; border-radius:10px; padding:24px; color:#fafafa; font-family:monospace;">
                <h3 style="margin:0 0 12px 0; color:#fafafa;">🔄 Before/After Comparison</h3>
                <p style="color:#888;">Both snapshots are required. Save a BEFORE and AFTER snapshot first.</p>
            </div>
        `;
    }

    const beforeFindings = window._beforeSnapshot.findings;
    const afterFindings = window._afterSnapshot.findings;

    const beforeCount = beforeFindings.length;
    const afterCount = afterFindings.length;
    const delta = afterCount - beforeCount;
    const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
    const deltaColor = delta > 0 ? '#ff4d6a' : delta < 0 ? '#4ade80' : '#888';

    // Match by pattern_name
    const beforePatterns = new Set(beforeFindings.map(f => f.pattern_name || f.patternName || f.name || f.message || 'unknown'));
    const afterPatterns = new Set(afterFindings.map(f => f.pattern_name || f.patternName || f.name || f.message || 'unknown'));

    const resolved = [...beforePatterns].filter(p => !afterPatterns.has(p));
    const newIssues = [...afterPatterns].filter(p => !beforePatterns.has(p));
    const persistent = [...beforePatterns].filter(p => afterPatterns.has(p));

    // Health scores
    const beforeHealth = _calculateHealthScore(beforeFindings);
    const afterHealth = _calculateHealthScore(afterFindings);
    const healthDelta = afterHealth - beforeHealth;
    const healthDeltaStr = healthDelta > 0 ? `+${healthDelta} improvement` : healthDelta < 0 ? `${healthDelta} regression` : 'no change';
    const healthDeltaColor = healthDelta > 0 ? '#4ade80' : healthDelta < 0 ? '#ff4d6a' : '#888';

    // Build issue lists
    const resolvedHtml = resolved.length > 0
        ? resolved.map(p => `<div style="color:#4ade80; padding:6px 10px; margin:4px 0; background:#0a1f0a; border-radius:6px; border-left:3px solid #4ade80;">✅ ${_escapeHtml(p)}</div>`).join('')
        : '<div style="color:#888; padding:6px 10px;">None</div>';

    const newIssuesHtml = newIssues.length > 0
        ? newIssues.map(p => `<div style="color:#ff4d6a; padding:6px 10px; margin:4px 0; background:#1f0a0a; border-radius:6px; border-left:3px solid #ff4d6a;">⚠️ ${_escapeHtml(p)}</div>`).join('')
        : '<div style="color:#888; padding:6px 10px;">None</div>';

    const persistentHtml = persistent.length > 0
        ? persistent.map(p => `<div style="color:#888; padding:6px 10px; margin:4px 0; background:#1a1a1a; border-radius:6px; border-left:3px solid #555;">⏸️ ${_escapeHtml(p)}</div>`).join('')
        : '<div style="color:#888; padding:6px 10px;">None</div>';

    // Summary sentence
    const summary = `${resolved.length} issues resolved, ${newIssues.length} new issues, ${persistent.length} persistent`;

    return `
        <div style="background:#0c0c0f; border:1px solid #2a2a3a; border-radius:10px; padding:24px; color:#fafafa; font-family:monospace;">
            <h3 style="margin:0 0 16px 0; color:#fafafa; font-size:18px;">🔄 Before/After Comparison</h3>

            <!-- Stats Row -->
            <div style="display:flex; gap:16px; margin-bottom:20px; flex-wrap:wrap;">
                <div style="background:#1a1a2e; padding:12px 18px; border-radius:8px; border:1px solid #2a2a3a;">
                    <span style="color:#888; font-size:12px;">Before</span><br>
                    <span style="color:#fafafa; font-size:20px; font-weight:bold;">${beforeCount}</span>
                    <span style="color:#888; font-size:12px;"> findings</span>
                </div>
                <div style="background:#1a1a2e; padding:12px 18px; border-radius:8px; border:1px solid #2a2a3a;">
                    <span style="color:#888; font-size:12px;">After</span><br>
                    <span style="color:#fafafa; font-size:20px; font-weight:bold;">${afterCount}</span>
                    <span style="color:#888; font-size:12px;"> findings</span>
                </div>
                <div style="background:#1a1a2e; padding:12px 18px; border-radius:8px; border:1px solid #2a2a3a;">
                    <span style="color:#888; font-size:12px;">Delta</span><br>
                    <span style="color:${deltaColor}; font-size:20px; font-weight:bold;">${deltaStr}</span>
                </div>
            </div>

            <!-- Health Score -->
            <div style="background:#1a1a2e; padding:14px 18px; border-radius:8px; border:1px solid #2a2a3a; margin-bottom:20px;">
                <span style="color:#888; font-size:12px;">Health Score Change</span><br>
                <span style="color:#fafafa; font-size:16px;">Before <strong>${beforeHealth}/100</strong> → After <strong>${afterHealth}/100</strong></span>
                <span style="color:${healthDeltaColor}; font-size:14px; margin-left:12px;">(${healthDeltaStr})</span>
            </div>

            <!-- Resolved Issues -->
            <div style="margin-bottom:16px;">
                <h4 style="color:#4ade80; margin:0 0 8px 0; font-size:14px;">✅ Resolved Issues (${resolved.length})</h4>
                ${resolvedHtml}
            </div>

            <!-- New Issues -->
            <div style="margin-bottom:16px;">
                <h4 style="color:#ff4d6a; margin:0 0 8px 0; font-size:14px;">⚠️ New Issues (${newIssues.length})</h4>
                ${newIssuesHtml}
            </div>

            <!-- Persistent Issues -->
            <div style="margin-bottom:16px;">
                <h4 style="color:#888; margin:0 0 8px 0; font-size:14px;">⏸️ Persistent Issues (${persistent.length})</h4>
                ${persistentHtml}
            </div>

            <!-- Summary -->
            <div style="background:#1a1a2e; padding:12px 18px; border-radius:8px; border:1px solid #2a2a3a; margin-top:16px; text-align:center;">
                <span style="color:#ccc; font-size:13px;">${summary}</span>
            </div>

            <!-- Timestamps -->
            <div style="margin-top:12px; color:#555; font-size:11px; text-align:right;">
                Before: ${window._beforeSnapshot.timestamp} | After: ${window._afterSnapshot.timestamp}
            </div>
        </div>
    `;
}

/**
 * Renders the Before/After action buttons.
 */
function renderBeforeAfterButtons() {
    return `
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button onclick="saveBeforeSnapshot()" style="
                background:#1a1a2e; color:#fafafa; border:1px solid #2a2a3a;
                padding:10px 18px; border-radius:8px; cursor:pointer;
                font-family:monospace; font-size:13px;
                transition: background 0.2s ease;
            " onmouseover="this.style.background='#2a2a4e'" onmouseout="this.style.background='#1a1a2e'">
                📸 Save as BEFORE
            </button>
            <button onclick="saveAfterSnapshot()" style="
                background:#1a1a2e; color:#fafafa; border:1px solid #2a2a3a;
                padding:10px 18px; border-radius:8px; cursor:pointer;
                font-family:monospace; font-size:13px;
                transition: background 0.2s ease;
            " onmouseover="this.style.background='#2a2a4e'" onmouseout="this.style.background='#1a1a2e'">
                📸 Save as AFTER
            </button>
            <button onclick="document.getElementById('before-after-output').innerHTML = renderBeforeAfterComparison()" style="
                background:#0d3320; color:#4ade80; border:1px solid #4ade80;
                padding:10px 18px; border-radius:8px; cursor:pointer;
                font-family:monospace; font-size:13px;
                transition: background 0.2s ease;
            " onmouseover="this.style.background='#145a34'" onmouseout="this.style.background='#0d3320'">
                🔄 Compare
            </button>
        </div>
        <div id="before-after-output" style="margin-top:16px;"></div>
    `;
}

/**
 * Escapes HTML to prevent XSS in rendered content.
 */
function _escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// Expose all functions on window object
window.saveBeforeSnapshot = saveBeforeSnapshot;
window.saveAfterSnapshot = saveAfterSnapshot;
window.renderBeforeAfterComparison = renderBeforeAfterComparison;
window.renderBeforeAfterButtons = renderBeforeAfterButtons;
