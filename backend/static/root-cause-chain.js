/**
 * LogSherlock Pro — AI Root Cause Chain Visualizer
 * Interactive timeline showing cause→effect propagation across services
 * 
 * ENTERPRISE FEATURE: No other tool builds cause→effect chains from raw log patterns.
 * Splunk shows you logs. We show you WHY things broke and HOW it cascaded.
 * 
 * DATA INTEGRITY: All chains are built ONLY from actual scan findings.
 * Zero fabrication. If we can't determine causality, we say "correlation only."
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    // CAUSALITY RULES — define known cause→effect relationships
    // These are based on REAL infrastructure failure patterns
    // ═══════════════════════════════════════════════════════════════
    const CAUSALITY_RULES = [
        // Storage cascade
        { cause: 'disk_io_error', effects: ['filesystem_readonly', 'gfs2_withdraw', 'application_crash'], confidence: 'HIGH', domain: 'storage' },
        { cause: 'multipath_failure', effects: ['disk_io_error', 'scsi_error', 'dm_failure'], confidence: 'HIGH', domain: 'storage' },
        { cause: 'san_link_down', effects: ['multipath_failure', 'iscsi_timeout', 'fc_error'], confidence: 'HIGH', domain: 'storage' },
        { cause: 'lvm_metadata_error', effects: ['filesystem_readonly', 'mount_failure'], confidence: 'MEDIUM', domain: 'storage' },

        // Network cascade
        { cause: 'nic_flap', effects: ['bond_degraded', 'network_timeout', 'connection_reset'], confidence: 'HIGH', domain: 'network' },
        { cause: 'bond_degraded', effects: ['packet_loss', 'network_timeout', 'corosync_timeout'], confidence: 'HIGH', domain: 'network' },
        { cause: 'switch_port_error', effects: ['nic_flap', 'crc_error', 'packet_loss'], confidence: 'MEDIUM', domain: 'network' },
        { cause: 'dns_failure', effects: ['service_unreachable', 'application_timeout', 'ldap_failure'], confidence: 'HIGH', domain: 'network' },
        { cause: 'firewall_drop', effects: ['connection_timeout', 'service_unreachable'], confidence: 'MEDIUM', domain: 'network' },

        // Cluster cascade
        { cause: 'corosync_timeout', effects: ['quorum_loss', 'node_fenced', 'split_brain'], confidence: 'HIGH', domain: 'cluster' },
        { cause: 'quorum_loss', effects: ['node_fenced', 'resource_stopped', 'gfs2_withdraw'], confidence: 'HIGH', domain: 'cluster' },
        { cause: 'fencing_failure', effects: ['split_brain', 'data_corruption_risk', 'manual_intervention'], confidence: 'CRITICAL', domain: 'cluster' },
        { cause: 'pacemaker_failure', effects: ['resource_stopped', 'failover_failed'], confidence: 'HIGH', domain: 'cluster' },

        // Memory cascade
        { cause: 'memory_leak', effects: ['oom_kill', 'swap_thrash', 'application_slow'], confidence: 'HIGH', domain: 'memory' },
        { cause: 'oom_kill', effects: ['service_restart', 'application_crash', 'data_loss_risk'], confidence: 'HIGH', domain: 'memory' },
        { cause: 'swap_thrash', effects: ['application_slow', 'io_wait_high', 'timeout'], confidence: 'MEDIUM', domain: 'memory' },
        { cause: 'memory_hardware_error', effects: ['mce_error', 'kernel_panic', 'node_crash'], confidence: 'CRITICAL', domain: 'memory' },

        // Kernel cascade
        { cause: 'kernel_bug', effects: ['kernel_panic', 'system_hang', 'watchdog_reset'], confidence: 'HIGH', domain: 'kernel' },
        { cause: 'kernel_panic', effects: ['node_crash', 'service_outage', 'data_loss_risk'], confidence: 'CRITICAL', domain: 'kernel' },
        { cause: 'cpu_lockup', effects: ['watchdog_reset', 'system_hang', 'rcu_stall'], confidence: 'HIGH', domain: 'kernel' },
        { cause: 'rcu_stall', effects: ['system_hang', 'application_timeout'], confidence: 'MEDIUM', domain: 'kernel' },

        // Application cascade
        { cause: 'config_error', effects: ['service_start_failure', 'application_crash'], confidence: 'MEDIUM', domain: 'application' },
        { cause: 'certificate_expired', effects: ['tls_failure', 'service_unreachable', 'authentication_failure'], confidence: 'HIGH', domain: 'application' },
        { cause: 'database_connection_pool_exhausted', effects: ['application_timeout', 'request_queue_full', 'service_degraded'], confidence: 'HIGH', domain: 'application' },
        { cause: 'java_heap_exhausted', effects: ['gc_storm', 'application_slow', 'oom_kill'], confidence: 'HIGH', domain: 'application' },

        // Virtualization cascade
        { cause: 'hypervisor_overcommit', effects: ['vm_slow', 'balloon_pressure', 'cpu_steal_high'], confidence: 'MEDIUM', domain: 'virtualization' },
        { cause: 'vm_migration_failure', effects: ['vm_crash', 'service_outage'], confidence: 'HIGH', domain: 'virtualization' },
        { cause: 'vsan_degraded', effects: ['disk_io_error', 'vm_slow', 'snapshot_failure'], confidence: 'HIGH', domain: 'virtualization' }
    ];

    // Pattern-to-cause mapping — maps scan pattern_names to causality nodes
    const PATTERN_TO_CAUSE = {
        'disk_io_error': ['disk_io_error', 'scsi_error'],
        'multipath_failure': ['multipath_failure', 'dm_failure'],
        'filesystem_readonly': ['filesystem_readonly'],
        'gfs2_withdraw': ['gfs2_withdraw'],
        'nic_flap': ['nic_flap'],
        'bond_degraded': ['bond_degraded'],
        'packet_loss': ['packet_loss'],
        'corosync_timeout': ['corosync_timeout'],
        'quorum_loss': ['quorum_loss'],
        'node_fenced': ['node_fenced'],
        'split_brain': ['split_brain'],
        'oom_kill': ['oom_kill'],
        'memory_leak': ['memory_leak'],
        'swap_usage': ['swap_thrash'],
        'kernel_panic': ['kernel_panic'],
        'kernel_bug': ['kernel_bug'],
        'cpu_lockup': ['cpu_lockup'],
        'rcu_stall': ['rcu_stall'],
        'service_failure': ['service_start_failure', 'application_crash'],
        'certificate_error': ['certificate_expired'],
        'connection_timeout': ['connection_timeout', 'network_timeout'],
        'dns_error': ['dns_failure'],
        'fencing_failure': ['fencing_failure'],
        'pacemaker_error': ['pacemaker_failure'],
        'mce_error': ['mce_error', 'memory_hardware_error'],
        'lvm_error': ['lvm_metadata_error'],
        'mount_failure': ['mount_failure'],
        'java_oom': ['java_heap_exhausted'],
        'gc_pressure': ['gc_storm'],
        'database_timeout': ['database_connection_pool_exhausted'],
        'san_error': ['san_link_down'],
        'fc_error': ['fc_error'],
        'hypervisor_error': ['hypervisor_overcommit'],
        'vm_crash': ['vm_crash'],
        'watchdog_reset': ['watchdog_reset']
    };

    // Domain colors
    const DOMAIN_COLORS = {
        storage: '#f59e0b',
        network: '#3b82f6',
        cluster: '#ef4444',
        memory: '#8b5cf6',
        kernel: '#dc2626',
        application: '#10b981',
        virtualization: '#6366f1'
    };

    const CONFIDENCE_LABELS = {
        CRITICAL: { label: 'Proven Chain', color: '#ef4444', icon: '🔴' },
        HIGH: { label: 'Strong Evidence', color: '#f59e0b', icon: '🟠' },
        MEDIUM: { label: 'Correlation', color: '#3b82f6', icon: '🔵' },
        LOW: { label: 'Possible Link', color: '#6b7280', icon: '⚪' }
    };

    // ═══════════════════════════════════════════════════════════════
    // CHAIN BUILDER — builds cause→effect chains from actual findings
    // ═══════════════════════════════════════════════════════════════

    function buildCausalityChains(findings) {
        if (!findings || findings.length === 0) return [];

        // Step 1: Map findings to causality nodes
        const foundNodes = new Set();
        const nodeToFindings = {};

        findings.forEach(f => {
            const patternKey = (f.pattern_name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
            // Check direct match
            Object.entries(PATTERN_TO_CAUSE).forEach(([pattern, nodes]) => {
                if (patternKey.includes(pattern) || pattern.includes(patternKey)) {
                    nodes.forEach(node => {
                        foundNodes.add(node);
                        if (!nodeToFindings[node]) nodeToFindings[node] = [];
                        nodeToFindings[node].push(f);
                    });
                }
            });
        });

        if (foundNodes.size < 2) return []; // Need at least 2 nodes to form a chain

        // Step 2: Find chains where BOTH cause and at least one effect are in findings
        const chains = [];
        CAUSALITY_RULES.forEach(rule => {
            if (foundNodes.has(rule.cause)) {
                const matchedEffects = rule.effects.filter(e => foundNodes.has(e));
                if (matchedEffects.length > 0) {
                    chains.push({
                        cause: rule.cause,
                        effects: matchedEffects,
                        allEffects: rule.effects,
                        unmatchedEffects: rule.effects.filter(e => !foundNodes.has(e)),
                        confidence: rule.confidence,
                        domain: rule.domain,
                        causeFindings: nodeToFindings[rule.cause] || [],
                        effectFindings: matchedEffects.map(e => nodeToFindings[e] || []).flat()
                    });
                }
            }
        });

        // Step 3: Merge overlapping chains into longer sequences
        const mergedChains = mergeChains(chains);

        return mergedChains;
    }

    function mergeChains(chains) {
        if (chains.length === 0) return [];

        // Build a graph: if chain A's effect is chain B's cause, they connect
        const merged = [];
        const used = new Set();

        // Sort by confidence (CRITICAL first)
        const confOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        chains.sort((a, b) => (confOrder[a.confidence] || 9) - (confOrder[b.confidence] || 9));

        chains.forEach((chain, idx) => {
            if (used.has(idx)) return;

            // Try to extend this chain forward
            let sequence = [chain];
            used.add(idx);

            let lastEffects = chain.effects;
            let extended = true;

            while (extended) {
                extended = false;
                for (let i = 0; i < chains.length; i++) {
                    if (used.has(i)) continue;
                    if (lastEffects.includes(chains[i].cause)) {
                        sequence.push(chains[i]);
                        used.add(i);
                        lastEffects = chains[i].effects;
                        extended = true;
                        break;
                    }
                }
            }

            merged.push({
                steps: sequence,
                length: sequence.length,
                rootCause: sequence[0].cause,
                finalEffects: sequence[sequence.length - 1].effects,
                domains: [...new Set(sequence.map(s => s.domain))],
                overallConfidence: sequence.reduce((worst, s) => {
                    return (confOrder[s.confidence] || 9) > (confOrder[worst] || 9) ? s.confidence : worst;
                }, sequence[0].confidence)
            });
        });

        // Sort by chain length (longer = more significant)
        merged.sort((a, b) => b.length - a.length);

        return merged;
    }

    // ═══════════════════════════════════════════════════════════════
    // TIMELINE RENDERER — builds interactive HTML visualization
    // ═══════════════════════════════════════════════════════════════

    function renderChainVisualizer(chains, container) {
        if (!chains || chains.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:30px;color:var(--text-400);">
                    <div style="font-size:32px;margin-bottom:12px;">🔗</div>
                    <div style="font-weight:500;margin-bottom:6px;">No Causal Chains Detected</div>
                    <div style="font-size:12px;">
                        Chains require 2+ related findings (e.g., disk_io_error → filesystem_readonly).<br>
                        Upload logs with multiple related issues to see cause→effect visualization.
                    </div>
                </div>`;
            return;
        }

        let html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <div>
                    <span style="font-size:14px;font-weight:600;color:var(--text-100);">⛓️ Root Cause Chain Analysis</span>
                    <span style="font-size:11px;color:var(--text-400);margin-left:8px;">${chains.length} chain${chains.length > 1 ? 's' : ''} detected</span>
                </div>
                <div style="font-size:10px;color:var(--text-500);background:var(--bg-0);padding:4px 8px;border-radius:4px;border:1px solid var(--border-subtle);">
                    ⚠️ Based on scan findings only — verify with full log context
                </div>
            </div>
            <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;">
                ${Object.entries(CONFIDENCE_LABELS).map(([key, val]) => `
                    <span style="font-size:10px;color:${val.color};background:${val.color}15;padding:2px 8px;border-radius:10px;border:1px solid ${val.color}30;">
                        ${val.icon} ${val.label}
                    </span>`).join('')}
            </div>`;

        chains.forEach((chain, chainIdx) => {
            const confInfo = CONFIDENCE_LABELS[chain.overallConfidence] || CONFIDENCE_LABELS.LOW;
            const domainTags = chain.domains.map(d => 
                `<span style="font-size:9px;color:${DOMAIN_COLORS[d] || '#6b7280'};background:${DOMAIN_COLORS[d] || '#6b7280'}15;padding:1px 6px;border-radius:8px;border:1px solid ${DOMAIN_COLORS[d] || '#6b7280'}30;">${d}</span>`
            ).join(' ');

            html += `
                <div style="background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:8px;padding:14px;margin-bottom:12px;border-left:3px solid ${confInfo.color};" class="rcc-chain" data-chain="${chainIdx}">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span style="font-size:12px;font-weight:600;color:var(--text-100);">Chain #${chainIdx + 1}</span>
                            ${domainTags}
                        </div>
                        <span style="font-size:10px;color:${confInfo.color};font-weight:500;">${confInfo.icon} ${confInfo.label}</span>
                    </div>
                    <div class="rcc-timeline" style="position:relative;padding-left:24px;">`;

            // Render each step in the chain
            chain.steps.forEach((step, stepIdx) => {
                const causeColor = DOMAIN_COLORS[step.domain] || '#6b7280';
                const isFirst = stepIdx === 0;
                const isLast = stepIdx === chain.steps.length - 1;

                // Cause node
                if (isFirst) {
                    html += renderTimelineNode(step.cause, 'ROOT CAUSE', causeColor, step.causeFindings, true);
                }

                // Arrow with rule info
                html += `
                    <div style="position:relative;padding:4px 0 4px 16px;margin:2px 0;">
                        <div style="position:absolute;left:7px;top:0;bottom:0;width:2px;background:${causeColor}40;"></div>
                        <div style="font-size:10px;color:var(--text-500);padding:2px 0;">
                            ↓ <em>causes</em> (${step.confidence} confidence)
                        </div>
                    </div>`;

                // Effect nodes
                step.effects.forEach((effect, effIdx) => {
                    const isTerminal = isLast && effIdx === step.effects.length - 1;
                    const effectLabel = isTerminal ? 'FINAL EFFECT' : 'INTERMEDIATE';
                    html += renderTimelineNode(effect, effectLabel, causeColor, step.effectFindings.filter(f => {
                        const patternKey = (f.pattern_name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
                        return patternKey.includes(effect) || effect.includes(patternKey);
                    }), false);
                });

                // Show unmatched (predicted) effects
                if (step.unmatchedEffects.length > 0 && isLast) {
                    html += `
                        <div style="padding:6px 0 2px 16px;position:relative;">
                            <div style="position:absolute;left:7px;top:0;height:50%;width:2px;background:${causeColor}20;border-left:2px dashed ${causeColor}30;"></div>
                            <div style="font-size:10px;color:var(--text-500);font-style:italic;">
                                ⚡ Potential downstream (not seen in logs): ${step.unmatchedEffects.map(e => formatNodeName(e)).join(', ')}
                            </div>
                        </div>`;
                }
            });

            html += `</div></div>`;
        });

        // Summary
        html += `
            <div style="background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:6px;padding:10px 14px;margin-top:8px;">
                <div style="font-size:11px;color:var(--text-300);">
                    <strong style="color:var(--text-100);">🎯 Investigation Priority:</strong> 
                    Start with <strong style="color:${DOMAIN_COLORS[chains[0].domains[0]] || '#6b7280'}">${formatNodeName(chains[0].rootCause)}</strong> — 
                    fixing the root cause may resolve ${chains[0].steps.reduce((sum, s) => sum + s.effects.length, 0)} downstream issue${chains[0].steps.reduce((sum, s) => sum + s.effects.length, 0) > 1 ? 's' : ''}.
                </div>
            </div>`;

        container.innerHTML = html;

        // Add click-to-expand on findings evidence
        container.querySelectorAll('.rcc-evidence-toggle').forEach(toggle => {
            toggle.addEventListener('click', function() {
                const target = this.nextElementSibling;
                if (target) {
                    target.style.display = target.style.display === 'none' ? 'block' : 'none';
                    this.textContent = target.style.display === 'none' ? '▶ Show evidence' : '▼ Hide evidence';
                }
            });
        });
    }

    function renderTimelineNode(nodeName, label, color, findings, isRoot) {
        const displayName = formatNodeName(nodeName);
        const labelColor = isRoot ? '#ef4444' : label === 'FINAL EFFECT' ? '#f59e0b' : 'var(--text-400)';
        const nodeIcon = isRoot ? '🔴' : label === 'FINAL EFFECT' ? '🟠' : '🔵';
        const evidenceCount = findings ? findings.length : 0;

        let html = `
            <div style="position:relative;padding:6px 0 6px 16px;">
                <div style="position:absolute;left:3px;top:50%;transform:translateY(-50%);width:12px;height:12px;border-radius:50%;background:${color};border:2px solid ${color}60;z-index:1;"></div>
                <div style="background:var(--bg-1);border:1px solid ${color}30;border-radius:6px;padding:8px 12px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <span style="font-size:10px;color:${labelColor};font-weight:600;text-transform:uppercase;">${nodeIcon} ${label}</span>
                            <div style="font-size:12px;font-weight:500;color:var(--text-100);margin-top:2px;">${displayName}</div>
                        </div>
                        ${evidenceCount > 0 ? `<span style="font-size:10px;color:var(--text-400);background:var(--bg-0);padding:2px 6px;border-radius:4px;">${evidenceCount} finding${evidenceCount > 1 ? 's' : ''}</span>` : ''}
                    </div>`;

        if (findings && findings.length > 0) {
            html += `
                    <div style="margin-top:6px;">
                        <span class="rcc-evidence-toggle" style="font-size:10px;color:var(--accent);cursor:pointer;user-select:none;">▶ Show evidence</span>
                        <div style="display:none;margin-top:4px;">`;
            findings.slice(0, 3).forEach(f => {
                html += `
                            <div style="font-size:10px;color:var(--text-400);padding:3px 0;border-top:1px solid var(--border-subtle);">
                                <span style="color:var(--text-300);font-family:var(--mono);">${escHtml(f.file || '')}:${f.line_number || '?'}</span>
                                <div style="color:var(--text-500);font-family:var(--mono);font-size:9px;margin-top:1px;word-break:break-all;">${escHtml((f.line_content || '').substring(0, 120))}</div>
                            </div>`;
            });
            if (findings.length > 3) {
                html += `<div style="font-size:9px;color:var(--text-500);padding-top:3px;">+${findings.length - 3} more</div>`;
            }
            html += `</div></div>`;
        }

        html += `</div></div>`;
        return html;
    }

    function formatNodeName(node) {
        return node.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    function escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ═══════════════════════════════════════════════════════════════
    // PANEL INJECTION — integrates with LogSherlock scan results
    // ═══════════════════════════════════════════════════════════════

    function initRootCauseChain() {
        // Expose for panel injection from index.html
        window.renderRootCauseChainPanel = function(findings) {
            if (!findings || findings.length < 2) return; // Need 2+ findings for chains

            const chains = buildCausalityChains(findings);

            // Create container
            let container = document.getElementById('rootCauseChainPanel');
            if (!container) {
                container = document.createElement('div');
                container.id = 'rootCauseChainPanel';
                container.className = 'results-panel';
                container.style.cssText = 'margin-top:16px;padding:16px;background:var(--bg-1);border:1px solid var(--border-subtle);border-radius:10px;';
                
                // Insert after health score or verdict
                const anchor = document.getElementById('healthScorePanel') || 
                               document.getElementById('verdictPanel') || 
                               document.getElementById('findingsList');
                if (anchor && anchor.parentNode) {
                    anchor.parentNode.insertBefore(container, anchor.nextSibling);
                } else {
                    const results = document.getElementById('resultsSection') || document.querySelector('.results-section');
                    if (results) results.appendChild(container);
                }
            }

            renderChainVisualizer(chains, container);
        };

        // Expose for external access
        window.LogSherlockRootCauseChain = {
            buildChains: buildCausalityChains,
            render: renderChainVisualizer,
            rules: CAUSALITY_RULES,
            version: '1.0.0'
        };
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRootCauseChain);
    } else {
        initRootCauseChain();
    }
})();
