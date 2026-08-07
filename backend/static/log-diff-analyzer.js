/**
 * LogSherlock Pro — Log Diff Analyzer
 * Compare two log sets: before/after change, good node vs bad node
 * 
 * ENTERPRISE FEATURE: After a change/upgrade, compare logs to see what's NEW.
 * During cluster issues, compare good vs bad node to isolate the difference.
 * 
 * DATA INTEGRITY: Shows ONLY actual differences between uploaded log sets.
 * No fabrication. Pure diff-based analysis on real log content.
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    // DIFF ENGINE — compares two sets of scan findings
    // ═══════════════════════════════════════════════════════════════

    function diffFindings(setA, setB, labelA, labelB) {
        if (!setA || !setB) return null;

        // Index findings by pattern_name + severity
        const indexByPattern = (findings) => {
            const idx = {};
            findings.forEach(f => {
                const key = `${f.pattern_name}|${f.severity}`;
                if (!idx[key]) idx[key] = [];
                idx[key].push(f);
            });
            return idx;
        };

        const idxA = indexByPattern(setA);
        const idxB = indexByPattern(setB);

        const allKeys = new Set([...Object.keys(idxA), ...Object.keys(idxB)]);

        const onlyInA = []; // Present in A but not B
        const onlyInB = []; // Present in B but not A (NEW issues)
        const inBoth = [];  // Present in both
        const countDiff = []; // Present in both but different counts

        allKeys.forEach(key => {
            const aItems = idxA[key] || [];
            const bItems = idxB[key] || [];
            const [pattern, severity] = key.split('|');

            if (aItems.length > 0 && bItems.length === 0) {
                onlyInA.push({ pattern, severity, count: aItems.length, findings: aItems });
            } else if (aItems.length === 0 && bItems.length > 0) {
                onlyInB.push({ pattern, severity, count: bItems.length, findings: bItems });
            } else {
                inBoth.push({ pattern, severity, countA: aItems.length, countB: bItems.length });
                if (aItems.length !== bItems.length) {
                    countDiff.push({ pattern, severity, countA: aItems.length, countB: bItems.length, delta: bItems.length - aItems.length });
                }
            }
        });

        // Sort new issues by severity
        const sevOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
        onlyInB.sort((a, b) => (sevOrder[a.severity] || 9) - (sevOrder[b.severity] || 9));
        onlyInA.sort((a, b) => (sevOrder[a.severity] || 9) - (sevOrder[b.severity] || 9));
        countDiff.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

        return {
            labelA,
            labelB,
            totalA: setA.length,
            totalB: setB.length,
            onlyInA,
            onlyInB,
            inBoth,
            countDiff,
            summary: {
                newIssues: onlyInB.length,
                resolvedIssues: onlyInA.length,
                unchanged: inBoth.length - countDiff.length,
                worsened: countDiff.filter(d => d.delta > 0).length,
                improved: countDiff.filter(d => d.delta < 0).length
            }
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // FILE COMPARATOR — compares unique files/lines between sets
    // ═══════════════════════════════════════════════════════════════

    function diffFileLocations(setA, setB) {
        const filesA = new Set(setA.map(f => f.file).filter(Boolean));
        const filesB = new Set(setB.map(f => f.file).filter(Boolean));

        const onlyInA = [...filesA].filter(f => !filesB.has(f));
        const onlyInB = [...filesB].filter(f => !filesA.has(f));
        const common = [...filesA].filter(f => filesB.has(f));

        return { onlyInA, onlyInB, common };
    }


    // ═══════════════════════════════════════════════════════════════
    // UI — Interactive diff panel with upload slots
    // ═══════════════════════════════════════════════════════════════

    let storedSetA = null;
    let storedSetB = null;
    let lastScanFindings = null;

    function renderDiffPanel(findings, container) {
        lastScanFindings = findings;

        let html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div>
                    <span style="font-size:14px;font-weight:600;color:var(--text-100);">🔀 Log Diff Analyzer</span>
                    <span style="font-size:11px;color:var(--text-400);margin-left:8px;">Compare two scan results</span>
                </div>
            </div>

            <div style="font-size:11px;color:var(--text-400);margin-bottom:12px;">
                Compare findings from two different scans: before/after a change, good node vs bad node, or two time periods.
            </div>

            <!-- Instructions -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
                <!-- Set A -->
                <div style="background:var(--bg-0);border:1px solid ${storedSetA ? '#10b981' : 'var(--border-subtle)'};border-radius:8px;padding:12px;">
                    <div style="font-size:11px;font-weight:600;color:var(--text-200);margin-bottom:6px;">
                        📁 Set A (Baseline / Before / Good Node)
                    </div>
                    ${storedSetA ? `
                        <div style="font-size:11px;color:#10b981;">✅ ${storedSetA.length} findings loaded</div>
                        <button id="diffClearA" style="font-size:10px;padding:3px 8px;margin-top:6px;background:var(--bg-1);color:var(--text-400);border:1px solid var(--border-subtle);border-radius:4px;cursor:pointer;">Clear</button>
                    ` : `
                        <div style="font-size:10px;color:var(--text-500);margin-bottom:6px;">No baseline loaded</div>
                        <button id="diffSaveA" style="font-size:10px;padding:4px 10px;background:var(--accent);color:var(--bg-0);border:none;border-radius:4px;cursor:pointer;">
                            💾 Save Current Scan as Set A
                        </button>
                    `}
                </div>

                <!-- Set B -->
                <div style="background:var(--bg-0);border:1px solid ${storedSetB ? '#3b82f6' : 'var(--border-subtle)'};border-radius:8px;padding:12px;">
                    <div style="font-size:11px;font-weight:600;color:var(--text-200);margin-bottom:6px;">
                        📁 Set B (After Change / Bad Node)
                    </div>
                    ${storedSetB ? `
                        <div style="font-size:11px;color:#3b82f6;">✅ ${storedSetB.length} findings loaded</div>
                        <button id="diffClearB" style="font-size:10px;padding:3px 8px;margin-top:6px;background:var(--bg-1);color:var(--text-400);border:1px solid var(--border-subtle);border-radius:4px;cursor:pointer;">Clear</button>
                    ` : `
                        <div style="font-size:10px;color:var(--text-500);margin-bottom:6px;">No comparison loaded</div>
                        <button id="diffSaveB" style="font-size:10px;padding:4px 10px;background:#3b82f6;color:white;border:none;border-radius:4px;cursor:pointer;">
                            💾 Save Current Scan as Set B
                        </button>
                    `}
                </div>
            </div>

            <!-- Compare button -->
            ${storedSetA && storedSetB ? `
                <button id="diffCompare" style="width:100%;padding:10px;background:linear-gradient(135deg,var(--accent),#10b981);color:var(--bg-0);border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">
                    🔀 Compare Set A vs Set B
                </button>
            ` : `
                <div style="text-align:center;font-size:11px;color:var(--text-500);padding:10px;">
                    ${!storedSetA && !storedSetB ? '💡 Run a scan, save as Set A. Then scan different logs, save as Set B. Click Compare.' :
                      storedSetA ? '💡 Now scan your second log set and save as Set B.' :
                      '💡 Now scan your first log set and save as Set A.'}
                </div>
            `}

            <!-- Results area -->
            <div id="diffResults" style="margin-top:14px;"></div>`;

        container.innerHTML = html;

        // Event handlers
        if (!storedSetA && document.getElementById('diffSaveA')) {
            document.getElementById('diffSaveA').addEventListener('click', () => {
                if (findings && findings.length > 0) {
                    storedSetA = [...findings];
                    renderDiffPanel(findings, container);
                } else {
                    alert('No scan findings to save. Run a scan first.');
                }
            });
        }

        if (!storedSetB && document.getElementById('diffSaveB')) {
            document.getElementById('diffSaveB').addEventListener('click', () => {
                if (findings && findings.length > 0) {
                    storedSetB = [...findings];
                    renderDiffPanel(findings, container);
                } else {
                    alert('No scan findings to save. Run a scan first.');
                }
            });
        }

        if (document.getElementById('diffClearA')) {
            document.getElementById('diffClearA').addEventListener('click', () => {
                storedSetA = null;
                renderDiffPanel(findings, container);
            });
        }

        if (document.getElementById('diffClearB')) {
            document.getElementById('diffClearB').addEventListener('click', () => {
                storedSetB = null;
                renderDiffPanel(findings, container);
            });
        }

        if (document.getElementById('diffCompare')) {
            document.getElementById('diffCompare').addEventListener('click', () => {
                const diff = diffFindings(storedSetA, storedSetB, 'Set A (Baseline)', 'Set B (After)');
                const fileDiff = diffFileLocations(storedSetA, storedSetB);
                renderDiffResults(diff, fileDiff, container.querySelector('#diffResults'));
            });
        }
    }

    function renderDiffResults(diff, fileDiff, resultEl) {
        const sevColors = { CRITICAL: '#ef4444', HIGH: '#f59e0b', MEDIUM: '#3b82f6', LOW: '#6b7280', INFO: '#8b5cf6' };

        let html = `
            <!-- Summary -->
            <div style="background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:8px;padding:14px;margin-bottom:12px;">
                <div style="font-size:12px;font-weight:600;color:var(--text-100);margin-bottom:8px;">📊 Diff Summary</div>
                <div style="display:grid;grid-template-columns:repeat(5, 1fr);gap:8px;text-align:center;">
                    <div>
                        <div style="font-size:18px;font-weight:700;color:#ef4444;">${diff.summary.newIssues}</div>
                        <div style="font-size:9px;color:var(--text-400);">New Issues</div>
                    </div>
                    <div>
                        <div style="font-size:18px;font-weight:700;color:#10b981;">${diff.summary.resolvedIssues}</div>
                        <div style="font-size:9px;color:var(--text-400);">Resolved</div>
                    </div>
                    <div>
                        <div style="font-size:18px;font-weight:700;color:#f59e0b;">${diff.summary.worsened}</div>
                        <div style="font-size:9px;color:var(--text-400);">Worsened</div>
                    </div>
                    <div>
                        <div style="font-size:18px;font-weight:700;color:#3b82f6;">${diff.summary.improved}</div>
                        <div style="font-size:9px;color:var(--text-400);">Improved</div>
                    </div>
                    <div>
                        <div style="font-size:18px;font-weight:700;color:var(--text-400);">${diff.summary.unchanged}</div>
                        <div style="font-size:9px;color:var(--text-400);">Unchanged</div>
                    </div>
                </div>
                <div style="font-size:10px;color:var(--text-500);margin-top:8px;text-align:center;">
                    ${diff.labelA}: ${diff.totalA} findings → ${diff.labelB}: ${diff.totalB} findings (${diff.totalB > diff.totalA ? '+' : ''}${diff.totalB - diff.totalA} net)
                </div>
            </div>`;

        // New issues (only in B)
        if (diff.onlyInB.length > 0) {
            html += `
                <div style="background:#ef444410;border:1px solid #ef444430;border-radius:8px;padding:12px;margin-bottom:10px;">
                    <div style="font-size:11px;font-weight:600;color:#ef4444;margin-bottom:8px;">🚨 NEW Issues (Only in Set B)</div>
                    ${diff.onlyInB.map(item => `
                        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #ef444415;">
                            <span style="font-size:9px;padding:2px 5px;border-radius:3px;background:${sevColors[item.severity]}20;color:${sevColors[item.severity]};font-weight:600;">${item.severity}</span>
                            <span style="font-size:11px;color:var(--text-200);flex:1;">${escHtml(item.pattern)}</span>
                            <span style="font-size:10px;color:var(--text-400);">${item.count}x</span>
                        </div>`).join('')}
                </div>`;
        }

        // Resolved issues (only in A)
        if (diff.onlyInA.length > 0) {
            html += `
                <div style="background:#10b98110;border:1px solid #10b98130;border-radius:8px;padding:12px;margin-bottom:10px;">
                    <div style="font-size:11px;font-weight:600;color:#10b981;margin-bottom:8px;">✅ RESOLVED (Only in Set A — no longer present)</div>
                    ${diff.onlyInA.map(item => `
                        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #10b98115;">
                            <span style="font-size:9px;padding:2px 5px;border-radius:3px;background:${sevColors[item.severity]}20;color:${sevColors[item.severity]};font-weight:600;">${item.severity}</span>
                            <span style="font-size:11px;color:var(--text-200);flex:1;text-decoration:line-through;opacity:0.7;">${escHtml(item.pattern)}</span>
                            <span style="font-size:10px;color:var(--text-400);">${item.count}x</span>
                        </div>`).join('')}
                </div>`;
        }

        // Count differences (worsened/improved)
        if (diff.countDiff.length > 0) {
            html += `
                <div style="background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:8px;padding:12px;margin-bottom:10px;">
                    <div style="font-size:11px;font-weight:600;color:var(--text-200);margin-bottom:8px;">📈 Changed Frequency</div>
                    ${diff.countDiff.slice(0, 10).map(item => {
                        const direction = item.delta > 0 ? '📈' : '📉';
                        const color = item.delta > 0 ? '#ef4444' : '#10b981';
                        return `
                            <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border-subtle);">
                                <span style="font-size:9px;padding:2px 5px;border-radius:3px;background:${sevColors[item.severity]}20;color:${sevColors[item.severity]};">${item.severity}</span>
                                <span style="font-size:11px;color:var(--text-200);flex:1;">${escHtml(item.pattern)}</span>
                                <span style="font-size:10px;color:${color};">${direction} ${item.countA} → ${item.countB} (${item.delta > 0 ? '+' : ''}${item.delta})</span>
                            </div>`;
                    }).join('')}
                </div>`;
        }

        // File differences
        if (fileDiff.onlyInB.length > 0) {
            html += `
                <div style="background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:8px;padding:12px;">
                    <div style="font-size:11px;font-weight:600;color:var(--text-200);margin-bottom:6px;">📁 New Files With Issues (in Set B only)</div>
                    ${fileDiff.onlyInB.slice(0, 8).map(f => `
                        <div style="font-size:10px;font-family:var(--mono);color:var(--text-300);padding:2px 0;">${escHtml(f)}</div>
                    `).join('')}
                    ${fileDiff.onlyInB.length > 8 ? `<div style="font-size:10px;color:var(--text-500);">+${fileDiff.onlyInB.length - 8} more</div>` : ''}
                </div>`;
        }

        resultEl.innerHTML = html;
    }


    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    function initLogDiff() {
        window.renderLogDiffPanel = function(findings) {
            let container = document.getElementById('logDiffPanel');
            if (!container) {
                container = document.createElement('div');
                container.id = 'logDiffPanel';
                container.className = 'results-panel';
                container.style.cssText = 'margin-top:16px;padding:16px;background:var(--bg-1);border:1px solid var(--border-subtle);border-radius:10px;';

                const anchor = document.getElementById('runbookExecutorPanel') ||
                               document.getElementById('shiftHandoffPanel') ||
                               document.getElementById('findingsList');
                if (anchor && anchor.parentNode) {
                    anchor.parentNode.insertBefore(container, anchor.nextSibling);
                }
            }

            renderDiffPanel(findings, container);
        };

        window.LogSherlockDiff = {
            compare: diffFindings,
            version: '1.0.0'
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLogDiff);
    } else {
        initLogDiff();
    }

    function escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }
})();
