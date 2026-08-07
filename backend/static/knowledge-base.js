/**
 * LogSherlock Pro — Knowledge Base Builder
 * Save resolved cases as searchable playbooks
 * 
 * ENTERPRISE FEATURE: Institutional memory. When an engineer solves
 * a problem, save the case: symptoms, root cause, resolution steps.
 * Next time same pattern appears, the KB suggests prior resolution.
 * 
 * DATA INTEGRITY: KB entries are CREATED by engineers from real cases.
 * Suggestions are clearly labeled as "from prior cases" not "AI-generated."
 */

(function() {
    'use strict';

    const KB_STORAGE_KEY = 'logsherlock_knowledge_base';

    // ═══════════════════════════════════════════════════════════════
    // KNOWLEDGE BASE CRUD
    // ═══════════════════════════════════════════════════════════════

    function getKB() {
        try {
            return JSON.parse(localStorage.getItem(KB_STORAGE_KEY) || '[]');
        } catch(e) { return []; }
    }

    function saveKB(entries) {
        try {
            localStorage.setItem(KB_STORAGE_KEY, JSON.stringify(entries));
        } catch(e) {}
    }

    function addEntry(entry) {
        const kb = getKB();
        entry.id = 'KB-' + Date.now().toString(36).toUpperCase();
        entry.createdAt = new Date().toISOString();
        entry.usageCount = 0;
        kb.unshift(entry);
        saveKB(kb);
        return entry;
    }

    function deleteEntry(id) {
        const kb = getKB().filter(e => e.id !== id);
        saveKB(kb);
    }

    function searchKB(query) {
        const kb = getKB();
        const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        if (terms.length === 0) return kb;

        return kb.map(entry => {
            const searchText = `${entry.title} ${entry.symptoms} ${entry.rootCause} ${entry.resolution} ${(entry.patterns || []).join(' ')}`.toLowerCase();
            const score = terms.reduce((sum, term) => sum + (searchText.includes(term) ? 1 : 0), 0);
            return { ...entry, relevance: score / terms.length };
        }).filter(e => e.relevance > 0).sort((a, b) => b.relevance - a.relevance);
    }

    function findRelevantKB(findings) {
        const kb = getKB();
        if (kb.length === 0 || !findings || findings.length === 0) return [];

        const findingPatterns = findings.map(f => (f.pattern_name || '').toLowerCase());
        const findingText = findings.map(f => `${f.pattern_name} ${f.description || ''}`).join(' ').toLowerCase();

        return kb.map(entry => {
            let score = 0;
            // Match on patterns
            (entry.patterns || []).forEach(p => {
                if (findingPatterns.some(fp => fp.includes(p.toLowerCase()) || p.toLowerCase().includes(fp))) {
                    score += 3;
                }
            });
            // Match on keywords in symptoms
            const symptomWords = (entry.symptoms || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
            symptomWords.forEach(w => {
                if (findingText.includes(w)) score += 0.5;
            });

            return { ...entry, matchScore: score };
        }).filter(e => e.matchScore > 1).sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
    }


    // ═══════════════════════════════════════════════════════════════
    // UI — Knowledge Base Panel
    // ═══════════════════════════════════════════════════════════════

    function renderKBPanel(findings, container) {
        const kb = getKB();
        const relevant = findRelevantKB(findings);

        let html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div>
                    <span style="font-size:14px;font-weight:600;color:var(--text-100);">📚 Knowledge Base</span>
                    <span style="font-size:11px;color:var(--text-400);margin-left:8px;">${kb.length} playbook${kb.length !== 1 ? 's' : ''} saved</span>
                </div>
                <button id="kbAddNew" style="background:var(--accent);color:var(--bg-0);border:none;border-radius:6px;padding:6px 12px;font-size:11px;cursor:pointer;font-weight:500;">
                    ➕ Save Current Case
                </button>
            </div>`;

        // Show relevant prior cases
        if (relevant.length > 0) {
            html += `
                <div style="background:#10b98110;border:1px solid #10b98130;border-radius:8px;padding:12px;margin-bottom:12px;">
                    <div style="font-size:11px;font-weight:600;color:#10b981;margin-bottom:8px;">
                        💡 ${relevant.length} prior case${relevant.length !== 1 ? 's' : ''} may be relevant (from engineer-created playbooks)
                    </div>
                    ${relevant.map(entry => `
                        <div style="background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:6px;padding:10px;margin-bottom:6px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;">
                                <div style="font-size:12px;font-weight:500;color:var(--text-100);">${escHtml(entry.title)}</div>
                                <span style="font-size:9px;color:var(--text-500);">${entry.id} · ${new Date(entry.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div style="font-size:10px;color:var(--text-300);margin-top:4px;">
                                <strong>Root Cause:</strong> ${escHtml(entry.rootCause || 'Not specified')}
                            </div>
                            <div style="font-size:10px;color:var(--text-400);margin-top:3px;">
                                <strong>Resolution:</strong> ${escHtml((entry.resolution || '').substring(0, 150))}${(entry.resolution || '').length > 150 ? '...' : ''}
                            </div>
                            ${entry.patterns && entry.patterns.length > 0 ? `
                                <div style="margin-top:4px;display:flex;gap:3px;flex-wrap:wrap;">
                                    ${entry.patterns.map(p => `<span style="font-size:8px;padding:1px 5px;border-radius:8px;background:var(--accent)15;color:var(--accent);border:1px solid var(--accent)30;">${escHtml(p)}</span>`).join('')}
                                </div>` : ''}
                        </div>`).join('')}
                </div>`;
        }

        // Search bar
        html += `
            <div style="margin-bottom:12px;">
                <div style="display:flex;gap:4px;">
                    <input id="kbSearch" type="text" placeholder="Search knowledge base..." style="
                        flex:1;padding:6px 10px;background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:4px;
                        color:var(--text-200);font-size:11px;outline:none;
                    ">
                    <button id="kbSearchBtn" style="padding:6px 10px;background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:4px;font-size:11px;cursor:pointer;color:var(--text-300);">🔍</button>
                </div>
            </div>

            <!-- KB entries list -->
            <div id="kbEntries" style="max-height:300px;overflow-y:auto;">
                ${kb.length === 0 ? `
                    <div style="text-align:center;padding:20px;color:var(--text-500);">
                        <div style="font-size:24px;margin-bottom:6px;">📚</div>
                        <div style="font-size:11px;">No playbooks yet. After resolving a case, click "Save Current Case" to build your team's knowledge base.</div>
                    </div>` :
                    kb.slice(0, 10).map(entry => `
                        <div style="background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:6px;padding:8px 10px;margin-bottom:4px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;">
                                <span style="font-size:11px;font-weight:500;color:var(--text-200);">${escHtml(entry.title)}</span>
                                <div style="display:flex;gap:4px;align-items:center;">
                                    <span style="font-size:9px;color:var(--text-500);">${new Date(entry.createdAt).toLocaleDateString()}</span>
                                    <button class="kb-delete" data-id="${entry.id}" style="font-size:9px;color:var(--text-500);background:none;border:none;cursor:pointer;padding:2px;">🗑️</button>
                                </div>
                            </div>
                            <div style="font-size:9px;color:var(--text-400);margin-top:2px;">${escHtml((entry.symptoms || '').substring(0, 80))}</div>
                        </div>`).join('')}
                ${kb.length > 10 ? `<div style="font-size:10px;color:var(--text-500);text-align:center;padding:4px;">+${kb.length - 10} more</div>` : ''}
            </div>

            <!-- New entry form (hidden by default) -->
            <div id="kbNewForm" style="display:none;margin-top:12px;background:var(--bg-0);border:1px solid var(--accent);border-radius:8px;padding:14px;"></div>`;

        container.innerHTML = html;

        // ═══ Event Handlers ═══

        // Add new case
        document.getElementById('kbAddNew').addEventListener('click', () => {
            const form = document.getElementById('kbNewForm');
            form.style.display = form.style.display === 'none' ? 'block' : 'none';
            if (form.style.display === 'block') {
                renderNewEntryForm(form, findings, container);
            }
        });

        // Search
        const doSearch = () => {
            const query = document.getElementById('kbSearch').value;
            const results = searchKB(query);
            const entriesEl = document.getElementById('kbEntries');
            if (query.trim()) {
                entriesEl.innerHTML = results.length === 0 ? 
                    '<div style="text-align:center;color:var(--text-500);font-size:11px;padding:12px;">No matching playbooks found.</div>' :
                    results.map(entry => `
                        <div style="background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:6px;padding:8px 10px;margin-bottom:4px;">
                            <div style="font-size:11px;font-weight:500;color:var(--text-200);">${escHtml(entry.title)}</div>
                            <div style="font-size:10px;color:var(--text-300);margin-top:3px;"><strong>Root Cause:</strong> ${escHtml(entry.rootCause || '')}</div>
                            <div style="font-size:10px;color:var(--text-400);margin-top:2px;"><strong>Resolution:</strong> ${escHtml((entry.resolution || '').substring(0, 120))}</div>
                        </div>`).join('');
            }
        };
        document.getElementById('kbSearchBtn').addEventListener('click', doSearch);
        document.getElementById('kbSearch').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

        // Delete handlers
        container.querySelectorAll('.kb-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Delete this playbook entry?')) {
                    deleteEntry(btn.dataset.id);
                    renderKBPanel(findings, container);
                }
            });
        });
    }

    function renderNewEntryForm(formEl, findings, container) {
        // Pre-populate patterns from current findings
        const topPatterns = [...new Set(findings.slice(0, 10).map(f => f.pattern_name).filter(Boolean))];

        formEl.innerHTML = `
            <div style="font-size:12px;font-weight:600;color:var(--text-100);margin-bottom:10px;">📝 Save as Playbook</div>
            <div style="margin-bottom:8px;">
                <label style="font-size:10px;color:var(--text-400);display:block;margin-bottom:2px;">Title *</label>
                <input id="kbTitle" type="text" placeholder="e.g., GFS2 withdraw due to SAN path flap" style="width:100%;padding:6px 10px;background:var(--bg-1);border:1px solid var(--border-subtle);border-radius:4px;color:var(--text-200);font-size:11px;outline:none;">
            </div>
            <div style="margin-bottom:8px;">
                <label style="font-size:10px;color:var(--text-400);display:block;margin-bottom:2px;">Symptoms (what was observed)</label>
                <textarea id="kbSymptoms" rows="2" placeholder="e.g., GFS2 filesystem went read-only on node3, applications failing to write" style="width:100%;padding:6px 10px;background:var(--bg-1);border:1px solid var(--border-subtle);border-radius:4px;color:var(--text-200);font-size:11px;outline:none;resize:vertical;"></textarea>
            </div>
            <div style="margin-bottom:8px;">
                <label style="font-size:10px;color:var(--text-400);display:block;margin-bottom:2px;">Root Cause *</label>
                <textarea id="kbRootCause" rows="2" placeholder="e.g., FC switch port CRC errors caused multipath to lose 2 of 4 paths, triggering SCSI reservation conflict" style="width:100%;padding:6px 10px;background:var(--bg-1);border:1px solid var(--border-subtle);border-radius:4px;color:var(--text-200);font-size:11px;outline:none;resize:vertical;"></textarea>
            </div>
            <div style="margin-bottom:8px;">
                <label style="font-size:10px;color:var(--text-400);display:block;margin-bottom:2px;">Resolution Steps *</label>
                <textarea id="kbResolution" rows="3" placeholder="1. Cleared FC port errors on switch\n2. Ran 'multipathd reconfigure'\n3. Remounted GFS2\n4. Verified applications writing successfully" style="width:100%;padding:6px 10px;background:var(--bg-1);border:1px solid var(--border-subtle);border-radius:4px;color:var(--text-200);font-size:11px;outline:none;resize:vertical;"></textarea>
            </div>
            <div style="margin-bottom:10px;">
                <label style="font-size:10px;color:var(--text-400);display:block;margin-bottom:2px;">Related Patterns (auto-detected from scan)</label>
                <div style="display:flex;flex-wrap:wrap;gap:4px;">
                    ${topPatterns.map(p => `
                        <label style="font-size:9px;padding:3px 6px;background:var(--bg-1);border:1px solid var(--border-subtle);border-radius:4px;cursor:pointer;display:flex;align-items:center;gap:3px;">
                            <input type="checkbox" class="kb-pattern-check" value="${escAttr(p)}" checked style="width:10px;height:10px;">
                            ${escHtml(p)}
                        </label>`).join('')}
                </div>
            </div>
            <div style="display:flex;gap:6px;">
                <button id="kbSaveEntry" style="background:var(--accent);color:var(--bg-0);border:none;border-radius:4px;padding:6px 14px;font-size:11px;cursor:pointer;font-weight:500;">💾 Save Playbook</button>
                <button id="kbCancelEntry" style="background:var(--bg-1);color:var(--text-300);border:1px solid var(--border-subtle);border-radius:4px;padding:6px 14px;font-size:11px;cursor:pointer;">Cancel</button>
            </div>`;

        // Save handler
        formEl.querySelector('#kbSaveEntry').addEventListener('click', () => {
            const title = document.getElementById('kbTitle').value.trim();
            const rootCause = document.getElementById('kbRootCause').value.trim();
            const resolution = document.getElementById('kbResolution').value.trim();

            if (!title || !rootCause || !resolution) {
                alert('Title, Root Cause, and Resolution are required.');
                return;
            }

            const patterns = [...formEl.querySelectorAll('.kb-pattern-check:checked')].map(cb => cb.value);

            addEntry({
                title,
                symptoms: document.getElementById('kbSymptoms').value.trim(),
                rootCause,
                resolution,
                patterns,
                engineer: '',
                ticketId: ''
            });

            formEl.style.display = 'none';
            renderKBPanel(findings, container);
        });

        formEl.querySelector('#kbCancelEntry').addEventListener('click', () => {
            formEl.style.display = 'none';
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    function initKnowledgeBase() {
        window.renderKnowledgeBasePanel = function(findings) {
            let container = document.getElementById('knowledgeBasePanel');
            if (!container) {
                container = document.createElement('div');
                container.id = 'knowledgeBasePanel';
                container.className = 'results-panel';
                container.style.cssText = 'margin-top:16px;padding:16px;background:var(--bg-1);border:1px solid var(--border-subtle);border-radius:10px;';

                const anchor = document.getElementById('patternConfidencePanel') ||
                               document.getElementById('executiveSummaryPanel') ||
                               document.getElementById('findingsList');
                if (anchor && anchor.parentNode) {
                    anchor.parentNode.insertBefore(container, anchor.nextSibling);
                }
            }

            renderKBPanel(findings, container);
        };

        window.LogSherlockKB = {
            search: searchKB,
            add: addEntry,
            getAll: getKB,
            findRelevant: findRelevantKB,
            version: '1.0.0'
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initKnowledgeBase);
    } else {
        initKnowledgeBase();
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
