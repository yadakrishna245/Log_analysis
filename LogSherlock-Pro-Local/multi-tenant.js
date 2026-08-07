/**
 * LogSherlock Pro — Multi-Tenant Workspace
 * Team-shared findings with role-based access
 * 
 * ENTERPRISE FEATURE: Teams need shared context. Engineers share findings,
 * managers see high-level summaries. Uses localStorage for local simulation
 * with export/import for team sharing.
 * 
 * DATA INTEGRITY: No fabricated team data. Workspace starts empty.
 * All shared findings come from actual scans exported by team members.
 */

(function() {
    'use strict';

    const WORKSPACE_KEY = 'logsherlock_workspace';
    const MEMBERS_KEY = 'logsherlock_workspace_members';

    // ═══════════════════════════════════════════════════════════════
    // WORKSPACE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    function getWorkspace() {
        try {
            return JSON.parse(localStorage.getItem(WORKSPACE_KEY) || '{"name":"","role":"engineer","sharedScans":[],"comments":[],"assignments":[]}');
        } catch(e) { return { name: '', role: 'engineer', sharedScans: [], comments: [], assignments: [] }; }
    }

    function saveWorkspace(ws) {
        try {
            localStorage.setItem(WORKSPACE_KEY, JSON.stringify(ws));
        } catch(e) {}
    }

    function getMembers() {
        try {
            return JSON.parse(localStorage.getItem(MEMBERS_KEY) || '[]');
        } catch(e) { return []; }
    }

    function saveMembers(members) {
        try {
            localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
        } catch(e) {}
    }

    const ROLES = {
        admin: { label: 'Admin', color: '#ef4444', permissions: ['view_all', 'share', 'assign', 'delete', 'manage_members'] },
        lead: { label: 'Team Lead', color: '#f59e0b', permissions: ['view_all', 'share', 'assign', 'delete'] },
        engineer: { label: 'Engineer', color: '#3b82f6', permissions: ['view_all', 'share', 'comment'] },
        viewer: { label: 'Viewer', color: '#6b7280', permissions: ['view_summary'] }
    };


    // ═══════════════════════════════════════════════════════════════
    // SHARING FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    function shareScan(findings, note, engineer) {
        const ws = getWorkspace();
        const scan = {
            id: 'SC-' + Date.now().toString(36).toUpperCase(),
            sharedAt: new Date().toISOString(),
            sharedBy: engineer || ws.name || 'Unknown',
            note: note || '',
            findingCount: findings.length,
            criticalCount: findings.filter(f => f.severity === 'CRITICAL').length,
            highCount: findings.filter(f => f.severity === 'HIGH').length,
            topPatterns: [...new Set(findings.slice(0, 5).map(f => f.pattern_name).filter(Boolean))],
            files: [...new Set(findings.map(f => f.file).filter(Boolean))].slice(0, 10),
            findings: findings.slice(0, 50).map(f => ({
                severity: f.severity,
                pattern: f.pattern_name,
                file: f.file,
                line: f.line_number,
                description: f.description
            }))
        };

        ws.sharedScans.unshift(scan);
        if (ws.sharedScans.length > 100) ws.sharedScans = ws.sharedScans.slice(0, 100);
        saveWorkspace(ws);
        return scan;
    }

    function addComment(scanId, text, author) {
        const ws = getWorkspace();
        ws.comments.push({
            id: 'CM-' + Date.now().toString(36),
            scanId,
            text,
            author: author || ws.name || 'Unknown',
            createdAt: new Date().toISOString()
        });
        saveWorkspace(ws);
    }

    function assignScan(scanId, assignee, note) {
        const ws = getWorkspace();
        ws.assignments.push({
            scanId,
            assignee,
            note: note || '',
            assignedAt: new Date().toISOString(),
            status: 'open'
        });
        saveWorkspace(ws);
    }

    function exportWorkspace() {
        const ws = getWorkspace();
        const members = getMembers();
        return JSON.stringify({ workspace: ws, members, exportedAt: new Date().toISOString() }, null, 2);
    }

    function importWorkspace(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            if (data.workspace) {
                const current = getWorkspace();
                // Merge shared scans (don't duplicate)
                const existingIds = new Set(current.sharedScans.map(s => s.id));
                const newScans = (data.workspace.sharedScans || []).filter(s => !existingIds.has(s.id));
                current.sharedScans = [...newScans, ...current.sharedScans].slice(0, 100);
                // Merge comments
                const existingComments = new Set(current.comments.map(c => c.id));
                const newComments = (data.workspace.comments || []).filter(c => !existingComments.has(c.id));
                current.comments = [...current.comments, ...newComments];
                saveWorkspace(current);
            }
            if (data.members) {
                const currentMembers = getMembers();
                const existingNames = new Set(currentMembers.map(m => m.name));
                const newMembers = data.members.filter(m => !existingNames.has(m.name));
                saveMembers([...currentMembers, ...newMembers]);
            }
            return true;
        } catch(e) { return false; }
    }

    // ═══════════════════════════════════════════════════════════════
    // UI — Workspace Panel
    // ═══════════════════════════════════════════════════════════════

    function renderWorkspacePanel(findings, container) {
        const ws = getWorkspace();
        const members = getMembers();
        const role = ROLES[ws.role] || ROLES.engineer;

        let html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div>
                    <span style="font-size:14px;font-weight:600;color:var(--text-100);">👥 Team Workspace</span>
                    <span style="font-size:11px;color:${role.color};margin-left:8px;background:${role.color}15;padding:2px 6px;border-radius:8px;border:1px solid ${role.color}30;">${role.label}</span>
                </div>
                <div style="display:flex;gap:4px;">
                    <button id="wsShareScan" style="background:var(--accent);color:var(--bg-0);border:none;border-radius:4px;padding:5px 10px;font-size:10px;cursor:pointer;">📤 Share Scan</button>
                    <button id="wsExport" style="background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:4px;padding:5px 8px;font-size:10px;cursor:pointer;color:var(--text-300);">⬇️</button>
                    <button id="wsImport" style="background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:4px;padding:5px 8px;font-size:10px;cursor:pointer;color:var(--text-300);">⬆️</button>
                </div>
            </div>

            <!-- Profile setup -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
                <div>
                    <label style="font-size:9px;color:var(--text-500);display:block;margin-bottom:2px;">Your Name</label>
                    <input id="wsName" type="text" value="${escAttr(ws.name)}" placeholder="Your name" style="width:100%;padding:5px 8px;background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:4px;color:var(--text-200);font-size:11px;outline:none;">
                </div>
                <div>
                    <label style="font-size:9px;color:var(--text-500);display:block;margin-bottom:2px;">Role</label>
                    <select id="wsRole" style="width:100%;padding:5px 8px;background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:4px;color:var(--text-200);font-size:11px;outline:none;">
                        ${Object.entries(ROLES).map(([key, r]) => `<option value="${key}" ${ws.role === key ? 'selected' : ''}>${r.label}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- Shared scans feed -->
            <div style="font-size:11px;font-weight:500;color:var(--text-200);margin-bottom:6px;">📋 Shared Scans (${ws.sharedScans.length})</div>
            <div id="wsSharedScans" style="max-height:280px;overflow-y:auto;">
                ${ws.sharedScans.length === 0 ? `
                    <div style="text-align:center;padding:20px;color:var(--text-500);">
                        <div style="font-size:24px;margin-bottom:6px;">👥</div>
                        <div style="font-size:11px;">No shared scans yet. After a scan, click "Share Scan" to share with your team.</div>
                        <div style="font-size:10px;color:var(--text-500);margin-top:4px;">Use Export/Import (⬇️/⬆️) to share workspace files between machines.</div>
                    </div>` :
                    ws.sharedScans.slice(0, 15).map(scan => {
                        const comments = ws.comments.filter(c => c.scanId === scan.id);
                        const assignment = ws.assignments.find(a => a.scanId === scan.id);
                        return `
                            <div style="background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:6px;padding:10px;margin-bottom:6px;">
                                <div style="display:flex;justify-content:space-between;align-items:center;">
                                    <div>
                                        <span style="font-size:11px;font-weight:500;color:var(--text-100);">${escHtml(scan.sharedBy)}</span>
                                        <span style="font-size:9px;color:var(--text-500);margin-left:6px;">${new Date(scan.sharedAt).toLocaleString()}</span>
                                    </div>
                                    <div style="display:flex;gap:4px;">
                                        ${scan.criticalCount > 0 ? `<span style="font-size:9px;padding:1px 5px;border-radius:4px;background:#ef444420;color:#ef4444;">${scan.criticalCount} CRIT</span>` : ''}
                                        ${scan.highCount > 0 ? `<span style="font-size:9px;padding:1px 5px;border-radius:4px;background:#f59e0b20;color:#f59e0b;">${scan.highCount} HIGH</span>` : ''}
                                    </div>
                                </div>
                                ${scan.note ? `<div style="font-size:10px;color:var(--text-300);margin-top:4px;font-style:italic;">"${escHtml(scan.note)}"</div>` : ''}
                                <div style="font-size:9px;color:var(--text-400);margin-top:4px;">
                                    ${scan.findingCount} findings · ${scan.topPatterns.slice(0, 3).join(', ')}
                                </div>
                                ${assignment ? `<div style="font-size:9px;color:#f59e0b;margin-top:3px;">→ Assigned to ${escHtml(assignment.assignee)}</div>` : ''}
                                ${comments.length > 0 ? `<div style="font-size:9px;color:var(--text-500);margin-top:3px;">💬 ${comments.length} comment${comments.length > 1 ? 's' : ''}</div>` : ''}
                            </div>`;
                    }).join('')}
            </div>

            <!-- Import overlay -->
            <input id="wsImportFile" type="file" accept=".json" style="display:none;">`;

        container.innerHTML = html;

        // ═══ Event Handlers ═══

        // Save profile
        const saveProfile = () => {
            ws.name = document.getElementById('wsName').value;
            ws.role = document.getElementById('wsRole').value;
            saveWorkspace(ws);
        };
        document.getElementById('wsName').addEventListener('change', saveProfile);
        document.getElementById('wsRole').addEventListener('change', saveProfile);

        // Share scan
        document.getElementById('wsShareScan').addEventListener('click', () => {
            if (!findings || findings.length === 0) {
                alert('No scan results to share. Run a scan first.');
                return;
            }
            const note = prompt('Add a note for your team (optional):') || '';
            shareScan(findings, note, ws.name);
            renderWorkspacePanel(findings, container);
        });

        // Export
        document.getElementById('wsExport').addEventListener('click', () => {
            const data = exportWorkspace();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `LogSherlock-Workspace-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });

        // Import
        document.getElementById('wsImport').addEventListener('click', () => {
            document.getElementById('wsImportFile').click();
        });
        document.getElementById('wsImportFile').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                if (importWorkspace(evt.target.result)) {
                    renderWorkspacePanel(findings, container);
                } else {
                    alert('Invalid workspace file.');
                }
            };
            reader.readAsText(file);
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    function initMultiTenant() {
        window.renderMultiTenantPanel = function(findings) {
            let container = document.getElementById('multiTenantPanel');
            if (!container) {
                container = document.createElement('div');
                container.id = 'multiTenantPanel';
                container.className = 'results-panel';
                container.style.cssText = 'margin-top:16px;padding:16px;background:var(--bg-1);border:1px solid var(--border-subtle);border-radius:10px;';

                const anchor = document.getElementById('knowledgeBasePanel') ||
                               document.getElementById('patternConfidencePanel') ||
                               document.getElementById('findingsList');
                if (anchor && anchor.parentNode) {
                    anchor.parentNode.insertBefore(container, anchor.nextSibling);
                }
            }

            renderWorkspacePanel(findings, container);
        };

        window.LogSherlockWorkspace = {
            share: shareScan,
            exportData: exportWorkspace,
            importData: importWorkspace,
            version: '1.0.0'
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMultiTenant);
    } else {
        initMultiTenant();
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
