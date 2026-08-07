/**
 * LogSherlock Pro — Compliance Export Engine
 * SOC2/ISO27001/HIPAA-ready reports with finding evidence
 * 
 * ENTERPRISE FEATURE: One-click audit-ready reports for compliance teams.
 * Formats findings into structured evidence documents that auditors expect.
 * 
 * DATA INTEGRITY: Reports contain ONLY actual scan findings and metadata.
 * No fabricated compliance assessments. We format the data — not judge it.
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    // COMPLIANCE FRAMEWORKS — defines report structure per standard
    // ═══════════════════════════════════════════════════════════════
    const FRAMEWORKS = {
        SOC2: {
            name: 'SOC 2 Type II',
            icon: '🛡️',
            sections: [
                { id: 'CC6.1', title: 'Logical and Physical Access Controls', keywords: ['auth', 'login', 'permission', 'access', 'firewall', 'certificate'] },
                { id: 'CC6.6', title: 'System Boundaries and External Threats', keywords: ['network', 'intrusion', 'connection', 'port', 'firewall'] },
                { id: 'CC7.2', title: 'Security Monitoring', keywords: ['error', 'warning', 'alert', 'monitor', 'threshold'] },
                { id: 'CC7.3', title: 'Incident Response', keywords: ['panic', 'crash', 'failure', 'outage', 'restart'] },
                { id: 'CC7.4', title: 'Recovery and Continuity', keywords: ['fence', 'failover', 'cluster', 'quorum', 'backup'] },
                { id: 'CC8.1', title: 'Change Management', keywords: ['config', 'update', 'deploy', 'version', 'migration'] }
            ]
        },
        ISO27001: {
            name: 'ISO 27001:2022',
            icon: '📋',
            sections: [
                { id: 'A.8.15', title: 'Logging', keywords: ['log', 'audit', 'record', 'trace', 'event'] },
                { id: 'A.8.16', title: 'Monitoring Activities', keywords: ['monitor', 'alert', 'threshold', 'anomaly', 'baseline'] },
                { id: 'A.8.6', title: 'Capacity Management', keywords: ['memory', 'disk', 'cpu', 'capacity', 'threshold', 'oom'] },
                { id: 'A.8.13', title: 'Information Backup', keywords: ['backup', 'snapshot', 'replicate', 'restore'] },
                { id: 'A.8.14', title: 'Redundancy', keywords: ['cluster', 'failover', 'ha', 'redundant', 'multipath'] },
                { id: 'A.5.26', title: 'Incident Management', keywords: ['incident', 'crash', 'panic', 'failure', 'outage'] }
            ]
        },
        HIPAA: {
            name: 'HIPAA Technical Safeguards',
            icon: '🏥',
            sections: [
                { id: '164.312(a)', title: 'Access Control', keywords: ['auth', 'login', 'permission', 'access', 'user', 'credential'] },
                { id: '164.312(b)', title: 'Audit Controls', keywords: ['audit', 'log', 'trace', 'record', 'event'] },
                { id: '164.312(c)', title: 'Integrity', keywords: ['corrupt', 'integrity', 'checksum', 'hash', 'tamper'] },
                { id: '164.312(d)', title: 'Authentication', keywords: ['auth', 'certificate', 'token', 'credential', 'identity'] },
                { id: '164.312(e)', title: 'Transmission Security', keywords: ['tls', 'ssl', 'encrypt', 'network', 'connection'] }
            ]
        },
        PCI_DSS: {
            name: 'PCI DSS v4.0',
            icon: '💳',
            sections: [
                { id: 'Req 1', title: 'Network Security Controls', keywords: ['firewall', 'network', 'port', 'connection', 'segment'] },
                { id: 'Req 5', title: 'Anti-Malware', keywords: ['virus', 'malware', 'intrusion', 'compromise'] },
                { id: 'Req 6', title: 'Secure Systems', keywords: ['vulnerability', 'patch', 'update', 'version', 'config'] },
                { id: 'Req 8', title: 'Authentication', keywords: ['auth', 'login', 'password', 'credential', 'mfa'] },
                { id: 'Req 10', title: 'Logging and Monitoring', keywords: ['log', 'audit', 'monitor', 'alert', 'event'] },
                { id: 'Req 12', title: 'Incident Response', keywords: ['incident', 'breach', 'response', 'recovery'] }
            ]
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // REPORT GENERATOR — maps findings to compliance framework
    // ═══════════════════════════════════════════════════════════════

    function generateComplianceReport(findings, framework, metadata) {
        if (!findings || findings.length === 0) return null;

        const fw = FRAMEWORKS[framework];
        if (!fw) return null;

        const report = {
            framework: fw.name,
            frameworkId: framework,
            generatedAt: new Date().toISOString(),
            metadata: metadata || {},
            totalFindings: findings.length,
            sections: [],
            unmappedFindings: []
        };

        const mappedFindings = new Set();

        // Map findings to framework sections
        fw.sections.forEach(section => {
            const sectionFindings = findings.filter(f => {
                const text = `${f.pattern_name || ''} ${f.description || ''} ${f.line_content || ''}`.toLowerCase();
                return section.keywords.some(kw => text.includes(kw));
            });

            sectionFindings.forEach(f => mappedFindings.add(f));

            report.sections.push({
                controlId: section.id,
                controlTitle: section.title,
                findingCount: sectionFindings.length,
                findings: sectionFindings.map(f => ({
                    severity: f.severity,
                    pattern: f.pattern_name,
                    description: f.description,
                    file: f.file,
                    line: f.line_number,
                    content: (f.line_content || '').substring(0, 200),
                    timestamp: f.file_date || null
                })),
                status: sectionFindings.length === 0 ? 'NO_FINDINGS' : 
                        sectionFindings.some(f => f.severity === 'CRITICAL') ? 'CRITICAL_FINDINGS' :
                        sectionFindings.some(f => f.severity === 'HIGH') ? 'HIGH_FINDINGS' : 'FINDINGS_NOTED'
            });
        });

        // Unmapped findings
        report.unmappedFindings = findings.filter(f => !mappedFindings.has(f)).map(f => ({
            severity: f.severity,
            pattern: f.pattern_name,
            file: f.file,
            line: f.line_number
        }));

        return report;
    }

    // ═══════════════════════════════════════════════════════════════
    // HTML REPORT RENDERER — professional audit-ready format
    // ═══════════════════════════════════════════════════════════════

    function renderComplianceHTML(report) {
        const sevColors = { CRITICAL: '#ef4444', HIGH: '#f59e0b', MEDIUM: '#3b82f6', LOW: '#6b7280', INFO: '#8b5cf6' };

        let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${report.framework} Compliance Report — LogSherlock Pro</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f1419; color: #e1e8ed; padding: 40px; line-height: 1.6; }
    .header { border-bottom: 2px solid #01a982; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { font-size: 24px; color: #01a982; }
    .header .subtitle { color: #8899a6; font-size: 14px; margin-top: 4px; }
    .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0; }
    .meta-item { background: #1a2332; border: 1px solid #2d3748; border-radius: 8px; padding: 12px; }
    .meta-label { font-size: 11px; color: #8899a6; text-transform: uppercase; }
    .meta-value { font-size: 16px; font-weight: 600; color: #e1e8ed; margin-top: 2px; }
    .section { background: #1a2332; border: 1px solid #2d3748; border-radius: 8px; margin-bottom: 16px; overflow: hidden; }
    .section-header { padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2d3748; }
    .section-id { font-size: 12px; font-weight: 600; color: #01a982; }
    .section-title { font-size: 13px; color: #e1e8ed; }
    .status-badge { font-size: 10px; padding: 3px 8px; border-radius: 12px; font-weight: 500; }
    .status-CRITICAL_FINDINGS { background: #ef444420; color: #ef4444; border: 1px solid #ef444440; }
    .status-HIGH_FINDINGS { background: #f59e0b20; color: #f59e0b; border: 1px solid #f59e0b40; }
    .status-FINDINGS_NOTED { background: #3b82f620; color: #3b82f6; border: 1px solid #3b82f640; }
    .status-NO_FINDINGS { background: #10b98120; color: #10b981; border: 1px solid #10b98140; }
    .findings { padding: 12px 16px; }
    .finding-row { padding: 8px 0; border-bottom: 1px solid #2d374830; display: grid; grid-template-columns: 70px 1fr; gap: 8px; align-items: start; }
    .finding-row:last-child { border-bottom: none; }
    .sev-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; text-align: center; }
    .finding-detail { font-size: 12px; }
    .finding-file { font-family: monospace; color: #8899a6; font-size: 11px; }
    .finding-content { font-family: monospace; color: #657786; font-size: 10px; margin-top: 3px; word-break: break-all; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #2d3748; font-size: 11px; color: #657786; }
    .disclaimer { background: #f59e0b10; border: 1px solid #f59e0b30; border-radius: 6px; padding: 10px 14px; margin-top: 16px; font-size: 11px; color: #f59e0b; }
    @media print { body { background: white; color: #1a1a1a; } .section { border-color: #ddd; background: #fafafa; } .header h1 { color: #0d7a5f; } }
</style>
</head>
<body>
    <div class="header">
        <h1>${report.framework} — Compliance Evidence Report</h1>
        <div class="subtitle">Generated by LogSherlock Pro | ${new Date(report.generatedAt).toLocaleString()}</div>
    </div>

    <div class="meta">
        <div class="meta-item">
            <div class="meta-label">Total Findings</div>
            <div class="meta-value">${report.totalFindings}</div>
        </div>
        <div class="meta-item">
            <div class="meta-label">Controls Assessed</div>
            <div class="meta-value">${report.sections.length}</div>
        </div>
        <div class="meta-item">
            <div class="meta-label">Controls With Issues</div>
            <div class="meta-value">${report.sections.filter(s => s.findingCount > 0).length}</div>
        </div>
    </div>

    <div class="disclaimer">
        ⚠️ This report documents findings from automated log pattern scanning. It is NOT a compliance certification. 
        Findings should be reviewed by qualified personnel. Absence of findings does not guarantee compliance.
    </div>

    <h2 style="font-size:16px;margin:24px 0 12px;color:#e1e8ed;">Control Assessment</h2>`;

        report.sections.forEach(section => {
            html += `
    <div class="section">
        <div class="section-header">
            <div>
                <span class="section-id">${section.controlId}</span>
                <span class="section-title" style="margin-left:8px;">${section.controlTitle}</span>
            </div>
            <span class="status-badge status-${section.status}">${section.status.replace(/_/g, ' ')}</span>
        </div>`;

            if (section.findings.length > 0) {
                html += `<div class="findings">`;
                section.findings.forEach(f => {
                    html += `
        <div class="finding-row">
            <span class="sev-badge" style="background:${sevColors[f.severity]}20;color:${sevColors[f.severity]};border:1px solid ${sevColors[f.severity]}40;">${f.severity}</span>
            <div class="finding-detail">
                <div>${escHtml(f.description || f.pattern || '')}</div>
                <div class="finding-file">${escHtml(f.file || '')}:${f.line || '?'}</div>
                ${f.content ? `<div class="finding-content">${escHtml(f.content)}</div>` : ''}
            </div>
        </div>`;
                });
                html += `</div>`;
            } else {
                html += `<div class="findings" style="color:#657786;font-size:12px;padding:12px 16px;">No relevant findings detected for this control.</div>`;
            }
            html += `</div>`;
        });

        html += `
    <div class="footer">
        <p>Report ID: RPT-${Date.now().toString(36).toUpperCase()} | Tool: LogSherlock Pro v2.0</p>
        <p>This document is provided as-is for evidence collection purposes.</p>
    </div>
</body>
</html>`;

        return html;
    }

    // ═══════════════════════════════════════════════════════════════
    // UI — Framework selector + export buttons
    // ═══════════════════════════════════════════════════════════════

    function renderCompliancePanel(findings, container) {
        if (!findings || findings.length === 0) {
            container.innerHTML = '';
            return;
        }

        let html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div>
                    <span style="font-size:14px;font-weight:600;color:var(--text-100);">📋 Compliance Export</span>
                    <span style="font-size:11px;color:var(--text-400);margin-left:8px;">Audit-ready reports from scan findings</span>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:8px;margin-bottom:12px;">`;

        Object.entries(FRAMEWORKS).forEach(([key, fw]) => {
            html += `
                <button class="compliance-export-btn" data-framework="${key}" style="
                    background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:8px;padding:12px;
                    cursor:pointer;text-align:left;transition:all 0.2s;
                " onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border-subtle)'">
                    <div style="font-size:16px;margin-bottom:4px;">${fw.icon}</div>
                    <div style="font-size:12px;font-weight:500;color:var(--text-100);">${fw.name}</div>
                    <div style="font-size:10px;color:var(--text-400);margin-top:2px;">${fw.sections.length} controls assessed</div>
                </button>`;
        });

        html += `</div>
            <div id="compliancePreview" style="display:none;background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:6px;padding:12px;margin-top:8px;"></div>
            <div style="font-size:10px;color:var(--text-500);margin-top:8px;text-align:center;">
                ⚠️ Reports document findings only — not a compliance certification
            </div>`;

        container.innerHTML = html;

        // Attach export handlers
        container.querySelectorAll('.compliance-export-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const framework = this.dataset.framework;
                const report = generateComplianceReport(findings, framework, {
                    engineer: 'LogSherlock Pro User',
                    scanDate: new Date().toISOString()
                });

                if (!report) return;

                // Generate and download HTML report
                const htmlContent = renderComplianceHTML(report);
                const blob = new Blob([htmlContent], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `LogSherlock-${framework}-Report-${new Date().toISOString().split('T')[0]}.html`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                // Show preview
                const preview = container.querySelector('#compliancePreview');
                if (preview) {
                    const critSections = report.sections.filter(s => s.status === 'CRITICAL_FINDINGS').length;
                    const highSections = report.sections.filter(s => s.status === 'HIGH_FINDINGS').length;
                    const cleanSections = report.sections.filter(s => s.status === 'NO_FINDINGS').length;
                    preview.style.display = 'block';
                    preview.innerHTML = `
                        <div style="font-size:11px;color:var(--text-300);">
                            <strong style="color:var(--text-100);">✅ Report Downloaded</strong> — ${report.framework}
                            <div style="margin-top:6px;display:flex;gap:12px;">
                                ${critSections > 0 ? `<span style="color:#ef4444;">🔴 ${critSections} critical</span>` : ''}
                                ${highSections > 0 ? `<span style="color:#f59e0b;">🟠 ${highSections} high</span>` : ''}
                                <span style="color:#10b981;">✅ ${cleanSections} clean</span>
                                <span style="color:var(--text-400);">${report.unmappedFindings.length} unmapped</span>
                            </div>
                        </div>`;
                }

                // Log to audit trail if available
                if (typeof window.LogSherlockAuditTrail !== 'undefined') {
                    window.LogSherlockAuditTrail.log('compliance_export', { framework, findings: report.totalFindings });
                }
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    function initComplianceExport() {
        window.renderComplianceExportPanel = function(findings) {
            if (!findings || findings.length === 0) return;

            let container = document.getElementById('complianceExportPanel');
            if (!container) {
                container = document.createElement('div');
                container.id = 'complianceExportPanel';
                container.className = 'results-panel';
                container.style.cssText = 'margin-top:16px;padding:16px;background:var(--bg-1);border:1px solid var(--border-subtle);border-radius:10px;';

                const anchor = document.getElementById('rootCauseChainPanel') ||
                               document.getElementById('healthScorePanel') ||
                               document.getElementById('findingsList');
                if (anchor && anchor.parentNode) {
                    anchor.parentNode.insertBefore(container, anchor.nextSibling);
                }
            }

            renderCompliancePanel(findings, container);
        };

        window.LogSherlockCompliance = {
            generate: generateComplianceReport,
            frameworks: FRAMEWORKS,
            version: '1.0.0'
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initComplianceExport);
    } else {
        initComplianceExport();
    }

    function escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }
})();
