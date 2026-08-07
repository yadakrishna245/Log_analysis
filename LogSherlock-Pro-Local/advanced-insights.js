/**
 * LogSherlock Pro — Advanced Intelligence Features
 * 
 * 1. Root Cause Graph — Collapses 50+ findings into 3-5 root causes (interactive DAG)
 * 2. Timeline Replay — Swimlane chronological view across all files
 * 3. Log Memory — Fingerprints cases, auto-matches to solved history
 * 
 * Loads AFTER scan results are available. Adds tabs to the results panel.
 */

(function() {
'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 1. ROOT CAUSE GRAPH
// ─────────────────────────────────────────────────────────────────────────────

const CAUSE_CHAINS = [
    { id: 'storage_io', label: 'Storage I/O Failure', color: '#ff4444',
      patterns: ['scsi_reservation_conflict','scsi_command_failed','multipath_path_failed','multipath_all_paths_down','io_error_on_device','alletra_lun_offline','iscsi_session_lost','fc_host_link_down','multipath_path_faulty','storage_access_lost'],
      effects: ['gfs2_withdraw','gfs2_readonly','vm_crashed','vm_block_io_error','disk_full_vm_paused','gfs2_withdraw_detected'] },
    { id: 'cluster_comm', label: 'Cluster Communication Loss', color: '#ff8800',
      patterns: ['corosync_ring_error','corosync_membership_change','knet_link_down','totem_token_timeout','bond_slave_down','nic_link_flapping','bond_nic_link_down','nic_interface_down','bond_no_active_slave'],
      effects: ['quorum_lost','pacemaker_fencing','pacemaker_node_lost','split_brain','corosync_quorum_lost','dlm_service_failure','dlm_lockspace_error'] },
    { id: 'memory_exhaust', label: 'Memory Exhaustion', color: '#cc44ff',
      patterns: ['oom_kill','java_heap_oom','memory_pressure_high','swap_usage_high','memory_hardware_error'],
      effects: ['oom_kill_qemu_vm','systemd_service_failed','vm_crashed','morpheus_ui_502','workqueue_cpu_hogging'] },
    { id: 'disk_full', label: 'Disk Space Exhaustion', color: '#ff6600',
      patterns: ['disk_full','host_disk_critical','filesystem_usage_critical','root_disk_full_logs'],
      effects: ['morpheus_mysql_down','elasticsearch_red','backup_failure','backup_space_insufficient','systemd_service_failed','vm_start_failed','disk_full_vm_paused'] },
    { id: 'network_fault', label: 'Network Infrastructure Fault', color: '#0088ff',
      patterns: ['bond_slave_down','kvm_bridge_missing','nic_link_flapping','network_unreachable','connection_timed_out','nic_interface_down','ovs_bridge_error'],
      effects: ['vm_migration_failed','connection_refused','dns_resolution_failed','iscsi_session_lost','cluster_communication_failure'] },
    { id: 'morpheus_svc', label: 'Morpheus Service Failure', color: '#44cc44',
      patterns: ['morpheus_ui_502','morpheus_mysql_down','rabbitmq_queue_stuck','elasticsearch_red','morpheus_upgrade_failed','morpheus_service_down'],
      effects: ['vm_provisioning_timeout','morpheus_deploy_failed','morpheus_nan_stats_error'] },
    { id: 'fencing_cascade', label: 'Fencing Cascade', color: '#ff0066',
      patterns: ['pacemaker_fencing','stonith_fencing_cascade','self_fencing_risk','fence_device_missing','dlm_monitor_timeout_fence'],
      effects: ['gfs2_readonly_cluster_wide','dlm_stateful_merge_kill','corosync_killed_by_dlm','agent_isolation_shutdown'] },
    { id: 'kernel_panic', label: 'Kernel Panic / Lockup', color: '#aa0000',
      patterns: ['kernel_panic','kernel_panic_on_oops','kernel_oops','cpu_soft_lockup','kernel_rcu_stall','watchdog_timeout','dstate_blocked_process','kernel_hung_task'],
      effects: ['pacemaker_fencing','vm_crashed','systemd_service_failed'] },
    { id: 'security_breach', label: 'Security Issue', color: '#ffcc00',
      patterns: ['selinux_avc_denial_libvirt','permission_denied','authentication_failed','ssh_brute_force','unauthorized_sudo','certificate_expired'],
      effects: ['kvm_storage_access_denied','vm_start_failed','connection_refused','libvirtd_connection_failed'] },
    { id: 'pr_key_issue', label: 'SCSI PR Key Missing', color: '#ff3399',
      patterns: ['sg_persist_pr_key_missing','sg_persist_command_failed','sg_persist_no_keys_registered','pr_key_cross_host_mismatch','pr_reservation_key'],
      effects: ['gfs2_journal_reservation_conflict','gfs2_withdraw','gfs2_metadata_withdraw','pacemaker_fencing'] },
];

function buildRootCauseGraph(findings) {
    if (!findings || findings.length === 0) return null;
    
    const patternNames = findings.map(f => f.pattern_name || f.name || '');
    const matchedChains = [];
    
    for (const chain of CAUSE_CHAINS) {
        const causeHits = chain.patterns.filter(p => patternNames.includes(p));
        const effectHits = chain.effects.filter(p => patternNames.includes(p));
        if (causeHits.length > 0 || effectHits.length > 0) {
            matchedChains.push({
                ...chain,
                causeHits,
                effectHits,
                totalHits: causeHits.length + effectHits.length,
                strength: (causeHits.length + effectHits.length) / (chain.patterns.length + chain.effects.length),
            });
        }
    }
    
    matchedChains.sort((a, b) => b.totalHits - a.totalHits);
    return matchedChains.slice(0, 5);
}

function renderRootCauseGraph(chains, findings) {
    if (!chains || chains.length === 0) return '<p style="color:var(--text-400);text-align:center;padding:40px;">No correlation chains detected in current findings.</p>';
    
    const totalFindings = findings.length;
    const explained = new Set();
    chains.forEach(c => { c.causeHits.forEach(h => explained.add(h)); c.effectHits.forEach(h => explained.add(h)); });
    const explainedPct = Math.round((explained.size / totalFindings) * 100);
    
    let html = `<div style="margin-bottom:20px;display:flex;gap:16px;align-items:center;">
        <div style="background:var(--bg-0);border-radius:8px;padding:12px 20px;flex:1;">
            <div style="font-size:24px;font-weight:700;color:var(--text-100);">${chains.length}</div>
            <div style="font-size:11px;color:var(--text-400);text-transform:uppercase;">Root Causes</div>
        </div>
        <div style="background:var(--bg-0);border-radius:8px;padding:12px 20px;flex:1;">
            <div style="font-size:24px;font-weight:700;color:var(--accent);">${totalFindings}</div>
            <div style="font-size:11px;color:var(--text-400);text-transform:uppercase;">Total Findings</div>
        </div>
        <div style="background:var(--bg-0);border-radius:8px;padding:12px 20px;flex:1;">
            <div style="font-size:24px;font-weight:700;color:#44cc44;">${explainedPct}%</div>
            <div style="font-size:11px;color:var(--text-400);text-transform:uppercase;">Explained</div>
        </div>
    </div>`;
    
    html += `<div style="font-size:11px;color:var(--text-400);margin-bottom:16px;text-transform:uppercase;letter-spacing:0.05em;">Cause → Effect Chains (click to expand)</div>`;
    
    for (const chain of chains) {
        const pct = Math.round(chain.strength * 100);
        html += `<div style="background:var(--bg-0);border-radius:10px;padding:16px;margin-bottom:12px;border-left:4px solid ${chain.color};">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-weight:600;font-size:14px;color:var(--text-100);">${chain.label}</span>
                <span style="font-size:11px;padding:3px 8px;border-radius:4px;background:${chain.color}22;color:${chain.color};font-weight:600;">${chain.totalHits} findings · ${pct}% match</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">`;
        
        for (const h of chain.causeHits) {
            html += `<span style="font-size:10px;padding:2px 6px;border-radius:3px;background:${chain.color}22;color:${chain.color};font-family:var(--mono);">⚡ ${h}</span>`;
        }
        for (const h of chain.effectHits) {
            html += `<span style="font-size:10px;padding:2px 6px;border-radius:3px;background:var(--bg-2);color:var(--text-300);font-family:var(--mono);">→ ${h}</span>`;
        }
        
        html += `</div></div>`;
    }
    
    return html;
}


// ─────────────────────────────────────────────────────────────────────────────
// 2. TIMELINE REPLAY
// ─────────────────────────────────────────────────────────────────────────────

function buildTimeline(findings) {
    const withTime = findings.filter(f => f.log_timestamp || f.timestamp);
    if (withTime.length === 0) return null;
    
    const events = withTime.map(f => ({
        time: new Date(f.log_timestamp || f.timestamp),
        severity: f.severity || 'MEDIUM',
        pattern: f.pattern_name || f.name || 'unknown',
        file: f.file || f.source_file || 'unknown',
        line: f.line_number || f.line || 0,
        text: (f.content || f.matched_text || '').substring(0, 120),
    })).filter(e => !isNaN(e.time.getTime()));
    
    events.sort((a, b) => a.time - b.time);
    return events;
}

function renderTimeline(events) {
    if (!events || events.length === 0) return '<p style="color:var(--text-400);text-align:center;padding:40px;">No timestamped events found. Upload logs with timestamps (syslog/ISO format) for timeline view.</p>';
    
    const files = [...new Set(events.map(e => e.file))];
    const colors = ['#4ecdc4','#ff6b6b','#ffd93d','#6c5ce7','#a8e6cf','#fdcb6e','#e17055','#74b9ff'];
    const fileColors = {};
    files.forEach((f, i) => { fileColors[f] = colors[i % colors.length]; });
    
    const sevColors = { CRITICAL: '#ff4444', HIGH: '#ff8800', MEDIUM: '#ffcc00', LOW: '#44cc44' };
    
    const minT = events[0].time.getTime();
    const maxT = events[events.length - 1].time.getTime();
    const range = maxT - minT || 1;
    
    let html = `<div style="margin-bottom:16px;display:flex;gap:12px;flex-wrap:wrap;">`;
    files.forEach(f => {
        const short = f.split('/').pop().split('\\\\').pop();
        html += `<span style="font-size:10px;padding:3px 8px;border-radius:4px;background:${fileColors[f]}22;color:${fileColors[f]};border:1px solid ${fileColors[f]}44;">📄 ${short}</span>`;
    });
    html += `</div>`;
    
    html += `<div style="font-size:10px;color:var(--text-400);display:flex;justify-content:space-between;margin-bottom:4px;">
        <span>${events[0].time.toLocaleTimeString()}</span>
        <span>${events.length} events across ${files.length} files</span>
        <span>${events[events.length-1].time.toLocaleTimeString()}</span>
    </div>`;
    
    // Swimlane per file
    for (const file of files) {
        const fileEvents = events.filter(e => e.file === file);
        const short = file.split('/').pop().split('\\').pop();
        html += `<div style="margin-bottom:8px;">
            <div style="font-size:10px;color:${fileColors[file]};font-family:var(--mono);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${short}</div>
            <div style="position:relative;height:28px;background:var(--bg-0);border-radius:4px;overflow:hidden;">`;
        
        for (const ev of fileEvents) {
            const pos = ((ev.time.getTime() - minT) / range) * 100;
            const col = sevColors[ev.severity] || '#888';
            html += `<div title="${ev.time.toLocaleTimeString()} — ${ev.pattern}\n${ev.text}" style="position:absolute;left:${pos}%;top:50%;transform:translate(-50%,-50%);width:10px;height:10px;border-radius:50%;background:${col};border:2px solid var(--bg-0);cursor:pointer;z-index:1;transition:transform 150ms;" onmouseover="this.style.transform='translate(-50%,-50%) scale(1.5)'" onmouseout="this.style.transform='translate(-50%,-50%)'"></div>`;
        }
        
        html += `</div></div>`;
    }
    
    // Event list (last 20)
    html += `<div style="margin-top:16px;max-height:300px;overflow-y:auto;">`;
    const show = events.slice(-30);
    for (const ev of show) {
        const col = sevColors[ev.severity] || '#888';
        html += `<div style="display:grid;grid-template-columns:70px 60px 1fr;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-subtle);font-size:11px;">
            <span style="color:var(--text-300);font-family:var(--mono);">${ev.time.toLocaleTimeString()}</span>
            <span style="color:${col};font-weight:600;text-transform:uppercase;font-size:10px;">${ev.severity}</span>
            <span style="color:var(--text-200);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ev.pattern}</span>
        </div>`;
    }
    html += `</div>`;
    
    return html;
}


// ─────────────────────────────────────────────────────────────────────────────
// 3. LOG MEMORY (Case Fingerprinting)
// ─────────────────────────────────────────────────────────────────────────────

const MEMORY_KEY = 'ls_log_memory';

function getCaseMemory() {
    try {
        return JSON.parse(localStorage.getItem(MEMORY_KEY) || '[]');
    } catch { return []; }
}

function saveCaseMemory(memory) {
    // Keep max 50 cases
    if (memory.length > 50) memory = memory.slice(-50);
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
}

function generateCaseFingerprint(findings) {
    // Fingerprint = sorted set of unique pattern names + severity distribution
    const patterns = [...new Set(findings.map(f => f.pattern_name || f.name || ''))].sort();
    const sevCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    findings.forEach(f => { const s = (f.severity || 'MEDIUM').toUpperCase(); if (sevCounts[s] !== undefined) sevCounts[s]++; });
    return {
        patterns,
        sevCounts,
        hash: patterns.join('|') + `::${sevCounts.CRITICAL}:${sevCounts.HIGH}:${sevCounts.MEDIUM}:${sevCounts.LOW}`,
        totalFindings: findings.length,
    };
}

function findSimilarCases(fingerprint) {
    const memory = getCaseMemory();
    if (memory.length === 0) return [];
    
    const currentPatterns = new Set(fingerprint.patterns);
    const scored = [];
    
    for (const past of memory) {
        const pastPatterns = new Set(past.fingerprint.patterns);
        const intersection = [...currentPatterns].filter(p => pastPatterns.has(p));
        const union = new Set([...currentPatterns, ...pastPatterns]);
        const jaccard = intersection.length / union.size; // Jaccard similarity
        
        if (jaccard > 0.2) { // At least 20% overlap
            scored.push({
                ...past,
                similarity: Math.round(jaccard * 100),
                commonPatterns: intersection,
            });
        }
    }
    
    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, 5);
}

function saveCurrentCase(findings, resolution) {
    const fingerprint = generateCaseFingerprint(findings);
    const memory = getCaseMemory();
    memory.push({
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        date: new Date().toISOString(),
        fingerprint,
        resolution: resolution || '',
        fileCount: new Set(findings.map(f => f.file || f.source_file || '')).size,
        topPatterns: fingerprint.patterns.slice(0, 10),
    });
    saveCaseMemory(memory);
    return memory.length;
}

function renderLogMemory(findings) {
    const fingerprint = generateCaseFingerprint(findings);
    const similar = findSimilarCases(fingerprint);
    const memory = getCaseMemory();
    
    let html = `<div style="display:flex;gap:16px;margin-bottom:20px;">
        <div style="background:var(--bg-0);border-radius:8px;padding:12px 20px;flex:1;">
            <div style="font-size:24px;font-weight:700;color:var(--text-100);">${memory.length}</div>
            <div style="font-size:11px;color:var(--text-400);text-transform:uppercase;">Cases Remembered</div>
        </div>
        <div style="background:var(--bg-0);border-radius:8px;padding:12px 20px;flex:1;">
            <div style="font-size:24px;font-weight:700;color:${similar.length > 0 ? '#44cc44' : 'var(--text-400)'};">${similar.length}</div>
            <div style="font-size:11px;color:var(--text-400);text-transform:uppercase;">Similar Past Cases</div>
        </div>
        <div style="background:var(--bg-0);border-radius:8px;padding:12px 20px;flex:1;">
            <div style="font-size:24px;font-weight:700;color:var(--accent);">${fingerprint.patterns.length}</div>
            <div style="font-size:11px;color:var(--text-400);text-transform:uppercase;">Unique Patterns</div>
        </div>
    </div>`;
    
    // Similar cases
    if (similar.length > 0) {
        html += `<div style="font-size:11px;color:var(--text-400);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">🧠 Similar Past Cases Found</div>`;
        for (const s of similar) {
            const date = new Date(s.date).toLocaleDateString();
            html += `<div style="background:var(--bg-0);border-radius:10px;padding:14px;margin-bottom:10px;border-left:4px solid #44cc44;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span style="font-weight:600;font-size:13px;color:var(--text-100);">Case from ${date}</span>
                    <span style="font-size:11px;padding:3px 8px;border-radius:4px;background:#44cc4422;color:#44cc44;font-weight:700;">${s.similarity}% match</span>
                </div>
                <div style="font-size:11px;color:var(--text-300);margin-bottom:4px;">${s.fingerprint.totalFindings} findings · ${s.fileCount} files</div>
                <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">
                    ${s.commonPatterns.slice(0, 8).map(p => `<span style="font-size:9px;padding:2px 5px;border-radius:3px;background:var(--bg-2);color:var(--text-300);font-family:var(--mono);">${p}</span>`).join('')}
                </div>
                ${s.resolution ? `<div style="margin-top:8px;font-size:12px;color:#44cc44;background:#44cc4411;padding:8px;border-radius:6px;">✅ Resolution: ${s.resolution}</div>` : ''}
            </div>`;
        }
    } else if (memory.length === 0) {
        html += `<div style="text-align:center;padding:30px;color:var(--text-400);">
            <div style="font-size:36px;margin-bottom:10px;">🧠</div>
            <div style="font-size:14px;font-weight:500;">Log Memory is empty</div>
            <div style="font-size:12px;margin-top:4px;">Save this case after resolving it. Next time a similar issue appears, Log Memory will auto-match it!</div>
        </div>`;
    } else {
        html += `<div style="text-align:center;padding:20px;color:var(--text-400);">
            <div style="font-size:14px;">No similar past cases found in ${memory.length} stored cases.</div>
            <div style="font-size:12px;margin-top:4px;">This appears to be a new type of issue.</div>
        </div>`;
    }
    
    // Save button
    html += `<div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border-subtle);">
        <div style="font-size:11px;color:var(--text-400);text-transform:uppercase;margin-bottom:8px;">Save This Case to Memory</div>
        <div style="display:flex;gap:8px;">
            <input type="text" id="lsMemoryResolution" placeholder="Resolution notes (e.g., 'Fixed by restarting DLM + remounting GFS2')" style="flex:1;padding:8px 12px;border-radius:6px;border:1px solid var(--border-subtle);background:var(--bg-0);color:var(--text-200);font-size:12px;">
            <button onclick="window._lsSaveCase()" style="padding:8px 16px;border-radius:6px;background:var(--accent);color:white;border:none;font-size:12px;font-weight:600;cursor:pointer;">💾 Save Case</button>
        </div>
    </div>`;
    
    // Recent memory entries
    if (memory.length > 0) {
        html += `<div style="margin-top:20px;">
            <div style="font-size:11px;color:var(--text-400);text-transform:uppercase;margin-bottom:8px;">Recent Cases in Memory (${memory.length})</div>
            <div style="max-height:200px;overflow-y:auto;">`;
        const recent = memory.slice(-10).reverse();
        for (const m of recent) {
            const date = new Date(m.date).toLocaleDateString();
            html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border-subtle);font-size:11px;">
                <span style="color:var(--text-300);">${date} · ${m.fingerprint.totalFindings} findings</span>
                <span style="color:var(--text-400);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.resolution || 'No resolution noted'}</span>
            </div>`;
        }
        html += `</div></div>`;
    }
    
    return html;
}


// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION — Injects tabs into scan results
// ─────────────────────────────────────────────────────────────────────────────

let _currentFindings = [];

window._lsSaveCase = function() {
    const resolution = document.getElementById('lsMemoryResolution')?.value || '';
    const count = saveCurrentCase(_currentFindings, resolution);
    const btn = document.querySelector('#lsMemoryPanel button');
    if (btn) { btn.textContent = `✅ Saved! (${count} total)`; btn.disabled = true; }
};

window.renderAdvancedInsights = function(findings) {
    _currentFindings = findings;
    
    // Build all three analyses
    const chains = buildRootCauseGraph(findings);
    const timeline = buildTimeline(findings);
    const memoryHtml = renderLogMemory(findings);
    
    const graphHtml = renderRootCauseGraph(chains, findings);
    const timelineHtml = renderTimeline(timeline);
    
    return `
    <div style="margin-top:24px;border-top:1px solid var(--border-subtle);padding-top:20px;">
        <div style="display:flex;gap:0;border-bottom:1px solid var(--border-subtle);margin-bottom:20px;">
            <div class="ls-adv-tab active" onclick="window._lsAdvTab(0)" style="padding:10px 18px;font-size:12px;font-weight:500;cursor:pointer;border-bottom:2px solid var(--accent);color:var(--text-100);">🔗 Root Cause Graph</div>
            <div class="ls-adv-tab" onclick="window._lsAdvTab(1)" style="padding:10px 18px;font-size:12px;font-weight:500;cursor:pointer;border-bottom:2px solid transparent;color:var(--text-400);">⏱️ Timeline Replay</div>
            <div class="ls-adv-tab" onclick="window._lsAdvTab(2)" style="padding:10px 18px;font-size:12px;font-weight:500;cursor:pointer;border-bottom:2px solid transparent;color:var(--text-400);">🧠 Log Memory</div>
        </div>
        <div id="lsAdvPane0" style="display:block;">${graphHtml}</div>
        <div id="lsAdvPane1" style="display:none;">${timelineHtml}</div>
        <div id="lsAdvPane2" style="display:none;" id="lsMemoryPanel">${memoryHtml}</div>
    </div>`;
};

window._lsAdvTab = function(idx) {
    document.querySelectorAll('.ls-adv-tab').forEach((t, i) => {
        t.style.borderBottomColor = i === idx ? 'var(--accent)' : 'transparent';
        t.style.color = i === idx ? 'var(--text-100)' : 'var(--text-400)';
    });
    for (let i = 0; i < 3; i++) {
        const pane = document.getElementById('lsAdvPane' + i);
        if (pane) pane.style.display = i === idx ? 'block' : 'none';
    }
};

})();
