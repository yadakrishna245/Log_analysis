/**
 * LogSherlock Pro — Runbook Executor
 * Step-by-step guided remediation with verification checks
 * 
 * ENTERPRISE FEATURE: Junior engineers follow expert-built runbooks.
 * Each step has: instruction, expected output, verification command, and rollback.
 * Progress is tracked. Steps can be marked pass/fail with evidence.
 * 
 * DATA INTEGRITY: Runbooks are triggered ONLY by actual scan findings.
 * Steps are generic remediation guidance — not fabricated diagnostics.
 */

(function() {
    'use strict';

    const RUNBOOK_STATE_KEY = 'logsherlock_runbook_state';

    // ═══════════════════════════════════════════════════════════════
    // RUNBOOK LIBRARY — expert remediation procedures
    // Each runbook maps to specific pattern_names from scan results
    // ═══════════════════════════════════════════════════════════════
    const RUNBOOKS = {
        gfs2_withdraw: {
            title: 'GFS2 Filesystem Withdraw Recovery',
            severity: 'CRITICAL',
            triggers: ['gfs2_withdraw', 'gfs2_error', 'filesystem_readonly'],
            estimatedTime: '30-60 min',
            steps: [
                { instruction: 'Check current GFS2 mount status', command: 'mount | grep gfs2', verify: 'Look for "rw" or "ro" status', rollback: null },
                { instruction: 'Check GFS2 lock dump for blocked locks', command: 'cat /sys/kernel/debug/gfs2/*/glocks | grep -c "f:H"', verify: 'High number indicates lock contention', rollback: null },
                { instruction: 'Check DLM (Distributed Lock Manager) status', command: 'dlm_tool ls', verify: 'All lockspaces should show "members" matching cluster size', rollback: null },
                { instruction: 'Verify underlying storage is accessible', command: 'dd if=/dev/<device> of=/dev/null bs=4k count=1', verify: 'Should complete without I/O errors', rollback: null },
                { instruction: 'Check cluster communication (corosync)', command: 'corosync-cmapctl | grep members', verify: 'All nodes should be listed', rollback: null },
                { instruction: 'If filesystem is withdrawn, unmount and remount', command: 'umount /mount/point && mount /mount/point', verify: 'Mount succeeds without errors in dmesg', rollback: 'If mount fails, do NOT force mount. Escalate.' },
                { instruction: 'If remount fails, check for journal recovery needed', command: 'gfs2_edit -p jindex /dev/<device> | grep Journal', verify: 'Journals should show "clean" state', rollback: 'Do not manually clear journals without backup' },
                { instruction: 'Verify applications can write to filesystem', command: 'touch /mount/point/.healthcheck && rm -f /mount/point/.healthcheck', verify: 'No permission denied or I/O errors', rollback: null }
            ]
        },
        quorum_loss: {
            title: 'Cluster Quorum Loss Recovery',
            severity: 'CRITICAL',
            triggers: ['quorum_loss', 'corosync_timeout', 'node_fenced'],
            estimatedTime: '15-45 min',
            steps: [
                { instruction: 'Check current quorum status', command: 'corosync-quorumtool', verify: 'Shows "Quorate: Yes" or lists missing nodes', rollback: null },
                { instruction: 'Identify which nodes are missing', command: 'pcs status nodes', verify: 'Note which nodes show "OFFLINE"', rollback: null },
                { instruction: 'Check if missing nodes are actually down vs network isolated', command: 'ping <node_ip> && ssh <node> "pcs status"', verify: 'Determines if node is alive but isolated', rollback: null },
                { instruction: 'Check corosync ring status', command: 'corosync-cfgtool -s', verify: 'All rings should show "no faults"', rollback: null },
                { instruction: 'If node is alive but isolated, check network/firewall', command: 'iptables -L -n | grep -i drop; ip link show', verify: 'No unexpected DROP rules, interfaces UP', rollback: null },
                { instruction: 'If node needs rejoining, restart corosync', command: 'systemctl restart corosync && sleep 5 && corosync-quorumtool', verify: 'Node rejoins and quorum is restored', rollback: 'If corosync fails to start, check /var/log/cluster/' },
                { instruction: 'Verify all resources resumed correctly', command: 'pcs resource show --full', verify: 'No resources in "Stopped" or "FAILED" state', rollback: 'pcs resource cleanup <resource_name>' }
            ]
        },
        oom_kill: {
            title: 'OOM Kill Investigation & Mitigation',
            severity: 'HIGH',
            triggers: ['oom_kill', 'memory_leak', 'java_oom', 'java_heap_exhausted'],
            estimatedTime: '20-40 min',
            steps: [
                { instruction: 'Identify which process was OOM-killed', command: 'dmesg | grep -i "killed process" | tail -5', verify: 'Shows PID and process name that was killed', rollback: null },
                { instruction: 'Check current memory usage', command: 'free -h && cat /proc/meminfo | grep -E "MemTotal|MemAvail|SwapTotal|SwapFree"', verify: 'Note available memory and swap usage', rollback: null },
                { instruction: 'Find top memory consumers', command: 'ps aux --sort=-%mem | head -15', verify: 'Identify if a process is using abnormal memory', rollback: null },
                { instruction: 'Check if the killed service has auto-restarted', command: 'systemctl status <service_name>', verify: 'Service should be "active (running)"', rollback: 'systemctl start <service_name>' },
                { instruction: 'Check for memory leak indicators (growing RSS)', command: 'ps -p <PID> -o pid,rss,vsz,comm --no-headers', verify: 'RSS should be within expected bounds for the application', rollback: null },
                { instruction: 'If Java app, check heap settings', command: 'ps aux | grep java | grep -o "\\-Xmx[^ ]*"', verify: 'Heap should be appropriate for available RAM', rollback: null },
                { instruction: 'Consider adjusting OOM score if needed', command: 'cat /proc/<PID>/oom_score_adj', verify: 'Critical services should have negative oom_score_adj', rollback: null }
            ]
        },
        multipath_failure: {
            title: 'Multipath Storage Path Recovery',
            severity: 'HIGH',
            triggers: ['multipath_failure', 'scsi_error', 'disk_io_error', 'san_error'],
            estimatedTime: '20-45 min',
            steps: [
                { instruction: 'Check multipath device status', command: 'multipath -ll', verify: 'Look for "failed" or "faulty" paths', rollback: null },
                { instruction: 'Identify failed paths', command: 'multipathd show paths', verify: 'Note paths with "faulty" or "shaky" state', rollback: null },
                { instruction: 'Check HBA/FC port status', command: 'cat /sys/class/fc_host/host*/port_state', verify: 'Should show "Online" for all ports', rollback: null },
                { instruction: 'Check for SCSI errors in dmesg', command: 'dmesg | grep -i "scsi\\|sd[a-z]" | tail -20', verify: 'Note any I/O errors or timeout messages', rollback: null },
                { instruction: 'Try to restore failed paths', command: 'multipathd reconfigure', verify: 'Run "multipath -ll" again to verify paths restored', rollback: null },
                { instruction: 'If paths remain down, rescan SCSI bus', command: 'echo "- - -" > /sys/class/scsi_host/host*/scan', verify: 'New paths should appear in "multipath -ll"', rollback: 'This is non-destructive, no rollback needed' },
                { instruction: 'Verify I/O is functioning on the device', command: 'dd if=/dev/mapper/<mpath_device> of=/dev/null bs=4k count=10', verify: 'Read completes without error', rollback: null }
            ]
        },
        kernel_panic: {
            title: 'Kernel Panic Post-Mortem & Prevention',
            severity: 'CRITICAL',
            triggers: ['kernel_panic', 'kernel_bug', 'cpu_lockup', 'watchdog_reset'],
            estimatedTime: '30-60 min',
            steps: [
                { instruction: 'Check if kdump captured a crash dump', command: 'ls -la /var/crash/ && systemctl status kdump', verify: 'vmcore file exists for analysis', rollback: null },
                { instruction: 'Get basic crash info from vmcore', command: 'crash /var/crash/*/vmcore /usr/lib/debug/lib/modules/$(uname -r)/vmlinux -i <<< "bt\\nsys\\nexit"', verify: 'Shows backtrace of panic', rollback: null },
                { instruction: 'Check kernel version and known bugs', command: 'uname -r && rpm -q kernel', verify: 'Note exact kernel version for bug lookup', rollback: null },
                { instruction: 'Check MCE (Machine Check Exception) logs', command: 'mcelog --client && dmesg | grep -i mce', verify: 'Hardware errors may have caused the panic', rollback: null },
                { instruction: 'Review recent changes before panic', command: 'rpm -qa --last | head -20 && last reboot | head -5', verify: 'Identify if a recent update/change triggered it', rollback: null },
                { instruction: 'Check if panic is reproducible (load test carefully)', command: 'uptime && cat /proc/loadavg', verify: 'System is stable since last reboot', rollback: null },
                { instruction: 'Enable persistent crash dump if not configured', command: 'systemctl enable kdump && kdumpctl showmem', verify: 'kdump is enabled and has reserved memory', rollback: null }
            ]
        },
        network_timeout: {
            title: 'Network Timeout Troubleshooting',
            severity: 'HIGH',
            triggers: ['connection_timeout', 'network_timeout', 'nic_flap', 'bond_degraded', 'packet_loss'],
            estimatedTime: '15-30 min',
            steps: [
                { instruction: 'Check interface status and errors', command: 'ip -s link show', verify: 'Look for RX/TX errors, drops, or "DOWN" state', rollback: null },
                { instruction: 'If bonded, check bond status', command: 'cat /proc/net/bonding/bond*', verify: 'All slave interfaces should show "up"', rollback: null },
                { instruction: 'Check for packet loss to key destinations', command: 'ping -c 10 <gateway_ip> && ping -c 10 <target_host>', verify: 'Zero packet loss expected', rollback: null },
                { instruction: 'Check ARP table for inconsistencies', command: 'ip neigh show | grep -i "FAILED\\|INCOMPLETE"', verify: 'No stuck ARP entries', rollback: 'ip neigh flush dev <interface>' },
                { instruction: 'Check for network ring buffer drops', command: 'ethtool -S <interface> | grep -i drop', verify: 'rx_missed or rx_no_buffer indicates NIC overload', rollback: 'ethtool -G <interface> rx 4096' },
                { instruction: 'Verify MTU consistency along path', command: 'ping -M do -s 1472 <destination>', verify: 'If fragmentation needed, MTU mismatch exists', rollback: null },
                { instruction: 'Check firewall/iptables for drops', command: 'iptables -L -v -n | grep -i drop; conntrack -C', verify: 'No unexpected drops, conntrack not full', rollback: null }
            ]
        }
    };


    // ═══════════════════════════════════════════════════════════════
    // RUNBOOK MATCHING — finds applicable runbooks from findings
    // ═══════════════════════════════════════════════════════════════

    function matchRunbooks(findings) {
        if (!findings || findings.length === 0) return [];

        const matched = [];
        const foundPatterns = findings.map(f => (f.pattern_name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_'));

        Object.entries(RUNBOOKS).forEach(([key, runbook]) => {
            const triggerMatches = runbook.triggers.filter(trigger => 
                foundPatterns.some(p => p.includes(trigger) || trigger.includes(p))
            );

            if (triggerMatches.length > 0) {
                matched.push({
                    id: key,
                    ...runbook,
                    matchedTriggers: triggerMatches,
                    relevantFindings: findings.filter(f => {
                        const pn = (f.pattern_name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
                        return triggerMatches.some(t => pn.includes(t) || t.includes(pn));
                    })
                });
            }
        });

        // Sort by severity
        const sevOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        matched.sort((a, b) => (sevOrder[a.severity] || 9) - (sevOrder[b.severity] || 9));

        return matched;
    }

    // ═══════════════════════════════════════════════════════════════
    // STATE MANAGEMENT — tracks progress through runbook steps
    // ═══════════════════════════════════════════════════════════════

    function getRunbookState() {
        try {
            return JSON.parse(localStorage.getItem(RUNBOOK_STATE_KEY) || '{}');
        } catch(e) { return {}; }
    }

    function saveRunbookState(state) {
        try {
            localStorage.setItem(RUNBOOK_STATE_KEY, JSON.stringify(state));
        } catch(e) {}
    }

    function getStepState(runbookId, stepIdx) {
        const state = getRunbookState();
        return (state[runbookId] && state[runbookId][stepIdx]) || { status: 'pending', notes: '' };
    }

    function setStepState(runbookId, stepIdx, status, notes) {
        const state = getRunbookState();
        if (!state[runbookId]) state[runbookId] = {};
        state[runbookId][stepIdx] = { status, notes: notes || '', completedAt: Date.now() };
        saveRunbookState(state);
    }

    // ═══════════════════════════════════════════════════════════════
    // UI RENDERER — interactive runbook execution panel
    // ═══════════════════════════════════════════════════════════════

    function renderRunbookPanel(findings, container) {
        const matched = matchRunbooks(findings);

        if (matched.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:24px;color:var(--text-400);">
                    <div style="font-size:28px;margin-bottom:8px;">📖</div>
                    <div style="font-size:12px;font-weight:500;">No Runbooks Match Current Findings</div>
                    <div style="font-size:11px;color:var(--text-500);margin-top:4px;">
                        Runbooks auto-activate for known patterns (GFS2, OOM, multipath, cluster, kernel, network).
                    </div>
                </div>`;
            return;
        }

        let html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div>
                    <span style="font-size:14px;font-weight:600;color:var(--text-100);">📖 Runbook Executor</span>
                    <span style="font-size:11px;color:var(--text-400);margin-left:8px;">${matched.length} runbook${matched.length > 1 ? 's' : ''} applicable</span>
                </div>
                <button id="runbookResetAll" style="font-size:10px;padding:4px 8px;background:var(--bg-0);color:var(--text-400);border:1px solid var(--border-subtle);border-radius:4px;cursor:pointer;">
                    🔄 Reset All Progress
                </button>
            </div>

            <!-- Runbook selector tabs -->
            <div style="display:flex;gap:6px;margin-bottom:14px;overflow-x:auto;padding-bottom:4px;" id="runbookTabs">
                ${matched.map((rb, idx) => {
                    const state = getRunbookState();
                    const rbState = state[rb.id] || {};
                    const completed = Object.values(rbState).filter(s => s.status === 'pass').length;
                    const total = rb.steps.length;
                    const pct = Math.round((completed / total) * 100);
                    return `
                        <button class="runbook-tab" data-idx="${idx}" style="
                            flex-shrink:0;padding:8px 12px;border-radius:6px;cursor:pointer;text-align:left;
                            background:${idx === 0 ? 'var(--accent)10' : 'var(--bg-0)'};
                            border:1px solid ${idx === 0 ? 'var(--accent)' : 'var(--border-subtle)'};
                            color:var(--text-200);
                        ">
                            <div style="font-size:11px;font-weight:500;">${rb.title}</div>
                            <div style="font-size:9px;color:var(--text-400);margin-top:2px;">
                                <span style="color:${rb.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b'}">${rb.severity}</span> · 
                                ${completed}/${total} steps · ${pct}%
                            </div>
                        </button>`;
                }).join('')}
            </div>

            <!-- Active runbook content -->
            <div id="runbookContent"></div>`;

        container.innerHTML = html;

        // Render first runbook by default
        renderRunbookSteps(matched[0], container.querySelector('#runbookContent'), findings);

        // Tab switching
        container.querySelectorAll('.runbook-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                container.querySelectorAll('.runbook-tab').forEach(t => {
                    t.style.background = 'var(--bg-0)';
                    t.style.borderColor = 'var(--border-subtle)';
                });
                this.style.background = 'var(--accent)10';
                this.style.borderColor = 'var(--accent)';
                renderRunbookSteps(matched[parseInt(this.dataset.idx)], container.querySelector('#runbookContent'), findings);
            });
        });

        // Reset all
        document.getElementById('runbookResetAll').addEventListener('click', () => {
            if (confirm('Reset all runbook progress? This cannot be undone.')) {
                localStorage.removeItem(RUNBOOK_STATE_KEY);
                renderRunbookPanel(findings, container);
            }
        });
    }

    function renderRunbookSteps(runbook, contentEl, findings) {
        const state = getRunbookState();
        const rbState = state[runbook.id] || {};

        let html = `
            <div style="background:var(--bg-0);border:1px solid var(--border-subtle);border-radius:8px;padding:14px;margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="font-size:13px;font-weight:600;color:var(--text-100);">${runbook.title}</div>
                        <div style="font-size:11px;color:var(--text-400);margin-top:2px;">
                            ⏱️ Estimated: ${runbook.estimatedTime} · 
                            Triggered by: ${runbook.matchedTriggers.map(t => `<code style="font-size:10px;background:var(--bg-1);padding:1px 4px;border-radius:3px;">${t}</code>`).join(', ')}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Progress bar -->
            <div style="margin-bottom:14px;">
                ${renderProgressBar(runbook, rbState)}
            </div>

            <!-- Steps -->
            <div class="runbook-steps">`;

        runbook.steps.forEach((step, idx) => {
            const stepState = rbState[idx] || { status: 'pending', notes: '' };
            const statusIcon = stepState.status === 'pass' ? '✅' : stepState.status === 'fail' ? '❌' : stepState.status === 'skip' ? '⏭️' : `<span style="color:var(--text-500);">${idx + 1}</span>`;
            const borderColor = stepState.status === 'pass' ? '#10b981' : stepState.status === 'fail' ? '#ef4444' : 'var(--border-subtle)';

            html += `
                <div class="runbook-step" data-step="${idx}" style="
                    background:var(--bg-0);border:1px solid ${borderColor};border-radius:8px;padding:12px;margin-bottom:8px;
                    ${stepState.status === 'pass' ? 'opacity:0.7;' : ''}
                ">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                        <div style="display:flex;gap:10px;flex:1;">
                            <div style="font-size:14px;min-width:20px;text-align:center;">${statusIcon}</div>
                            <div style="flex:1;">
                                <div style="font-size:12px;font-weight:500;color:var(--text-100);">${escHtml(step.instruction)}</div>
                                <div style="margin-top:6px;background:var(--bg-1);border-radius:4px;padding:6px 10px;font-family:var(--mono);font-size:11px;color:var(--accent);word-break:break-all;">
                                    $ ${escHtml(step.command)}
                                </div>
                                <div style="font-size:10px;color:var(--text-400);margin-top:4px;">
                                    <strong>Verify:</strong> ${escHtml(step.verify)}
                                </div>
                                ${step.rollback ? `<div style="font-size:10px;color:#f59e0b;margin-top:3px;"><strong>⚠️ Rollback:</strong> ${escHtml(step.rollback)}</div>` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Action buttons -->
                    <div style="display:flex;gap:4px;margin-top:8px;padding-left:30px;">
                        <button class="rb-step-pass" data-rb="${runbook.id}" data-step="${idx}" style="font-size:10px;padding:3px 8px;background:#10b98120;color:#10b981;border:1px solid #10b98140;border-radius:4px;cursor:pointer;">✅ Pass</button>
                        <button class="rb-step-fail" data-rb="${runbook.id}" data-step="${idx}" style="font-size:10px;padding:3px 8px;background:#ef444420;color:#ef4444;border:1px solid #ef444440;border-radius:4px;cursor:pointer;">❌ Fail</button>
                        <button class="rb-step-skip" data-rb="${runbook.id}" data-step="${idx}" style="font-size:10px;padding:3px 8px;background:var(--bg-1);color:var(--text-400);border:1px solid var(--border-subtle);border-radius:4px;cursor:pointer;">⏭️ Skip</button>
                        <input class="rb-step-notes" data-rb="${runbook.id}" data-step="${idx}" type="text" placeholder="Notes (optional)" value="${escAttr(stepState.notes)}" style="
                            flex:1;font-size:10px;padding:3px 8px;background:var(--bg-1);border:1px solid var(--border-subtle);border-radius:4px;color:var(--text-300);outline:none;
                        ">
                    </div>
                </div>`;
        });

        html += `</div>`;

        contentEl.innerHTML = html;

        // Attach step action handlers
        contentEl.querySelectorAll('.rb-step-pass, .rb-step-fail, .rb-step-skip').forEach(btn => {
            btn.addEventListener('click', function() {
                const rbId = this.dataset.rb;
                const stepIdx = parseInt(this.dataset.step);
                const status = this.classList.contains('rb-step-pass') ? 'pass' : 
                               this.classList.contains('rb-step-fail') ? 'fail' : 'skip';
                const notesInput = contentEl.querySelector(`.rb-step-notes[data-step="${stepIdx}"]`);
                setStepState(rbId, stepIdx, status, notesInput ? notesInput.value : '');
                renderRunbookSteps(runbook, contentEl, findings);
            });
        });

        // Save notes on change
        contentEl.querySelectorAll('.rb-step-notes').forEach(input => {
            input.addEventListener('change', function() {
                const rbId = this.dataset.rb;
                const stepIdx = parseInt(this.dataset.step);
                const current = getStepState(rbId, stepIdx);
                setStepState(rbId, stepIdx, current.status || 'pending', this.value);
            });
        });
    }

    function renderProgressBar(runbook, rbState) {
        const total = runbook.steps.length;
        const passed = Object.values(rbState).filter(s => s.status === 'pass').length;
        const failed = Object.values(rbState).filter(s => s.status === 'fail').length;
        const skipped = Object.values(rbState).filter(s => s.status === 'skip').length;
        const pct = Math.round(((passed + skipped) / total) * 100);

        return `
            <div style="display:flex;align-items:center;gap:8px;">
                <div style="flex:1;height:6px;background:var(--bg-0);border-radius:3px;overflow:hidden;border:1px solid var(--border-subtle);">
                    <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#10b981,#01a982);border-radius:3px;transition:width 0.3s;"></div>
                </div>
                <div style="font-size:10px;color:var(--text-400);white-space:nowrap;">
                    <span style="color:#10b981;">${passed}✓</span> 
                    ${failed > 0 ? `<span style="color:#ef4444;">${failed}✗</span> ` : ''}
                    ${skipped > 0 ? `<span style="color:var(--text-500);">${skipped}⏭</span> ` : ''}
                    / ${total}
                </div>
            </div>`;
    }


    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    function initRunbookExecutor() {
        window.renderRunbookExecutorPanel = function(findings) {
            if (!findings || findings.length === 0) return;

            let container = document.getElementById('runbookExecutorPanel');
            if (!container) {
                container = document.createElement('div');
                container.id = 'runbookExecutorPanel';
                container.className = 'results-panel';
                container.style.cssText = 'margin-top:16px;padding:16px;background:var(--bg-1);border:1px solid var(--border-subtle);border-radius:10px;';

                const anchor = document.getElementById('shiftHandoffPanel') ||
                               document.getElementById('complianceExportPanel') ||
                               document.getElementById('rootCauseChainPanel') ||
                               document.getElementById('findingsList');
                if (anchor && anchor.parentNode) {
                    anchor.parentNode.insertBefore(container, anchor.nextSibling);
                }
            }

            renderRunbookPanel(findings, container);
        };

        window.LogSherlockRunbook = {
            match: matchRunbooks,
            library: RUNBOOKS,
            version: '1.0.0'
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRunbookExecutor);
    } else {
        initRunbookExecutor();
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
