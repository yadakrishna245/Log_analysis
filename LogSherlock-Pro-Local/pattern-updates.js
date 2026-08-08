/**
 * LogSherlock Pro - Pattern Update Subscription Feature
 * Simulates antivirus-style signature updates for log pattern detection.
 * Standalone module — no network calls, all data embedded.
 */

(function () {
  'use strict';

  // ─── Embedded Pattern Update History ───────────────────────────────────────────
  const PATTERN_UPDATES = [
    {
      version: 675,
      date: '2026-08-08',
      dateLabel: 'Aug 8, 2026',
      added: 220,
      current: true,
      categories: ['HPE VME/Server Hardware', 'Linux System', 'Windows System', 'Storage & SAN', 'Network', 'Virtualization', 'Kubernetes & Containers', 'Database', 'Security & Compliance'],
      patterns: [
        'iLO connectivity failure - connection refused',
        'iLO connectivity failure - SSL handshake timeout',
        'iLO connectivity failure - authentication expired',
        'Thermal warning - CPU zone exceeded threshold',
        'Thermal warning - ambient temperature critical',
        'Thermal warning - exhaust temperature rising',
        'Fan failure - fan module degraded',
        'Fan failure - fan rotor locked',
        'Fan failure - redundancy lost',
        'PSU degradation - efficiency drop detected',
        'PSU degradation - capacitor aging warning',
        'PSU degradation - input voltage fluctuation',
        'PSU failure - redundant supply offline',
        'DIMM error - correctable ECC threshold exceeded',
        'DIMM error - uncorrectable multi-bit fault',
        'DIMM error - memory training failure on boot',
        'DIMM error - memory mirroring failover',
        'PCIe bus error - correctable advisory non-fatal',
        'PCIe bus error - uncorrectable fatal ACS violation',
        'PCIe bus error - link degraded to lower width',
        'RAID controller warning - cache battery low',
        'RAID controller warning - write-back cache disabled',
        'RAID controller warning - logical drive degraded',
        'Drive predictive failure - SMART threshold exceeded',
        'Drive predictive failure - reallocated sector count critical',
        'Firmware mismatch - iLO and system ROM incompatible',
        'Firmware mismatch - NIC firmware downlevel',
        'BMC communication loss - IPMI heartbeat timeout',
        'NMI event - hardware watchdog triggered',
        'Machine check exception - corrected hardware error',
        'Machine check exception - uncorrected fatal MCE',
        'Smart Array cache failure - flash-backed write cache disabled',
        'NVDIMM backup failure - energy source depleted',
        'NVDIMM backup failure - persistence lost on power cycle',
        'TPM error - self-test failure',
        'TPM error - PCR bank measurement mismatch',
        'Kernel panic - not syncing VFS unable to mount root',
        'Kernel panic - fatal exception in interrupt',
        'Kernel panic - attempted to kill init',
        'Softlockup - CPU stuck for 22s',
        'Softlockup - watchdog BUG soft lockup detected',
        'RCU stall - detected on CPU',
        'RCU stall - grace period not ending',
        'hung_task - task blocked for more than 120 seconds',
        'hung_task - IO wait task unresponsive',
        'BUG: unable to handle kernel NULL pointer dereference',
        'BUG: scheduling while atomic',
        'BUG: workqueue lockup detected',
        'oom-kill - Out of memory invoked oom-killer',
        'oom-kill - memory cgroup limit exceeded',
        'oom-kill - total-vm limit reached',
        'ext4 error - filesystem remounted read-only',
        'ext4 error - journal commit IO error',
        'ext4 error - inode checksum invalid',
        'XFS corruption - metadata IO error detected',
        'XFS corruption - log recovery failed',
        'XFS corruption - directory corruption on block',
        'BTRFS checksum failure - mirror read failed',
        'BTRFS checksum failure - csum mismatch on data',
        'LVM error - insufficient free extents',
        'LVM error - PV missing from volume group',
        'LVM error - thin pool metadata full',
        'systemd unit failure - service entered failed state',
        'systemd unit failure - start request repeated too quickly',
        'systemd unit failure - dependency failed for unit',
        'cgroup OOM - memory.max exceeded killed process',
        'NUMA imbalance - excessive remote memory access',
        'CPU throttling - thermal throttle activated',
        'CPU throttling - power limit notification',
        'auditd overflow - audit backlog limit exceeded',
        'auditd overflow - kernel audit buffer full',
        'SELinux denial - avc denied operation',
        'SELinux denial - context mismatch prevented access',
        'AppArmor block - DENIED operation on profile',
        'AppArmor block - profile load failure',
        'seccomp violation - SECCOMP action kill on syscall',
        'seccomp violation - bad system call trapped',
        'BSOD 0x0000007E - SYSTEM_THREAD_EXCEPTION_NOT_HANDLED',
        'BSOD 0x0000000A - IRQL_NOT_LESS_OR_EQUAL',
        'BSOD 0x000000D1 - DRIVER_IRQL_NOT_LESS_OR_EQUAL',
        'BSOD 0x00000050 - PAGE_FAULT_IN_NONPAGED_AREA',
        'BSOD 0x0000001E - KMODE_EXCEPTION_NOT_HANDLED',
        'Minidump generation - dump file written to SystemRoot',
        'WMI repository corruption - inconsistent repository detected',
        'WMI repository corruption - rebuild required',
        'DCOM error - server did not register with DCOM within timeout',
        'DCOM error - access permission denied for CLSID',
        'RPC failure - RPC server unavailable',
        'RPC failure - endpoint mapper no endpoints available',
        'Cluster failover event - resource group moved',
        'Cluster failover event - node isolated from cluster',
        'Disk witness loss - file share witness unavailable',
        'Quorum failure - cluster quorum lost',
        'Quorum failure - node weight insufficient',
        'Windows Update failure - error 0x80070002 file not found',
        'Windows Update failure - error 0x800F0922 CBS store corrupt',
        'CBS corruption - component store needs repair',
        'SFC finding - Windows Resource Protection found corrupt files',
        'Kerberos error - KRB_AP_ERR_SKEW clock skew too great',
        'Kerberos error - ticket expired TGT renewal failure',
        'NTLM fallback - Kerberos authentication failed falling back',
        'AD replication failure - DRS replication lingering objects',
        'AD replication failure - USN journal rollback detected',
        'Multipath failure - all paths to device lost',
        'Multipath failure - single path remaining degraded',
        'Path flapping - path oscillating between states',
        'Path flapping - excessive path transitions per minute',
        'SCSI sense code - medium error unrecovered read',
        'SCSI sense code - hardware error internal target failure',
        'SCSI sense code - aborted command overlapped commands',
        'Thin provisioning warning - pool utilization above 85%',
        'Thin provisioning warning - pool auto-extend failed',
        'Snapshot space exhaustion - snapshot reserve full',
        'Snapshot space exhaustion - copy-on-write allocation failed',
        'Deduplication failure - dedup engine hash collision',
        'Deduplication failure - fingerprint database corrupt',
        'Compression error - inline compression engine timeout',
        'Tiering issue - policy engine failed to migrate extents',
        'Tiering issue - SSD tier capacity critical',
        '3PAR alert - node pair communication lost',
        '3PAR alert - cage link degraded',
        'Nimble alert - array replication link down',
        'Nimble alert - volume collection schedule missed',
        'Primera alert - persistent port error detected',
        'StoreOnce error - catalyst connection failure',
        'StoreOnce error - dedup store health check failed',
        'LUN alignment issue - partition offset misaligned',
        'Queue depth exceeded - host bus adapter queue full',
        'Reservation conflict - SCSI persistent reservation failed',
        'BGP peer down - hold timer expired',
        'BGP peer down - notification received cease',
        'OSPF adjacency loss - neighbor state change to down',
        'OSPF adjacency loss - dead timer expired',
        'Spanning-tree topology change - root bridge election',
        'Spanning-tree topology change - port transition to blocking',
        'MTU mismatch - PMTUD failure fragmentation needed',
        'MTU mismatch - jumbo frame dropped on path',
        'CRC errors - frame check sequence errors incrementing',
        'Input errors - interface input discards increasing',
        'Output errors - interface output buffer failures',
        'ARP storm - excessive ARP requests per second',
        'Broadcast storm - broadcast traffic exceeding threshold',
        'MAC flapping - MAC address oscillating between ports',
        'SSL/TLS handshake failure - protocol version mismatch',
        'SSL/TLS handshake failure - cipher suite negotiation failed',
        'Certificate chain incomplete - missing intermediate CA',
        'Certificate expired - peer certificate validation failed',
        'DNS SERVFAIL - upstream resolver returning server failure',
        'NXDOMAIN flood - excessive non-existent domain queries',
        'Recursive query failure - maximum recursion depth exceeded',
        'Load balancer health check failure - backend unreachable',
        'Pool member down - health monitor marked server offline',
        'VMware PSOD - purple screen of death on ESXi host',
        'VMware HA failover - host declared unreachable',
        'VMware HA failover - VM restarted on alternate host',
        'VMware vMotion failure - migration exceeds VMotion timeout',
        'VMware vMotion failure - network connectivity lost during migration',
        'VMware VMFS heartbeat loss - datastore not accessible',
        'VMware snapshot consolidation - disk consolidation needed',
        'VMware snapshot consolidation - helper snapshot operation failed',
        'Hyper-V checkpoint merge failure - VHD chain merge error',
        'Hyper-V checkpoint merge failure - insufficient disk space for merge',
        'Hyper-V live migration error - compatibility check failed',
        'Hyper-V live migration error - network connectivity insufficient',
        'Hyper-V VHD corruption - virtual disk integrity check failed',
        'KVM virtio error - virtio_blk queue reset',
        'KVM virtio error - virtio_net tx queue timeout',
        'libvirt connection failure - unable to connect to hypervisor',
        'libvirt connection failure - socket permission denied',
        'CPU steal time high - excessive hypervisor overhead detected',
        'CPU steal time high - VM scheduling latency critical',
        'CrashLoopBackOff - container restarting repeatedly',
        'CrashLoopBackOff - back-off delay increasing',
        'ImagePullBackOff - failed to pull container image',
        'ImagePullBackOff - registry authentication required',
        'OOMKilled - container exceeded memory limit',
        'OOMKilled - pod evicted due to node memory pressure',
        'Evicted - pod evicted for resource reclaim',
        'etcd leader election - leader changed',
        'etcd leader election - election timeout no quorum',
        'apiserver unavailable - connection refused to kube-apiserver',
        'apiserver unavailable - request timeout exceeded',
        'scheduler failure - unable to schedule pod no nodes available',
        'PVC pending - persistent volume claim waiting for binding',
        'PVC pending - no persistent volume matching claim',
        'CSI driver error - volume attachment failed',
        'CSI driver error - volume mount timeout',
        'Node NotReady - kubelet stopped posting status',
        'Node NotReady - node condition memory pressure',
        'Ingress 502 - bad gateway upstream connection error',
        'Ingress 503 - service unavailable no endpoints',
        'Ingress 504 - gateway timeout upstream response delay',
        'Service mesh sidecar injection failure - webhook timeout',
        'Resource quota exceeded - namespace CPU limit reached',
        'LimitRange violation - container spec exceeds limits',
        'PDB violated - pod disruption budget would be breached',
        'HPA unable to scale - metrics unavailable for scaling',
        'Cluster autoscaler failed - unable to provision new node',
        'Taint toleration issue - pod unschedulable due to taint',
        'MySQL deadlock detected - transaction rolled back',
        'MySQL replication lag - seconds behind master critical',
        'MySQL binlog corruption - binary log event checksum failure',
        'MySQL InnoDB corruption - page checksum mismatch',
        'PostgreSQL WAL corruption - invalid record length at location',
        'PostgreSQL vacuum wraparound - approaching transaction ID limit',
        'PostgreSQL connection exhausted - remaining slots critical',
        'PostgreSQL shared buffer pressure - buffer cache hit ratio low',
        'Oracle ORA-00060 - deadlock detected waiting for resource',
        'Oracle ORA-04031 - unable to allocate shared memory',
        'Oracle ORA-01555 - snapshot too old rollback segment',
        'Oracle tablespace full - unable to extend segment',
        'Oracle archive log full - archiver process stuck',
        'Redis maxmemory reached - eviction policy triggered',
        'Redis persistence error - RDB snapshot write failed',
        'Redis persistence error - AOF rewrite failure',
        'Redis cluster slot migration - slot migration timeout',
        'MongoDB election - replica set election called',
        'MongoDB rollback - rollback to consistent point',
        'MongoDB WiredTiger cache pressure - cache usage above threshold',
        'Failed login brute force - multiple authentication failures detected',
        'Failed login brute force - account lockout threshold exceeded',
        'Privilege escalation - unauthorized sudo usage detected',
        'Privilege escalation - uid 0 gained by non-root process',
        'Rootkit detection - suspicious hidden process found',
        'Rootkit detection - kernel module signature verification failed',
        'Suspicious cron entry - unexpected crontab modification',
        'Unauthorized SSH key - authorized_keys file modified',
        'Password file modification - passwd or shadow file changed unexpectedly',
        'Firewall rule violation - blocked connection on restricted port',
        'Firewall rule violation - stateful inspection anomaly',
        'IDS alert - intrusion signature matched',
        'IPS alert - traffic blocked by inline prevention',
        'DDoS detection - SYN flood threshold exceeded',
        'DDoS detection - volumetric attack bandwidth spike',
        'Data exfiltration indicator - large outbound transfer to unknown',
        'Data exfiltration indicator - DNS tunneling pattern detected',
        'Unusual outbound traffic - connection to known C2 address',
        'PCI-DSS violation - unencrypted cardholder data transmission',
        'SOX audit failure - unauthorized financial system access',
        'HIPAA access violation - PHI accessed without authorization'
      ]
    },
    {
      version: 455,
      date: '2026-08-07',
      dateLabel: 'Aug 7, 2026',
      added: 12,
      current: false,
      categories: ['Morpheus 7.x errors', 'GFS2 v5 changes'],
      patterns: [
        'Morpheus 7.x appliance boot failure',
        'Morpheus 7.x API timeout on provisioning',
        'Morpheus 7.x task engine deadlock',
        'Morpheus 7.x integration token expiry',
        'Morpheus 7.x catalog sync corruption',
        'Morpheus 7.x network pool exhaustion',
        'GFS2 v5 journal recovery stall',
        'GFS2 v5 dlm lock contention',
        'GFS2 v5 quota enforcement error',
        'GFS2 v5 withdraw on metadata corruption',
        'GFS2 v5 fence race condition',
        'GFS2 v5 resource group bitmap overflow'
      ]
    },
    {
      version: 443,
      date: '2026-07-28',
      dateLabel: 'Jul 28, 2026',
      added: 8,
      current: false,
      categories: ['RHEL 9.4 kernel panics', 'New OOM variants'],
      patterns: [
        'RHEL 9.4 kernel NULL pointer dereference in nf_conntrack',
        'RHEL 9.4 kernel BUG in slab allocator',
        'RHEL 9.4 kernel softlockup in virtio_net',
        'RHEL 9.4 kernel RCU stall on NUMA node',
        'OOM killer invoked by cgroup memory.max',
        'OOM killer triggered by tmpfs exhaustion',
        'OOM reaper stuck on locked pages',
        'OOM cascading kill in container namespace'
      ]
    },
    {
      version: 435,
      date: '2026-07-15',
      dateLabel: 'Jul 15, 2026',
      added: 15,
      current: false,
      categories: ['VMware 8.0u3 migration', 'vSAN health'],
      patterns: [
        'VMware 8.0u3 vMotion stun time exceeded',
        'VMware 8.0u3 migration pre-check failure',
        'VMware 8.0u3 EVC mode incompatibility',
        'VMware 8.0u3 snapshot consolidation hang',
        'VMware 8.0u3 CBRC digest mismatch',
        'VMware 8.0u3 DVS port binding error',
        'VMware 8.0u3 VMFS heartbeat loss',
        'VMware 8.0u3 host isolation response',
        'vSAN health: disk group decommission stall',
        'vSAN health: object compliance failure',
        'vSAN health: witness partition detected',
        'vSAN health: encryption KMS unreachable',
        'vSAN health: stretched cluster split-brain',
        'vSAN health: capacity imbalance critical',
        'vSAN health: resync throttling deadlock'
      ]
    },
    {
      version: 420,
      date: '2026-07-01',
      dateLabel: 'Jul 1, 2026',
      added: 20,
      current: false,
      categories: ['Storage multipath improvements'],
      patterns: [
        'DM-Multipath path failover timeout',
        'DM-Multipath all paths down',
        'DM-Multipath ghost path detected',
        'DM-Multipath queue_if_no_path overload',
        'PowerPath dead path recovery loop',
        'PowerPath license validation failure',
        'HPE 3PAR ALUA state transition',
        'HPE 3PAR port failover incomplete',
        'NetApp ONTAP LIF migration failure',
        'NetApp ONTAP aggregate offline',
        'Pure Storage multipath priority conflict',
        'Pure Storage replication lag critical',
        'iSCSI session timeout on initiator',
        'iSCSI login redirect loop',
        'FC RSCN fabric notification storm',
        'FC zone merge conflict',
        'NVMe-oF path error recovery',
        'NVMe-oF controller reset triggered',
        'SAN switch ISL congestion detected',
        'SAN switch zone database inconsistency'
      ]
    },
    {
      version: 400,
      date: '2026-06-15',
      dateLabel: 'Jun 15, 2026',
      added: 400,
      current: false,
      categories: ['Initial pattern set'],
      patterns: []
    }
  ];

  const TOTAL_SIGNATURES = 675;
  const CURRENT_VERSION = 675;
  const LATEST_VERSION = 675;
  const LAST_UPDATED = '2026-08-08';
  const NEXT_UPDATE_DATE = new Date('2026-09-08');
  const AUTO_UPDATE_KEY = 'logsherlock_auto_update_enabled';

  // ─── Utility Functions ─────────────────────────────────────────────────────────

  function getAutoUpdateEnabled() {
    try {
      const stored = localStorage.getItem(AUTO_UPDATE_KEY);
      return stored === null ? true : stored === 'true';
    } catch (e) {
      return true;
    }
  }

  function setAutoUpdateEnabled(enabled) {
    try {
      localStorage.setItem(AUTO_UPDATE_KEY, String(enabled));
    } catch (e) { /* localStorage unavailable */ }
  }

  function getDaysUntilNextUpdate() {
    const now = new Date();
    const diff = NEXT_UPDATE_DATE - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── Styles ────────────────────────────────────────────────────────────────────

  function getStyles() {
    return `
      .lsp-updates-panel {
        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
        background: #1e1e2e;
        color: #e0e0e0;
        padding: 28px;
        border-radius: 12px;
        max-width: 720px;
        margin: 0 auto;
        box-sizing: border-box;
      }
      .lsp-updates-panel * { box-sizing: border-box; }

      .lsp-updates-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 20px;
      }
      .lsp-updates-title {
        font-size: 22px;
        font-weight: 700;
        color: #ffffff;
        margin: 0;
      }
      .lsp-version-badge {
        background: linear-gradient(135deg, #01a982, #00875a);
        color: #ffffff;
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.3px;
      }

      .lsp-status-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 20px;
        padding: 14px 18px;
        background: #2a2a3e;
        border-radius: 8px;
        border-left: 3px solid #01a982;
      }
      .lsp-status-compare {
        font-size: 14px;
        color: #b0b0c0;
      }
      .lsp-status-compare .lsp-uptodate {
        color: #01a982;
        font-weight: 600;
      }
      .lsp-status-subscription {
        font-size: 12px;
        color: #8888a0;
        margin-top: 4px;
      }
      .lsp-last-updated {
        font-size: 12px;
        color: #8888a0;
      }

      .lsp-actions-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 14px;
        margin-bottom: 24px;
      }
      .lsp-check-btn {
        background: #01a982;
        color: #ffffff;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: background 0.2s, transform 0.1s;
      }
      .lsp-check-btn:hover { background: #00875a; transform: translateY(-1px); }
      .lsp-check-btn:active { transform: translateY(0); }
      .lsp-check-btn:disabled { opacity: 0.6; cursor: not-allowed; }

      .lsp-spinner {
        display: none;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: lsp-spin 0.7s linear infinite;
      }
      .lsp-spinner.active { display: inline-block; }
      @keyframes lsp-spin {
        to { transform: rotate(360deg); }
      }

      .lsp-auto-toggle {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
        color: #b0b0c0;
      }
      .lsp-toggle-switch {
        position: relative;
        width: 40px;
        height: 22px;
        background: #3a3a50;
        border-radius: 11px;
        cursor: pointer;
        transition: background 0.2s;
      }
      .lsp-toggle-switch.on { background: #01a982; }
      .lsp-toggle-switch::after {
        content: '';
        position: absolute;
        top: 3px;
        left: 3px;
        width: 16px;
        height: 16px;
        background: #ffffff;
        border-radius: 50%;
        transition: transform 0.2s;
      }
      .lsp-toggle-switch.on::after { transform: translateX(18px); }

      .lsp-countdown {
        font-size: 12px;
        color: #8888a0;
        text-align: right;
      }
      .lsp-countdown-value {
        color: #01a982;
        font-weight: 600;
      }

      .lsp-highlight-card {
        background: #2a2a3e;
        border: 1px solid #01a98233;
        border-radius: 10px;
        padding: 18px;
        margin-bottom: 24px;
      }
      .lsp-highlight-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      }
      .lsp-highlight-title {
        font-size: 15px;
        font-weight: 600;
        color: #01a982;
      }
      .lsp-highlight-count {
        background: #01a98222;
        color: #01a982;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
      }
      .lsp-highlight-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 16px;
      }
      .lsp-highlight-list li {
        font-size: 12px;
        color: #c0c0d0;
        padding: 3px 0;
        border-bottom: 1px solid #3a3a50;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .lsp-highlight-list li::before {
        content: '+ ';
        color: #01a982;
        font-weight: 700;
      }

      .lsp-timeline {
        position: relative;
        padding-left: 28px;
      }
      .lsp-timeline::before {
        content: '';
        position: absolute;
        left: 8px;
        top: 6px;
        bottom: 6px;
        width: 2px;
        background: #01a982;
        border-radius: 1px;
      }
      .lsp-timeline-item {
        position: relative;
        margin-bottom: 22px;
        padding: 14px 16px;
        background: #2a2a3e;
        border-radius: 8px;
        border: 1px solid #3a3a50;
        transition: border-color 0.2s;
      }
      .lsp-timeline-item:hover { border-color: #01a98266; }
      .lsp-timeline-item.current { border-color: #01a982; }
      .lsp-timeline-item::before {
        content: '';
        position: absolute;
        left: -24px;
        top: 18px;
        width: 12px;
        height: 12px;
        background: #1e1e2e;
        border: 2px solid #01a982;
        border-radius: 50%;
      }
      .lsp-timeline-item.current::before {
        background: #01a982;
        box-shadow: 0 0 8px #01a98266;
      }
      .lsp-timeline-item-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 6px;
      }
      .lsp-timeline-version {
        font-size: 14px;
        font-weight: 700;
        color: #ffffff;
      }
      .lsp-timeline-date {
        font-size: 12px;
        color: #8888a0;
      }
      .lsp-timeline-current-tag {
        background: #01a982;
        color: #ffffff;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .lsp-timeline-added {
        font-size: 13px;
        color: #01a982;
        font-weight: 600;
        margin-bottom: 4px;
      }
      .lsp-timeline-categories {
        font-size: 12px;
        color: #b0b0c0;
      }
      .lsp-timeline-cat-tag {
        display: inline-block;
        background: #3a3a50;
        padding: 2px 8px;
        border-radius: 4px;
        margin-right: 6px;
        margin-top: 4px;
        font-size: 11px;
        color: #c0c0d0;
      }

      .lsp-section-title {
        font-size: 16px;
        font-weight: 600;
        color: #ffffff;
        margin-bottom: 16px;
        padding-bottom: 8px;
        border-bottom: 1px solid #3a3a50;
      }

      .lsp-update-result {
        display: none;
        padding: 10px 14px;
        margin-bottom: 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
      }
      .lsp-update-result.show { display: block; }
      .lsp-update-result.success {
        background: #01a98218;
        color: #01a982;
        border: 1px solid #01a98244;
      }
    `;
  }

  // ─── Render Functions ──────────────────────────────────────────────────────────

  function renderPatternUpdatesPanel() {
    const autoUpdateOn = getAutoUpdateEnabled();
    const daysUntil = getDaysUntilNextUpdate();
    const newestPatterns = PATTERN_UPDATES[0].patterns;

    let html = `<style>${getStyles()}</style>`;
    html += `<div class="lsp-updates-panel" id="lsp-updates-panel">`;

    // Header
    html += `
      <div class="lsp-updates-header">
        <h2 class="lsp-updates-title">🛡️ Pattern Updates</h2>
        <span class="lsp-version-badge">Pattern DB v${CURRENT_VERSION} — ${TOTAL_SIGNATURES} signatures</span>
      </div>
    `;

    // Status row
    html += `
      <div class="lsp-status-row">
        <div>
          <div class="lsp-status-compare">
            Your version: <strong>v${CURRENT_VERSION}</strong> | Latest: <strong>v${LATEST_VERSION}</strong>
            <span class="lsp-uptodate"> ✅ Up to date</span>
          </div>
          <div class="lsp-status-subscription">Active — Pattern updates included with your license</div>
        </div>
        <div class="lsp-last-updated">Last updated: ${LAST_UPDATED}</div>
      </div>
    `;

    // Update result message (hidden by default)
    html += `<div class="lsp-update-result" id="lsp-update-result"></div>`;

    // Actions row
    html += `
      <div class="lsp-actions-row">
        <button class="lsp-check-btn" id="lsp-check-btn" onclick="window.__lspCheckForUpdates()">
          <span class="lsp-spinner" id="lsp-spinner"></span>
          <span id="lsp-check-label">Check for Updates</span>
        </button>
        <div class="lsp-auto-toggle">
          <div class="lsp-toggle-switch ${autoUpdateOn ? 'on' : ''}" id="lsp-auto-toggle" onclick="window.__lspToggleAutoUpdate()" role="switch" aria-checked="${autoUpdateOn}" aria-label="Auto-update toggle" tabindex="0"></div>
          <span>Auto-update enabled</span>
        </div>
        <div class="lsp-countdown">
          Next update in <span class="lsp-countdown-value">${daysUntil} days</span>
        </div>
      </div>
    `;

    // New patterns this month highlight card
    html += `
      <div class="lsp-highlight-card">
        <div class="lsp-highlight-header">
          <span class="lsp-highlight-title">🆕 New Patterns This Month</span>
          <span class="lsp-highlight-count">${newestPatterns.length} patterns</span>
        </div>
        <ul class="lsp-highlight-list">
          ${newestPatterns.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
        </ul>
      </div>
    `;

    // Timeline section
    html += `<div class="lsp-section-title">📜 Update History</div>`;
    html += `<div class="lsp-timeline">`;

    for (const update of PATTERN_UPDATES) {
      const isCurrent = update.current;
      html += `
        <div class="lsp-timeline-item ${isCurrent ? 'current' : ''}">
          <div class="lsp-timeline-item-header">
            <span class="lsp-timeline-version">v${update.version}</span>
            <span class="lsp-timeline-date">${update.dateLabel}</span>
            ${isCurrent ? '<span class="lsp-timeline-current-tag">Current</span>' : ''}
          </div>
          <div class="lsp-timeline-added">+${update.added} patterns</div>
          <div class="lsp-timeline-categories">
            ${update.categories.map(c => `<span class="lsp-timeline-cat-tag">${escapeHtml(c)}</span>`).join('')}
          </div>
        </div>
      `;
    }

    html += `</div>`; // .lsp-timeline
    html += `</div>`; // .lsp-updates-panel

    return html;
  }

  // ─── Check for Updates (Simulated) ─────────────────────────────────────────────

  function checkForUpdates() {
    return new Promise((resolve) => {
      const btn = document.getElementById('lsp-check-btn');
      const spinner = document.getElementById('lsp-spinner');
      const label = document.getElementById('lsp-check-label');
      const result = document.getElementById('lsp-update-result');

      if (btn) btn.disabled = true;
      if (spinner) spinner.classList.add('active');
      if (label) label.textContent = 'Checking...';
      if (result) { result.classList.remove('show'); }

      // Simulate network delay
      setTimeout(() => {
        if (spinner) spinner.classList.remove('active');
        if (label) label.textContent = 'Check for Updates';
        if (btn) btn.disabled = false;

        if (result) {
          result.textContent = '✅ Pattern database is up to date. v675 — 675 signatures loaded.';
          result.className = 'lsp-update-result show success';
        }

        resolve({
          upToDate: true,
          currentVersion: CURRENT_VERSION,
          latestVersion: LATEST_VERSION,
          totalSignatures: TOTAL_SIGNATURES,
          message: 'Pattern database is up to date.'
        });
      }, 2200);
    });
  }

  // ─── Get Pattern Version Info ──────────────────────────────────────────────────

  function getPatternVersion() {
    return {
      currentVersion: CURRENT_VERSION,
      latestVersion: LATEST_VERSION,
      totalSignatures: TOTAL_SIGNATURES,
      lastUpdated: LAST_UPDATED,
      isUpToDate: CURRENT_VERSION >= LATEST_VERSION,
      autoUpdateEnabled: getAutoUpdateEnabled(),
      daysUntilNextUpdate: getDaysUntilNextUpdate(),
      subscriptionStatus: 'Active',
      updateHistory: PATTERN_UPDATES.map(u => ({
        version: u.version,
        date: u.date,
        added: u.added,
        categories: u.categories
      }))
    };
  }

  // ─── Toggle Auto-Update ────────────────────────────────────────────────────────

  function toggleAutoUpdate() {
    const toggle = document.getElementById('lsp-auto-toggle');
    const current = getAutoUpdateEnabled();
    const next = !current;
    setAutoUpdateEnabled(next);
    if (toggle) {
      toggle.classList.toggle('on', next);
      toggle.setAttribute('aria-checked', String(next));
    }
  }

  // ─── Expose to Window for DOM Events ───────────────────────────────────────────

  window.__lspCheckForUpdates = checkForUpdates;
  window.__lspToggleAutoUpdate = toggleAutoUpdate;

  // ─── Self-Initialize on DOMContentLoaded ───────────────────────────────────────

  function init() {
    // If a container with id 'pattern-updates-root' exists, render into it
    let root = document.getElementById('pattern-updates-root');
    if (!root) {
      // Create a root container and append to body
      root = document.createElement('div');
      root.id = 'pattern-updates-root';
      document.body.appendChild(root);
    }
    root.innerHTML = renderPatternUpdatesPanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─── Detection Patterns (Regex-based) ─────────────────────────────────────────
  // These patterns are used by the log analysis engine for real-time detection.
  // Each pattern has: name, regex, severity, category, description, resolution

  const DETECTION_PATTERNS = [
    // ═══════════════════════════════════════════════════════════════════════════════
    // HPE VME / Server Hardware (30 patterns)
    // ═══════════════════════════════════════════════════════════════════════════════
    { name: 'iLO Connectivity Failure - Connection Refused', regex: /ilo.*(connection refused|unable to connect|EHOSTUNREACH)/i, severity: 'HIGH', category: 'HPE Server Hardware', description: 'iLO management interface is unreachable or refusing connections', resolution: 'Check iLO network cable, verify iLO IP configuration, reset iLO via physical button or HPONCFG' },
    { name: 'iLO Connectivity Failure - SSL Handshake Timeout', regex: /ilo.*(ssl|tls).*(handshake|timeout|certificate)/i, severity: 'HIGH', category: 'HPE Server Hardware', description: 'iLO SSL/TLS handshake failing, possible certificate or firmware issue', resolution: 'Regenerate iLO SSL certificate, update iLO firmware, check TLS version compatibility' },
    { name: 'iLO Authentication Expired', regex: /ilo.*(auth|session|token).*(expir|invalid|denied)/i, severity: 'MEDIUM', category: 'HPE Server Hardware', description: 'iLO authentication credentials have expired or are invalid', resolution: 'Reset iLO credentials, check directory service integration, verify LDAP/AD connectivity' },
    { name: 'Thermal Warning - CPU Zone', regex: /(thermal|temperature).*(cpu|processor).*(exceed|critical|warning|threshold)/i, severity: 'HIGH', category: 'HPE Server Hardware', description: 'CPU zone temperature has exceeded safe operating threshold', resolution: 'Check datacenter cooling, verify fan operation, clean dust from heatsinks, check thermal paste' },
    { name: 'Thermal Warning - Ambient Critical', regex: /(ambient|inlet).*(temperature|thermal).*(critical|high|exceed)/i, severity: 'HIGH', category: 'HPE Server Hardware', description: 'Ambient/inlet temperature is critically high', resolution: 'Check CRAC units, verify hot/cold aisle containment, reduce workload temporarily' },
    { name: 'Thermal Warning - Exhaust Rising', regex: /(exhaust|outlet).*(temperature|thermal).*(rising|increasing|warning)/i, severity: 'MEDIUM', category: 'HPE Server Hardware', description: 'Exhaust temperature is rising indicating potential cooling issue', resolution: 'Inspect airflow obstructions, verify fan speeds, check for blanking panels' },
    { name: 'Fan Failure - Module Degraded', regex: /fan.*(module|unit).*(degrad|fail|fault|error)/i, severity: 'HIGH', category: 'HPE Server Hardware', description: 'Fan module has degraded or partially failed', resolution: 'Replace fan module, check fan connector seating, verify redundant fans operational' },
    { name: 'Fan Failure - Rotor Locked', regex: /fan.*(rotor|blade|spin).*(lock|stuck|stall|stop)/i, severity: 'CRITICAL', category: 'HPE Server Hardware', description: 'Fan rotor is locked or not spinning', resolution: 'Immediately replace failed fan module to prevent thermal shutdown' },
    { name: 'Fan Failure - Redundancy Lost', regex: /fan.*(redundan).*(lost|fail|degrad)/i, severity: 'HIGH', category: 'HPE Server Hardware', description: 'Fan redundancy has been lost, single point of failure exists', resolution: 'Replace failed fan immediately, schedule maintenance window if needed' },
    { name: 'PSU Degradation - Efficiency Drop', regex: /psu|power supply.*(efficien|degrad|performance).*(drop|decreas|low)/i, severity: 'MEDIUM', category: 'HPE Server Hardware', description: 'Power supply efficiency has dropped below expected levels', resolution: 'Monitor PSU health metrics, plan replacement during next maintenance window' },
    { name: 'PSU Degradation - Capacitor Aging', regex: /psu|power supply.*(capacitor|aging|wear|life)/i, severity: 'MEDIUM', category: 'HPE Server Hardware', description: 'Power supply capacitor aging detected via predictive analytics', resolution: 'Schedule PSU replacement before failure, verify redundant PSU is healthy' },
    { name: 'PSU Input Voltage Fluctuation', regex: /psu|power supply.*(input|voltage).*(fluctuat|unstable|spike|sag)/i, severity: 'HIGH', category: 'HPE Server Hardware', description: 'Input voltage to PSU is fluctuating outside normal range', resolution: 'Check UPS health, verify PDU connections, inspect facility power quality' },
    { name: 'PSU Failure - Redundant Supply Offline', regex: /psu|power supply.*(redundan|secondary).*(offline|fail|lost)/i, severity: 'CRITICAL', category: 'HPE Server Hardware', description: 'Redundant power supply has gone offline', resolution: 'Replace failed PSU immediately, verify remaining PSU can handle full load' },
    { name: 'DIMM ECC Error - Correctable Threshold', regex: /(dimm|memory).*(ecc|correctable).*(threshold|exceeded|rate)/i, severity: 'HIGH', category: 'HPE Server Hardware', description: 'Correctable ECC memory errors have exceeded threshold', resolution: 'Schedule DIMM replacement, run memory diagnostics, check DIMM seating' },
    { name: 'DIMM Error - Uncorrectable Multi-bit', regex: /(dimm|memory).*(uncorrectable|multi.?bit|uce|fatal)/i, severity: 'CRITICAL', category: 'HPE Server Hardware', description: 'Uncorrectable multi-bit memory error detected', resolution: 'Replace affected DIMM immediately, system may need restart, check for data corruption' },
    { name: 'DIMM Memory Training Failure', regex: /(dimm|memory).*(training|init).*(fail|error|unable)/i, severity: 'CRITICAL', category: 'HPE Server Hardware', description: 'Memory training failed during boot, DIMM may be defective', resolution: 'Reseat DIMM, try different slot, replace DIMM if persistent, update system BIOS' },
    { name: 'DIMM Memory Mirroring Failover', regex: /(memory|dimm).*(mirror).*(failover|activated|triggered)/i, severity: 'HIGH', category: 'HPE Server Hardware', description: 'Memory mirroring failover activated due to primary DIMM error', resolution: 'Replace failed mirrored DIMM, restore mirror protection during maintenance' },
    { name: 'PCIe Bus Error - Correctable', regex: /pcie|pci express.*(correctable|advisory|non.?fatal)/i, severity: 'LOW', category: 'HPE Server Hardware', description: 'PCIe correctable error detected, usually informational', resolution: 'Monitor error rate, update device firmware if errors increase' },
    { name: 'PCIe Bus Error - Uncorrectable Fatal', regex: /pcie|pci express.*(uncorrectable|fatal|acs violation)/i, severity: 'CRITICAL', category: 'HPE Server Hardware', description: 'PCIe uncorrectable fatal error, device may be unusable', resolution: 'Reseat PCIe card, check slot for damage, replace card, update firmware' },
    { name: 'PCIe Link Degraded', regex: /pcie|pci express.*(link).*(degrad|width|speed).*(reduced|lower|downgrade)/i, severity: 'MEDIUM', category: 'HPE Server Hardware', description: 'PCIe link operating at reduced width or speed', resolution: 'Reseat card, inspect slot contacts, check for BIOS settings limiting link speed' },
    { name: 'RAID Controller - Cache Battery Low', regex: /raid.*(cache|battery|capacitor).*(low|fail|degrad)/i, severity: 'HIGH', category: 'HPE Server Hardware', description: 'RAID controller cache battery/capacitor is low or degraded', resolution: 'Replace RAID controller battery, FBWC capacitor pack, cache may be disabled' },
    { name: 'RAID Controller - Write-Back Disabled', regex: /raid.*(write.?back|cache).*(disable|bypass|through)/i, severity: 'MEDIUM', category: 'HPE Server Hardware', description: 'RAID write-back cache disabled, performance degraded', resolution: 'Resolve battery/capacitor issue to re-enable write-back cache' },
    { name: 'RAID Logical Drive Degraded', regex: /raid.*(logical|array|volume).*(degrad|rebuild|fail)/i, severity: 'CRITICAL', category: 'HPE Server Hardware', description: 'RAID logical drive is degraded, rebuild may be in progress', resolution: 'Identify and replace failed disk, monitor rebuild progress, do not reboot during rebuild' },
    { name: 'Drive Predictive Failure - SMART', regex: /(smart|predictive).*(threshold|failure|alert).*(exceeded|imminent|warning)/i, severity: 'HIGH', category: 'HPE Server Hardware', description: 'Drive SMART attributes indicate imminent failure', resolution: 'Replace drive proactively, initiate rebuild before complete failure' },
    { name: 'Drive Reallocated Sectors Critical', regex: /(reallocat|remap).*(sector|block).*(critical|exceed|high)/i, severity: 'HIGH', category: 'HPE Server Hardware', description: 'Drive has critically high reallocated sector count', resolution: 'Schedule immediate drive replacement, backup data if not redundant' },
    { name: 'Firmware Mismatch - iLO/ROM', regex: /(firmware|bios).*(mismatch|incompatib|version).*(ilo|rom|system)/i, severity: 'MEDIUM', category: 'HPE Server Hardware', description: 'Firmware version mismatch between iLO and system ROM', resolution: 'Update firmware using SPP (Service Pack for ProLiant), follow recommended update order' },
    { name: 'Firmware Mismatch - NIC Downlevel', regex: /(firmware|nic|adapter).*(downlevel|outdated|mismatch|incompatible)/i, severity: 'MEDIUM', category: 'HPE Server Hardware', description: 'Network adapter firmware is downlevel or incompatible', resolution: 'Update NIC firmware via SPP or vendor tools, verify driver compatibility' },
    { name: 'BMC Communication Loss', regex: /(bmc|ipmi|baseboard).*(communication|heartbeat|connection).*(lost|timeout|fail)/i, severity: 'HIGH', category: 'HPE Server Hardware', description: 'BMC/IPMI communication lost, out-of-band management unavailable', resolution: 'Reset BMC via chassis power cycle, check dedicated management NIC, update BMC firmware' },
    { name: 'NMI Hardware Watchdog', regex: /(nmi|non.?maskable).*(interrupt|watchdog|hardware).*(trigger|fired|assert)/i, severity: 'CRITICAL', category: 'HPE Server Hardware', description: 'Non-maskable interrupt triggered, possible hardware lockup', resolution: 'Collect crash dump, check hardware event logs, inspect for failing components' },
    { name: 'Machine Check Exception', regex: /(machine check|mce|mca).*(exception|error|fatal|uncorrected)/i, severity: 'CRITICAL', category: 'HPE Server Hardware', description: 'CPU machine check exception detected, possible hardware fault', resolution: 'Decode MCE error code, check CPU/memory/chipset health, may require motherboard replacement' },
    { name: 'Smart Array Cache Failure', regex: /(smart array|fbwc|flash.?backed).*(cache|write).*(fail|disabled|lost)/i, severity: 'HIGH', category: 'HPE Server Hardware', description: 'Smart Array flash-backed write cache failure', resolution: 'Replace FBWC module, check capacitor pack health, data in cache may be at risk' },
    { name: 'NVDIMM Backup Failure', regex: /(nvdimm|persistent memory).*(backup|energy|save).*(fail|deplet|error)/i, severity: 'CRITICAL', category: 'HPE Server Hardware', description: 'NVDIMM backup energy source depleted or backup failed', resolution: 'Replace NVDIMM battery/energy source, data persistence at risk' },
    { name: 'NVDIMM Persistence Lost', regex: /(nvdimm|persistent memory).*(persist|data).*(lost|corrupt|fail)/i, severity: 'CRITICAL', category: 'HPE Server Hardware', description: 'NVDIMM persistence lost, data may not survive power cycle', resolution: 'Investigate energy source, verify NVDIMM health, backup data immediately' },
    { name: 'TPM Self-Test Failure', regex: /tpm.*(self.?test|diagnostic|init).*(fail|error)/i, severity: 'HIGH', category: 'HPE Server Hardware', description: 'TPM module self-test failed, security functions may be unavailable', resolution: 'Clear TPM ownership and reinitialize, update TPM firmware, replace if persistent' },
    { name: 'TPM PCR Measurement Mismatch', regex: /tpm.*(pcr|measurement|integrity).*(mismatch|unexpected|changed)/i, severity: 'HIGH', category: 'HPE Server Hardware', description: 'TPM PCR measurements do not match expected values', resolution: 'Investigate boot chain changes, re-seal keys after verified changes, check for tampering' },
  ];

  // ═══════════════════════════════════════════════════════════════════════════════
  // Linux System (30 patterns)
  // ═══════════════════════════════════════════════════════════════════════════════
  const DETECTION_PATTERNS_LINUX = [
    { name: 'Kernel Panic - VFS Mount Failure', regex: /kernel panic.*(not syncing|vfs|unable to mount root)/i, severity: 'CRITICAL', category: 'Linux System', description: 'Kernel panic due to VFS unable to mount root filesystem', resolution: 'Check root filesystem integrity, verify initramfs, check boot parameters and disk connectivity' },
    { name: 'Kernel Panic - Fatal Exception', regex: /kernel panic.*(fatal exception|in interrupt|double fault)/i, severity: 'CRITICAL', category: 'Linux System', description: 'Kernel panic due to fatal exception', resolution: 'Collect vmcore dump, analyze with crash tool, check for kernel bug or hardware fault' },
    { name: 'Kernel Panic - Kill Init', regex: /kernel panic.*(attempted to kill init|pid 1)/i, severity: 'CRITICAL', category: 'Linux System', description: 'Init process (PID 1) was killed causing kernel panic', resolution: 'Check systemd/init corruption, verify root filesystem, boot into rescue mode' },
    { name: 'Softlockup Detected', regex: /soft\s*lockup.*(cpu|stuck|bug)/i, severity: 'CRITICAL', category: 'Linux System', description: 'CPU soft lockup detected, task stuck without scheduling', resolution: 'Check for runaway kernel threads, verify interrupt handling, update kernel, check hardware' },
    { name: 'Softlockup Watchdog', regex: /watchdog.*(soft lockup|bug.*lockup)/i, severity: 'CRITICAL', category: 'Linux System', description: 'Watchdog detected CPU soft lockup', resolution: 'Analyze stacktrace, check for kernel module bugs, verify no IRQ storms' },
    { name: 'RCU Stall Detected', regex: /rcu.*(stall|detected on cpu)/i, severity: 'HIGH', category: 'Linux System', description: 'RCU grace period stall detected on CPU', resolution: 'Check for long-running kernel operations, verify no spinlock deadlocks, update kernel' },
    { name: 'RCU Grace Period Not Ending', regex: /rcu.*(grace period|not ending|stuck)/i, severity: 'HIGH', category: 'Linux System', description: 'RCU grace period not completing, potential kernel deadlock', resolution: 'Check CPU affinity settings, verify no CPU isolation issues, analyze kernel threads' },
    { name: 'Hung Task Detected', regex: /hung_task|task .* blocked for more than \d+ seconds/i, severity: 'HIGH', category: 'Linux System', description: 'Task has been blocked for extended period, possible IO hang', resolution: 'Check storage subsystem health, verify filesystem state, check for deadlocked processes' },
    { name: 'Hung Task IO Wait', regex: /(hung|blocked).*(io|wait|unresponsive).*task/i, severity: 'HIGH', category: 'Linux System', description: 'Task stuck in IO wait state', resolution: 'Check disk health, verify multipath state, check for storage controller issues' },
    { name: 'BUG: NULL Pointer Dereference', regex: /bug.*unable to handle.*null pointer dereference/i, severity: 'CRITICAL', category: 'Linux System', description: 'Kernel NULL pointer dereference bug', resolution: 'Collect crash dump, identify faulting module, update or remove buggy kernel module' },
    { name: 'BUG: Scheduling While Atomic', regex: /bug.*scheduling while atomic/i, severity: 'HIGH', category: 'Linux System', description: 'Kernel attempted to schedule while in atomic context', resolution: 'Identify faulting kernel module, report kernel bug, update kernel' },
    { name: 'BUG: Workqueue Lockup', regex: /bug.*(workqueue|worker).*(lockup|stuck|hung)/i, severity: 'HIGH', category: 'Linux System', description: 'Kernel workqueue lockup detected', resolution: 'Identify stuck work items, check for dependent subsystem failures' },
    { name: 'OOM Killer Invoked', regex: /out of memory|oom.?killer|invoked oom/i, severity: 'CRITICAL', category: 'Linux System', description: 'OOM killer invoked to free memory', resolution: 'Increase memory/swap, tune vm.overcommit settings, identify memory-leaking process, set cgroup limits' },
    { name: 'OOM Cgroup Limit', regex: /memory\.max|cgroup.*(oom|memory).*(limit|exceeded)/i, severity: 'HIGH', category: 'Linux System', description: 'Cgroup memory limit exceeded triggering OOM', resolution: 'Increase cgroup memory limit, optimize application memory usage, add swap' },
    { name: 'OOM Total-VM Limit', regex: /total.?vm.*limit|oom.*total.*vm/i, severity: 'HIGH', category: 'Linux System', description: 'Process total virtual memory limit reached', resolution: 'Increase ulimits, tune overcommit_memory, investigate memory leak' },
    { name: 'ext4 Remounted Read-Only', regex: /ext4.*(remount|mount).*(read.?only|ro)|ext4.*error.*remounting/i, severity: 'CRITICAL', category: 'Linux System', description: 'ext4 filesystem remounted read-only due to errors', resolution: 'Run fsck in rescue mode, check disk health, verify journal integrity' },
    { name: 'ext4 Journal IO Error', regex: /ext4.*(journal|jbd2).*(io error|commit|abort)/i, severity: 'CRITICAL', category: 'Linux System', description: 'ext4 journal commit IO error, filesystem may be corrupted', resolution: 'Check underlying disk, run e2fsck, consider filesystem rebuild' },
    { name: 'ext4 Inode Checksum Invalid', regex: /ext4.*(inode|checksum).*(invalid|mismatch|corrupt)/i, severity: 'HIGH', category: 'Linux System', description: 'ext4 inode checksum validation failed', resolution: 'Run e2fsck with -f flag, check disk for bad sectors, restore from backup if needed' },
    { name: 'XFS Metadata IO Error', regex: /xfs.*(metadata|meta).*(io error|write|read).*(error|fail)/i, severity: 'CRITICAL', category: 'Linux System', description: 'XFS metadata IO error detected', resolution: 'Run xfs_repair, check disk health, verify storage path connectivity' },
    { name: 'XFS Log Recovery Failed', regex: /xfs.*(log|journal).*(recovery|replay).*(fail|error|corrupt)/i, severity: 'CRITICAL', category: 'Linux System', description: 'XFS log recovery failed during mount', resolution: 'Run xfs_repair -L (caution: data loss), check for disk errors, restore from backup' },
    { name: 'XFS Directory Corruption', regex: /xfs.*(directory|dir).*(corrupt|error|invalid)/i, severity: 'HIGH', category: 'Linux System', description: 'XFS directory corruption detected', resolution: 'Run xfs_repair, check affected directories, restore from backup' },
    { name: 'BTRFS Checksum Failure', regex: /btrfs.*(checksum|csum).*(fail|mismatch|error)/i, severity: 'HIGH', category: 'Linux System', description: 'BTRFS data checksum verification failed', resolution: 'Run btrfs scrub, check disk health, replace disk if errors persist' },
    { name: 'BTRFS Mirror Read Failed', regex: /btrfs.*(mirror|copy).*(read|fail|error)/i, severity: 'HIGH', category: 'Linux System', description: 'BTRFS mirror read failed, data redundancy compromised', resolution: 'Run btrfs device stats, replace failing device, rebalance' },
    { name: 'LVM Insufficient Free Extents', regex: /lvm.*(insufficient|not enough).*(free|extent|space)/i, severity: 'HIGH', category: 'Linux System', description: 'LVM volume group has insufficient free extents', resolution: 'Extend VG with new PV, reduce other LVs, or expand physical storage' },
    { name: 'LVM PV Missing', regex: /lvm.*(pv|physical volume).*(missing|not found|lost)/i, severity: 'CRITICAL', category: 'Linux System', description: 'LVM physical volume missing from volume group', resolution: 'Check disk connectivity, rescan SCSI bus, vgreduce --removemissing if disk is permanently lost' },
    { name: 'LVM Thin Pool Metadata Full', regex: /lvm.*(thin|pool).*(metadata|meta).*(full|space|exhausted)/i, severity: 'CRITICAL', category: 'Linux System', description: 'LVM thin pool metadata space exhausted', resolution: 'Extend thin pool metadata LV immediately, delete unnecessary snapshots' },
    { name: 'Systemd Unit Failed', regex: /systemd.*(unit|service).*(fail|entered failed state)/i, severity: 'MEDIUM', category: 'Linux System', description: 'Systemd unit entered failed state', resolution: 'Check journalctl -u <unit>, fix configuration, systemctl reset-failed and restart' },
    { name: 'Systemd Start Rate Limit', regex: /systemd.*(start.?request|rate).*(repeated|limit|too quickly)/i, severity: 'MEDIUM', category: 'Linux System', description: 'Service restart rate limit hit, service crashing repeatedly', resolution: 'Investigate service crash cause via logs, check dependencies, fix root cause before restart' },
    { name: 'Systemd Dependency Failed', regex: /systemd.*(dependency|required).*(fail|unmet)/i, severity: 'MEDIUM', category: 'Linux System', description: 'Systemd unit failed due to dependency failure', resolution: 'Identify and fix the dependency unit first, check unit ordering' },
    { name: 'Cgroup OOM Kill', regex: /cgroup.*(oom|memory\.max|killed)|(memory\.max).*(exceeded)/i, severity: 'HIGH', category: 'Linux System', description: 'Process killed by cgroup memory limit enforcement', resolution: 'Increase cgroup memory limit, optimize application, investigate memory leak' },
    { name: 'NUMA Imbalance', regex: /numa.*(imbalance|remote|access).*(excessive|high|penalty)/i, severity: 'MEDIUM', category: 'Linux System', description: 'Excessive cross-NUMA memory access detected', resolution: 'Pin processes to NUMA nodes, use numactl, optimize memory allocation' },
    { name: 'CPU Thermal Throttling', regex: /cpu.*(thermal|throttl).*(activated|engaged|limiting)/i, severity: 'HIGH', category: 'Linux System', description: 'CPU thermal throttling activated', resolution: 'Check cooling system, clean heatsinks, verify fan operation, reduce workload' },
    { name: 'CPU Power Limit Throttling', regex: /cpu.*(power limit|tdp).*(throttl|notification|capped)/i, severity: 'MEDIUM', category: 'Linux System', description: 'CPU power limit throttling engaged', resolution: 'Check power configuration, verify PSU capacity, adjust power capping policy' },
    { name: 'Auditd Backlog Overflow', regex: /audit.*(backlog|buffer).*(limit|exceeded|overflow|full)/i, severity: 'MEDIUM', category: 'Linux System', description: 'Audit system backlog limit exceeded, events may be lost', resolution: 'Increase audit_backlog_limit, tune audit rules to reduce volume, check auditd performance' },
    { name: 'SELinux Denial', regex: /selinux.*(denied|avc)|avc:\s*denied/i, severity: 'MEDIUM', category: 'Linux System', description: 'SELinux access vector cache denial', resolution: 'Analyze with audit2why, create custom policy module if needed, check file contexts' },
    { name: 'SELinux Context Mismatch', regex: /selinux.*(context|label).*(mismatch|incorrect|wrong)/i, severity: 'MEDIUM', category: 'Linux System', description: 'SELinux context mismatch blocking access', resolution: 'Restore contexts with restorecon -R, check file_contexts definitions' },
    { name: 'AppArmor Denied', regex: /apparmor.*(denied|reject|block)/i, severity: 'MEDIUM', category: 'Linux System', description: 'AppArmor profile blocked an operation', resolution: 'Review AppArmor logs, update profile rules, use aa-logprof to generate fixes' },
    { name: 'AppArmor Profile Load Failure', regex: /apparmor.*(profile).*(fail|error|unable to load)/i, severity: 'MEDIUM', category: 'Linux System', description: 'AppArmor profile failed to load', resolution: 'Check profile syntax with apparmor_parser -p, fix syntax errors' },
    { name: 'Seccomp Violation Kill', regex: /seccomp.*(kill|violation|blocked|bad syscall)/i, severity: 'HIGH', category: 'Linux System', description: 'Seccomp filter killed process for restricted syscall', resolution: 'Review seccomp profile, add required syscall to allowlist if legitimate' },
    { name: 'Seccomp Bad System Call', regex: /(bad system call|seccomp).*(trapped|terminated|signal)/i, severity: 'HIGH', category: 'Linux System', description: 'Process terminated by seccomp bad system call trap', resolution: 'Identify required syscall, update seccomp profile or container security context' },
  ];

  // ═══════════════════════════════════════════════════════════════════════════════
  // Windows System (25 patterns)
  // ═══════════════════════════════════════════════════════════════════════════════
  const DETECTION_PATTERNS_WINDOWS = [
    { name: 'BSOD 0x0000007E', regex: /(0x0000007E|SYSTEM_THREAD_EXCEPTION_NOT_HANDLED)/i, severity: 'CRITICAL', category: 'Windows System', description: 'Blue screen: system thread exception not handled', resolution: 'Identify faulting driver from minidump, update or remove driver, check hardware' },
    { name: 'BSOD 0x0000000A', regex: /(0x0000000A|IRQL_NOT_LESS_OR_EQUAL)/i, severity: 'CRITICAL', category: 'Windows System', description: 'Blue screen: IRQL not less or equal, kernel-mode driver fault', resolution: 'Analyze minidump with WinDbg, identify faulting driver, update drivers' },
    { name: 'BSOD 0x000000D1', regex: /(0x000000D1|DRIVER_IRQL_NOT_LESS_OR_EQUAL)/i, severity: 'CRITICAL', category: 'Windows System', description: 'Blue screen: driver IRQL not less or equal', resolution: 'Update network/storage drivers, check for driver version conflicts' },
    { name: 'BSOD 0x00000050', regex: /(0x00000050|PAGE_FAULT_IN_NONPAGED_AREA)/i, severity: 'CRITICAL', category: 'Windows System', description: 'Blue screen: page fault in non-paged area', resolution: 'Check RAM with memtest, verify disk health, update drivers' },
    { name: 'BSOD 0x0000001E', regex: /(0x0000001E|KMODE_EXCEPTION_NOT_HANDLED)/i, severity: 'CRITICAL', category: 'Windows System', description: 'Blue screen: kernel mode exception not handled', resolution: 'Analyze crash dump, check recently installed drivers or software' },
    { name: 'Minidump Generated', regex: /minidump|dump file.*(written|saved|created).*systemroot/i, severity: 'HIGH', category: 'Windows System', description: 'System crash minidump file generated', resolution: 'Analyze dump with WinDbg or BlueScreenView, identify root cause' },
    { name: 'WMI Repository Corruption', regex: /wmi.*(repository|inconsist|corrupt|rebuild)/i, severity: 'HIGH', category: 'Windows System', description: 'WMI repository corruption detected', resolution: 'Run winmgmt /verifyrepository, rebuild with winmgmt /resetrepository if needed' },
    { name: 'WMI Repository Rebuild Required', regex: /wmi.*(rebuild|reset|repair).*(required|needed)/i, severity: 'HIGH', category: 'Windows System', description: 'WMI repository requires rebuild', resolution: 'Execute winmgmt /resetrepository, recompile MOF files, restart WMI service' },
    { name: 'DCOM Timeout', regex: /dcom.*(timeout|did not register|within the required)/i, severity: 'MEDIUM', category: 'Windows System', description: 'DCOM server did not register within timeout period', resolution: 'Restart affected COM service, check permissions, verify DCOM configuration' },
    { name: 'DCOM Access Denied', regex: /dcom.*(access|permission).*(denied|error).*clsid/i, severity: 'MEDIUM', category: 'Windows System', description: 'DCOM access permission denied for application', resolution: 'Configure DCOM permissions via dcomcnfg, verify user account permissions' },
    { name: 'RPC Server Unavailable', regex: /rpc.*(server|service).*(unavailable|not available)/i, severity: 'HIGH', category: 'Windows System', description: 'RPC server is unavailable', resolution: 'Restart RPC service, check firewall rules for RPC ports, verify network connectivity' },
    { name: 'RPC Endpoint Mapper Failure', regex: /rpc.*(endpoint|mapper).*(no endpoints|fail|error)/i, severity: 'HIGH', category: 'Windows System', description: 'RPC endpoint mapper has no endpoints available', resolution: 'Restart RPC Endpoint Mapper service, check for port exhaustion' },
    { name: 'Cluster Failover Event', regex: /cluster.*(failover|resource group|moved|ownership)/i, severity: 'HIGH', category: 'Windows System', description: 'Cluster resource group failover event', resolution: 'Investigate why node failed, check cluster event logs, validate network connectivity' },
    { name: 'Cluster Node Isolated', regex: /cluster.*(node|member).*(isolat|removed|evict)/i, severity: 'CRITICAL', category: 'Windows System', description: 'Cluster node has been isolated or evicted', resolution: 'Check cluster network, verify heartbeat communication, inspect node health' },
    { name: 'Disk Witness Unavailable', regex: /(disk|file share).*(witness).*(unavail|lost|fail)/i, severity: 'HIGH', category: 'Windows System', description: 'Cluster disk/file share witness is unavailable', resolution: 'Verify witness disk/share accessibility, check network paths, reconfigure witness if needed' },
    { name: 'Quorum Loss', regex: /quorum.*(lost|fail|insufficient|unable)/i, severity: 'CRITICAL', category: 'Windows System', description: 'Cluster quorum has been lost', resolution: 'Restore majority of nodes, fix witness, force quorum start if needed (with caution)' },
    { name: 'Quorum Node Weight', regex: /quorum.*(weight|vote).*(insufficient|imbalance)/i, severity: 'HIGH', category: 'Windows System', description: 'Cluster quorum node weight insufficient', resolution: 'Adjust node weights, ensure proper quorum model configuration' },
    { name: 'Windows Update Failure 0x80070002', regex: /windows update.*(0x80070002|file not found)|0x80070002.*update/i, severity: 'MEDIUM', category: 'Windows System', description: 'Windows Update failed with file not found error', resolution: 'Clear SoftwareDistribution folder, run Windows Update troubleshooter' },
    { name: 'Windows Update CBS Corrupt', regex: /windows update.*(0x800F0922|cbs.*corrupt)|cbs.*(corruption|repair)/i, severity: 'MEDIUM', category: 'Windows System', description: 'Windows Update CBS store corruption detected', resolution: 'Run DISM /Online /Cleanup-Image /RestoreHealth, then sfc /scannow' },
    { name: 'CBS Corruption', regex: /cbs.*(store|component).*(needs repair|corrupt|inconsist)/i, severity: 'MEDIUM', category: 'Windows System', description: 'Component Based Servicing store needs repair', resolution: 'Run DISM RestoreHealth, check Windows Update logs for specifics' },
    { name: 'SFC Corrupt Files Found', regex: /sfc|windows resource protection.*(found|detected).*(corrupt|integrity)/i, severity: 'MEDIUM', category: 'Windows System', description: 'System File Checker found corrupt system files', resolution: 'Review CBS.log, run DISM RestoreHealth before SFC, replace files from known good source' },
    { name: 'Kerberos Clock Skew', regex: /kerberos.*(krb_ap_err_skew|clock skew|time.*(difference|drift))/i, severity: 'HIGH', category: 'Windows System', description: 'Kerberos authentication failing due to clock skew', resolution: 'Sync time with domain controller, verify NTP configuration, check w32time service' },
    { name: 'Kerberos Ticket Expired', regex: /kerberos.*(ticket|tgt).*(expir|renew.*fail|invalid)/i, severity: 'HIGH', category: 'Windows System', description: 'Kerberos ticket expired or renewal failed', resolution: 'Force klist purge, verify KDC availability, check account lockout status' },
    { name: 'NTLM Fallback', regex: /ntlm.*(fallback|downgrade)|kerberos.*(fail|unavail).*ntlm/i, severity: 'MEDIUM', category: 'Windows System', description: 'Authentication falling back from Kerberos to NTLM', resolution: 'Verify SPN registration, check DNS resolution, ensure KDC reachable' },
    { name: 'AD Replication Failure', regex: /ad.*(replication|drs).*(fail|error|lingering|usn rollback)/i, severity: 'HIGH', category: 'Windows System', description: 'Active Directory replication failure detected', resolution: 'Run repadmin /replsummary, check network between DCs, resolve lingering objects' },
  ];

  // ═══════════════════════════════════════════════════════════════════════════════
  // Storage & SAN (25 patterns)
  // ═══════════════════════════════════════════════════════════════════════════════
  const DETECTION_PATTERNS_STORAGE = [
    { name: 'Multipath All Paths Lost', regex: /multipath.*(all paths|no path|no valid).*(lost|down|fail|unavail)/i, severity: 'CRITICAL', category: 'Storage & SAN', description: 'All paths to multipath device have been lost', resolution: 'Check HBA status, verify FC/iSCSI connectivity, check storage array health' },
    { name: 'Multipath Single Path Remaining', regex: /multipath.*(single|one|last).*(path|remaining|degraded)/i, severity: 'HIGH', category: 'Storage & SAN', description: 'Multipath device degraded to single path', resolution: 'Investigate failed path, check switch ports, verify zone configuration' },
    { name: 'Path Flapping Detected', regex: /(path|mpath).*(flap|oscillat|toggle|bouncing)/i, severity: 'HIGH', category: 'Storage & SAN', description: 'Storage path is flapping between states', resolution: 'Check cable connections, verify switch port health, check for firmware bugs' },
    { name: 'Path Excessive Transitions', regex: /(path|mpath).*(excessive|too many).*(transition|change|event)/i, severity: 'HIGH', category: 'Storage & SAN', description: 'Excessive path state transitions detected', resolution: 'Stabilize SAN fabric, check for marginal cables, review error counters' },
    { name: 'SCSI Medium Error', regex: /scsi.*(medium error|unrecovered read|write fault)/i, severity: 'HIGH', category: 'Storage & SAN', description: 'SCSI medium error - disk surface issue', resolution: 'Replace disk, check RAID rebuild status, verify backup integrity' },
    { name: 'SCSI Hardware Error', regex: /scsi.*(hardware error|internal target failure)/i, severity: 'CRITICAL', category: 'Storage & SAN', description: 'SCSI hardware error from target device', resolution: 'Check storage controller, verify disk health, check cabling' },
    { name: 'SCSI Aborted Command', regex: /scsi.*(aborted command|overlapped|task abort)/i, severity: 'MEDIUM', category: 'Storage & SAN', description: 'SCSI command aborted, possible queue or timing issue', resolution: 'Check queue depths, verify timeout settings, update HBA firmware' },
    { name: 'Thin Provision Pool High Utilization', regex: /thin.*(pool|provision).*(utiliz|capacity|usage).*(above|exceed|high|85|90|95)/i, severity: 'HIGH', category: 'Storage & SAN', description: 'Thin provisioned pool utilization is critically high', resolution: 'Extend pool capacity, reclaim space, delete unused snapshots' },
    { name: 'Thin Provision Auto-Extend Failed', regex: /thin.*(pool|provision).*(auto.?extend|grow|expand).*(fail|error|unable)/i, severity: 'CRITICAL', category: 'Storage & SAN', description: 'Thin pool auto-extension failed', resolution: 'Manually extend pool immediately, add disks to aggregate, verify space available' },
    { name: 'Snapshot Space Exhausted', regex: /snapshot.*(space|reserve|capacity).*(full|exhaust|exceeded)/i, severity: 'HIGH', category: 'Storage & SAN', description: 'Snapshot reserve space has been exhausted', resolution: 'Delete old snapshots, extend snapshot reserve, review snapshot policy' },
    { name: 'Snapshot COW Allocation Failed', regex: /snapshot.*(cow|copy.?on.?write|alloc).*(fail|error|unable)/i, severity: 'CRITICAL', category: 'Storage & SAN', description: 'Snapshot copy-on-write allocation failed, snapshot invalid', resolution: 'Delete invalid snapshot, extend space, verify LV health' },
    { name: 'Deduplication Hash Collision', regex: /dedup.*(hash|collision|fingerprint).*(error|collision|conflict)/i, severity: 'MEDIUM', category: 'Storage & SAN', description: 'Deduplication engine hash collision detected', resolution: 'Verify data integrity, check dedup engine version, run verification scan' },
    { name: 'Deduplication Database Corrupt', regex: /dedup.*(database|fingerprint|db).*(corrupt|error|rebuild)/i, severity: 'HIGH', category: 'Storage & SAN', description: 'Deduplication fingerprint database is corrupt', resolution: 'Rebuild dedup database, this may temporarily increase storage usage' },
    { name: 'Compression Engine Timeout', regex: /compress.*(engine|inline).*(timeout|slow|fail)/i, severity: 'MEDIUM', category: 'Storage & SAN', description: 'Inline compression engine timeout, performance impact', resolution: 'Check CPU load on storage controller, consider disabling inline compression temporarily' },
    { name: 'Tiering Migration Failure', regex: /tier.*(policy|engine|migration).*(fail|error|stuck)/i, severity: 'MEDIUM', category: 'Storage & SAN', description: 'Storage tiering policy engine failed to migrate data', resolution: 'Check tier health, verify free space on destination tier, review tiering policy' },
    { name: 'Tiering SSD Tier Critical', regex: /tier.*(ssd|fast|performance).*(capacity|full|critical|exhausted)/i, severity: 'HIGH', category: 'Storage & SAN', description: 'SSD/performance tier capacity is critical', resolution: 'Extend SSD tier, adjust tiering policy to demote cold data, add SSD disks' },
    { name: '3PAR Node Communication Lost', regex: /3par.*(node|pair).*(communication|link|heartbeat).*(lost|fail|down)/i, severity: 'CRITICAL', category: 'Storage & SAN', description: 'HPE 3PAR node pair communication lost', resolution: 'Check inter-node cables, verify node health via SP console, prepare for potential takeover' },
    { name: '3PAR Cage Link Degraded', regex: /3par.*(cage|loop|link).*(degrad|error|fail)/i, severity: 'HIGH', category: 'Storage & SAN', description: 'HPE 3PAR cage link degraded', resolution: 'Check cage cables, verify port LEDs, run diagcage command' },
    { name: 'Nimble Replication Link Down', regex: /nimble.*(replication|replica|link).*(down|fail|disconnect)/i, severity: 'HIGH', category: 'Storage & SAN', description: 'Nimble array replication link is down', resolution: 'Check network between arrays, verify replication partner health, check firewall rules' },
    { name: 'Nimble Volume Schedule Missed', regex: /nimble.*(volume|collection|schedule).*(missed|overdue|fail)/i, severity: 'MEDIUM', category: 'Storage & SAN', description: 'Nimble volume collection schedule missed', resolution: 'Check array load, verify schedule configuration, check for conflicts' },
    { name: 'Primera Persistent Port Error', regex: /primera.*(persistent|port).*(error|fault|degrad)/i, severity: 'HIGH', category: 'Storage & SAN', description: 'HPE Primera persistent port error detected', resolution: 'Check SFP modules, verify cable integrity, run port diagnostics' },
    { name: 'StoreOnce Catalyst Connection Failure', regex: /storeonce.*(catalyst|connection).*(fail|error|refused)/i, severity: 'HIGH', category: 'Storage & SAN', description: 'HPE StoreOnce Catalyst connection failure', resolution: 'Check network connectivity, verify Catalyst service status, check licenses' },
    { name: 'StoreOnce Dedup Store Health Failed', regex: /storeonce.*(dedup|store|health).*(check|fail|error|corrupt)/i, severity: 'HIGH', category: 'Storage & SAN', description: 'StoreOnce deduplication store health check failed', resolution: 'Run housekeeping, check disk health, contact support if persistent' },
    { name: 'LUN Alignment Issue', regex: /(lun|partition).*(alignment|offset|misalign)/i, severity: 'LOW', category: 'Storage & SAN', description: 'LUN partition alignment issue detected, performance impact', resolution: 'Realign partition on next rebuild, use proper alignment offset (1MB)' },
    { name: 'Queue Depth Exceeded', regex: /(queue depth|hba queue|cmd queue).*(exceed|full|overflow|throttl)/i, severity: 'MEDIUM', category: 'Storage & SAN', description: 'Host bus adapter queue depth exceeded', resolution: 'Increase queue depth, distribute load across more paths, check storage latency' },
    { name: 'SCSI Reservation Conflict', regex: /scsi.*(reservation|persistent reserve).*(conflict|fail|error)/i, severity: 'HIGH', category: 'Storage & SAN', description: 'SCSI persistent reservation conflict detected', resolution: 'Check for competing hosts, verify cluster fencing config, clear stale reservations' },
  ];

  // ═══════════════════════════════════════════════════════════════════════════════
  // Network (25 patterns)
  // ═══════════════════════════════════════════════════════════════════════════════
  const DETECTION_PATTERNS_NETWORK = [
    { name: 'BGP Peer Down - Hold Timer', regex: /bgp.*(peer|neighbor).*(down|hold timer|expired|ceased)/i, severity: 'CRITICAL', category: 'Network', description: 'BGP peer session down due to hold timer expiry', resolution: 'Check interface status to peer, verify routing, check for CPU overload on router' },
    { name: 'BGP Notification Cease', regex: /bgp.*(notification|cease|reset|withdrawn)/i, severity: 'HIGH', category: 'Network', description: 'BGP notification received, peer intentionally closed session', resolution: 'Check peer configuration changes, verify prefix limits, review BGP logs on peer' },
    { name: 'OSPF Adjacency Down', regex: /ospf.*(adjacency|neighbor).*(down|dead timer|lost|change)/i, severity: 'CRITICAL', category: 'Network', description: 'OSPF neighbor adjacency lost', resolution: 'Check interface connectivity, verify OSPF area and authentication config, check MTU match' },
    { name: 'OSPF Dead Timer Expired', regex: /ospf.*(dead timer|hello).*(expired|timeout|missed)/i, severity: 'HIGH', category: 'Network', description: 'OSPF dead timer expired, neighbor declared down', resolution: 'Check interface status, verify no packet loss on segment, match hello/dead timers' },
    { name: 'Spanning Tree Topology Change', regex: /spanning.?tree.*(topology change|tcn|root.*election)/i, severity: 'HIGH', category: 'Network', description: 'Spanning tree topology change detected', resolution: 'Identify port causing change, check for flapping links, enable BPDU guard on edge ports' },
    { name: 'Spanning Tree Port Blocking', regex: /spanning.?tree.*(port|interface).*(block|transition|state change)/i, severity: 'MEDIUM', category: 'Network', description: 'Spanning tree port transitioned to blocking state', resolution: 'Verify expected topology, check for loops, review STP priority configuration' },
    { name: 'MTU Mismatch - PMTUD Failure', regex: /(mtu|pmtud).*(mismatch|fragmentation needed|too big|icmp unreachable)/i, severity: 'MEDIUM', category: 'Network', description: 'Path MTU discovery failure, fragmentation needed', resolution: 'Verify MTU consistency across path, enable jumbo frames end-to-end or reduce MTU' },
    { name: 'MTU Jumbo Frame Dropped', regex: /(jumbo|mtu).*(drop|discard|exceed|too large)/i, severity: 'MEDIUM', category: 'Network', description: 'Jumbo frames being dropped due to MTU mismatch', resolution: 'Verify all switches/routers support jumbo frames, check interface MTU settings' },
    { name: 'CRC Errors on Interface', regex: /(crc|fcs|frame check).*(error|incrementing|increasing|detected)/i, severity: 'HIGH', category: 'Network', description: 'CRC/FCS errors detected on interface', resolution: 'Replace cable, check SFP/transceiver, verify patch panel connections' },
    { name: 'Interface Input Errors', regex: /interface.*(input|rx).*(error|discard|drop).*(increasing|detected|high)/i, severity: 'MEDIUM', category: 'Network', description: 'Interface input errors/discards increasing', resolution: 'Check cable quality, verify duplex settings, check for noise/interference' },
    { name: 'Interface Output Errors', regex: /interface.*(output|tx).*(error|buffer|fail|discard)/i, severity: 'MEDIUM', category: 'Network', description: 'Interface output buffer failures or errors', resolution: 'Check for congestion, increase output queue, verify link speed/duplex' },
    { name: 'ARP Storm Detected', regex: /arp.*(storm|flood|excessive|threshold|broadcast)/i, severity: 'HIGH', category: 'Network', description: 'Excessive ARP traffic indicating potential ARP storm', resolution: 'Identify source MAC, enable ARP inspection, check for misconfigured hosts or attacks' },
    { name: 'Broadcast Storm', regex: /broadcast.*(storm|threshold|exceeded|suppression)/i, severity: 'HIGH', category: 'Network', description: 'Broadcast traffic exceeding threshold', resolution: 'Enable storm control, identify source, check for loops, verify STP operation' },
    { name: 'MAC Flapping', regex: /mac.*(flap|oscillat|move|bouncing|learned on multiple)/i, severity: 'HIGH', category: 'Network', description: 'MAC address flapping between ports', resolution: 'Check for network loops, verify STP, look for duplicate MAC addresses or MLAG issues' },
    { name: 'SSL/TLS Handshake - Protocol Mismatch', regex: /(ssl|tls).*(handshake|protocol).*(fail|mismatch|version|unsupported)/i, severity: 'MEDIUM', category: 'Network', description: 'SSL/TLS handshake failure due to protocol version mismatch', resolution: 'Update TLS configuration, ensure compatible protocol versions, disable legacy protocols' },
    { name: 'SSL/TLS Cipher Negotiation Failed', regex: /(ssl|tls).*(cipher|negotiat).*(fail|no common|mismatch)/i, severity: 'MEDIUM', category: 'Network', description: 'SSL/TLS cipher suite negotiation failed', resolution: 'Configure compatible cipher suites, update crypto libraries, review security requirements' },
    { name: 'Certificate Chain Incomplete', regex: /certificate.*(chain|intermediate).*(incomplete|missing|untrusted)/i, severity: 'HIGH', category: 'Network', description: 'SSL certificate chain is incomplete or missing intermediate CA', resolution: 'Install complete certificate chain including intermediate CAs' },
    { name: 'Certificate Expired', regex: /certificate.*(expir|invalid|not yet valid|past validity)/i, severity: 'HIGH', category: 'Network', description: 'SSL/TLS certificate has expired', resolution: 'Renew certificate immediately, check certificate auto-renewal automation' },
    { name: 'DNS SERVFAIL', regex: /dns.*(servfail|server fail|resolution fail)/i, severity: 'HIGH', category: 'Network', description: 'DNS server returning SERVFAIL responses', resolution: 'Check upstream DNS health, verify zone configuration, check DNSSEC validation' },
    { name: 'NXDOMAIN Flood', regex: /dns.*(nxdomain|non.?existent).*(flood|excessive|spike|threshold)/i, severity: 'HIGH', category: 'Network', description: 'Excessive NXDOMAIN queries indicating potential DGA malware or misconfiguration', resolution: 'Investigate source IPs, check for malware, review DNS query patterns' },
    { name: 'DNS Recursive Query Failure', regex: /dns.*(recursion|recursive).*(fail|depth|timeout|exceeded)/i, severity: 'MEDIUM', category: 'Network', description: 'DNS recursive query failure', resolution: 'Check upstream resolvers, verify DNSSEC chain, increase timeout values' },
    { name: 'Load Balancer Health Check Failed', regex: /load.?balancer.*(health|monitor).*(fail|down|unreachable)/i, severity: 'HIGH', category: 'Network', description: 'Load balancer health check marked backend as failed', resolution: 'Check backend service health, verify health check endpoint, review timeout settings' },
    { name: 'Pool Member Down', regex: /(pool|backend).*(member|server|node).*(down|offline|removed|unavail)/i, severity: 'HIGH', category: 'Network', description: 'Load balancer pool member marked as down', resolution: 'Investigate backend server, check application health, verify network connectivity' },
    { name: 'Interface Flapping', regex: /interface.*(flap|up.*down|link.*(up|down).*rapid)/i, severity: 'HIGH', category: 'Network', description: 'Network interface link state flapping', resolution: 'Check cable/SFP, verify port configuration, look for auto-negotiation issues' },
    { name: 'Duplex Mismatch', regex: /(duplex|half.?duplex).*(mismatch|error|collision)/i, severity: 'MEDIUM', category: 'Network', description: 'Duplex mismatch causing collisions and errors', resolution: 'Set consistent duplex on both ends, prefer auto-negotiation or hard-set full-duplex' },
  ];

  // ═══════════════════════════════════════════════════════════════════════════════
  // Virtualization (20 patterns)
  // ═══════════════════════════════════════════════════════════════════════════════
  const DETECTION_PATTERNS_VIRT = [
    { name: 'VMware PSOD', regex: /(psod|purple screen|purple diagnostic)/i, severity: 'CRITICAL', category: 'Virtualization', description: 'VMware ESXi Purple Screen of Death', resolution: 'Collect vmkernel dump, analyze with VMware support, check for known driver/firmware issues' },
    { name: 'VMware HA Failover - Host Unreachable', regex: /vmware.*(ha|high availability).*(failover|host.*unreachable|declared dead)/i, severity: 'CRITICAL', category: 'Virtualization', description: 'VMware HA declared host unreachable, VMs being restarted', resolution: 'Investigate failed host, check management network, review HA isolation response' },
    { name: 'VMware HA VM Restarted', regex: /vmware.*(ha|high availability).*(vm|virtual machine).*(restart|failover|moved)/i, severity: 'HIGH', category: 'Virtualization', description: 'VM restarted by HA on alternate host', resolution: 'Verify VM health post-restart, investigate original host failure' },
    { name: 'VMware vMotion Failure - Timeout', regex: /vmotion.*(fail|timeout|stun time|exceeded|abort)/i, severity: 'HIGH', category: 'Virtualization', description: 'vMotion migration failed or exceeded timeout', resolution: 'Check vMotion network bandwidth, reduce VM memory change rate, verify compatibility' },
    { name: 'VMware vMotion Network Loss', regex: /vmotion.*(network|connectivity).*(lost|fail|interrupt|disconnect)/i, severity: 'HIGH', category: 'Virtualization', description: 'Network connectivity lost during vMotion', resolution: 'Verify vMotion vmkernel adapter, check physical network, verify MTU settings' },
    { name: 'VMware VMFS Heartbeat Loss', regex: /vmfs.*(heartbeat|datastore).*(loss|missing|fail|not accessible)/i, severity: 'CRITICAL', category: 'Virtualization', description: 'VMFS datastore heartbeat lost, storage may be inaccessible', resolution: 'Check SAN connectivity, verify storage paths, check for APD/PDL conditions' },
    { name: 'VMware Snapshot Consolidation Needed', regex: /vmware.*(snapshot|disk).*(consolidat|needed|required)/i, severity: 'MEDIUM', category: 'Virtualization', description: 'VM disk consolidation needed due to snapshot chain issues', resolution: 'Consolidate snapshots, ensure sufficient datastore space, check for locked files' },
    { name: 'VMware Snapshot Consolidation Failed', regex: /vmware.*(snapshot|consolidat).*(fail|error|unable|stuck)/i, severity: 'HIGH', category: 'Virtualization', description: 'Snapshot consolidation operation failed', resolution: 'Check for locked VMDK files, verify datastore space, try consolidation during low IO' },
    { name: 'Hyper-V Checkpoint Merge Failure', regex: /hyper.?v.*(checkpoint|avhd|merge).*(fail|error|unable)/i, severity: 'HIGH', category: 'Virtualization', description: 'Hyper-V checkpoint merge operation failed', resolution: 'Check disk space, verify no other operations running, attempt merge again or delete checkpoint' },
    { name: 'Hyper-V Merge Insufficient Space', regex: /hyper.?v.*(merge|checkpoint).*(insufficient|disk space|no space)/i, severity: 'HIGH', category: 'Virtualization', description: 'Insufficient disk space for Hyper-V checkpoint merge', resolution: 'Free disk space on volume, move other VMs, extend volume' },
    { name: 'Hyper-V Live Migration - Compatibility Failed', regex: /hyper.?v.*(live migration|migration).*(compatibility|check|fail|error)/i, severity: 'HIGH', category: 'Virtualization', description: 'Hyper-V live migration compatibility check failed', resolution: 'Verify CPU compatibility mode, check Hyper-V version match, review migration settings' },
    { name: 'Hyper-V Live Migration - Network Error', regex: /hyper.?v.*(live migration|migration).*(network|connectivity|bandwidth).*(fail|insufficient|error)/i, severity: 'HIGH', category: 'Virtualization', description: 'Hyper-V live migration failed due to network issues', resolution: 'Verify dedicated migration network, check bandwidth, review SMB settings' },
    { name: 'Hyper-V VHD Corruption', regex: /hyper.?v.*(vhd|vhdx|virtual.*disk).*(corrupt|integrity|error|invalid)/i, severity: 'CRITICAL', category: 'Virtualization', description: 'Hyper-V virtual hard disk corruption detected', resolution: 'Run Repair-VHD PowerShell cmdlet, restore from backup if repair fails' },
    { name: 'KVM Virtio Block Error', regex: /(virtio_blk|virtio.?block).*(error|reset|queue|timeout|fail)/i, severity: 'HIGH', category: 'Virtualization', description: 'KVM virtio block device error or queue reset', resolution: 'Check backend storage health, verify qemu-kvm version, check for IO errors on host' },
    { name: 'KVM Virtio Net TX Timeout', regex: /(virtio_net|virtio.?net).*(timeout|tx|hang|stall)/i, severity: 'MEDIUM', category: 'Virtualization', description: 'KVM virtio network transmit queue timeout', resolution: 'Check host network, verify bridge/OVS configuration, update virtio drivers' },
    { name: 'Libvirt Connection Failure', regex: /libvirt.*(connection|connect|unable).*(fail|error|refused|denied)/i, severity: 'HIGH', category: 'Virtualization', description: 'Unable to connect to libvirt hypervisor', resolution: 'Check libvirtd service status, verify socket permissions, restart libvirtd' },
    { name: 'Libvirt Socket Permission Denied', regex: /libvirt.*(socket|permission).*(denied|error|access)/i, severity: 'MEDIUM', category: 'Virtualization', description: 'Libvirt socket permission denied', resolution: 'Add user to libvirt group, check polkit rules, verify socket ownership' },
    { name: 'CPU Steal Time High', regex: /(steal|cpu steal|st%).*(high|excessive|critical|above threshold)/i, severity: 'HIGH', category: 'Virtualization', description: 'VM CPU steal time is excessively high', resolution: 'Check host CPU overcommit ratio, migrate VM to less loaded host, verify CPU pinning' },
    { name: 'CPU Steal Time - Scheduling Latency', regex: /(steal|scheduling).*(latency|delay|wait).*(high|critical|excessive)/i, severity: 'HIGH', category: 'Virtualization', description: 'VM scheduling latency critical due to hypervisor contention', resolution: 'Reduce host VM density, configure CPU reservations, use latency-sensitive settings' },
    { name: 'VM Disk Latency High', regex: /(vm|virtual).*(disk|storage).*(latency|slow|response time).*(high|critical|exceeded)/i, severity: 'HIGH', category: 'Virtualization', description: 'Virtual machine disk latency is critically high', resolution: 'Check storage backend health, move to faster datastore, check for noisy neighbors' },
  ];

  // ═══════════════════════════════════════════════════════════════════════════════
  // Kubernetes & Containers (25 patterns)
  // ═══════════════════════════════════════════════════════════════════════════════
  const DETECTION_PATTERNS_K8S = [
    { name: 'CrashLoopBackOff', regex: /crashloopbackoff|crash.?loop.?back.?off/i, severity: 'HIGH', category: 'Kubernetes & Containers', description: 'Container is crash-looping, restarting repeatedly', resolution: 'Check container logs, verify image and entrypoint, check readiness/liveness probes' },
    { name: 'CrashLoopBackOff - Backoff Increasing', regex: /(crashloop|backoff).*(delay|increasing|exponential|restart)/i, severity: 'HIGH', category: 'Kubernetes & Containers', description: 'Container restart backoff delay is increasing', resolution: 'Fix application crash root cause, check resource limits, verify configuration' },
    { name: 'ImagePullBackOff', regex: /imagepullbackoff|image.?pull.?back.?off|errimagepull/i, severity: 'HIGH', category: 'Kubernetes & Containers', description: 'Failed to pull container image', resolution: 'Verify image name/tag, check registry credentials (imagePullSecrets), verify network access to registry' },
    { name: 'ImagePullBackOff - Auth Required', regex: /(image|pull).*(auth|credentials|unauthorized|403|401)/i, severity: 'HIGH', category: 'Kubernetes & Containers', description: 'Container image pull failed due to authentication', resolution: 'Create/update imagePullSecret, verify registry credentials, check secret reference in pod spec' },
    { name: 'OOMKilled', regex: /oomkilled|oom.?killed|reason.*oom/i, severity: 'HIGH', category: 'Kubernetes & Containers', description: 'Container killed due to exceeding memory limit', resolution: 'Increase memory limit, optimize application memory usage, check for memory leaks' },
    { name: 'Pod Evicted - Memory Pressure', regex: /(evict|eviction).*(memory|resource|pressure|reclaim)/i, severity: 'HIGH', category: 'Kubernetes & Containers', description: 'Pod evicted due to node resource pressure', resolution: 'Set appropriate resource requests, add more nodes, check for memory leaks across pods' },
    { name: 'Pod Evicted - Disk Pressure', regex: /(evict|eviction).*(disk|ephemeral|storage).*(pressure|full)/i, severity: 'HIGH', category: 'Kubernetes & Containers', description: 'Pod evicted due to disk pressure', resolution: 'Clean up container logs, increase ephemeral storage limits, add node storage' },
    { name: 'etcd Leader Election', regex: /etcd.*(leader|election).*(changed|elected|lost|timeout)/i, severity: 'HIGH', category: 'Kubernetes & Containers', description: 'etcd leader election event, possible cluster instability', resolution: 'Check etcd cluster health, verify network between etcd members, check disk IO latency' },
    { name: 'etcd Election No Quorum', regex: /etcd.*(election|quorum).*(timeout|no quorum|fail|lost)/i, severity: 'CRITICAL', category: 'Kubernetes & Containers', description: 'etcd election timeout, quorum lost', resolution: 'Restore etcd quorum, check member connectivity, may need to force new cluster' },
    { name: 'API Server Unavailable', regex: /(apiserver|kube-apiserver|api server).*(unavail|refused|timeout|connection)/i, severity: 'CRITICAL', category: 'Kubernetes & Containers', description: 'Kubernetes API server is unavailable', resolution: 'Check apiserver pods, verify etcd health, check certificates, review apiserver logs' },
    { name: 'API Server Request Timeout', regex: /(apiserver|api server).*(request|timeout|deadline|exceeded)/i, severity: 'HIGH', category: 'Kubernetes & Containers', description: 'API server request timeout exceeded', resolution: 'Check apiserver load, verify etcd performance, review audit logs for expensive queries' },
    { name: 'Scheduler Failure', regex: /(scheduler|kube-scheduler).*(fail|unable|no nodes|unschedulable)/i, severity: 'HIGH', category: 'Kubernetes & Containers', description: 'Kubernetes scheduler unable to place pod', resolution: 'Check node resources, review pod affinity/anti-affinity, verify taints and tolerations' },
    { name: 'PVC Pending', regex: /pvc.*(pending|waiting|unbound|no.*(pv|volume))/i, severity: 'MEDIUM', category: 'Kubernetes & Containers', description: 'PersistentVolumeClaim is pending, waiting for volume', resolution: 'Check storage class provisioner, verify available PVs, check CSI driver health' },
    { name: 'PVC No Matching Volume', regex: /pvc.*(no.*(match|available)|persistent volume.*not found)/i, severity: 'MEDIUM', category: 'Kubernetes & Containers', description: 'No persistent volume matches the claim requirements', resolution: 'Create appropriate PV, check storage class parameters, verify access modes' },
    { name: 'CSI Driver Error - Attachment Failed', regex: /csi.*(attach|volume).*(fail|error|timeout)/i, severity: 'HIGH', category: 'Kubernetes & Containers', description: 'CSI driver volume attachment failed', resolution: 'Check CSI driver pods, verify storage backend connectivity, check node plugin daemonset' },
    { name: 'CSI Driver Error - Mount Timeout', regex: /csi.*(mount|unmount).*(timeout|fail|error)/i, severity: 'HIGH', category: 'Kubernetes & Containers', description: 'CSI volume mount operation timed out', resolution: 'Check node kubelet logs, verify storage connectivity from node, restart CSI node plugin' },
    { name: 'Node NotReady', regex: /node.*(notready|not ready|condition.*ready.*false)/i, severity: 'CRITICAL', category: 'Kubernetes & Containers', description: 'Kubernetes node is in NotReady state', resolution: 'Check kubelet status, verify container runtime, check node resources and network' },
    { name: 'Node Memory Pressure', regex: /node.*(memory pressure|memorypressure|condition.*memory)/i, severity: 'HIGH', category: 'Kubernetes & Containers', description: 'Node under memory pressure, evictions may occur', resolution: 'Identify high-memory pods, add resources, set proper resource requests/limits' },
    { name: 'Ingress 502 Bad Gateway', regex: /ingress.*(502|bad gateway|upstream.*error)/i, severity: 'HIGH', category: 'Kubernetes & Containers', description: 'Ingress returning 502 bad gateway', resolution: 'Check backend pod health, verify service endpoints, review ingress controller logs' },
    { name: 'Ingress 503 Service Unavailable', regex: /ingress.*(503|service unavailable|no endpoints)/i, severity: 'HIGH', category: 'Kubernetes & Containers', description: 'Ingress returning 503, service has no endpoints', resolution: 'Verify pods are running, check service selector labels, verify endpoints exist' },
    { name: 'Ingress 504 Gateway Timeout', regex: /ingress.*(504|gateway timeout|upstream.*timeout)/i, severity: 'HIGH', category: 'Kubernetes & Containers', description: 'Ingress returning 504 gateway timeout', resolution: 'Increase proxy timeout, optimize backend response time, check for resource constraints' },
    { name: 'Service Mesh Sidecar Injection Failed', regex: /(sidecar|istio|envoy).*(inject|webhook).*(fail|timeout|error)/i, severity: 'MEDIUM', category: 'Kubernetes & Containers', description: 'Service mesh sidecar injection webhook failed', resolution: 'Check webhook service health, verify namespace labels, review injection configuration' },
    { name: 'Resource Quota Exceeded', regex: /resource.?quota.*(exceed|forbidden|limit|denied)/i, severity: 'MEDIUM', category: 'Kubernetes & Containers', description: 'Namespace resource quota exceeded', resolution: 'Increase quota, optimize resource requests, clean up unused resources' },
    { name: 'HPA Unable to Scale', regex: /hpa.*(unable|fail|cannot).*(scale|metrics|compute)/i, severity: 'MEDIUM', category: 'Kubernetes & Containers', description: 'Horizontal Pod Autoscaler cannot determine scaling', resolution: 'Check metrics-server health, verify HPA metric targets, check resource requests are set' },
    { name: 'Cluster Autoscaler Failed', regex: /cluster.?autoscaler.*(fail|unable|error|provision|scale.?up)/i, severity: 'HIGH', category: 'Kubernetes & Containers', description: 'Cluster autoscaler failed to provision new nodes', resolution: 'Check cloud provider quota, verify autoscaler permissions, review node group configuration' },
  ];

  // ═══════════════════════════════════════════════════════════════════════════════
  // Database (20 patterns)
  // ═══════════════════════════════════════════════════════════════════════════════
  const DETECTION_PATTERNS_DATABASE = [
    { name: 'MySQL Deadlock Detected', regex: /mysql.*(deadlock|waiting for.*lock|lock wait timeout)/i, severity: 'HIGH', category: 'Database', description: 'MySQL deadlock detected, transaction rolled back', resolution: 'Review transaction isolation levels, optimize query order, add appropriate indexes' },
    { name: 'MySQL Replication Lag Critical', regex: /mysql.*(replication|slave|replica).*(lag|behind|delay).*(critical|seconds|high)/i, severity: 'HIGH', category: 'Database', description: 'MySQL replication lag is critically high', resolution: 'Check slave IO/SQL thread, optimize heavy queries, verify network bandwidth, consider parallel replication' },
    { name: 'MySQL Binlog Corruption', regex: /mysql.*(binlog|binary log).*(corrupt|checksum|invalid|error)/i, severity: 'CRITICAL', category: 'Database', description: 'MySQL binary log corruption detected', resolution: 'Skip corrupted event, restore slave from backup, verify disk health' },
    { name: 'MySQL InnoDB Corruption', regex: /mysql.*(innodb).*(corrupt|page checksum|torn page|inconsist)/i, severity: 'CRITICAL', category: 'Database', description: 'InnoDB page corruption detected', resolution: 'Set innodb_force_recovery, dump and reimport data, check disk/RAID health' },
    { name: 'PostgreSQL WAL Corruption', regex: /postgres.*(wal|xlog).*(corrupt|invalid record|unexpected|error)/i, severity: 'CRITICAL', category: 'Database', description: 'PostgreSQL WAL (Write-Ahead Log) corruption detected', resolution: 'Restore from backup, pg_resetwal as last resort (data loss possible), check disk health' },
    { name: 'PostgreSQL Vacuum Wraparound', regex: /postgres.*(vacuum|wraparound|transaction id|xid).*(limit|warning|must|approaching)/i, severity: 'CRITICAL', category: 'Database', description: 'PostgreSQL approaching transaction ID wraparound limit', resolution: 'Run VACUUM FREEZE immediately, set aggressive autovacuum, do not delay' },
    { name: 'PostgreSQL Connection Exhausted', regex: /postgres.*(connection|slot|remaining).*(exhaust|full|maximum|too many|limit)/i, severity: 'HIGH', category: 'Database', description: 'PostgreSQL connection slots exhausted', resolution: 'Increase max_connections, use connection pooler (PgBouncer), check for connection leaks' },
    { name: 'PostgreSQL Shared Buffer Pressure', regex: /postgres.*(shared buffer|buffer|cache).*(pressure|low|hit ratio|miss)/i, severity: 'MEDIUM', category: 'Database', description: 'PostgreSQL shared buffer cache pressure, low hit ratio', resolution: 'Increase shared_buffers, optimize queries to reduce IO, add RAM' },
    { name: 'Oracle ORA-00060 Deadlock', regex: /ora-00060|deadlock detected.*waiting for resource/i, severity: 'HIGH', category: 'Database', description: 'Oracle deadlock detected between sessions', resolution: 'Analyze trace file, review application locking order, optimize transaction design' },
    { name: 'Oracle ORA-04031 Shared Memory', regex: /ora-04031|unable to allocate.*shared memory/i, severity: 'HIGH', category: 'Database', description: 'Oracle unable to allocate shared memory from SGA', resolution: 'Increase SGA size, flush shared pool, check for cursor leaks or literal SQL' },
    { name: 'Oracle ORA-01555 Snapshot Too Old', regex: /ora-01555|snapshot too old/i, severity: 'MEDIUM', category: 'Database', description: 'Oracle snapshot too old, undo space insufficient for read consistency', resolution: 'Increase undo tablespace, optimize long-running queries, increase undo_retention' },
    { name: 'Oracle Tablespace Full', regex: /ora.*(tablespace|segment).*(full|unable to extend|space|autoextend)/i, severity: 'CRITICAL', category: 'Database', description: 'Oracle tablespace is full, unable to extend', resolution: 'Add datafile, enable autoextend, purge old data, extend existing files' },
    { name: 'Oracle Archive Log Full', regex: /ora.*(archive|archiver).*(full|stuck|destination|error)/i, severity: 'CRITICAL', category: 'Database', description: 'Oracle archive log destination full, database may hang', resolution: 'Free archive log space immediately, backup and delete old archives, add destination' },
    { name: 'Redis Maxmemory Reached', regex: /redis.*(maxmemory|max.?memory).*(reached|exceeded|evict|limit)/i, severity: 'HIGH', category: 'Database', description: 'Redis has reached maxmemory limit, eviction active', resolution: 'Increase maxmemory, review eviction policy, remove unused keys, scale out' },
    { name: 'Redis RDB Snapshot Failed', regex: /redis.*(rdb|snapshot|bgsave).*(fail|error|unable|write)/i, severity: 'HIGH', category: 'Database', description: 'Redis RDB snapshot/persistence failed', resolution: 'Check disk space, verify write permissions, check fork memory requirements' },
    { name: 'Redis AOF Rewrite Failure', regex: /redis.*(aof|append.?only).*(rewrite|fail|error|corrupt)/i, severity: 'HIGH', category: 'Database', description: 'Redis AOF file rewrite failed', resolution: 'Check disk space, verify permissions, run redis-check-aof --fix if corrupt' },
    { name: 'Redis Cluster Slot Migration Timeout', regex: /redis.*(cluster|slot).*(migration|migrat).*(timeout|fail|error|stuck)/i, severity: 'HIGH', category: 'Database', description: 'Redis cluster slot migration operation timed out', resolution: 'Fix stuck migration with CLUSTER SETSLOT STABLE, verify node connectivity' },
    { name: 'MongoDB Election', regex: /mongodb|mongod.*(election|primary).*(called|step.?down|new primary|elected)/i, severity: 'HIGH', category: 'Database', description: 'MongoDB replica set election triggered', resolution: 'Check member connectivity, verify oplog, investigate why primary stepped down' },
    { name: 'MongoDB Rollback', regex: /mongodb|mongod.*(rollback|roll.?back).*(detected|started|data)/i, severity: 'HIGH', category: 'Database', description: 'MongoDB rollback to consistent point in progress', resolution: 'Check rollback files for lost writes, investigate network partition cause' },
    { name: 'MongoDB WiredTiger Cache Pressure', regex: /mongodb|mongod.*(wiredtiger|cache).*(pressure|eviction|usage|threshold|dirty)/i, severity: 'HIGH', category: 'Database', description: 'MongoDB WiredTiger cache under pressure', resolution: 'Increase cacheSizeGB, optimize queries and indexes, check for collection scans' },
  ];

  // ═══════════════════════════════════════════════════════════════════════════════
  // Security & Compliance (20 patterns)
  // ═══════════════════════════════════════════════════════════════════════════════
  const DETECTION_PATTERNS_SECURITY = [
    { name: 'Brute Force Login - Multiple Failures', regex: /(failed|invalid).*(login|auth|password|logon).*(multiple|repeated|5|threshold|brute)/i, severity: 'CRITICAL', category: 'Security & Compliance', description: 'Multiple failed authentication attempts detected (brute force)', resolution: 'Block source IP, enable account lockout, implement rate limiting, review firewall rules' },
    { name: 'Brute Force - Account Lockout', regex: /(account|user).*(lock|locked|lockout|disabled).*(threshold|too many|attempts)/i, severity: 'HIGH', category: 'Security & Compliance', description: 'Account locked due to excessive failed login attempts', resolution: 'Verify if legitimate, check source IPs, reset account after investigation' },
    { name: 'Privilege Escalation - Unauthorized Sudo', regex: /(unauthorized|illegal|denied).*(sudo|su |privilege|root access)/i, severity: 'CRITICAL', category: 'Security & Compliance', description: 'Unauthorized privilege escalation attempt detected', resolution: 'Investigate user activity, check sudoers file, review audit trail, alert security team' },
    { name: 'Privilege Escalation - UID 0 Gained', regex: /(uid|euid).*(0|root).*(gained|changed|elevated|non.?root)/i, severity: 'CRITICAL', category: 'Security & Compliance', description: 'Non-root process gained root privileges', resolution: 'Investigate immediately, check for exploit, review setuid binaries, audit process lineage' },
    { name: 'Rootkit Detection - Hidden Process', regex: /(rootkit|hidden).*(process|pid|proc).*(found|detected|suspicious)/i, severity: 'CRITICAL', category: 'Security & Compliance', description: 'Possible rootkit - hidden process detected', resolution: 'Isolate system immediately, boot from clean media, forensic analysis, rebuild system' },
    { name: 'Rootkit Detection - Kernel Module Suspicious', regex: /(kernel module|lkm).*(unsigned|suspicious|unknown|verification fail)/i, severity: 'CRITICAL', category: 'Security & Compliance', description: 'Suspicious kernel module detected, possible rootkit', resolution: 'Remove module, verify module signatures, audit loaded modules, check secure boot' },
    { name: 'Suspicious Cron Entry', regex: /(cron|crontab).*(suspicious|unexpected|modified|unauthorized|new entry)/i, severity: 'HIGH', category: 'Security & Compliance', description: 'Unexpected crontab modification detected', resolution: 'Review cron entries, compare with known-good baseline, investigate user who made change' },
    { name: 'Unauthorized SSH Key Addition', regex: /(authorized_keys|ssh.*key).*(added|modified|unauthorized|unexpected|changed)/i, severity: 'CRITICAL', category: 'Security & Compliance', description: 'Unauthorized SSH key added to authorized_keys', resolution: 'Remove unauthorized key, investigate access vector, rotate all SSH keys, audit access logs' },
    { name: 'Password File Modification', regex: /(passwd|shadow|group).*(modified|changed|tampere|unexpected|write)/i, severity: 'CRITICAL', category: 'Security & Compliance', description: 'System password or shadow file unexpectedly modified', resolution: 'Investigate immediately, compare with backup, check for added users, audit trail review' },
    { name: 'Firewall Rule Violation', regex: /firewall.*(violation|blocked|denied|reject|rule.*match)/i, severity: 'MEDIUM', category: 'Security & Compliance', description: 'Firewall rule violation - traffic blocked', resolution: 'Review blocked traffic, verify if legitimate, update rules if needed, check for attack patterns' },
    { name: 'Firewall Stateful Inspection Anomaly', regex: /firewall.*(stateful|state table|inspection).*(anomal|overflow|invalid|error)/i, severity: 'HIGH', category: 'Security & Compliance', description: 'Firewall stateful inspection detected anomaly', resolution: 'Check for DoS attack, verify state table capacity, review connection patterns' },
    { name: 'IDS Signature Matched', regex: /(ids|intrusion detection).*(signature|alert|match|detected)/i, severity: 'HIGH', category: 'Security & Compliance', description: 'Intrusion detection system matched a threat signature', resolution: 'Investigate alert, correlate with other events, block source if confirmed threat' },
    { name: 'IPS Traffic Blocked', regex: /(ips|intrusion prevention).*(block|prevent|inline|dropped|terminated)/i, severity: 'HIGH', category: 'Security & Compliance', description: 'Intrusion prevention system blocked malicious traffic', resolution: 'Review blocked traffic, verify signature accuracy, check for false positives' },
    { name: 'DDoS SYN Flood', regex: /(ddos|syn flood|syn.?attack).*(threshold|detected|exceeded|spike)/i, severity: 'CRITICAL', category: 'Security & Compliance', description: 'SYN flood attack detected', resolution: 'Enable SYN cookies, activate DDoS mitigation, rate limit connections, engage ISP/CDN protection' },
    { name: 'DDoS Volumetric Attack', regex: /(ddos|volumetric|bandwidth).*(attack|spike|flood|threshold|abnormal)/i, severity: 'CRITICAL', category: 'Security & Compliance', description: 'Volumetric DDoS attack detected', resolution: 'Engage upstream DDoS scrubbing, blackhole routing, CDN absorption, contact ISP' },
    { name: 'Data Exfiltration - Large Outbound', regex: /(exfiltration|data.?loss|large).*(outbound|transfer|upload).*(unknown|suspicious|unusual)/i, severity: 'CRITICAL', category: 'Security & Compliance', description: 'Possible data exfiltration - large outbound transfer to unknown destination', resolution: 'Block connection immediately, investigate source process, forensic analysis, notify security team' },
    { name: 'Data Exfiltration - DNS Tunneling', regex: /(dns tunnel|dns exfil|unusual dns).*(pattern|detected|query length|subdomain)/i, severity: 'CRITICAL', category: 'Security & Compliance', description: 'DNS tunneling pattern detected, possible data exfiltration', resolution: 'Block suspicious DNS traffic, investigate endpoint, deploy DNS monitoring' },
    { name: 'C2 Communication Detected', regex: /(command.?and.?control|c2|c&c|beacon).*(communication|connection|detected|known)/i, severity: 'CRITICAL', category: 'Security & Compliance', description: 'Communication to known C2/command-and-control address detected', resolution: 'Isolate affected system, block C2 address, full forensic investigation, incident response' },
    { name: 'PCI-DSS Violation', regex: /(pci.?dss|cardholder|payment card).*(violation|unencrypted|non.?compliant|breach)/i, severity: 'CRITICAL', category: 'Security & Compliance', description: 'PCI-DSS compliance violation detected', resolution: 'Remediate immediately, encrypt cardholder data, notify compliance team, document finding' },
    { name: 'HIPAA Access Violation', regex: /(hipaa|phi|protected health).*(violation|unauthorized|access|breach)/i, severity: 'CRITICAL', category: 'Security & Compliance', description: 'HIPAA-protected health information accessed without authorization', resolution: 'Document breach, notify privacy officer, investigate access, follow breach notification rules' },
  ];

  // ═══════════════════════════════════════════════════════════════════════════════
  // Merge all detection patterns into single array
  // ═══════════════════════════════════════════════════════════════════════════════
  const ALL_DETECTION_PATTERNS = [
    ...DETECTION_PATTERNS,
    ...DETECTION_PATTERNS_LINUX,
    ...DETECTION_PATTERNS_WINDOWS,
    ...DETECTION_PATTERNS_STORAGE,
    ...DETECTION_PATTERNS_NETWORK,
    ...DETECTION_PATTERNS_VIRT,
    ...DETECTION_PATTERNS_K8S,
    ...DETECTION_PATTERNS_DATABASE,
    ...DETECTION_PATTERNS_SECURITY
  ];

  // ─── Pattern Matching Engine ───────────────────────────────────────────────────
  function analyzeLogLine(line) {
    const matches = [];
    for (const pattern of ALL_DETECTION_PATTERNS) {
      if (pattern.regex.test(line)) {
        matches.push({
          name: pattern.name,
          severity: pattern.severity,
          category: pattern.category,
          description: pattern.description,
          resolution: pattern.resolution
        });
      }
    }
    return matches;
  }

  function getDetectionPatterns() {
    return ALL_DETECTION_PATTERNS;
  }

  function getPatternCount() {
    return ALL_DETECTION_PATTERNS.length;
  }

  // ─── Module Exports ────────────────────────────────────────────────────────────

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { renderPatternUpdatesPanel, checkForUpdates, getPatternVersion, ALL_DETECTION_PATTERNS, analyzeLogLine, getDetectionPatterns, getPatternCount };
  }

  // Also expose on window for browser use
  window.LogSherlockPatternUpdates = {
    renderPatternUpdatesPanel,
    checkForUpdates,
    getPatternVersion,
    analyzeLogLine,
    getDetectionPatterns,
    getPatternCount
  };

})();
