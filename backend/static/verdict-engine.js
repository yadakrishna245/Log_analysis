/**
 * LogSherlock Pro — Smart Verdict Engine ⚖️
 * One-glance root cause verdict with evidence chain, accuracy scoring,
 * and ticket-aligned resolution path.
 * 
 * Inputs: window._allFindings + ticket context textarea
 * Output: Rendered verdict panel HTML
 */

// ═══════════════════════════════════════════════════════════════════════
// CAUSAL CHAIN DATABASE — Known cause→effect sequences in HPE VME
// ═══════════════════════════════════════════════════════════════════════
const VERDICT_CHAINS = [
    {
        id: 'gfs2_withdraw',
        name: 'GFS2 Filesystem Withdraw',
        verdict: 'GFS2 filesystem withdrew due to I/O errors on shared storage, causing cluster-wide mount failures',
        triggers: ['gfs2_withdraw', 'gfs2_io_error', 'gfs2_journal_error', 'dlm_lock_timeout', 'scsi_reservation_conflict'],
        chain: [
            { step: 'Storage path degraded or SCSI PR conflict detected', patterns: ['scsi_reservation_conflict', 'multipath_path_failed', 'scsi_error'] },
            { step: 'DLM lock requests timeout waiting for storage I/O', patterns: ['dlm_lock_timeout', 'dlm_error'] },
            { step: 'GFS2 journal replay fails, filesystem withdraws', patterns: ['gfs2_withdraw', 'gfs2_journal_error', 'gfs2_io_error'] },
            { step: 'All GFS2 mounts go read-only or unmount', patterns: ['filesystem_readonly', 'mount_error'] },
            { step: 'VMs on affected storage become unresponsive', patterns: ['vm_io_error', 'qemu_error'] }
        ],
        resolution: [
            'Check multipath status: multipath -ll',
            'Verify SCSI PR keys: sg_persist --in --read-keys /dev/sdX',
            'Re-register PR keys if missing: sg_persist --out --register --param-sark=0x<KEY> /dev/sdX',
            'Remount GFS2: umount /shared && mount /shared',
            'Verify DLM: dlm_tool status',
            'Check all nodes: corosync-quorumtool'
        ],
        kb: 'KB-2847',
        severity: 'P1',
        impact: 'Cluster-wide — all VMs on shared storage affected',
        ttr: '30-60 min'
    },
    {
        id: 'fencing_failure',
        name: 'Node Fencing Race / Failure',
        verdict: 'Cluster fencing failed or raced, causing split-brain risk and service disruption',
        triggers: ['fence_timeout', 'fence_failed', 'stonith_error', 'fence_kdump', 'quorum_lost'],
        chain: [
            { step: 'Node becomes unresponsive (crash/hang/network)', patterns: ['node_unreachable', 'heartbeat_lost', 'corosync_error'] },
            { step: 'Fencing agent triggered but fails/times out', patterns: ['fence_timeout', 'fence_failed', 'stonith_error', 'fence_kdump'] },
            { step: 'Cluster loses quorum or enters split-brain', patterns: ['quorum_lost', 'split_brain', 'cluster_partition'] },
            { step: 'Resources fail to migrate, services go down', patterns: ['resource_failed', 'service_stop_error'] }
        ],
        resolution: [
            'Check fence status: pcs stonith status',
            'Verify IPMI/iLO connectivity: ipmitool -I lanplus -H <bmc-ip> -U admin power status',
            'Switch from fence_kdump to IPMI fencing for reliability',
            'Clear failed resources: pcs resource cleanup',
            'Restore quorum: corosync-quorumtool -s'
        ],
        kb: 'KB-3102',
        severity: 'P1',
        impact: 'Cluster-wide — potential data corruption if split-brain',
        ttr: '15-45 min'
    },
    {
        id: 'storage_io_cascade',
        name: 'Storage I/O Cascade Failure',
        verdict: 'Multipath storage failure cascaded through I/O stack causing VM disk errors and potential data loss',
        triggers: ['multipath_path_failed', 'scsi_error', 'io_error', 'disk_error', 'vm_io_error'],
        chain: [
            { step: 'Physical storage path goes down (FC/iSCSI)', patterns: ['multipath_path_failed', 'scsi_error', 'iscsi_error'] },
            { step: 'Multipath failover — remaining paths overloaded', patterns: ['multipath_path_failed', 'io_timeout'] },
            { step: 'I/O errors propagate to filesystem layer', patterns: ['io_error', 'disk_error', 'filesystem_readonly'] },
            { step: 'VMs experience disk I/O failures', patterns: ['vm_io_error', 'qemu_error', 'virtio_error'] }
        ],
        resolution: [
            'Check multipath: multipath -ll (look for faulty/failed paths)',
            'Check FC links: systool -c fc_host -v | grep port_state',
            'Rescan paths: echo "1" > /sys/class/fc_host/hostX/issue_lip',
            'Verify array health via HPE 3PAR/Primera/Nimble CLI',
            'Resume VMs after paths restore: virsh resume <vm>'
        ],
        kb: 'KB-2901',
        severity: 'P1',
        impact: 'All VMs on affected LUN — potential data loss',
        ttr: '20-45 min'
    },
    {
        id: 'memory_oom',
        name: 'Host Out-of-Memory (OOM) Kill',
        verdict: 'Host ran out of memory, OOM killer terminated VM processes causing unexpected shutdowns',
        triggers: ['oom_killer', 'memory_pressure', 'swap_exhausted', 'vm_crashed'],
        chain: [
            { step: 'Host memory overcommitted beyond safe threshold', patterns: ['memory_pressure', 'swap_exhausted'] },
            { step: 'Linux OOM killer activates', patterns: ['oom_killer'] },
            { step: 'QEMU/VM processes killed to free memory', patterns: ['vm_crashed', 'qemu_error', 'process_killed'] },
            { step: 'VMs terminate ungracefully — potential filesystem damage', patterns: ['vm_io_error', 'filesystem_readonly'] }
        ],
        resolution: [
            'Check current memory: free -h',
            'Identify killed processes: dmesg | grep -i "oom\\|killed"',
            'Restart affected VMs: virsh start <vm>',
            'Enable KSM: echo 1 > /sys/kernel/mm/ksm/run',
            'Reduce overcommit: shutdown non-critical VMs',
            'Long-term: Add RAM or migrate VMs to other hosts'
        ],
        kb: 'KB-2755',
        severity: 'P2',
        impact: 'Multiple VMs on affected host',
        ttr: '15-30 min'
    },
    {
        id: 'network_bond_failure',
        name: 'Network Bond/Bridge Failure',
        verdict: 'Network bonding or bridge failure caused VM connectivity loss across the host',
        triggers: ['bond_slave_down', 'network_interface_down', 'bridge_error', 'link_down'],
        chain: [
            { step: 'Physical NIC or bond slave goes down', patterns: ['bond_slave_down', 'network_interface_down', 'link_down'] },
            { step: 'Bond degraded — remaining link overloaded or failed', patterns: ['bond_slave_down', 'network_error'] },
            { step: 'Bridge connectivity lost for VMs', patterns: ['bridge_error', 'network_error'] },
            { step: 'VMs lose network — SSH/ping/apps unreachable', patterns: ['vm_network_error', 'connection_timeout'] }
        ],
        resolution: [
            'Check bond status: cat /proc/net/bonding/bond0',
            'Check physical links: ethtool eth0 | grep "Link detected"',
            'Bring slave back: ip link set eth0 up',
            'Check switch port (LACP if mode 4): switch admin',
            'Verify bridge: brctl show',
            'Check MTU consistency: ip link show | grep mtu'
        ],
        kb: 'KB-2680',
        severity: 'P2',
        impact: 'All VMs on affected bridge/VLAN',
        ttr: '10-30 min'
    },
    {
        id: 'morpheus_service_crash',
        name: 'Morpheus/VME Appliance Service Crash',
        verdict: 'HPE VME Manager appliance service crashed — UI/API unavailable, provisioning halted',
        triggers: ['morpheus_crash', 'java_oom', 'service_failed', 'rabbitmq_error', 'elasticsearch_red'],
        chain: [
            { step: 'Service crashes (Java OOM, disk full, or bug)', patterns: ['morpheus_crash', 'java_oom', 'service_failed'] },
            { step: 'Dependent services cascade-fail', patterns: ['rabbitmq_error', 'elasticsearch_red', 'mysql_error'] },
            { step: 'Management UI returns 502/503', patterns: ['http_error', 'nginx_error'] },
            { step: 'Provisioning/monitoring tasks halt', patterns: ['task_failed', 'provisioning_error'] }
        ],
        resolution: [
            'Check all services: sudo morpheus-ctl status',
            'Restart crashed service: sudo morpheus-ctl restart morpheus-ui',
            'Check disk space: df -h /opt/morpheus',
            'Check logs: sudo morpheus-ctl tail morpheus-ui',
            'Full restart if needed: sudo morpheus-ctl stop && sleep 10 && sudo morpheus-ctl start',
            'Reconfigure if persistent: sudo morpheus-ctl reconfigure'
        ],
        kb: 'KB-3055',
        severity: 'P2',
        impact: 'Management plane down — existing VMs unaffected but no new operations',
        ttr: '5-15 min'
    },
    {
        id: 'kernel_panic',
        name: 'Kernel Panic / Host Crash',
        verdict: 'Host suffered kernel panic — all VMs on this host terminated ungracefully',
        triggers: ['kernel_panic', 'kernel_bug', 'kernel_oops', 'hardware_error', 'mce_error'],
        chain: [
            { step: 'Hardware error or kernel bug triggers panic', patterns: ['kernel_panic', 'kernel_bug', 'kernel_oops', 'mce_error', 'hardware_error'] },
            { step: 'Host crashes — all processes terminate', patterns: ['kernel_panic', 'unexpected_reboot'] },
            { step: 'All VMs on host die without graceful shutdown', patterns: ['vm_crashed', 'qemu_error'] },
            { step: 'Cluster detects node loss, attempts fencing', patterns: ['fence_timeout', 'node_unreachable'] }
        ],
        resolution: [
            'Check crash dump: crash /var/crash/vmcore /usr/lib/debug/vmlinux',
            'Check hardware: ipmitool sel list (IPMI event log)',
            'Check MCE: mcelog --client',
            'Check memory: memtest86+',
            'Update kernel: yum update kernel',
            'If recurring: check RAM, CPU, motherboard via iLO/BMC'
        ],
        kb: 'KB-3201',
        severity: 'P1',
        impact: 'All VMs on host — potential data loss if no HA',
        ttr: '30-90 min (includes host recovery)'
    },
    {
        id: 'disk_full',
        name: 'Disk Full — Services Crashing',
        verdict: 'Root or data filesystem 100% full — critical services crashed (MySQL, ES, logging)',
        triggers: ['disk_full', 'no_space', 'filesystem_full', 'mysql_error', 'elasticsearch_red'],
        chain: [
            { step: 'Disk fills up (logs, backups, ES indices, snapshots)', patterns: ['disk_full', 'no_space', 'filesystem_full'] },
            { step: 'MySQL crashes (cannot write)', patterns: ['mysql_error', 'database_error'] },
            { step: 'Elasticsearch stops indexing', patterns: ['elasticsearch_red', 'elasticsearch_error'] },
            { step: 'Appliance UI fails, logging stops', patterns: ['morpheus_crash', 'service_failed'] }
        ],
        resolution: [
            'Check space: df -h / && du -sh /opt/morpheus/* | sort -h',
            'Clean logs: sudo morpheus-ctl log-rotate',
            'Remove old backups: ls -lt /opt/morpheus/backups/ (delete oldest)',
            'Clean journal: sudo journalctl --vacuum-time=3d',
            'Delete old ES indices: curl -X DELETE localhost:9200/morpheus-logs-2026.05.*',
            'Restart after cleanup: sudo morpheus-ctl restart'
        ],
        kb: 'KB-2590',
        severity: 'P2',
        impact: 'Management plane — existing VMs run but no management',
        ttr: '10-20 min'
    },
    {
        id: 'cluster_quorum_loss',
        name: 'Cluster Quorum Loss',
        verdict: 'Cluster lost quorum — DLM frozen, GFS2 I/O halted, VMs may be stuck',
        triggers: ['quorum_lost', 'corosync_error', 'dlm_lock_timeout', 'node_unreachable'],
        chain: [
            { step: 'Multiple nodes fail or become unreachable', patterns: ['node_unreachable', 'corosync_error', 'heartbeat_lost'] },
            { step: 'Cluster loses quorum (less than 50%+1 nodes)', patterns: ['quorum_lost', 'cluster_partition'] },
            { step: 'DLM freezes all lock operations', patterns: ['dlm_lock_timeout', 'dlm_error'] },
            { step: 'GFS2 I/O hangs — VMs freeze', patterns: ['gfs2_io_error', 'vm_io_error'] }
        ],
        resolution: [
            'Check quorum: corosync-quorumtool -s',
            'Check node status: corosync-cmapctl | grep members',
            'If nodes are actually up — check network between them',
            'Force quorum (DANGEROUS): corosync-quorumtool -e 1',
            'Restart corosync on recovered nodes: systemctl restart corosync',
            'After quorum restored: pcs resource cleanup'
        ],
        kb: 'KB-3150',
        severity: 'P1',
        impact: 'Entire cluster — all shared storage I/O frozen',
        ttr: '15-45 min'
    },
    {
        id: 'vm_migration_failure',
        name: 'Live Migration Failure',
        verdict: 'VM live migration failed — VM may be in inconsistent state between source and target',
        triggers: ['migration_failed', 'migration_timeout', 'cpu_incompatible', 'storage_not_shared'],
        chain: [
            { step: 'Migration initiated but pre-checks fail', patterns: ['migration_failed', 'cpu_incompatible'] },
            { step: 'Or: migration starts but times out during memory copy', patterns: ['migration_timeout', 'network_error'] },
            { step: 'VM stuck in "paused" or "in shutdown" state', patterns: ['vm_crashed', 'qemu_error'] }
        ],
        resolution: [
            'Check VM state: virsh domstate <vm> --reason',
            'If paused: virsh resume <vm> (on source host)',
            'Check CPU compat: virsh capabilities (both hosts)',
            'Use host-model CPU: edit VM XML → <cpu mode="host-model"/>',
            'Check shared storage: virsh domblklist <vm> (path must be shared)',
            'Open migration ports: firewall-cmd --add-port=49152-49215/tcp'
        ],
        kb: 'KB-2920',
        severity: 'P3',
        impact: 'Single VM — but maintenance window may be blocked',
        ttr: '10-30 min'
    }
];



// ═══════════════════════════════════════════════════════════════════════
// VERDICT ENGINE — Core Analysis Logic
// ═══════════════════════════════════════════════════════════════════════

function generateVerdict(findings, ticketText) {
    if (!findings || findings.length === 0) return null;

    // Step 1: Score each chain against findings
    const chainScores = VERDICT_CHAINS.map(chain => {
        let score = 0;
        let matchedSteps = [];
        let matchedFindings = [];
        let totalPossiblePatterns = 0;

        chain.chain.forEach((step, stepIdx) => {
            totalPossiblePatterns += step.patterns.length;
            let stepMatched = false;
            let stepFindings = [];

            step.patterns.forEach(pattern => {
                const matching = findings.filter(f => {
                    const text = `${f.pattern_name || ''} ${f.category || ''} ${f.description || ''}`.toLowerCase();
                    const patternLower = pattern.toLowerCase().replace(/_/g, ' ');
                    const patternUnderscore = pattern.toLowerCase();
                    return text.includes(patternLower) || text.includes(patternUnderscore) ||
                           (f.pattern_name && f.pattern_name.toLowerCase().includes(patternUnderscore));
                });

                if (matching.length > 0) {
                    stepMatched = true;
                    stepFindings.push(...matching);
                    score += matching.length;
                }
            });

            if (stepMatched) {
                matchedSteps.push({
                    stepIdx,
                    description: step.description || step.step,
                    findings: stepFindings
                });
            }
        });

        // Also check trigger patterns
        let triggerHits = 0;
        chain.triggers.forEach(trigger => {
            const hit = findings.some(f => {
                const text = `${f.pattern_name || ''}`.toLowerCase();
                return text.includes(trigger.toLowerCase());
            });
            if (hit) triggerHits++;
        });

        // Chain coverage: what % of the chain steps are matched
        const chainCoverage = matchedSteps.length / chain.chain.length;
        // Trigger coverage
        const triggerCoverage = triggerHits / chain.triggers.length;

        // Combined score: weighted
        const combinedScore = (chainCoverage * 60) + (triggerCoverage * 30) + (Math.min(score, 10) / 10 * 10);

        // Deduplicate matched findings
        const uniqueFindings = [];
        const seen = new Set();
        matchedSteps.forEach(ms => {
            ms.findings.forEach(f => {
                const key = `${f.file}:${f.line_number}:${f.pattern_name}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueFindings.push(f);
                }
            });
        });

        return {
            chain,
            score: combinedScore,
            chainCoverage,
            triggerCoverage,
            matchedSteps,
            matchedFindings: uniqueFindings,
            triggerHits
        };
    });

    // Step 2: Sort by score, pick top chain
    chainScores.sort((a, b) => b.score - a.score);
    const topChain = chainScores[0];

    if (topChain.score < 15) return null; // Not enough evidence

    // Step 3: Calculate ticket alignment
    const ticketAlignment = calculateTicketAlignment(topChain, ticketText, findings);

    // Step 4: Calculate overall confidence
    const confidence = calculateConfidence(topChain, ticketAlignment, findings);

    // Step 5: Build evidence chain with line numbers
    const evidenceChain = buildEvidenceChain(topChain);

    // Step 6: Identify affected systems
    const affectedSystems = identifyAffectedSystems(topChain.matchedFindings);

    return {
        verdict: topChain.chain.verdict,
        chainName: topChain.chain.name,
        severity: topChain.chain.severity,
        confidence: confidence,
        ticketAlignment: ticketAlignment,
        evidenceChain: evidenceChain,
        resolution: topChain.chain.resolution,
        kb: topChain.chain.kb,
        impact: topChain.chain.impact,
        ttr: topChain.chain.ttr,
        affectedSystems: affectedSystems,
        matchedFindings: topChain.matchedFindings,
        chainCoverage: topChain.chainCoverage,
        alternativeChains: chainScores.slice(1, 3).filter(c => c.score > 10)
    };
}

// ═══════════════════════════════════════════════════════════════════════
// TICKET ALIGNMENT SCORING
// ═══════════════════════════════════════════════════════════════════════

function calculateTicketAlignment(topChain, ticketText, findings) {
    if (!ticketText || ticketText.length < 10) {
        return { score: 0, reason: 'No ticket context provided', matchedKeywords: [] };
    }

    const ticketLower = ticketText.toLowerCase();
    const stopWords = new Set(['that','this','with','from','have','been','after','when','which','their','they','them',
        'also','into','than','then','each','other','some','what','about','could','would','should','will','just','more',
        'were','being','those','customer','reports','issue','problem','please','help','ticket','case','description']);

    const ticketWords = ticketLower.replace(/[^a-z0-9_\-\.\/]/g, ' ').split(/\s+/)
        .filter(w => w.length > 3 && !stopWords.has(w));
    const ticketKeywords = [...new Set(ticketWords)];

    if (ticketKeywords.length === 0) {
        return { score: 0, reason: 'Ticket too short for analysis', matchedKeywords: [] };
    }

    // Match ticket keywords against chain name, verdict, triggers, and findings
    const chainText = `${topChain.chain.name} ${topChain.chain.verdict} ${topChain.chain.triggers.join(' ')} ${topChain.chain.impact}`.toLowerCase();
    const findingsText = topChain.matchedFindings.map(f =>
        `${f.pattern_name} ${f.description} ${f.category}`
    ).join(' ').toLowerCase();

    let matchedKeywords = [];
    ticketKeywords.forEach(kw => {
        if (chainText.includes(kw) || findingsText.includes(kw)) {
            matchedKeywords.push(kw);
        }
    });

    // Domain-specific boosters
    const domainPairs = [
        [['gfs2', 'filesystem', 'mount', 'readonly', 'read-only'], 'gfs2_withdraw'],
        [['fence', 'fencing', 'stonith', 'split', 'brain'], 'fencing_failure'],
        [['storage', 'disk', 'lun', 'multipath', 'scsi', 'path'], 'storage_io_cascade'],
        [['memory', 'oom', 'killed', 'swap', 'ram'], 'memory_oom'],
        [['network', 'bond', 'bridge', 'connectivity', 'ping'], 'network_bond_failure'],
        [['morpheus', 'appliance', 'ui', '502', '503', 'portal'], 'morpheus_service_crash'],
        [['kernel', 'panic', 'crash', 'reboot', 'hung'], 'kernel_panic'],
        [['disk', 'full', 'space', 'capacity', '100%'], 'disk_full'],
        [['quorum', 'cluster', 'node', 'corosync', 'dlm'], 'cluster_quorum_loss'],
        [['migration', 'migrate', 'vmotion', 'move'], 'vm_migration_failure']
    ];

    domainPairs.forEach(([keywords, chainId]) => {
        if (topChain.chain.id === chainId) {
            keywords.forEach(kw => {
                if (ticketLower.includes(kw) && !matchedKeywords.includes(kw)) {
                    matchedKeywords.push(kw);
                }
            });
        }
    });

    const score = Math.min(99, Math.round((matchedKeywords.length / Math.max(ticketKeywords.length, 1)) * 100));

    let reason = '';
    if (score >= 80) reason = 'Excellent match — ticket description strongly aligns with detected root cause';
    else if (score >= 60) reason = 'Good match — key symptoms from ticket found in log evidence';
    else if (score >= 40) reason = 'Moderate match — some ticket keywords align with findings';
    else if (score >= 20) reason = 'Weak match — limited correlation between ticket and findings';
    else reason = 'Low match — ticket context may describe a different issue';

    return { score, reason, matchedKeywords };
}



// ═══════════════════════════════════════════════════════════════════════
// CONFIDENCE CALCULATION
// ═══════════════════════════════════════════════════════════════════════

function calculateConfidence(topChain, ticketAlignment, findings) {
    let confidence = 0;
    let factors = [];

    // Factor 1: Chain coverage (0-35 points)
    const coveragePoints = Math.round(topChain.chainCoverage * 35);
    confidence += coveragePoints;
    if (topChain.chainCoverage >= 0.75) factors.push(`${Math.round(topChain.chainCoverage * 100)}% of causal chain confirmed`);

    // Factor 2: Trigger hits (0-25 points)
    const triggerPoints = Math.round(topChain.triggerCoverage * 25);
    confidence += triggerPoints;
    if (topChain.triggerHits >= 2) factors.push(`${topChain.triggerHits} trigger patterns matched`);

    // Factor 3: Evidence volume (0-20 points)
    const volumePoints = Math.min(20, topChain.matchedFindings.length * 2);
    confidence += volumePoints;
    if (topChain.matchedFindings.length >= 5) factors.push(`${topChain.matchedFindings.length} supporting findings`);

    // Factor 4: Ticket alignment boost (0-15 points)
    const alignPoints = Math.round((ticketAlignment.score / 100) * 15);
    confidence += alignPoints;
    if (ticketAlignment.score >= 50) factors.push(`${ticketAlignment.score}% ticket alignment`);

    // Factor 5: Severity concentration (0-5 points)
    const critCount = topChain.matchedFindings.filter(f => f.severity === 'CRITICAL').length;
    if (critCount >= 2) {
        confidence += 5;
        factors.push(`${critCount} CRITICAL findings`);
    }

    confidence = Math.min(99, Math.max(10, confidence));

    return { score: confidence, factors };
}

// ═══════════════════════════════════════════════════════════════════════
// EVIDENCE CHAIN BUILDER
// ═══════════════════════════════════════════════════════════════════════

function buildEvidenceChain(topChain) {
    return topChain.matchedSteps.map(ms => {
        // Pick the best finding for this step (highest severity, then first)
        const sortedFindings = ms.findings.sort((a, b) => {
            const sevOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
            return (sevOrder[a.severity] || 3) - (sevOrder[b.severity] || 3);
        });
        const bestFinding = sortedFindings[0];

        return {
            step: ms.description,
            finding: bestFinding,
            file: bestFinding ? (bestFinding.file || '').split('/').pop() : '',
            line: bestFinding ? bestFinding.line_number : '',
            severity: bestFinding ? bestFinding.severity : 'MEDIUM',
            content: bestFinding ? (bestFinding.line_content || '').substring(0, 100) : ''
        };
    });
}

// ═══════════════════════════════════════════════════════════════════════
// AFFECTED SYSTEMS IDENTIFICATION
// ═══════════════════════════════════════════════════════════════════════

function identifyAffectedSystems(matchedFindings) {
    const systems = new Set();
    const systemMap = {
        'storage': ['scsi', 'multipath', 'disk', 'lun', 'iscsi', 'fc_', 'san', 'io_error', 'pr_key'],
        'filesystem': ['gfs2', 'xfs', 'ext4', 'mount', 'readonly', 'filesystem'],
        'cluster': ['corosync', 'pacemaker', 'dlm', 'quorum', 'fence', 'stonith', 'cluster'],
        'network': ['bond', 'bridge', 'vlan', 'nic', 'eth', 'network', 'link_down'],
        'compute': ['qemu', 'kvm', 'virsh', 'libvirt', 'vcpu', 'vm_'],
        'memory': ['oom', 'swap', 'memory', 'ram', 'hugepage'],
        'kernel': ['kernel', 'panic', 'oops', 'mce', 'hardware'],
        'appliance': ['morpheus', 'rabbitmq', 'elasticsearch', 'mysql', 'nginx']
    };

    matchedFindings.forEach(f => {
        const text = `${f.pattern_name || ''} ${f.category || ''} ${f.description || ''}`.toLowerCase();
        Object.entries(systemMap).forEach(([system, keywords]) => {
            if (keywords.some(kw => text.includes(kw))) {
                systems.add(system);
            }
        });
    });

    return [...systems];
}



// ═══════════════════════════════════════════════════════════════════════
// RENDER — Beautiful Verdict Panel HTML
// ═══════════════════════════════════════════════════════════════════════

function renderVerdictPanel(findings, ticketText) {
    const verdict = generateVerdict(findings, ticketText);
    if (!verdict) return '';

    const sevColors = { 'P1': '#ef4444', 'P2': '#f59e0b', 'P3': '#3b82f6', 'P4': '#22c55e' };
    const sevColor = sevColors[verdict.severity] || '#3b82f6';
    const confColor = verdict.confidence.score >= 80 ? '#22c55e' : verdict.confidence.score >= 60 ? '#f59e0b' : '#ef4444';

    // System icons
    const sysIcons = {
        'storage': '💾', 'filesystem': '📂', 'cluster': '🔗', 'network': '🌐',
        'compute': '🖥️', 'memory': '🧠', 'kernel': '⚙️', 'appliance': '🏢'
    };

    let html = `
    <div id="verdictPanel" style="background:linear-gradient(135deg, #0f0f15 0%, #1a1025 100%);border:2px solid ${sevColor}40;border-radius:16px;padding:0;margin-bottom:24px;overflow:hidden;box-shadow:0 0 30px ${sevColor}15;">
        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:${sevColor}10;border-bottom:1px solid ${sevColor}30;">
            <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:24px;">⚖️</span>
                <span style="font-size:16px;font-weight:700;color:#fafafa;letter-spacing:0.5px;">VERDICT</span>
                <span style="font-size:10px;padding:3px 8px;border-radius:12px;background:${sevColor}25;color:${sevColor};font-weight:600;">${verdict.severity}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
                <div style="text-align:right;">
                    <div style="font-size:10px;color:#71717a;text-transform:uppercase;">Confidence</div>
                    <div style="font-size:20px;font-weight:700;color:${confColor};">${verdict.confidence.score}%</div>
                </div>
                <div style="width:40px;height:40px;border-radius:50%;border:3px solid ${confColor};display:flex;align-items:center;justify-content:center;">
                    <div style="width:28px;height:28px;border-radius:50%;background:conic-gradient(${confColor} ${verdict.confidence.score * 3.6}deg, #1a1a22 0deg);"></div>
                </div>
            </div>
        </div>

        <!-- Verdict Statement -->
        <div style="padding:20px;border-bottom:1px solid #2a2a3a;">
            <div style="font-size:15px;color:#fafafa;font-weight:500;line-height:1.6;">
                🔴 <strong>ROOT CAUSE:</strong> ${escVerdict(verdict.verdict)}
            </div>
            <div style="margin-top:8px;font-size:11px;color:#71717a;">
                Chain: <span style="color:#8b5cf6;">${escVerdict(verdict.chainName)}</span> · 
                Coverage: ${Math.round(verdict.chainCoverage * 100)}% · 
                ${verdict.matchedFindings.length} findings matched
            </div>
        </div>

        <!-- Evidence Chain -->
        <div style="padding:20px;border-bottom:1px solid #2a2a3a;">
            <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;font-weight:500;">📍 Evidence Chain</div>
            <div style="position:relative;padding-left:24px;">
                <div style="position:absolute;left:8px;top:4px;bottom:4px;width:2px;background:linear-gradient(to bottom, ${sevColor}, #3b82f6, #22c55e);border-radius:2px;"></div>
                ${verdict.evidenceChain.map((ev, i) => {
                    const evSevColor = ev.severity === 'CRITICAL' ? '#ef4444' : ev.severity === 'HIGH' ? '#f59e0b' : '#3b82f6';
                    return `
                    <div style="position:relative;margin-bottom:12px;padding:10px 14px;background:#0c0c0f;border:1px solid #1e1e2a;border-radius:8px;">
                        <div style="position:absolute;left:-20px;top:14px;width:12px;height:12px;border-radius:50%;background:${evSevColor};border:2px solid #0f0f15;"></div>
                        <div style="font-size:12px;color:#d4d4d8;font-weight:500;">Step ${i + 1}: ${escVerdict(ev.step)}</div>
                        ${ev.file ? `<div style="font-size:10px;color:#71717a;margin-top:4px;font-family:'JetBrains Mono',monospace;">📄 ${escVerdict(ev.file)}${ev.line ? ` : Line ${ev.line}` : ''}</div>` : ''}
                        ${ev.content ? `<div style="font-size:10px;color:#52525b;margin-top:3px;font-family:'JetBrains Mono',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escVerdict(ev.content)}</div>` : ''}
                    </div>`;
                }).join('')}
            </div>
        </div>

        <!-- Ticket Alignment -->
        ${verdict.ticketAlignment.score > 0 ? `
        <div style="padding:16px 20px;border-bottom:1px solid #2a2a3a;background:#01A98208;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="font-size:14px;">🎯</span>
                <span style="font-size:12px;font-weight:600;color:#01A982;">TICKET ALIGNMENT: ${verdict.ticketAlignment.score}%</span>
            </div>
            <div style="font-size:11px;color:#a1a1aa;line-height:1.6;">${escVerdict(verdict.ticketAlignment.reason)}</div>
            ${verdict.ticketAlignment.matchedKeywords.length > 0 ? `
            <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;">
                ${verdict.ticketAlignment.matchedKeywords.slice(0, 12).map(kw =>
                    `<span style="font-size:9px;padding:2px 6px;border-radius:10px;background:#01A98215;color:#01A982;border:1px solid #01A98230;">${escVerdict(kw)}</span>`
                ).join('')}
            </div>` : ''}
        </div>` : ''}

        <!-- Resolution Path -->
        <div style="padding:20px;border-bottom:1px solid #2a2a3a;">
            <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;font-weight:500;">🛠️ Resolution Path</div>
            ${verdict.resolution.map((step, i) => `
                <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px;">
                    <span style="min-width:20px;height:20px;border-radius:50%;background:#8b5cf620;color:#8b5cf6;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;">${i + 1}</span>
                    <code style="font-size:12px;color:#d4d4d8;font-family:'JetBrains Mono',monospace;background:#0c0c0f;padding:4px 8px;border-radius:4px;border:1px solid #1e1e2a;flex:1;word-break:break-all;">${escVerdict(step)}</code>
                </div>
            `).join('')}
        </div>

        <!-- Footer: Impact + TTR + Systems + Actions -->
        <div style="padding:16px 20px;display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between;">
            <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
                <div style="font-size:11px;">
                    <span style="color:#71717a;">⏱️ Fix:</span>
                    <span style="color:#d4d4d8;font-weight:500;">${verdict.ttr}</span>
                </div>
                <div style="font-size:11px;">
                    <span style="color:#71717a;">💥 Impact:</span>
                    <span style="color:#d4d4d8;font-weight:500;">${escVerdict(verdict.impact)}</span>
                </div>
                <div style="font-size:11px;">
                    <span style="color:#71717a;">📚 KB:</span>
                    <span style="color:#8b5cf6;font-weight:500;">${verdict.kb}</span>
                </div>
                <div style="display:flex;gap:4px;">
                    ${verdict.affectedSystems.map(sys =>
                        `<span title="${sys}" style="font-size:14px;">${sysIcons[sys] || '🔧'}</span>`
                    ).join('')}
                </div>
            </div>
            <div style="display:flex;gap:8px;">
                <button onclick="copyVerdictToClipboard()" style="font-size:11px;padding:6px 12px;border-radius:6px;background:#8b5cf620;color:#8b5cf6;border:1px solid #8b5cf640;cursor:pointer;font-weight:500;">📋 Copy to Ticket</button>
                <button onclick="toggleVerdictDetails()" style="font-size:11px;padding:6px 12px;border-radius:6px;background:#01A98215;color:#01A982;border:1px solid #01A98230;cursor:pointer;font-weight:500;">🔍 Details</button>
            </div>
        </div>

        <!-- Expandable Details (hidden by default) -->
        <div id="verdictDetails" style="display:none;padding:16px 20px;border-top:1px solid #2a2a3a;background:#0c0c0f;">
            <div style="font-size:11px;color:#71717a;text-transform:uppercase;margin-bottom:8px;font-weight:500;">Confidence Factors</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
                ${verdict.confidence.factors.map(f =>
                    `<span style="font-size:10px;padding:3px 8px;border-radius:10px;background:#22c55e15;color:#22c55e;border:1px solid #22c55e30;">✓ ${escVerdict(f)}</span>`
                ).join('')}
            </div>
            ${verdict.alternativeChains.length > 0 ? `
            <div style="font-size:11px;color:#71717a;text-transform:uppercase;margin-bottom:8px;font-weight:500;">Alternative Diagnoses</div>
            ${verdict.alternativeChains.map(alt => `
                <div style="font-size:11px;color:#a1a1aa;margin-bottom:4px;">
                    • ${escVerdict(alt.chain.name)} <span style="color:#71717a;">(score: ${Math.round(alt.score)})</span>
                </div>
            `).join('')}` : ''}
        </div>
    </div>`;

    return html;
}



// ═══════════════════════════════════════════════════════════════════════
// ACTIONS — Copy to Ticket, Toggle Details
// ═══════════════════════════════════════════════════════════════════════

function copyVerdictToClipboard() {
    const findings = window._allFindings || [];
    const ticketText = (document.getElementById('ticketContext') || {}).value || '';
    const verdict = generateVerdict(findings, ticketText);
    if (!verdict) return;

    const text = `═══ LogSherlock Pro — Smart Verdict ═══

🔴 ROOT CAUSE: ${verdict.verdict}

📊 Confidence: ${verdict.confidence.score}% | Severity: ${verdict.severity} | Chain: ${verdict.chainName}
🎯 Ticket Alignment: ${verdict.ticketAlignment.score}% — ${verdict.ticketAlignment.reason}

📍 EVIDENCE CHAIN:
${verdict.evidenceChain.map((ev, i) => `  ${i + 1}. ${ev.step}${ev.file ? ` (${ev.file}:${ev.line})` : ''}`).join('\n')}

🛠️ RESOLUTION STEPS:
${verdict.resolution.map((step, i) => `  ${i + 1}. ${step}`).join('\n')}

⏱️ Estimated Fix Time: ${verdict.ttr}
💥 Impact: ${verdict.impact}
📚 Reference: ${verdict.kb}
🖥️ Affected Systems: ${verdict.affectedSystems.join(', ')}

═══ Generated by LogSherlock Pro — ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST ═══`;

    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('#verdictPanel button');
        if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '✅ Copied!';
            btn.style.background = '#22c55e20';
            btn.style.color = '#22c55e';
            setTimeout(() => { btn.innerHTML = orig; btn.style.background = '#8b5cf620'; btn.style.color = '#8b5cf6'; }, 2000);
        }
    }).catch(() => {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
    });
}

function toggleVerdictDetails() {
    const details = document.getElementById('verdictDetails');
    if (details) {
        details.style.display = details.style.display === 'none' ? 'block' : 'none';
    }
}

// Escape HTML for safe rendering
function escVerdict(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC API — Called from index.html after scan completes
// ═══════════════════════════════════════════════════════════════════════

/**
 * Call this after scan completes to render the verdict panel.
 * Returns HTML string to inject into the page.
 */
function getVerdictHTML() {
    const findings = window._allFindings || [];
    const ticketText = (document.getElementById('ticketContext') || {}).value || '';
    return renderVerdictPanel(findings, ticketText);
}

// Auto-expose for external use
window.getVerdictHTML = getVerdictHTML;
window.renderVerdictPanel = renderVerdictPanel;
window.generateVerdict = generateVerdict;
window.copyVerdictToClipboard = copyVerdictToClipboard;
window.toggleVerdictDetails = toggleVerdictDetails;
