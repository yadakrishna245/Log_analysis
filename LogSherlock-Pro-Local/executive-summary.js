/**
 * LogSherlock Pro — Executive Summary Generator
 * C-level one-pager auto-generated from findings
 * 
 * ENTERPRISE FEATURE: When CTO/VP asks "what happened?" — generate a 
 * professional 1-page summary with: situation, impact, actions, ETA.
 * Written in business language, not tech jargon.
 * 
 * DATA INTEGRITY: Summary is generated from ACTUAL findings only.
 * Impact statements use "potential" language. No unverified claims.
 */

(function() {
    'use strict';

    // Business-friendly severity descriptions
    const SEVERITY_BUSINESS = {
        CRITICAL: { label: 'Service Impacting', color: '#ef4444', business: 'Immediate attention required — service stability at risk' },
        HIGH: { label: 'Significant Risk', color: '#f59e0b', business: 'Important issues requiring prompt resolution' },
        MEDIUM: { label: 'Moderate Concern', color: '#3b82f6', business: 'Issues to monitor and plan remediation' },
        LOW: { label: 'Minor', color: '#6b7280', business: 'Low-priority items for planned maintenance' },
        INFO: { label: 'Informational', color: '#8b5cf6', business: 'Observations for awareness' }
    };

    // Domain-to-business-impact mapping
    const DOMAIN_IMPACT = {
        storage: 'Data availability and persistence',
        network: 'Service connectivity and communication',
        cluster: 'High availability and failover capability',
        memory: 'Application performance and stability',
        kernel: 'System stability and reliability',
        application: 'Business service delivery',
        security: 'Security posture and compliance'
    };

    function generateExecutiveSummary(findings) {
        if (!findings || findings.length === 0) return null;

        const critCount = findings.filter(f => f.severity === 'CRITICAL').length;
        const highCount = findings.filter(f => f.severity === 'HIGH').length;
        const medCount = findings.filter(f => f.severity === 'MEDIUM').length;

        // Determine overall situation level
        let situationLevel, situationDesc;
        if (critCount > 0) {
            situationLevel = 'CRITICAL';
            situationDesc = 'Active service-impacting issues detected requiring immediate attention.';
        } else if (highCount > 0) {
            situationLevel = 'HIGH';
            situationDesc = 'Significant issues detected that may affect service stability if unaddressed.';
        } else if (medCount > 0) {
            situationLevel = 'MEDIUM';
            situationDesc = 'Moderate issues detected — no immediate risk but remediation recommended.';
        } else {
            situationLevel = 'LOW';
            situationDesc = 'Minor observations only — environment appears healthy.';
        }

        // Group findings by domain for business impact
        const domains = {};
        findings.forEach(f => {
            const pattern = (f.pattern_name || '').toLowerCase();
            let domain = 'application';
            if (/disk|storage|san|multipath|gfs|lvm|mount|filesystem/.test(pattern)) domain = 'storage';
            else if (/network|nic|bond|dns|connection|timeout|packet/.test(pattern)) domain = 'network';
            else if (/cluster|corosync|quorum|pacemaker|fence|dlm/.test(pattern)) domain = 'cluster';
            else if (/memory|oom|swap|heap|ram/.test(pattern)) domain = 'memory';
            else if (/kernel|panic|cpu|rcu|watchdog/.test(pattern)) domain = 'kernel';
            else if (/auth|cert|security|permission|access/.test(pattern)) domain = 'security';

            if (!domains[domain]) domains[domain] = { count: 0, critical: 0, high: 0 };
            domains[domain].count++;
            if (f.severity === 'CRITICAL') domains[domain].critical++;
            if (f.severity === 'HIGH') domains[domain].high++;
        });

        // Get unique files affected
        const affectedSystems = [...new Set(findings.map(f => f.file).filter(Boolean))];

        return {
            situationLevel,
            situationDesc,
            totalFindings: findings.length,
            critCount,
            highCount,
            medCount,
            domains,
            affectedSystems,
            generatedAt: new Date().toISOString()
        };
    }


    // ═══════════════════════════════════════════════════════════════
    // EXECUTIVE DOCUMENT GENERATOR
    // ═══════════════════════════════════════════════════════════════

    function renderExecutiveDocument(summary) {
        const now = new Date(summary.generatedAt);
        const levelColor = SEVERITY_BUSINESS[summary.situationLevel]?.color || '#6b7280';

        let doc = `
══════════════════════════════════════════════════════
 EXECUTIVE INCIDENT SUMMARY
 ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
 ${now.toLocaleTimeString()}
══════════════════════════════════════════════════════

STATUS: ${summary.situationLevel}
${summary.situationDesc}

──────────────────────────────────────────────────────
 SITUATION OVERVIEW
──────────────────────────────────────────────────────

 Total issues identified: ${summary.totalFindings}
 • Critical (service-impacting): ${summary.critCount}
 • High (significant risk):      ${summary.highCount}
 • Medium (moderate concern):    ${summary.medCount}
 • Other:                        ${summary.totalFindings - summary.critCount - summary.highCount - summary.medCount}

 Systems affected: ${summary.affectedSystems.length} log source${summary.affectedSystems.length !== 1 ? 's' : ''}

──────────────────────────────────────────────────────
 BUSINESS IMPACT AREAS
──────────────────────────────────────────────────────
${Object.entries(summary.domains).map(([domain, info]) => {
    const impact = DOMAIN_IMPACT[domain] || 'General operations';
    const status = info.critical > 0 ? '🔴 IMPACTED' : info.high > 0 ? '🟠 AT RISK' : '🟡 MONITOR';
    return ` ${status} ${impact}\n          (${info.count} finding${info.count !== 1 ? 's' : ''}, ${info.critical} critical, ${info.high} high)`;
}).join('\n')}

──────────────────────────────────────────────────────
 RECOMMENDED ACTIONS
──────────────────────────────────────────────────────
${summary.critCount > 0 ? ` 1. IMMEDIATE: Assign L4 engineer to investigate critical findings\n 2. COMMUNICATE: Notify affected service owners\n 3. MONITOR: Set up alert for recurrence\n` :
  summary.highCount > 0 ? ` 1. SCHEDULE: Plan remediation within 24-48 hours\n 2. ASSESS: Review high-severity findings for service impact\n 3. PREVENTIVE: Address root causes to prevent escalation\n` :
  ` 1. PLAN: Include in next maintenance window\n 2. REVIEW: Assess findings during regular operations review\n`}
──────────────────────────────────────────────────────
 DISCLAIMER
──────────────────────────────────────────────────────
 This summary is auto-generated from automated log pattern
 scanning. Findings indicate pattern matches, not confirmed
 outages. Technical team should validate impact before
 communicating to customers.

══════════════════════════════════════════════════════
 Generated by LogSherlock Pro | Confidential
══════════════════════════════════════════════════════`;

        return doc;
    }

    // ═══════════════════════════════════════════════════════════════
    // UI PANEL
    // ═══════════════════════════════════════════════════════════════

    function renderExecSummaryPanel(findings, container) {
        const summary = generateExecutiveSummary(findings);
        if (!summary) {
            container.innerHTML = '';
            return;
        }

        const levelInfo = SEVERITY_BUSINESS[summary.situationLevel];

        let html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div>
                    <span style="font-size:14px;font-weight:600;color:var(--text-100);">📄 Executive Summary</span>
                    <span style="font-size:11px;color:var(--text-400);margin-left:8px;">C-level one-pager</span>
                </div>
                <button id="execSummaryGenerate" style="background:var(--accent);color:var(--bg-0);border:none;border-radius:6px;padding:6px 12px;font-size:11px;cursor:pointer;font-weight:500;">
                    📋 Generate & Copy
                </button>
            </div>

            <!-- Quick preview -->
            <div style="background:var(--bg-0);border:1px solid ${levelInfo.color}40;border-left:3px solid ${levelInfo.color};border-radius:6px;padding:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-size:12px;font-weight:600;color:${levelInfo.color};">${levelInfo.label}</span>
                    <span style="font-size:10px;color:var(--text-400);">${new Date().toLocaleDateString()}</span>
                </div>
                <div style="font-size:11px;color:var(--text-300);margin-bottom:10px;">${summary.situationDesc}</div>
                <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:6px;text-align:center;">
                    <div style="background:var(--bg-1);border-radius:4px;padding:6px;">
                        <div style="font-size:16px;font-weight:700;color:#ef4444;">${summary.critCount}</div>
                        <div style="font-size:8px;color:var(--text-500);">Critical</div>
                    </div>
                    <div style="background:var(--bg-1);border-radius:4px;padding:6px;">
                        <div style="font-size:16px;font-weight:700;color:#f59e0b;">${summary.highCount}</div>
                        <div style="font-size:8px;color:var(--text-500);">High</div>
                    </div>
                    <div style="background:var(--bg-1);border-radius:4px;padding:6px;">
                        <div style="font-size:16px;font-weight:700;color:var(--text-300);">${summary.affectedSystems.length}</div>
                        <div style="font-size:8px;color:var(--text-500);">Systems</div>
                    </div>
                    <div style="background:var(--bg-1);border-radius:4px;padding:6px;">
                        <div style="font-size:16px;font-weight:700;color:var(--text-300);">${Object.keys(summary.domains).length}</div>
                        <div style="font-size:8px;color:var(--text-500);">Domains</div>
                    </div>
                </div>
                <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;">
                    ${Object.entries(summary.domains).map(([domain, info]) => {
                        const color = info.critical > 0 ? '#ef4444' : info.high > 0 ? '#f59e0b' : '#3b82f6';
                        return `<span style="font-size:9px;padding:2px 6px;border-radius:10px;background:${color}15;color:${color};border:1px solid ${color}30;">${domain} (${info.count})</span>`;
                    }).join('')}
                </div>
            </div>

            <div id="execSummaryOutput" style="display:none;margin-top:12px;"></div>`;

        container.innerHTML = html;

        // Generate handler
        document.getElementById('execSummaryGenerate').addEventListener('click', () => {
            const doc = renderExecutiveDocument(summary);
            const output = document.getElementById('execSummaryOutput');
            output.style.display = 'block';
            output.innerHTML = `
                <div style="background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:6px;padding:10px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                        <span style="font-size:11px;color:var(--text-200);">📄 Executive Summary Document</span>
                        <div style="display:flex;gap:4px;">
                            <button id="execCopy" style="font-size:10px;padding:3px 8px;background:var(--accent);color:var(--bg-0);border:none;border-radius:4px;cursor:pointer;">📋 Copy</button>
                            <button id="execDownload" style="font-size:10px;padding:3px 8px;background:var(--bg-1);color:var(--text-300);border:1px solid var(--border-subtle);border-radius:4px;cursor:pointer;">💾 Download</button>
                        </div>
                    </div>
                    <pre style="font-size:9px;color:var(--text-400);font-family:var(--mono);white-space:pre-wrap;max-height:250px;overflow-y:auto;background:var(--bg-1);padding:8px;border-radius:4px;">${escHtml(doc)}</pre>
                </div>`;

            document.getElementById('execCopy').addEventListener('click', () => {
                navigator.clipboard.writeText(doc).then(() => {
                    document.getElementById('execCopy').textContent = '✅ Copied!';
                    setTimeout(() => document.getElementById('execCopy').textContent = '📋 Copy', 2000);
                });
            });

            document.getElementById('execDownload').addEventListener('click', () => {
                const blob = new Blob([doc], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Executive-Summary-${new Date().toISOString().split('T')[0]}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    function initExecutiveSummary() {
        window.renderExecutiveSummaryPanel = function(findings) {
            if (!findings || findings.length === 0) return;

            let container = document.getElementById('executiveSummaryPanel');
            if (!container) {
                container = document.createElement('div');
                container.id = 'executiveSummaryPanel';
                container.className = 'results-panel';
                container.style.cssText = 'margin-top:16px;padding:16px;background:var(--bg-1);border:1px solid var(--border-subtle);border-radius:10px;';

                const anchor = document.getElementById('blastRadiusPanel') ||
                               document.getElementById('logDiffPanel') ||
                               document.getElementById('findingsList');
                if (anchor && anchor.parentNode) {
                    anchor.parentNode.insertBefore(container, anchor.nextSibling);
                }
            }

            renderExecSummaryPanel(findings, container);
        };

        window.LogSherlockExecSummary = {
            generate: generateExecutiveSummary,
            version: '1.0.0'
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initExecutiveSummary);
    } else {
        initExecutiveSummary();
    }

    function escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }
})();
