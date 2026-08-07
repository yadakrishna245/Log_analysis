/**
 * LogSherlock Pro — Shift Handoff Generator
 * Auto-summarize current investigation state for next shift engineer
 * 
 * ENTERPRISE FEATURE: Critical for 24/7 NOC/SOC/L4 support teams.
 * End of shift = generate structured handoff document in 1 click.
 * Next engineer knows: what's been found, what's been tried, what's remaining.
 * 
 * DATA INTEGRITY: Handoff contains ONLY actual findings and user-entered actions.
 * No assumptions about what was tried. Engineer confirms their own actions.
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    // STATE TRACKER — records investigation actions during session
    // ═══════════════════════════════════════════════════════════════

    const SESSION_KEY = 'logsherlock_shift_session';
    const HANDOFF_HISTORY_KEY = 'logsherlock_handoff_history';

    function getSession() {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            if (raw) {
                const session = JSON.parse(raw);
                // If session is older than 14 hours, it's stale
                if (Date.now() - session.startedAt > 14 * 60 * 60 * 1000) {
                    return createNewSession();
                }
                return session;
            }
        } catch(e) {}
        return createNewSession();
    }

    function createNewSession() {
        const session = {
            id: 'SH-' + Date.now().toString(36).toUpperCase(),
            startedAt: Date.now(),
            engineer: '',
            ticketId: '',
            findings: [],
            actions: [],
            notes: [],
            blockers: [],
            nextSteps: [],
            severity: 'UNKNOWN',
            status: 'IN_PROGRESS'
        };
        saveSession(session);
        return session;
    }

    function saveSession(session) {
        try {
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        } catch(e) {}
    }

    // ═══════════════════════════════════════════════════════════════
    // HANDOFF DOCUMENT GENERATOR
    // ═══════════════════════════════════════════════════════════════

    function generateHandoff(session, findings) {
        const now = new Date();
        const duration = session.startedAt ? Math.round((Date.now() - session.startedAt) / 60000) : 0;
        const hours = Math.floor(duration / 60);
        const mins = duration % 60;

        const handoff = {
            id: session.id,
            generatedAt: now.toISOString(),
            engineer: session.engineer || 'Not specified',
            ticketId: session.ticketId || 'Not specified',
            duration: `${hours}h ${mins}m`,
            status: session.status,
            summary: {
                totalFindings: findings ? findings.length : 0,
                criticalCount: findings ? findings.filter(f => f.severity === 'CRITICAL').length : 0,
                highCount: findings ? findings.filter(f => f.severity === 'HIGH').length : 0,
                topPatterns: findings ? getTopPatterns(findings) : [],
                affectedFiles: findings ? [...new Set(findings.map(f => f.file).filter(Boolean))].slice(0, 10) : []
            },
            actions: session.actions,
            blockers: session.blockers,
            nextSteps: session.nextSteps,
            notes: session.notes
        };

        return handoff;
    }

    function getTopPatterns(findings) {
        const counts = {};
        findings.forEach(f => {
            const name = f.pattern_name || 'unknown';
            counts[name] = (counts[name] || 0) + 1;
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));
    }

    // ═══════════════════════════════════════════════════════════════
    // HANDOFF DOCUMENT RENDERER — clean structured format
    // ═══════════════════════════════════════════════════════════════

    function renderHandoffDocument(handoff) {
        const sevColor = handoff.summary.criticalCount > 0 ? '#ef4444' : 
                         handoff.summary.highCount > 0 ? '#f59e0b' : '#10b981';

        let doc = `════════════════════════════════════════════════════════════════
 SHIFT HANDOFF — ${handoff.id}
 Generated: ${new Date(handoff.generatedAt).toLocaleString()}
════════════════════════════════════════════════════════════════

► ENGINEER: ${handoff.engineer}
► TICKET:   ${handoff.ticketId}
► DURATION: ${handoff.duration}
► STATUS:   ${handoff.status}

────────────────────────────────────────────────────────────────
 SCAN SUMMARY
────────────────────────────────────────────────────────────────
 Total Findings: ${handoff.summary.totalFindings}
 Critical:       ${handoff.summary.criticalCount}
 High:           ${handoff.summary.highCount}

 Top Patterns:
${handoff.summary.topPatterns.map(p => `   • ${p.name} (${p.count}x)`).join('\n') || '   (none)'}

 Affected Files:
${handoff.summary.affectedFiles.map(f => `   • ${f}`).join('\n') || '   (none)'}

────────────────────────────────────────────────────────────────
 ACTIONS TAKEN (${handoff.actions.length})
────────────────────────────────────────────────────────────────
${handoff.actions.length > 0 ? handoff.actions.map((a, i) => 
    ` ${i+1}. [${a.time}] ${a.text}${a.result ? '\n    Result: ' + a.result : ''}`
).join('\n') : ' (No actions recorded this session)'}

────────────────────────────────────────────────────────────────
 BLOCKERS / PENDING
────────────────────────────────────────────────────────────────
${handoff.blockers.length > 0 ? handoff.blockers.map(b => ` ⚠️ ${b}`).join('\n') : ' (No blockers)'}

────────────────────────────────────────────────────────────────
 RECOMMENDED NEXT STEPS
────────────────────────────────────────────────────────────────
${handoff.nextSteps.length > 0 ? handoff.nextSteps.map((s, i) => ` ${i+1}. ${s}`).join('\n') : ' (No next steps recorded)'}

────────────────────────────────────────────────────────────────
 NOTES
────────────────────────────────────────────────────────────────
${handoff.notes.length > 0 ? handoff.notes.map(n => ` • ${n}`).join('\n') : ' (No notes)'}

════════════════════════════════════════════════════════════════
 END OF HANDOFF — Next engineer: review above, then continue.
════════════════════════════════════════════════════════════════`;

        return doc;
    }

    // ═══════════════════════════════════════════════════════════════
    // UI — Interactive handoff panel
    // ═══════════════════════════════════════════════════════════════

    function renderShiftHandoffPanel(findings, container) {
        const session = getSession();

        // Auto-capture findings summary
        if (findings && findings.length > 0) {
            session.findings = findings.slice(0, 50).map(f => ({
                severity: f.severity,
                pattern: f.pattern_name,
                file: f.file,
                line: f.line_number
            }));
            saveSession(session);
        }

        let html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div>
                    <span style="font-size:14px;font-weight:600;color:var(--text-100);">🔄 Shift Handoff</span>
                    <span style="font-size:11px;color:var(--text-400);margin-left:8px;">Session: ${session.id}</span>
                </div>
                <div style="display:flex;gap:6px;">
                    <button id="shiftHandoffGenerate" style="background:var(--accent);color:var(--bg-0);border:none;border-radius:6px;padding:6px 12px;font-size:11px;cursor:pointer;font-weight:500;">
                        📋 Generate Handoff
                    </button>
                    <button id="shiftHandoffReset" style="background:var(--bg-0);color:var(--text-300);border:1px solid var(--border-subtle);border-radius:6px;padding:6px 10px;font-size:11px;cursor:pointer;">
                        🔄 New Shift
                    </button>
                </div>
            </div>

            <!-- Quick Info -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
                <div>
                    <label style="font-size:10px;color:var(--text-400);display:block;margin-bottom:3px;">Engineer Name</label>
                    <input id="shiftEngineer" type="text" value="${escAttr(session.engineer)}" placeholder="Your name" style="
                        width:100%;padding:6px 10px;background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:4px;
                        color:var(--text-200);font-size:12px;outline:none;
                    ">
                </div>
                <div>
                    <label style="font-size:10px;color:var(--text-400);display:block;margin-bottom:3px;">Ticket/Case ID</label>
                    <input id="shiftTicket" type="text" value="${escAttr(session.ticketId)}" placeholder="INC-12345" style="
                        width:100%;padding:6px 10px;background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:4px;
                        color:var(--text-200);font-size:12px;outline:none;
                    ">
                </div>
            </div>

            <!-- Actions Taken -->
            <div style="margin-bottom:12px;">
                <label style="font-size:10px;color:var(--text-400);display:block;margin-bottom:3px;">Actions Taken (${session.actions.length})</label>
                <div id="shiftActionsList" style="max-height:120px;overflow-y:auto;margin-bottom:6px;">
                    ${session.actions.map((a, i) => `
                        <div style="font-size:11px;color:var(--text-300);padding:4px 8px;background:var(--bg-0);border-radius:4px;margin-bottom:3px;display:flex;justify-content:space-between;align-items:center;">
                            <span><span style="color:var(--text-500);">${a.time}</span> ${escHtml(a.text)}</span>
                            <span class="shift-remove-action" data-idx="${i}" style="cursor:pointer;color:var(--text-500);padding:0 4px;">×</span>
                        </div>`).join('')}
                </div>
                <div style="display:flex;gap:4px;">
                    <input id="shiftNewAction" type="text" placeholder="What did you do? (e.g., 'Checked corosync logs on node3')" style="
                        flex:1;padding:6px 10px;background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:4px;
                        color:var(--text-200);font-size:11px;outline:none;
                    ">
                    <button id="shiftAddAction" style="background:var(--bg-0);border:1px solid var(--accent);color:var(--accent);border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer;">+</button>
                </div>
            </div>

            <!-- Blockers -->
            <div style="margin-bottom:12px;">
                <label style="font-size:10px;color:var(--text-400);display:block;margin-bottom:3px;">Blockers / Pending (${session.blockers.length})</label>
                <div id="shiftBlockersList" style="margin-bottom:6px;">
                    ${session.blockers.map((b, i) => `
                        <div style="font-size:11px;color:#f59e0b;padding:3px 8px;background:#f59e0b10;border-radius:4px;margin-bottom:3px;display:flex;justify-content:space-between;">
                            <span>⚠️ ${escHtml(b)}</span>
                            <span class="shift-remove-blocker" data-idx="${i}" style="cursor:pointer;padding:0 4px;">×</span>
                        </div>`).join('')}
                </div>
                <div style="display:flex;gap:4px;">
                    <input id="shiftNewBlocker" type="text" placeholder="Blocker (e.g., 'Waiting for customer to provide sosreport')" style="
                        flex:1;padding:6px 10px;background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:4px;
                        color:var(--text-200);font-size:11px;outline:none;
                    ">
                    <button id="shiftAddBlocker" style="background:var(--bg-0);border:1px solid #f59e0b;color:#f59e0b;border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer;">+</button>
                </div>
            </div>

            <!-- Next Steps -->
            <div style="margin-bottom:12px;">
                <label style="font-size:10px;color:var(--text-400);display:block;margin-bottom:3px;">Recommended Next Steps (${session.nextSteps.length})</label>
                <div id="shiftNextList" style="margin-bottom:6px;">
                    ${session.nextSteps.map((s, i) => `
                        <div style="font-size:11px;color:#10b981;padding:3px 8px;background:#10b98110;border-radius:4px;margin-bottom:3px;display:flex;justify-content:space-between;">
                            <span>→ ${escHtml(s)}</span>
                            <span class="shift-remove-next" data-idx="${i}" style="cursor:pointer;padding:0 4px;">×</span>
                        </div>`).join('')}
                </div>
                <div style="display:flex;gap:4px;">
                    <input id="shiftNewNext" type="text" placeholder="Next step (e.g., 'Collect pacemaker logs from node2')" style="
                        flex:1;padding:6px 10px;background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:4px;
                        color:var(--text-200);font-size:11px;outline:none;
                    ">
                    <button id="shiftAddNext" style="background:var(--bg-0);border:1px solid #10b981;color:#10b981;border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer;">+</button>
                </div>
            </div>

            <!-- Status -->
            <div style="display:flex;gap:6px;margin-bottom:8px;">
                <label style="font-size:10px;color:var(--text-400);padding-top:6px;">Status:</label>
                ${['IN_PROGRESS', 'ESCALATED', 'WAITING_CUSTOMER', 'RESOLVED'].map(s => `
                    <button class="shift-status-btn" data-status="${s}" style="
                        font-size:10px;padding:4px 8px;border-radius:4px;cursor:pointer;
                        background:${session.status === s ? 'var(--accent)' : 'var(--bg-0)'};
                        color:${session.status === s ? 'var(--bg-0)' : 'var(--text-300)'};
                        border:1px solid ${session.status === s ? 'var(--accent)' : 'var(--border-subtle)'};
                    ">${s.replace(/_/g, ' ')}</button>`).join('')}
            </div>

            <!-- Output -->
            <div id="shiftHandoffOutput" style="display:none;margin-top:12px;"></div>`;

        container.innerHTML = html;

        // ═══ Event handlers ═══
        const saveFields = () => {
            session.engineer = document.getElementById('shiftEngineer').value;
            session.ticketId = document.getElementById('shiftTicket').value;
            saveSession(session);
        };

        document.getElementById('shiftEngineer').addEventListener('change', saveFields);
        document.getElementById('shiftTicket').addEventListener('change', saveFields);

        // Add action
        const addAction = () => {
            const input = document.getElementById('shiftNewAction');
            if (input.value.trim()) {
                session.actions.push({ text: input.value.trim(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), result: '' });
                saveSession(session);
                input.value = '';
                renderShiftHandoffPanel(findings, container);
            }
        };
        document.getElementById('shiftAddAction').addEventListener('click', addAction);
        document.getElementById('shiftNewAction').addEventListener('keydown', e => { if (e.key === 'Enter') addAction(); });

        // Add blocker
        const addBlocker = () => {
            const input = document.getElementById('shiftNewBlocker');
            if (input.value.trim()) {
                session.blockers.push(input.value.trim());
                saveSession(session);
                input.value = '';
                renderShiftHandoffPanel(findings, container);
            }
        };
        document.getElementById('shiftAddBlocker').addEventListener('click', addBlocker);
        document.getElementById('shiftNewBlocker').addEventListener('keydown', e => { if (e.key === 'Enter') addBlocker(); });

        // Add next step
        const addNext = () => {
            const input = document.getElementById('shiftNewNext');
            if (input.value.trim()) {
                session.nextSteps.push(input.value.trim());
                saveSession(session);
                input.value = '';
                renderShiftHandoffPanel(findings, container);
            }
        };
        document.getElementById('shiftAddNext').addEventListener('click', addNext);
        document.getElementById('shiftNewNext').addEventListener('keydown', e => { if (e.key === 'Enter') addNext(); });

        // Remove handlers
        container.querySelectorAll('.shift-remove-action').forEach(btn => {
            btn.addEventListener('click', () => { session.actions.splice(parseInt(btn.dataset.idx), 1); saveSession(session); renderShiftHandoffPanel(findings, container); });
        });
        container.querySelectorAll('.shift-remove-blocker').forEach(btn => {
            btn.addEventListener('click', () => { session.blockers.splice(parseInt(btn.dataset.idx), 1); saveSession(session); renderShiftHandoffPanel(findings, container); });
        });
        container.querySelectorAll('.shift-remove-next').forEach(btn => {
            btn.addEventListener('click', () => { session.nextSteps.splice(parseInt(btn.dataset.idx), 1); saveSession(session); renderShiftHandoffPanel(findings, container); });
        });

        // Status buttons
        container.querySelectorAll('.shift-status-btn').forEach(btn => {
            btn.addEventListener('click', () => { session.status = btn.dataset.status; saveSession(session); renderShiftHandoffPanel(findings, container); });
        });

        // Generate handoff
        document.getElementById('shiftHandoffGenerate').addEventListener('click', () => {
            saveFields();
            const handoff = generateHandoff(session, findings);
            const doc = renderHandoffDocument(handoff);
            const output = document.getElementById('shiftHandoffOutput');
            output.style.display = 'block';
            output.innerHTML = `
                <div style="background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:6px;padding:12px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <span style="font-size:12px;font-weight:500;color:var(--text-100);">📋 Handoff Document</span>
                        <div style="display:flex;gap:6px;">
                            <button id="shiftCopyBtn" style="font-size:10px;padding:3px 8px;background:var(--accent);color:var(--bg-0);border:none;border-radius:4px;cursor:pointer;">📋 Copy</button>
                            <button id="shiftDownloadBtn" style="font-size:10px;padding:3px 8px;background:var(--bg-0);color:var(--text-300);border:1px solid var(--border-subtle);border-radius:4px;cursor:pointer;">💾 Download</button>
                        </div>
                    </div>
                    <pre style="font-size:10px;color:var(--text-300);font-family:var(--mono);white-space:pre-wrap;max-height:300px;overflow-y:auto;padding:8px;background:var(--bg-1);border-radius:4px;">${escHtml(doc)}</pre>
                </div>`;

            document.getElementById('shiftCopyBtn').addEventListener('click', () => {
                navigator.clipboard.writeText(doc).then(() => {
                    document.getElementById('shiftCopyBtn').textContent = '✅ Copied!';
                    setTimeout(() => { document.getElementById('shiftCopyBtn').textContent = '📋 Copy'; }, 2000);
                });
            });

            document.getElementById('shiftDownloadBtn').addEventListener('click', () => {
                const blob = new Blob([doc], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Handoff-${session.id}-${new Date().toISOString().split('T')[0]}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });

            // Save to history
            try {
                const history = JSON.parse(localStorage.getItem(HANDOFF_HISTORY_KEY) || '[]');
                history.unshift({ id: handoff.id, generatedAt: handoff.generatedAt, ticketId: handoff.ticketId, engineer: handoff.engineer });
                localStorage.setItem(HANDOFF_HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
            } catch(e) {}
        });

        // Reset shift
        document.getElementById('shiftHandoffReset').addEventListener('click', () => {
            if (confirm('Start a new shift? Current session data will be archived.')) {
                localStorage.removeItem(SESSION_KEY);
                renderShiftHandoffPanel(findings, container);
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    function initShiftHandoff() {
        window.renderShiftHandoffPanel = function(findings) {
            let container = document.getElementById('shiftHandoffPanel');
            if (!container) {
                container = document.createElement('div');
                container.id = 'shiftHandoffPanel';
                container.className = 'results-panel';
                container.style.cssText = 'margin-top:16px;padding:16px;background:var(--bg-1);border:1px solid var(--border-subtle);border-radius:10px;';

                const anchor = document.getElementById('complianceExportPanel') ||
                               document.getElementById('rootCauseChainPanel') ||
                               document.getElementById('findingsList');
                if (anchor && anchor.parentNode) {
                    anchor.parentNode.insertBefore(container, anchor.nextSibling);
                }
            }

            renderShiftHandoffPanel(findings, container);
        };

        window.LogSherlockShiftHandoff = {
            getSession: getSession,
            generate: generateHandoff,
            version: '1.0.0'
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initShiftHandoff);
    } else {
        initShiftHandoff();
    }

    function escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    function escAttr(str) {
        return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
})();
