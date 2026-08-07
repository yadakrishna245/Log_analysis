/**
 * LogSherlock Pro — Live Demo Mode
 * =================================
 * Standalone module for sales demonstrations.
 * Loads synthetic scan results instantly without requiring a real log file.
 *
 * Usage:
 *   <script src="live-demo-mode.js"></script>
 *   — or —
 *   import { renderLiveDemoButton, startLiveDemo } from './live-demo-mode.js';
 */

(function (root) {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────────────
  let demoActive = false;

  // ─── Styles ──────────────────────────────────────────────────────────────────
  const STYLES = `
    @keyframes demoPulse {
      0%   { box-shadow: 0 0 6px #01a982, 0 0 12px #01a982; }
      50%  { box-shadow: 0 0 14px #01a982, 0 0 28px #01a982; }
      100% { box-shadow: 0 0 6px #01a982, 0 0 12px #01a982; }
    }

    #live-demo-btn {
      position: fixed;
      bottom: 28px;
      right: 28px;
      z-index: 99999;
      padding: 12px 22px;
      border: none;
      border-radius: 8px;
      background: linear-gradient(135deg, #01a982, #00875a);
      color: #fff;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      animation: demoPulse 2s infinite;
      transition: transform 0.15s ease, opacity 0.15s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      letter-spacing: 0.3px;
    }

    #live-demo-btn:hover {
      transform: scale(1.06);
    }

    #live-demo-btn:active {
      transform: scale(0.97);
    }

    #demo-mode-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 99998;
      padding: 10px 20px;
      background: linear-gradient(90deg, #1a1a2e, #16213e);
      border-bottom: 2px solid #01a982;
      color: #e0e0e0;
      text-align: center;
      font-size: 14px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
    }

    #demo-mode-banner .demo-banner-text {
      color: #01a982;
      letter-spacing: 0.5px;
    }

    #demo-reset-btn {
      padding: 5px 14px;
      border: 1px solid #01a982;
      border-radius: 4px;
      background: transparent;
      color: #01a982;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
    }

    #demo-reset-btn:hover {
      background: #01a982;
      color: #1a1a2e;
    }
  `;

  // ─── Synthetic Data Templates ────────────────────────────────────────────────

  const FILE_PATHS = [
    '/var/log/messages',
    '/var/log/cluster/corosync.log',
    '/var/log/pacemaker/pacemaker.log',
    '/var/log/syslog',
    '/opt/morpheus/logs/morpheus.log',
    '/var/log/kern.log',
    '/var/log/multipath/multipathd.log',
    '/var/log/libvirt/qemu/vm-prod-01.log',
    '/var/log/lvm/lvm2-monitor.log',
    '/var/log/cluster/gfs2.log',
    '/var/log/NetworkManager/NetworkManager.log',
    '/var/log/dmesg',
  ];

  const FINDING_TEMPLATES = [
    // ─── Cluster ─────────────────────────────────────────────────────────────
    {
      pattern: 'gfs2_withdraw',
      severity: 'CRITICAL',
      category: 'cluster',
      file: '/var/log/cluster/gfs2.log',
      description: 'GFS2 filesystem withdrawn — shared storage is now read-only on this node',
      matches: [
        'Aug  7 03:14:22 node01 kernel: gfs2: fsid=cluster01:gfs2vol01: about to withdraw from the cluster',
        'Aug  7 03:14:22 node01 kernel: gfs2: fsid=cluster01:gfs2vol01: telling LM to withdraw',
        'Aug  7 03:14:23 node01 kernel: gfs2: fsid=cluster01:gfs2vol01: withdrawn',
      ],
    },
    {
      pattern: 'gfs2_withdraw',
      severity: 'CRITICAL',
      category: 'cluster',
      file: '/var/log/messages',
      description: 'GFS2 journal recovery required after node withdraw event',
      matches: [
        'Aug  7 03:15:01 node02 gfs2_tool: Recovering journal 3 for filesystem gfs2vol01',
      ],
    },
    {
      pattern: 'fence_timeout',
      severity: 'CRITICAL',
      category: 'cluster',
      file: '/var/log/cluster/corosync.log',
      description: 'Fencing operation timed out — node may remain in undetermined state',
      matches: [
        'Aug  7 04:22:09 node01 stonith-ng[2841]: error: STONITH operation timed out for node03 (timeout=60s)',
        'Aug  7 04:22:09 node01 crmd[2845]: error: Fencing of node03 failed: Timer expired',
        'Aug  7 04:23:10 node01 stonith-ng[2841]: notice: Retrying STONITH operation for node03 via iLO5',
      ],
    },
    {
      pattern: 'fence_timeout',
      severity: 'HIGH',
      category: 'cluster',
      file: '/var/log/pacemaker/pacemaker.log',
      description: 'Pacemaker detected unreachable node, fence attempt initiated',
      matches: [
        'Aug  7 04:21:55 node01 pacemaker-controld[2845]: warning: Node node03 is now lost',
        'Aug  7 04:21:56 node01 pacemaker-fenced[2841]: notice: Requesting peer fencing (reboot) of node03',
      ],
    },
    {
      pattern: 'quorum_loss',
      severity: 'CRITICAL',
      category: 'cluster',
      file: '/var/log/cluster/corosync.log',
      description: 'Cluster lost quorum — services will be stopped to prevent split-brain',
      matches: [
        'Aug  7 05:30:44 node01 corosync[1892]: [QUORUM] Members[1]: 1',
        'Aug  7 05:30:44 node01 corosync[1892]: [QUORUM] This node is no longer part of the quorate partition',
        'Aug  7 05:30:45 node01 crmd[2845]: warning: Quorum lost - Loss of quorum',
      ],
    },
    {
      pattern: 'quorum_loss',
      severity: 'HIGH',
      category: 'cluster',
      file: '/var/log/pacemaker/pacemaker.log',
      description: 'Pacemaker stopping all resources due to quorum loss policy',
      matches: [
        'Aug  7 05:30:45 node01 pacemaker-controld[2845]: notice: Quorum lost: stopping resources per no-quorum-policy=stop',
      ],
    },

    // ─── Storage ─────────────────────────────────────────────────────────────
    {
      pattern: 'lvm_partial',
      severity: 'HIGH',
      category: 'storage',
      file: '/var/log/lvm/lvm2-monitor.log',
      description: 'LVM volume group running with partial PV availability',
      matches: [
        'Aug  7 06:12:33 node01 lvm[4521]: WARNING: VG vg_shared is missing PV /dev/sdc (uuid QkF9d1-x2R3-7Hn4-rP8z-9YKl-mW3t-Vh6Bns)',
        'Aug  7 06:12:33 node01 lvm[4521]: WARNING: VG vg_shared running in partial mode with 2/3 PVs',
      ],
    },
    {
      pattern: 'lvm_partial',
      severity: 'MEDIUM',
      category: 'storage',
      file: '/var/log/messages',
      description: 'LVM thin pool approaching capacity threshold',
      matches: [
        'Aug  7 06:15:00 node01 lvm[4521]: DMEVENT: thin pool vg_shared/tp_data is 82.4% full',
      ],
    },
    {
      pattern: 'multipath_fault',
      severity: 'CRITICAL',
      category: 'storage',
      file: '/var/log/multipath/multipathd.log',
      description: 'All paths to storage device failed — I/O will queue until timeout',
      matches: [
        'Aug  7 07:01:18 node01 multipathd[1230]: mpath3: all paths down - queueing I/O',
        'Aug  7 07:01:18 node01 multipathd[1230]: mpath3: sda - path offline (tur checker)',
        'Aug  7 07:01:18 node01 multipathd[1230]: mpath3: sdb - path offline (tur checker)',
      ],
    },
    {
      pattern: 'multipath_fault',
      severity: 'HIGH',
      category: 'storage',
      file: '/var/log/messages',
      description: 'Multipath device experiencing intermittent path failures',
      matches: [
        'Aug  7 07:00:55 node01 multipathd[1230]: mpath3: sdb - directio checker reports path is down',
        'Aug  7 07:01:02 node01 multipathd[1230]: mpath3: remaining active paths: 1',
      ],
    },
    {
      pattern: 'scsi_error',
      severity: 'HIGH',
      category: 'storage',
      file: '/var/log/messages',
      description: 'SCSI device reporting medium errors — potential disk failure',
      matches: [
        'Aug  7 08:44:12 node01 kernel: sd 2:0:1:0: [sdc] Sense Key: Medium Error [current]',
        'Aug  7 08:44:12 node01 kernel: sd 2:0:1:0: [sdc] Add. Sense: Unrecovered read error',
        'Aug  7 08:44:12 node01 kernel: blk_update_request: I/O error, dev sdc, sector 488397168',
      ],
    },
    {
      pattern: 'scsi_error',
      severity: 'MEDIUM',
      category: 'storage',
      file: '/var/log/kern.log',
      description: 'SCSI command timeout on storage controller — possible HBA issue',
      matches: [
        'Aug  7 08:44:50 node01 kernel: scsi_eh_2: attempting to abort cmd 0xffff9a1bc4e82000',
        'Aug  7 08:44:51 node01 kernel: hpsa 0000:03:00.0: scsi 2:0:1:0: abort succeeded for CDB',
      ],
    },

    // ─── Kernel ──────────────────────────────────────────────────────────────
    {
      pattern: 'kernel_panic',
      severity: 'CRITICAL',
      category: 'kernel',
      file: '/var/log/kern.log',
      description: 'Kernel panic — system halted, manual intervention required',
      matches: [
        'Aug  6 23:58:41 node03 kernel: Kernel panic - not syncing: VFS: Unable to mount root fs on unknown-block(0,0)',
        'Aug  6 23:58:41 node03 kernel: CPU: 0 PID: 1 Comm: swapper/0 Kdump: loaded Tainted: G W 5.14.0-162.el9.x86_64',
      ],
    },
    {
      pattern: 'kernel_panic',
      severity: 'CRITICAL',
      category: 'kernel',
      file: '/var/log/messages',
      description: 'Kernel panic with call trace indicating memory corruption',
      matches: [
        'Aug  7 02:11:03 node02 kernel: BUG: unable to handle page fault for address: ffff88813a2b1008',
        'Aug  7 02:11:03 node02 kernel: Oops: 0000 [#1] SMP NOPTI',
        'Aug  7 02:11:03 node02 kernel: Kernel panic - not syncing: Fatal exception',
      ],
    },
    {
      pattern: 'oom_kill',
      severity: 'HIGH',
      category: 'kernel',
      file: '/var/log/messages',
      description: 'OOM killer invoked — system critically low on memory',
      matches: [
        'Aug  7 09:33:17 node01 kernel: node01 invoked oom-killer: gfp_mask=0x100cca(GFP_HIGHUSER_MOVABLE), order=0',
        'Aug  7 09:33:17 node01 kernel: Out of memory: Killed process 8832 (java) total-vm:12485632kB, anon-rss:8124456kB',
      ],
    },
    {
      pattern: 'oom_kill',
      severity: 'HIGH',
      category: 'kernel',
      file: '/var/log/syslog',
      description: 'Repeated OOM kills suggest memory leak in application',
      matches: [
        'Aug  7 09:35:22 node01 kernel: Out of memory: Killed process 8901 (morpheus-app) total-vm:6291456kB, anon-rss:5872640kB',
        'Aug  7 09:40:55 node01 kernel: Out of memory: Killed process 9102 (morpheus-app) total-vm:6291456kB, anon-rss:5910528kB',
      ],
    },
    {
      pattern: 'soft_lockup',
      severity: 'HIGH',
      category: 'kernel',
      file: '/var/log/kern.log',
      description: 'Soft lockup detected — CPU stuck in kernel code for extended time',
      matches: [
        'Aug  7 10:15:33 node01 kernel: watchdog: BUG: soft lockup - CPU#4 stuck for 23s! [kworker/4:1:1854]',
        'Aug  7 10:15:33 node01 kernel: CPU: 4 PID: 1854 Comm: kworker/4:1 Tainted: G W OE 5.14.0-162.el9.x86_64',
      ],
    },
    {
      pattern: 'soft_lockup',
      severity: 'MEDIUM',
      category: 'kernel',
      file: '/var/log/messages',
      description: 'RCU stall warning — potential preemption issue under load',
      matches: [
        'Aug  7 10:15:34 node01 kernel: rcu: INFO: rcu_sched self-detected stall on CPU',
        'Aug  7 10:15:34 node01 kernel: rcu:  4-....: (10500 ticks this GP) idle=0e2/1/0x4000000000000000',
      ],
    },

    // ─── Network ─────────────────────────────────────────────────────────────
    {
      pattern: 'bond_failover',
      severity: 'MEDIUM',
      category: 'network',
      file: '/var/log/messages',
      description: 'Network bond failover — slave interface went down',
      matches: [
        'Aug  7 11:02:44 node01 kernel: bond0: link status definitely down for interface ens3f0, disabling it',
        'Aug  7 11:02:44 node01 kernel: bond0: making interface ens3f1 the new active one',
      ],
    },
    {
      pattern: 'bond_failover',
      severity: 'HIGH',
      category: 'network',
      file: '/var/log/NetworkManager/NetworkManager.log',
      description: 'Bond failover with all slaves flapping — potential switch issue',
      matches: [
        'Aug  7 11:05:12 node01 NetworkManager[1105]: <warn> bond0: slave ens3f0: link status flapping',
        'Aug  7 11:05:14 node01 NetworkManager[1105]: <warn> bond0: slave ens3f1: link status flapping',
        'Aug  7 11:05:16 node01 kernel: bond0: Warning: No active slave, bond going down',
      ],
    },
    {
      pattern: 'network_timeout',
      severity: 'MEDIUM',
      category: 'network',
      file: '/var/log/syslog',
      description: 'Network connection timeouts to management plane',
      matches: [
        'Aug  7 12:30:01 node01 morpheus-agent[3421]: WARN Connection to management server timed out (10.0.1.50:443) after 30s',
        'Aug  7 12:30:31 node01 morpheus-agent[3421]: WARN Retry 1/3: connecting to management server...',
      ],
    },
    {
      pattern: 'network_timeout',
      severity: 'HIGH',
      category: 'network',
      file: '/var/log/messages',
      description: 'iSCSI connection timeout — storage network disruption',
      matches: [
        'Aug  7 12:31:22 node01 kernel: connection3:0: ping timeout of 5 secs expired, recv timeout 5, last rx 4301253, last ping 4301258',
        'Aug  7 12:31:22 node01 iscsid[2103]: connection3:0: detected conn error (1020)',
        'Aug  7 12:31:22 node01 kernel: session3: session recovery timed out after 120 secs',
      ],
    },

    // ─── Virtualization ──────────────────────────────────────────────────────
    {
      pattern: 'vm_migration_fail',
      severity: 'HIGH',
      category: 'virtualization',
      file: '/var/log/libvirt/qemu/vm-prod-01.log',
      description: 'VM live migration failed — dirty page rate exceeds bandwidth',
      matches: [
        'Aug  7 13:44:08 node01 libvirtd[2200]: migration of vm-prod-01 failed: migration stalled: dirty page rate 245MB/s exceeds transfer rate 180MB/s',
        'Aug  7 13:44:08 node01 libvirtd[2200]: operation aborted: migration cancelled after 3 convergence attempts',
      ],
    },
    {
      pattern: 'vm_migration_fail',
      severity: 'CRITICAL',
      category: 'virtualization',
      file: '/var/log/messages',
      description: 'VM migration crashed source hypervisor — emergency failover triggered',
      matches: [
        'Aug  7 13:45:12 node01 libvirtd[2200]: error: internal error: QEMU unexpectedly closed monitor during migration of vm-prod-03',
        'Aug  7 13:45:12 node01 pacemaker-controld[2845]: notice: Initiating failover of vm-prod-03 to node02',
      ],
    },
    {
      pattern: 'vm_migration_fail',
      severity: 'MEDIUM',
      category: 'virtualization',
      file: '/var/log/libvirt/qemu/vm-prod-01.log',
      description: 'Migration pre-check warning — insufficient resources on destination',
      matches: [
        'Aug  7 13:40:55 node01 libvirtd[2200]: warning: destination node02 has only 4096MB free, VM requires 8192MB',
      ],
    },
    {
      pattern: 'morpheus_crash',
      severity: 'CRITICAL',
      category: 'virtualization',
      file: '/opt/morpheus/logs/morpheus.log',
      description: 'Morpheus application server crashed with OutOfMemoryError',
      matches: [
        'Aug  7 14:22:01 node01 morpheus[5500]: FATAL [main] java.lang.OutOfMemoryError: Java heap space',
        'Aug  7 14:22:01 node01 morpheus[5500]: FATAL   at com.morpheusdata.core.TaskService.executeAll(TaskService.java:412)',
        'Aug  7 14:22:02 node01 systemd[1]: morpheus-app.service: Main process exited, code=exited, status=137/KILL',
      ],
    },
    {
      pattern: 'morpheus_crash',
      severity: 'HIGH',
      category: 'virtualization',
      file: '/opt/morpheus/logs/morpheus.log',
      description: 'Morpheus UI unresponsive — multiple health check failures',
      matches: [
        'Aug  7 14:22:30 node01 morpheus-monitor[5510]: ERROR Health check failed for morpheus-ui (attempt 5/5)',
        'Aug  7 14:22:30 node01 morpheus-monitor[5510]: ERROR Service morpheus-ui marked as CRITICAL - auto-restart initiated',
        'Aug  7 14:22:35 node01 systemd[1]: morpheus-ui.service: Scheduled restart job, restart counter is at 3',
      ],
    },
    {
      pattern: 'morpheus_crash',
      severity: 'MEDIUM',
      category: 'virtualization',
      file: '/opt/morpheus/logs/morpheus.log',
      description: 'Morpheus RabbitMQ connection pool exhausted',
      matches: [
        'Aug  7 14:20:44 node01 morpheus[5500]: WARN [pool-3-thread-12] RabbitMQ connection pool exhausted (max=50, active=50, idle=0)',
        'Aug  7 14:20:44 node01 morpheus[5500]: WARN [pool-3-thread-12] Queuing message for retry: provisioning.task.complete',
      ],
    },
  ];

  // ─── Finding Generator ───────────────────────────────────────────────────────

  function generateFindings() {
    const findings = [];
    const baseLines = [42, 118, 256, 389, 512, 734, 891, 1023, 1156, 1298, 1445, 1589];

    FINDING_TEMPLATES.forEach(function (template, idx) {
      template.matches.forEach(function (match, mIdx) {
        findings.push({
          pattern: template.pattern,
          severity: template.severity,
          category: template.category,
          file: template.file,
          line: baseLines[idx % baseLines.length] + mIdx * 3 + Math.floor(Math.random() * 5),
          description: template.description,
          match: match,
        });
      });
    });

    // Shuffle for a natural feel
    for (let i = findings.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = findings[i];
      findings[i] = findings[j];
      findings[j] = temp;
    }

    // Ensure count is between 45 and 60
    if (findings.length > 60) {
      findings.length = 60;
    }

    return findings;
  }

  // ─── Inject Styles ───────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('live-demo-styles')) return;
    const style = document.createElement('style');
    style.id = 'live-demo-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  // ─── renderLiveDemoButton ────────────────────────────────────────────────────

  function renderLiveDemoButton() {
    return '<button id="live-demo-btn" onclick="startLiveDemo()" title="Load synthetic demo data for presentations">⚡ Live Demo</button>';
  }

  // ─── startLiveDemo ───────────────────────────────────────────────────────────

  function startLiveDemo() {
    if (demoActive) return;
    demoActive = true;

    injectStyles();

    // Hide the demo button
    const btn = document.getElementById('live-demo-btn');
    if (btn) btn.style.display = 'none';

    // Insert demo banner
    const banner = document.createElement('div');
    banner.id = 'demo-mode-banner';
    banner.innerHTML =
      '<span class="demo-banner-text">⚡ DEMO MODE — Showing synthetic data for demonstration purposes</span>' +
      '<button id="demo-reset-btn" onclick="resetLiveDemo()">Reset Demo</button>';
    document.body.prepend(banner);

    // Generate findings
    const findings = generateFindings();

    // Dispatch custom event
    window.dispatchEvent(
      new CustomEvent('demo-scan-complete', {
        detail: {
          findings: findings,
          files_analyzed: 12,
          scan_time: '0.8s',
        },
      })
    );

    // Call renderScanResults directly if available
    if (typeof renderScanResults === 'function') {
      renderScanResults(findings, { files_analyzed: 12, scan_time: '0.8s' });
    } else if (typeof window.renderScanResults === 'function') {
      window.renderScanResults(findings, { files_analyzed: 12, scan_time: '0.8s' });
    }

    console.log(
      '%c[LogSherlock Pro] %cDemo Mode Active — ' + findings.length + ' findings loaded',
      'color: #01a982; font-weight: bold;',
      'color: #e0e0e0;'
    );
  }

  // ─── resetLiveDemo ───────────────────────────────────────────────────────────

  function resetLiveDemo() {
    demoActive = false;

    // Remove banner
    const banner = document.getElementById('demo-mode-banner');
    if (banner) banner.remove();

    // Show demo button again
    const btn = document.getElementById('live-demo-btn');
    if (btn) btn.style.display = '';

    // Dispatch reset event
    window.dispatchEvent(new CustomEvent('demo-scan-reset'));

    console.log(
      '%c[LogSherlock Pro] %cDemo Mode Reset',
      'color: #01a982; font-weight: bold;',
      'color: #e0e0e0;'
    );
  }

  // ─── Self-Initializing ───────────────────────────────────────────────────────

  function init() {
    injectStyles();

    // Inject the floating demo button into the DOM
    const container = document.createElement('div');
    container.id = 'live-demo-container';
    container.innerHTML = renderLiveDemoButton();
    document.body.appendChild(container);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─── Exports ─────────────────────────────────────────────────────────────────

  // Global exports for script-tag usage
  root.renderLiveDemoButton = renderLiveDemoButton;
  root.startLiveDemo = startLiveDemo;
  root.resetLiveDemo = resetLiveDemo;

  // ES module / CommonJS support
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      renderLiveDemoButton: renderLiveDemoButton,
      startLiveDemo: startLiveDemo,
      resetLiveDemo: resetLiveDemo,
    };
  }
})(typeof window !== 'undefined' ? window : this);
