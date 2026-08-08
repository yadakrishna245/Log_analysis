/**
 * LogSherlock Pro — Baseline Subtraction Module
 * Known-Good Baseline Subtraction: Filter out normal patterns from future scans.
 * 
 * Exports:
 *   window.renderBaselinePanel(findings)
 *   window.getBaselinePatterns()
 *   window.isBaselineActive()
 */
(function () {
    if (typeof window === 'undefined') return;

    const STORAGE_KEY = 'logsherlock_baseline';

    // --- Storage Helpers ---

    function loadBaseline() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.patterns) && typeof parsed.name === 'string') {
                return parsed;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    function saveBaseline(baseline) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(baseline));
    }

    function clearBaseline() {
        localStorage.removeItem(STORAGE_KEY);
    }

    // --- Exported Functions ---

    function getBaselinePatterns() {
        const baseline = loadBaseline();
        return baseline ? baseline.patterns : [];
    }

    function isBaselineActive() {
        return loadBaseline() !== null;
    }

    function renderBaselinePanel(findings) {
        findings = Array.isArray(findings) ? findings : [];
        const baseline = loadBaseline();

        const container = document.createElement('div');
        container.id = 'logsherlock-baseline-panel';
        container.style.cssText = `
            background: #1e1e2e;
            border: 1px solid #333;
            border-radius: 10px;
            padding: 24px;
            margin: 16px 0;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            color: #e0e0e0;
        `;

        // --- Title ---
        const title = document.createElement('h2');
        title.textContent = '📏 Baseline Subtraction — Filter Known-Good';
        title.style.cssText = `
            margin: 0 0 20px 0;
            font-size: 1.3rem;
            color: #01a982;
            border-bottom: 1px solid #333;
            padding-bottom: 12px;
        `;
        container.appendChild(title);

        // --- Section A: Set Baseline ---
        const sectionA = document.createElement('div');
        sectionA.style.cssText = 'margin-bottom: 24px;';

        const sectionATitle = document.createElement('h3');
        sectionATitle.textContent = 'Set Baseline';
        sectionATitle.style.cssText = 'margin: 0 0 12px 0; font-size: 1rem; color: #ccc;';
        sectionA.appendChild(sectionATitle);

        if (!baseline) {
            // No baseline — show save button
            const saveBtn = createButton('Save Current Scan as Baseline', function () {
                if (!findings || findings.length === 0) {
                    showToast(container, 'No findings in current scan to save as baseline.');
                    return;
                }
                const uniquePatterns = [...new Set(findings.map(function (f) { return f.pattern_name; }).filter(Boolean))];
                const newBaseline = {
                    name: 'Baseline — ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
                    created_at: new Date().toISOString(),
                    patterns: uniquePatterns
                };
                saveBaseline(newBaseline);
                reRender(findings);
            });
            sectionA.appendChild(saveBtn);
        } else {
            // Baseline exists — show info card
            const infoCard = document.createElement('div');
            infoCard.style.cssText = `
                background: #2a2a3e;
                border: 1px solid #01a982;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 12px;
            `;

            const createdDate = new Date(baseline.created_at).toLocaleString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            infoCard.innerHTML = `
                <div style="font-weight: 600; color: #01a982; margin-bottom: 6px;">${escapeHtml(baseline.name)}</div>
                <div style="font-size: 0.85rem; color: #aaa; margin-bottom: 4px;">Created: ${escapeHtml(createdDate)}</div>
                <div style="font-size: 0.85rem; color: #aaa;">Patterns: <strong style="color: #e0e0e0;">${baseline.patterns.length}</strong> known-good patterns defined</div>
            `;
            sectionA.appendChild(infoCard);

            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display: flex; gap: 10px; flex-wrap: wrap;';

            const clearBtn = createButton('Clear Baseline', function () {
                clearBaseline();
                reRender(findings);
            }, true);
            btnRow.appendChild(clearBtn);

            const updateBtn = createButton('Update Baseline', function () {
                if (!findings || findings.length === 0) {
                    showToast(container, 'No findings in current scan to update baseline.');
                    return;
                }
                const uniquePatterns = [...new Set(findings.map(function (f) { return f.pattern_name; }).filter(Boolean))];
                const updatedBaseline = {
                    name: 'Baseline — ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
                    created_at: new Date().toISOString(),
                    patterns: uniquePatterns
                };
                saveBaseline(updatedBaseline);
                reRender(findings);
            });
            btnRow.appendChild(updateBtn);

            sectionA.appendChild(btnRow);
        }

        container.appendChild(sectionA);

        // --- Section B: Delta View ---
        const sectionB = document.createElement('div');

        const sectionBTitle = document.createElement('h3');
        sectionBTitle.textContent = 'Delta View';
        sectionBTitle.style.cssText = 'margin: 0 0 12px 0; font-size: 1rem; color: #ccc;';
        sectionB.appendChild(sectionBTitle);

        if (!baseline) {
            const hint = document.createElement('p');
            hint.textContent = 'Set a baseline from a clean environment scan to filter known-good patterns from future scans.';
            hint.style.cssText = 'color: #888; font-size: 0.9rem; margin: 0;';
            sectionB.appendChild(hint);
        } else if (findings.length > 0) {
            const baselineSet = new Set(baseline.patterns);
            const deltaFindings = findings.filter(function (f) {
                return !baselineSet.has(f.pattern_name);
            });
            const baselineMatched = findings.filter(function (f) {
                return baselineSet.has(f.pattern_name);
            });

            // Stats line
            const stats = document.createElement('div');
            stats.style.cssText = 'margin-bottom: 14px; font-size: 0.9rem; color: #bbb;';
            stats.innerHTML = `
                <span style="color: #01a982; font-weight: 600;">Baseline: ${baseline.patterns.length} patterns defined</span>
                <span style="margin: 0 8px;">•</span>
                Current scan: ${findings.length} findings
                <span style="margin: 0 8px;">•</span>
                <span style="color: ${deltaFindings.length > 0 ? '#ff6b6b' : '#01a982'}; font-weight: 600;">New (not in baseline): ${deltaFindings.length} findings</span>
            `;
            sectionB.appendChild(stats);

            // Toggle button
            let showDeltaOnly = true;
            const toggleBtn = document.createElement('button');
            toggleBtn.textContent = 'Show All';
            toggleBtn.style.cssText = `
                background: transparent;
                border: 1px solid #555;
                color: #ccc;
                padding: 6px 14px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 0.85rem;
                margin-bottom: 14px;
                transition: all 0.2s;
            `;
            toggleBtn.addEventListener('mouseenter', function () {
                toggleBtn.style.borderColor = '#01a982';
                toggleBtn.style.color = '#01a982';
            });
            toggleBtn.addEventListener('mouseleave', function () {
                toggleBtn.style.borderColor = '#555';
                toggleBtn.style.color = '#ccc';
            });

            const findingsList = document.createElement('div');

            function renderFindings() {
                findingsList.innerHTML = '';
                const toShow = showDeltaOnly ? deltaFindings : findings;

                if (toShow.length === 0) {
                    const empty = document.createElement('div');
                    empty.textContent = showDeltaOnly
                        ? '✅ No new findings — all patterns match the baseline.'
                        : 'No findings to display.';
                    empty.style.cssText = 'color: #01a982; font-size: 0.9rem; padding: 12px 0;';
                    findingsList.appendChild(empty);
                    return;
                }

                toShow.forEach(function (finding) {
                    const item = document.createElement('div');
                    item.style.cssText = `
                        background: #2a2a3e;
                        border: 1px solid #3a3a4e;
                        border-radius: 6px;
                        padding: 10px 14px;
                        margin-bottom: 8px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        flex-wrap: wrap;
                    `;

                    // Severity badge
                    const severity = (finding.severity || 'info').toLowerCase();
                    const severityColors = {
                        critical: '#ff4444',
                        high: '#ff6b6b',
                        medium: '#ffaa00',
                        low: '#01a982',
                        info: '#6699cc'
                    };
                    const badge = document.createElement('span');
                    badge.textContent = severity.toUpperCase();
                    badge.style.cssText = `
                        background: ${severityColors[severity] || '#6699cc'};
                        color: #1e1e2e;
                        font-size: 0.7rem;
                        font-weight: 700;
                        padding: 2px 7px;
                        border-radius: 3px;
                        text-transform: uppercase;
                    `;
                    item.appendChild(badge);

                    // Pattern name
                    const name = document.createElement('span');
                    name.textContent = finding.pattern_name || 'Unknown';
                    name.style.cssText = 'color: #e0e0e0; font-size: 0.9rem; flex: 1;';
                    item.appendChild(name);

                    // Baseline tag (when showing all)
                    if (!showDeltaOnly && baselineSet.has(finding.pattern_name)) {
                        const tag = document.createElement('span');
                        tag.textContent = '✔️ baseline';
                        tag.style.cssText = `
                            font-size: 0.75rem;
                            color: #01a982;
                            background: rgba(1, 169, 130, 0.1);
                            border: 1px solid rgba(1, 169, 130, 0.3);
                            padding: 2px 8px;
                            border-radius: 4px;
                        `;
                        item.appendChild(tag);
                    }

                    findingsList.appendChild(item);
                });
            }

            toggleBtn.addEventListener('click', function () {
                showDeltaOnly = !showDeltaOnly;
                toggleBtn.textContent = showDeltaOnly ? 'Show All' : 'Show Delta Only';
                renderFindings();
            });

            sectionB.appendChild(toggleBtn);
            sectionB.appendChild(findingsList);
            renderFindings();
        } else {
            const noFindings = document.createElement('p');
            noFindings.textContent = 'No findings in current scan to compare against baseline.';
            noFindings.style.cssText = 'color: #888; font-size: 0.9rem; margin: 0;';
            sectionB.appendChild(noFindings);
        }

        container.appendChild(sectionB);

        // --- Insert into DOM ---
        const existing = document.getElementById('logsherlock-baseline-panel');
        if (existing) {
            existing.replaceWith(container);
        } else {
            const target = document.getElementById('logsherlock-baseline-target') || document.body;
            target.appendChild(container);
        }

        // --- Re-render helper ---
        function reRender(f) {
            renderBaselinePanel(f);
        }
    }

    // --- UI Helpers ---

    function createButton(text, onClick, isDanger) {
        const btn = document.createElement('button');
        btn.textContent = text;
        const baseColor = isDanger ? '#ff6b6b' : '#01a982';
        btn.style.cssText = `
            background: ${baseColor};
            color: #1e1e2e;
            border: none;
            padding: 8px 18px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 600;
            transition: opacity 0.2s;
        `;
        btn.addEventListener('mouseenter', function () { btn.style.opacity = '0.8'; });
        btn.addEventListener('mouseleave', function () { btn.style.opacity = '1'; });
        btn.addEventListener('click', onClick);
        return btn;
    }

    function showToast(container, message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            background: #ffaa00;
            color: #1e1e2e;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 0.85rem;
            font-weight: 600;
            margin-top: 10px;
            display: inline-block;
        `;
        container.appendChild(toast);
        setTimeout(function () { toast.remove(); }, 3000);
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // --- Self-initialize ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            // Module ready — panel renders on demand via renderBaselinePanel()
        });
    }

    // --- Export to window ---
    window.renderBaselinePanel = renderBaselinePanel;
    window.getBaselinePatterns = getBaselinePatterns;
    window.isBaselineActive = isBaselineActive;

})();
