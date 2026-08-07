/**
 * LogSherlock Pro — Blast Radius Calculator
 * Show what services/nodes/components are affected by a finding
 * 
 * ENTERPRISE FEATURE: Incident commanders need to know: "What else is at risk?"
 * Maps findings to infrastructure dependency model and shows blast radius.
 * 
 * DATA INTEGRITY: Impact zones are POTENTIAL based on infrastructure models.
 * We clearly label as "potential" not "confirmed". Shows evidence basis.
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    // INFRASTRUCTURE DEPENDENCY MODEL
    // Maps component types to what they affect (downstream dependencies)
    // ═══════════════════════════════════════════════════════════════

    const DEPENDENCY_MODEL = {
        // Storage layer
        san: { label: 'SAN/Storage Array', downstream: ['multipath', 'lvm', 'filesystem'], icon: '💾', tier: 0 },
        multipath: { label: 'Multipath I/O', downstream: ['lvm', 'filesystem', 'database'], icon: '🔀', tier: 1 },
        lvm: { label: 'LVM/Volume Manager', downstream: ['filesystem', 'database', 'application'], icon: '📦', tier: 1 },
        filesystem: { label: 'Filesystem (GFS2/XFS/ext4)', downstream: ['database', 'application', 'logging'], icon: '📂', tier: 2 },

        // Network layer
        physical_network: { label: 'Physical Network (NIC/Switch)', downstream: ['bonding', 'cluster_comm', 'application_network'], icon: '🔌', tier: 0 },
        bonding: { label: 'Network Bonding', downstream: ['cluster_comm', 'application_network', 'dns'], icon: '🔗', tier: 1 },
        cluster_comm: { label: 'Cluster Communication', downstream: ['pacemaker', 'corosync', 'dlm', 'gfs2_locks'], icon: '📡', tier: 2 },
        dns: { label: 'DNS Resolution', downstream: ['application', 'authentication', 'monitoring'], icon: '🌐', tier: 2 },

        // Cluster layer
        corosync: { label: 'Corosync Messaging', downstream: ['quorum', 'pacemaker', 'fencing'], icon: '💬', tier: 2 },
        quorum: { label: 'Cluster Quorum', downstream: ['pacemaker', 'fencing', 'gfs2_locks', 'resource_mgmt'], icon: '🗳️', tier: 3 },
        pacemaker: { label: 'Pacemaker Resource Mgr', downstream: ['resource_mgmt', 'failover', 'service_availability'], icon: '❤️', tier: 3 },
        fencing: { label: 'STONITH/Fencing', downstream: ['data_integrity', 'split_brain_prevention'], icon: '🚧', tier: 3 },
        dlm: { label: 'Distributed Lock Manager', downstream: ['gfs2_locks', 'filesystem'], icon: '🔒', tier: 3 },

        // Compute layer
        kernel: { label: 'Linux Kernel', downstream: ['all_processes', 'filesystem', 'network_stack', 'memory_mgmt'], icon: '🐧', tier: 0 },
        memory: { label: 'System Memory', downstream: ['all_processes', 'database', 'application', 'cache'], icon: '🧠', tier: 1 },
        cpu: { label: 'CPU/Processing', downstream: ['all_processes', 'application', 'database'], icon: '⚡', tier: 1 },

        // Application layer
        database: { label: 'Database Service', downstream: ['application', 'reporting', 'api_service'], icon: '🗄️', tier: 3 },
        application: { label: 'Application Service', downstream: ['api_service', 'user_facing', 'batch_jobs'], icon: '🖥️', tier: 4 },
        authentication: { label: 'Authentication (LDAP/AD)', downstream: ['application', 'user_access', 'api_service'], icon: '🔐', tier: 3 },

        // Impact targets (leaf nodes)
        all_processes: { label: 'All Running Processes', downstream: [], icon: '⚙️', tier: 5 },
        service_availability: { label: 'Service Availability', downstream: [], icon: '🟢', tier: 5 },
        data_integrity: { label: 'Data Integrity', downstream: [], icon: '🛡️', tier: 5 },
        user_facing: { label: 'User-Facing Services', downstream: [], icon: '👤', tier: 5 },
        api_service: { label: 'API Endpoints', downstream: [], icon: '🔌', tier: 5 },
        reporting: { label: 'Reporting/Analytics', downstream: [], icon: '📊', tier: 5 },
        monitoring: { label: 'Monitoring/Alerting', downstream: [], icon: '📟', tier: 5 },
        logging: { label: 'Log Collection', downstream: [], icon: '📜', tier: 5 }
    };

    // Pattern-to-component mapping
    const PATTERN_TO_COMPONENT = {
        'san_error': 'san', 'fc_error': 'san', 'iscsi_timeout': 'san',
        'multipath_failure': 'multipath', 'dm_failure': 'multipath', 'scsi_error': 'multipath',
        'lvm_error': 'lvm', 'lvm_metadata': 'lvm',
        'gfs2_withdraw': 'filesystem', 'filesystem_readonly': 'filesystem', 'mount_failure': 'filesystem', 'disk_io_error': 'filesystem',
        'nic_flap': 'physical_network', 'link_down': 'physical_network', 'crc_error': 'physical_network',
        'bond_degraded': 'bonding', 'bond_failure': 'bonding',
        'corosync_timeout': 'corosync', 'corosync_error': 'corosync',
        'quorum_loss': 'quorum', 'quorum_error': 'quorum',
        'pacemaker_error': 'pacemaker', 'resource_failure': 'pacemaker',
        'fencing_failure': 'fencing', 'stonith_error': 'fencing', 'node_fenced': 'fencing',
        'kernel_panic': 'kernel', 'kernel_bug': 'kernel', 'cpu_lockup': 'kernel', 'rcu_stall': 'kernel',
        'oom_kill': 'memory', 'memory_leak': 'memory', 'swap_usage': 'memory',
        'java_oom': 'memory', 'java_heap': 'memory',
        'dns_error': 'dns', 'dns_failure': 'dns',
        'database_timeout': 'database', 'database_error': 'database',
        'certificate_error': 'authentication', 'ldap_failure': 'authentication', 'auth_failure': 'authentication',
        'connection_timeout': 'cluster_comm', 'network_timeout': 'cluster_comm',
        'service_failure': 'application', 'application_crash': 'application'
    };


    // ═══════════════════════════════════════════════════════════════
    // BLAST RADIUS CALCULATOR
    // Traverses dependency graph from affected components
    // ═══════════════════════════════════════════════════════════════

    function calculateBlastRadius(findings) {
        if (!findings || findings.length === 0) return null;

        // Map findings to affected components
        const affectedComponents = new Set();
        const componentFindings = {};

        findings.forEach(f => {
            const patternKey = (f.pattern_name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
            Object.entries(PATTERN_TO_COMPONENT).forEach(([pattern, component]) => {
                if (patternKey.includes(pattern) || pattern.includes(patternKey)) {
                    affectedComponents.add(component);
                    if (!componentFindings[component]) componentFindings[component] = [];
                    componentFindings[component].push(f);
                }
            });
        });

        if (affectedComponents.size === 0) return null;

        // BFS through dependency graph to find blast radius
        const impacted = new Map(); // component -> { distance, path }
        const queue = [];

        affectedComponents.forEach(comp => {
            impacted.set(comp, { distance: 0, path: [comp], source: true });
            queue.push(comp);
        });

        while (queue.length > 0) {
            const current = queue.shift();
            const currentInfo = impacted.get(current);
            const model = DEPENDENCY_MODEL[current];

            if (model && model.downstream) {
                model.downstream.forEach(dep => {
                    if (!impacted.has(dep)) {
                        impacted.set(dep, {
                            distance: currentInfo.distance + 1,
                            path: [...currentInfo.path, dep],
                            source: false
                        });
                        queue.push(dep);
                    }
                });
            }
        }

        // Organize by distance (rings)
        const rings = {};
        impacted.forEach((info, comp) => {
            const ring = info.distance;
            if (!rings[ring]) rings[ring] = [];
            rings[ring].push({ component: comp, ...info, model: DEPENDENCY_MODEL[comp] });
        });

        return {
            sourceComponents: [...affectedComponents],
            totalImpacted: impacted.size,
            directlyAffected: affectedComponents.size,
            downstreamRisk: impacted.size - affectedComponents.size,
            rings,
            componentFindings
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // UI — Visual blast radius display with concentric rings
    // ═══════════════════════════════════════════════════════════════

    function renderBlastRadiusPanel(findings, container) {
        const result = calculateBlastRadius(findings);

        if (!result) {
            container.innerHTML = `
                <div style="text-align:center;padding:24px;color:var(--text-400);">
                    <div style="font-size:28px;margin-bottom:8px;">💥</div>
                    <div style="font-size:12px;font-weight:500;">Blast Radius Not Calculable</div>
                    <div style="font-size:11px;color:var(--text-500);margin-top:4px;">
                        Need findings that map to known infrastructure components.
                    </div>
                </div>`;
            return;
        }

        const ringColors = ['#ef4444', '#f59e0b', '#eab308', '#3b82f6', '#6366f1', '#8b5cf6'];
        const ringLabels = ['🔴 Directly Hit', '🟠 1st Degree Impact', '🟡 2nd Degree Impact', '🔵 3rd Degree Impact', '🟣 4th Degree Impact', '⚪ Extended Impact'];

        let html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div>
                    <span style="font-size:14px;font-weight:600;color:var(--text-100);">💥 Blast Radius</span>
                    <span style="font-size:11px;color:var(--text-400);margin-left:8px;">${result.totalImpacted} components potentially affected</span>
                </div>
                <div style="font-size:10px;color:var(--text-500);background:var(--bg-0);padding:3px 8px;border-radius:4px;border:1px solid var(--border-subtle);">
                    ⚠️ Potential impact — verify in environment
                </div>
            </div>

            <!-- Impact summary bar -->
            <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-bottom:14px;">
                <div style="background:#ef444415;border:1px solid #ef444430;border-radius:6px;padding:10px;text-align:center;">
                    <div style="font-size:20px;font-weight:700;color:#ef4444;">${result.directlyAffected}</div>
                    <div style="font-size:9px;color:var(--text-400);">Directly Hit</div>
                </div>
                <div style="background:#f59e0b15;border:1px solid #f59e0b30;border-radius:6px;padding:10px;text-align:center;">
                    <div style="font-size:20px;font-weight:700;color:#f59e0b;">${result.downstreamRisk}</div>
                    <div style="font-size:9px;color:var(--text-400);">Downstream Risk</div>
                </div>
                <div style="background:#3b82f615;border:1px solid #3b82f630;border-radius:6px;padding:10px;text-align:center;">
                    <div style="font-size:20px;font-weight:700;color:#3b82f6;">${result.totalImpacted}</div>
                    <div style="font-size:9px;color:var(--text-400);">Total Blast Radius</div>
                </div>
            </div>

            <!-- Rings visualization -->
            <div style="background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:8px;padding:14px;">`;

        Object.entries(result.rings).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).forEach(([ring, components]) => {
            const ringIdx = parseInt(ring);
            const color = ringColors[ringIdx] || ringColors[ringColors.length - 1];
            const label = ringLabels[ringIdx] || `Ring ${ringIdx}`;

            html += `
                <div style="margin-bottom:10px;${ringIdx > 0 ? 'padding-left:' + (ringIdx * 12) + 'px;' : ''}">
                    <div style="font-size:10px;font-weight:600;color:${color};margin-bottom:4px;">${label}</div>
                    <div style="display:flex;flex-wrap:wrap;gap:4px;">
                        ${components.map(c => `
                            <span style="
                                font-size:10px;padding:3px 8px;border-radius:4px;
                                background:${color}15;color:${color};border:1px solid ${color}30;
                                ${c.source ? 'font-weight:600;' : ''}
                            ">${c.model ? c.model.icon : '⚪'} ${c.model ? c.model.label : c.component}</span>
                        `).join('')}
                    </div>
                </div>`;
        });

        html += `
            </div>

            <!-- Source evidence -->
            <div style="margin-top:10px;background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:6px;padding:10px;">
                <div style="font-size:10px;font-weight:500;color:var(--text-300);margin-bottom:6px;">Evidence — findings that triggered this blast radius:</div>
                ${result.sourceComponents.map(comp => {
                    const findings = result.componentFindings[comp] || [];
                    const model = DEPENDENCY_MODEL[comp];
                    return `
                        <div style="font-size:10px;color:var(--text-400);padding:3px 0;border-bottom:1px solid var(--border-subtle);">
                            <strong style="color:var(--text-200);">${model ? model.icon : ''} ${model ? model.label : comp}</strong>
                            — ${findings.length} finding${findings.length !== 1 ? 's' : ''}: 
                            ${findings.slice(0, 2).map(f => `<span style="font-family:var(--mono);font-size:9px;">${escHtml(f.pattern_name || '')}</span>`).join(', ')}
                            ${findings.length > 2 ? ` +${findings.length - 2} more` : ''}
                        </div>`;
                }).join('')}
            </div>`;

        container.innerHTML = html;
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    function initBlastRadius() {
        window.renderBlastRadiusPanel = function(findings) {
            if (!findings || findings.length === 0) return;

            let container = document.getElementById('blastRadiusPanel');
            if (!container) {
                container = document.createElement('div');
                container.id = 'blastRadiusPanel';
                container.className = 'results-panel';
                container.style.cssText = 'margin-top:16px;padding:16px;background:var(--bg-1);border:1px solid var(--border-subtle);border-radius:10px;';

                const anchor = document.getElementById('logDiffPanel') ||
                               document.getElementById('runbookExecutorPanel') ||
                               document.getElementById('findingsList');
                if (anchor && anchor.parentNode) {
                    anchor.parentNode.insertBefore(container, anchor.nextSibling);
                }
            }

            renderBlastRadiusPanel(findings, container);
        };

        window.LogSherlockBlastRadius = {
            calculate: calculateBlastRadius,
            model: DEPENDENCY_MODEL,
            version: '1.0.0'
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBlastRadius);
    } else {
        initBlastRadius();
    }

    function escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }
})();
