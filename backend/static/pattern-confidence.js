/**
 * LogSherlock Pro — Pattern Confidence Scoring
 * Shows WHY a pattern matched with evidence strength meter
 * 
 * ENTERPRISE FEATURE: Experienced engineers need to know: "How confident
 * should I be in this finding?" Shows match quality, context strength,
 * and false-positive likelihood for each finding.
 * 
 * DATA INTEGRITY: Confidence is CALCULATED from match characteristics.
 * No fabricated scores. Algorithm is transparent and explainable.
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    // CONFIDENCE SCORING ALGORITHM
    // Factors: keyword match quality, context indicators, severity,
    //          line content richness, pattern specificity
    // ═══════════════════════════════════════════════════════════════

    const SCORING_FACTORS = {
        // How specific is the pattern (generic vs specific)
        patternSpecificity: {
            weight: 25,
            highSpecificity: ['kernel_panic', 'gfs2_withdraw', 'oom_kill', 'quorum_loss', 'fencing_failure', 'multipath_failure'],
            medSpecificity: ['disk_io_error', 'corosync_timeout', 'bond_degraded', 'memory_leak', 'service_failure'],
            lowSpecificity: ['warning', 'error', 'timeout', 'failure']
        },
        // Does the line content contain actual diagnostic data?
        contentRichness: {
            weight: 25,
            indicators: {
                hasTimestamp: /\d{4}[-/]\d{2}[-/]\d{2}|\w{3}\s+\d+\s+\d+:\d+:\d+/,
                hasPID: /pid[:\s=]\d+|\[\d+\]/,
                hasErrorCode: /error[:\s]\d+|errno[:\s]\d+|rc[=:]\s*-?\d+/i,
                hasDeviceName: /\/dev\/\w+|sd[a-z]+|dm-\d+|mpath\w+/,
                hasIPAddress: /\d+\.\d+\.\d+\.\d+|[0-9a-f:]{8,}/i,
                hasStackTrace: /call trace|backtrace|stack:/i,
                hasServiceName: /\.service|systemd|systemctl/i,
                hasKernelModule: /\[\s*\w+\s*\]|module\s+\w+/
            }
        },
        // Multiple matches in same file = higher confidence
        corroboration: {
            weight: 20
        },
        // Severity alignment — critical patterns in critical context
        severityAlignment: {
            weight: 15
        },
        // Line number presence and file identification
        locationPrecision: {
            weight: 15
        }
    };

    function calculateConfidence(finding, allFindings) {
        let score = 0;
        const factors = [];

        // Factor 1: Pattern Specificity (0-25)
        const patternName = (finding.pattern_name || '').toLowerCase();
        if (SCORING_FACTORS.patternSpecificity.highSpecificity.some(p => patternName.includes(p))) {
            score += 25;
            factors.push({ name: 'Pattern Specificity', score: 25, max: 25, detail: 'Highly specific pattern — low false-positive rate' });
        } else if (SCORING_FACTORS.patternSpecificity.medSpecificity.some(p => patternName.includes(p))) {
            score += 18;
            factors.push({ name: 'Pattern Specificity', score: 18, max: 25, detail: 'Moderately specific pattern' });
        } else {
            score += 8;
            factors.push({ name: 'Pattern Specificity', score: 8, max: 25, detail: 'Generic pattern — higher false-positive possibility' });
        }

        // Factor 2: Content Richness (0-25)
        const content = finding.line_content || '';
        let contentScore = 0;
        const contentDetails = [];
        Object.entries(SCORING_FACTORS.contentRichness.indicators).forEach(([name, regex]) => {
            if (regex.test(content)) {
                contentScore += 3;
                contentDetails.push(name.replace(/([A-Z])/g, ' $1').trim());
            }
        });
        contentScore = Math.min(25, contentScore);
        if (content.length > 80) contentScore = Math.min(25, contentScore + 3);
        score += contentScore;
        factors.push({ name: 'Content Richness', score: contentScore, max: 25, detail: contentDetails.length > 0 ? `Contains: ${contentDetails.join(', ')}` : 'Minimal diagnostic data in line' });

        // Factor 3: Corroboration (0-20)
        const sameFile = allFindings.filter(f => f.file === finding.file);
        const samePattern = allFindings.filter(f => f.pattern_name === finding.pattern_name);
        let corrobScore = 0;
        if (sameFile.length > 1) corrobScore += Math.min(10, sameFile.length * 2);
        if (samePattern.length > 1) corrobScore += Math.min(10, samePattern.length * 3);
        corrobScore = Math.min(20, corrobScore);
        score += corrobScore;
        factors.push({ name: 'Corroboration', score: corrobScore, max: 20, detail: `${sameFile.length} findings in same file, ${samePattern.length} total for this pattern` });

        // Factor 4: Severity Alignment (0-15)
        let sevScore = 0;
        if (finding.severity === 'CRITICAL' && /panic|fatal|emerg|crash|withdraw|fence/i.test(content)) {
            sevScore = 15;
        } else if (finding.severity === 'HIGH' && /error|fail|down|timeout|kill/i.test(content)) {
            sevScore = 12;
        } else if (finding.severity === 'MEDIUM') {
            sevScore = 10;
        } else {
            sevScore = 6;
        }
        score += sevScore;
        factors.push({ name: 'Severity Alignment', score: sevScore, max: 15, detail: `${finding.severity} severity matches content keywords` });

        // Factor 5: Location Precision (0-15)
        let locScore = 0;
        if (finding.file && finding.line_number) {
            locScore = 15;
        } else if (finding.file) {
            locScore = 10;
        } else {
            locScore = 3;
        }
        score += locScore;
        factors.push({ name: 'Location Precision', score: locScore, max: 15, detail: finding.file && finding.line_number ? `Exact location: ${finding.file}:${finding.line_number}` : 'Partial location data' });

        // Determine confidence level
        let level, color;
        if (score >= 80) { level = 'VERY HIGH'; color = '#10b981'; }
        else if (score >= 60) { level = 'HIGH'; color = '#01a982'; }
        else if (score >= 40) { level = 'MEDIUM'; color = '#f59e0b'; }
        else if (score >= 25) { level = 'LOW'; color = '#6b7280'; }
        else { level = 'VERY LOW'; color = '#ef4444'; }

        return {
            score,
            maxScore: 100,
            level,
            color,
            factors,
            falsePositiveLikelihood: score >= 70 ? 'Low' : score >= 45 ? 'Moderate' : 'High'
        };
    }


    // ═══════════════════════════════════════════════════════════════
    // UI — Confidence scoring panel
    // ═══════════════════════════════════════════════════════════════

    function renderConfidencePanel(findings, container) {
        if (!findings || findings.length === 0) {
            container.innerHTML = '';
            return;
        }

        // Score all findings
        const scored = findings.map(f => ({
            finding: f,
            confidence: calculateConfidence(f, findings)
        }));

        // Sort by confidence score (lowest first — these need attention)
        scored.sort((a, b) => a.confidence.score - b.confidence.score);

        // Stats
        const avgScore = Math.round(scored.reduce((sum, s) => sum + s.confidence.score, 0) / scored.length);
        const highConf = scored.filter(s => s.confidence.score >= 60).length;
        const lowConf = scored.filter(s => s.confidence.score < 40).length;

        let html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div>
                    <span style="font-size:14px;font-weight:600;color:var(--text-100);">🎯 Pattern Confidence</span>
                    <span style="font-size:11px;color:var(--text-400);margin-left:8px;">Evidence strength analysis</span>
                </div>
            </div>

            <!-- Overall confidence summary -->
            <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-bottom:14px;">
                <div style="background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:6px;padding:10px;text-align:center;">
                    <div style="font-size:18px;font-weight:700;color:var(--accent);">${avgScore}%</div>
                    <div style="font-size:9px;color:var(--text-400);">Avg Confidence</div>
                </div>
                <div style="background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:6px;padding:10px;text-align:center;">
                    <div style="font-size:18px;font-weight:700;color:#10b981;">${highConf}</div>
                    <div style="font-size:9px;color:var(--text-400);">High Confidence</div>
                </div>
                <div style="background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:6px;padding:10px;text-align:center;">
                    <div style="font-size:18px;font-weight:700;color:${lowConf > 0 ? '#f59e0b' : 'var(--text-400)'};">${lowConf}</div>
                    <div style="font-size:9px;color:var(--text-400);">Low Confidence</div>
                </div>
            </div>

            <!-- Show lowest-confidence findings first (these are potential false positives) -->
            ${lowConf > 0 ? `
                <div style="font-size:11px;color:#f59e0b;margin-bottom:8px;padding:6px 10px;background:#f59e0b10;border-radius:4px;border:1px solid #f59e0b30;">
                    ⚠️ ${lowConf} finding${lowConf > 1 ? 's' : ''} with low confidence — review for potential false positives
                </div>` : ''}

            <div style="max-height:350px;overflow-y:auto;">
                ${scored.slice(0, 15).map((item, idx) => renderConfidenceCard(item, idx)).join('')}
                ${scored.length > 15 ? `<div style="font-size:10px;color:var(--text-500);text-align:center;padding:8px;">+${scored.length - 15} more findings (all scored)</div>` : ''}
            </div>

            <div style="font-size:10px;color:var(--text-500);margin-top:8px;text-align:center;">
                Confidence = pattern specificity + content richness + corroboration + severity alignment + location precision
            </div>`;

        container.innerHTML = html;

        // Add expand/collapse handlers
        container.querySelectorAll('.confidence-detail-toggle').forEach(toggle => {
            toggle.addEventListener('click', function() {
                const detail = this.nextElementSibling;
                if (detail) {
                    detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
                    this.textContent = detail.style.display === 'none' ? '▶ Why?' : '▼ Hide';
                }
            });
        });
    }

    function renderConfidenceCard(item, idx) {
        const { finding, confidence } = item;
        const sevColors = { CRITICAL: '#ef4444', HIGH: '#f59e0b', MEDIUM: '#3b82f6', LOW: '#6b7280', INFO: '#8b5cf6' };

        return `
            <div style="background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:6px;padding:10px;margin-bottom:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:6px;">
                            <span style="font-size:9px;padding:2px 5px;border-radius:3px;background:${sevColors[finding.severity] || '#6b7280'}20;color:${sevColors[finding.severity] || '#6b7280'};">${finding.severity}</span>
                            <span style="font-size:11px;color:var(--text-200);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(finding.pattern_name || '')}</span>
                        </div>
                        <div style="font-size:9px;color:var(--text-500);margin-top:2px;font-family:var(--mono);">${escHtml((finding.file || '') + ':' + (finding.line_number || '?'))}</div>
                    </div>
                    <div style="text-align:right;min-width:80px;">
                        <div style="font-size:14px;font-weight:700;color:${confidence.color};">${confidence.score}%</div>
                        <div style="font-size:8px;color:${confidence.color};">${confidence.level}</div>
                    </div>
                </div>
                <!-- Confidence bar -->
                <div style="margin-top:6px;height:4px;background:var(--bg-1);border-radius:2px;overflow:hidden;">
                    <div style="height:100%;width:${confidence.score}%;background:${confidence.color};border-radius:2px;transition:width 0.3s;"></div>
                </div>
                <!-- Detail toggle -->
                <div style="margin-top:6px;">
                    <span class="confidence-detail-toggle" style="font-size:9px;color:var(--accent);cursor:pointer;user-select:none;">▶ Why?</span>
                    <div style="display:none;margin-top:4px;">
                        ${confidence.factors.map(f => `
                            <div style="display:flex;align-items:center;gap:6px;padding:2px 0;">
                                <div style="width:100px;font-size:9px;color:var(--text-400);">${f.name}</div>
                                <div style="flex:1;height:3px;background:var(--bg-1);border-radius:2px;overflow:hidden;">
                                    <div style="height:100%;width:${Math.round(f.score/f.max*100)}%;background:${confidence.color};"></div>
                                </div>
                                <div style="font-size:9px;color:var(--text-500);min-width:30px;text-align:right;">${f.score}/${f.max}</div>
                            </div>
                            <div style="font-size:8px;color:var(--text-500);padding-left:106px;margin-bottom:2px;">${escHtml(f.detail)}</div>
                        `).join('')}
                        <div style="font-size:9px;color:var(--text-400);margin-top:4px;padding-top:4px;border-top:1px solid var(--border-subtle);">
                            False positive likelihood: <strong style="color:${confidence.falsePositiveLikelihood === 'Low' ? '#10b981' : confidence.falsePositiveLikelihood === 'Moderate' ? '#f59e0b' : '#ef4444'};">${confidence.falsePositiveLikelihood}</strong>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    function initPatternConfidence() {
        window.renderPatternConfidencePanel = function(findings) {
            if (!findings || findings.length === 0) return;

            let container = document.getElementById('patternConfidencePanel');
            if (!container) {
                container = document.createElement('div');
                container.id = 'patternConfidencePanel';
                container.className = 'results-panel';
                container.style.cssText = 'margin-top:16px;padding:16px;background:var(--bg-1);border:1px solid var(--border-subtle);border-radius:10px;';

                const anchor = document.getElementById('executiveSummaryPanel') ||
                               document.getElementById('blastRadiusPanel') ||
                               document.getElementById('findingsList');
                if (anchor && anchor.parentNode) {
                    anchor.parentNode.insertBefore(container, anchor.nextSibling);
                }
            }

            renderConfidencePanel(findings, container);
        };

        window.LogSherlockConfidence = {
            calculate: calculateConfidence,
            version: '1.0.0'
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPatternConfidence);
    } else {
        initPatternConfidence();
    }

    function escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }
})();
