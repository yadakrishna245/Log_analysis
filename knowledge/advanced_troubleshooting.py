"""Advanced Troubleshooting Knowledge Base for LogSherlock Pro.

Covers: GFS2, Storage/LUN, Kernel, OOM, CPU, Alletra, GreenLake, Multipath
Source: HPE support engineering best practices + vendor documentation
Added: August 2026
"""

ADVANCED_TROUBLESHOOTING = [
    # ═══════════════════════════════════════════════════════════════
    # GFS2 / DLM ISSUES
    # ═══════════════════════════════════════════════════════════════
    {
        'id': 'ADV-001',
        'title': 'GFS2 Filesystem Withdraw Due to I/O Errors',
        'category': 'gfs2',
        'products': ['GFS2', 'Pacemaker', 'Alletra'],
        'severity': 'critical',
        'symptoms': 'GFS2 withdraw messages in dmesg/messages. Filesystem becomes inaccessible. Applications get EIO errors. "GFS2: fsid=X:Y.Z: about to withdraw" in logs.',
        'root_cause': 'GFS2 withdraws when it detects inconsistency to prevent data corruption. Common causes: underlying storage I/O failures, DLM communication loss, SCSI reservation conflicts, or disk timeouts exceeding cluster fence timeout.',
        'diagnostic_commands': [
            'dmesg | grep -i "gfs2.*withdraw"',
            'journalctl -k | grep -i gfs2',
            'cat /sys/kernel/debug/gfs2/*/glocks | head -50',
            'dlm_tool ls',
            'dlm_tool lockdebug <lockspace>',
            'multipath -ll',
            'pcs status',
        ],
        'solution': '1. Relocate services to another node: pcs resource move <resource>\n2. Reboot the withdrawn node (preferred) or fence it: pcs stonith fence <node>\n3. After reboot, verify storage health: multipath -ll\n4. If corruption suspected: umount on all nodes, run fsck.gfs2 -y /dev/mapper/<device>\n5. Remount and restart services: pcs resource clear <resource>',
        'prevention': 'Ensure storage paths are redundant (multipath). Set proper I/O timeout values. Monitor storage latency. Keep GFS2 and kernel packages updated. Configure fence timeout < storage I/O timeout.',
        'log_signatures': [
            r'GFS2.*withdraw',
            r'GFS2.*fsid.*about to withdraw',
            r'GFS2.*forcing withdraw',
            r'GFS2.*filesystem.*withdraw',
        ],
        'references': ['https://access.redhat.com/solutions/141203'],
    },
    {
        'id': 'ADV-002',
        'title': 'GFS2 Remounted Read-Only Due to Storage Errors',
        'category': 'gfs2',
        'products': ['GFS2', 'Alletra', 'Nimble'],
        'severity': 'critical',
        'symptoms': 'Filesystem becomes read-only unexpectedly. Applications fail with "Read-only file system" errors. dmesg shows "Remounting filesystem read-only".',
        'root_cause': 'Kernel remounts GFS2 read-only when it encounters I/O errors that make write operations unsafe. Usually caused by: all multipath paths failing briefly, storage array timeout, or SCSI errors on the backing LUN.',
        'diagnostic_commands': [
            'mount | grep gfs2',
            'dmesg | grep -i "read.only\\|remount"',
            'multipath -ll | grep -A5 "mpath"',
            'cat /sys/block/dm-*/device/state',
            'iscsiadm -m session -P3',
        ],
        'solution': '1. Check and fix storage paths: multipath -ll\n2. If paths are back: umount /mountpoint\n3. Verify filesystem: fsck.gfs2 -n /dev/mapper/<device>\n4. Remount: mount /dev/mapper/<device> /mountpoint\n5. If cluster resource: pcs resource restart <resource>',
        'prevention': 'Configure multipath with proper failback timers. Set no_path_retry to queue or a high number. Monitor path health with multipathd. Set up storage alerting.',
        'log_signatures': [
            r'Remounting filesystem read-only.*gfs2',
            r'GFS2.*remount.*ro',
            r'EXT4.*read.only',
        ],
        'references': ['https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/configuring_gfs2_file_systems/'],
    },
    {
        'id': 'ADV-003',
        'title': 'DLM Quorum Lost - GFS2 Operations Hang',
        'category': 'gfs2',
        'products': ['GFS2', 'Pacemaker', 'Corosync'],
        'severity': 'critical',
        'symptoms': 'GFS2 operations (ls, touch, df) hang indefinitely. DLM shows "not quorate". Corosync ring errors. pcs status shows nodes offline.',
        'root_cause': 'DLM requires cluster quorum to operate. When quorum is lost (>50% nodes unreachable), DLM blocks all lock operations, causing GFS2 to hang. Root causes: network partition, corosync failure, or too many nodes fenced simultaneously.',
        'diagnostic_commands': [
            'corosync-quorumtool',
            'corosync-cfgtool -s',
            'dlm_tool ls',
            'dlm_tool status',
            'pcs status --full',
            'journalctl -u corosync --since "1 hour ago"',
        ],
        'solution': '1. Check quorum status: corosync-quorumtool\n2. If network issue: fix network connectivity between nodes\n3. If nodes are fenced: restart corosync on fenced nodes: systemctl restart corosync\n4. Force quorum (DANGEROUS - only if you know state): corosync-quorumtool -e 1\n5. Verify DLM recovery: dlm_tool ls (should show "members" matching cluster)',
        'prevention': 'Use redundant corosync rings (rrp). Monitor corosync token timeouts. Set up network monitoring between nodes. Consider two_node mode with auto_tie_breaker for 2-node clusters.',
        'log_signatures': [
            r'DLM.*not quorate',
            r'dlm.*quorum.*not achieved',
            r'corosync.*quorum lost',
            r'dlm_controld.*quorum',
        ],
        'references': ['https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/7/html/global_file_system_2/'],
    },
    {
        'id': 'ADV-004',
        'title': 'GFS2 Mount Failure - DLM Lockspace Not Available',
        'category': 'gfs2',
        'products': ['GFS2', 'Pacemaker', 'DLM'],
        'severity': 'high',
        'symptoms': 'mount command hangs or fails with "mount.gfs2: dlm not ready". dlm_controld not running or not joined. pcs shows DLM resource stopped.',
        'root_cause': 'GFS2 requires DLM lockspace to be active before mounting. If DLM resource fails to start, or if controld cannot join the cluster lockspace, GFS2 cannot mount. Causes: corosync not running, DLM resource constraint issue, or previous unclean shutdown.',
        'diagnostic_commands': [
            'pcs resource show dlm',
            'systemctl status dlm',
            'dlm_tool ls',
            'cat /sys/kernel/config/dlm/cluster/comms/*/addr',
            'journalctl -u dlm --since "30 min ago"',
        ],
        'solution': '1. Verify corosync is running: systemctl status corosync\n2. Start DLM if stopped: pcs resource enable dlm-clone\n3. If DLM stuck: pcs resource cleanup dlm-clone\n4. Check for location constraints: pcs constraint show --full\n5. If all else fails: restart pacemaker on affected node: systemctl restart pacemaker',
        'prevention': 'Ensure DLM resource has proper ordering constraints (start before GFS2). Use resource groups or colocation constraints. Monitor DLM resource health.',
        'log_signatures': [
            r'mount\.gfs2.*dlm not ready',
            r'dlm.*lockspace.*not found',
            r'dlm_controld.*join.*fail',
        ],
        'references': [],
    },
    {
        'id': 'ADV-005',
        'title': 'GFS2 Journal Blocked - Lock Contention',
        'category': 'gfs2',
        'products': ['GFS2'],
        'severity': 'high',
        'symptoms': 'GFS2 performance severely degraded. Processes in D-state waiting on GFS2. "gfs2: jid=X: journal blocked" in kernel logs. High DLM lock wait times.',
        'root_cause': 'Journal blocking occurs when a node cannot obtain the locks it needs for journaling. Usually caused by: another node holding locks for too long (slow I/O), too many nodes accessing same directory, or DLM communication delays.',
        'diagnostic_commands': [
            'cat /sys/kernel/debug/gfs2/*/glocks | grep -c "H W"',
            'cat /proc/fs/gfs2/*/demote_rq',
            'dlm_tool lockdebug <lockspace> | grep -c "wait"',
            'glocktop (from gfs2-utils)',
            'ps aux | grep " D "',
        ],
        'solution': '1. Identify the contending node: check DLM debug for long-held locks\n2. Check storage latency on that node: iostat -x 1 5\n3. If storage is slow: fix multipath/storage issues first\n4. Reduce concurrent access: spread workloads across different directories\n5. Consider tuning: echo 10 > /sys/kernel/debug/gfs2/<fsname>/log_flush_time',
        'prevention': 'Avoid having all nodes write to the same directory. Use localflocks mount option where appropriate. Monitor per-node I/O latency. Keep storage latency < 5ms for GFS2 workloads.',
        'log_signatures': [
            r'gfs2.*journal.*blocked',
            r'gfs2.*jid.*blocked',
            r'GFS2.*stuck.*lock',
        ],
        'references': [],
    },
    {
        'id': 'ADV-006',
        'title': 'GFS2 Slow Performance - Excessive Lock Traffic',
        'category': 'gfs2',
        'products': ['GFS2', 'DLM'],
        'severity': 'medium',
        'symptoms': 'GFS2 operations are 10-100x slower than expected. High CPU usage by glock_workqueue. Network traffic between nodes is high. dlm_tool shows high lock counts.',
        'root_cause': 'GFS2 uses distributed locking for cache coherency. Operations that modify metadata (create/delete files, update timestamps) require cluster-wide lock negotiation. Workloads with many small files or frequent metadata updates perform poorly.',
        'diagnostic_commands': [
            'cat /proc/fs/gfs2/<fsname>/glstats',
            'dlm_tool lockdebug <lockspace> | wc -l',
            'perf top -p $(pgrep glock_workqueue)',
            'echo "noatime,nodiratime" >> /etc/fstab',
            'cat /sys/kernel/debug/gfs2/<fsname>/sbstats',
        ],
        'solution': '1. Mount with noatime,nodiratime: reduces metadata updates by 30-50%\n2. Use localflocks if POSIX locks not needed across nodes\n3. Partition workload: each node writes to its own subdirectory\n4. For temp files: use local /tmp instead of GFS2\n5. Increase DLM socket buffer: sysctl -w net.core.rmem_max=4194304',
        'prevention': 'Design applications for clustered filesystem patterns. Avoid ls -la on large directories from multiple nodes simultaneously. Use resource affinity to pin workloads to nodes.',
        'log_signatures': [
            r'glock_workqueue.*CPU',
            r'dlm.*lock.*timeout',
        ],
        'references': [],
    },

    # ═══════════════════════════════════════════════════════════════
    # LUN CONFIGURATION & STORAGE ISSUES
    # ═══════════════════════════════════════════════════════════════
    {
        'id': 'ADV-007',
        'title': 'Step-by-Step: Configure New iSCSI LUN on Linux Host',
        'category': 'lun',
        'products': ['Alletra', 'Nimble', 'general'],
        'severity': 'medium',
        'symptoms': 'New LUN provisioned on storage array but not visible on Linux host. Need to discover and configure new storage.',
        'root_cause': 'Linux does not auto-discover new LUNs. Manual iSCSI discovery, login, multipath configuration, and filesystem creation are required.',
        'diagnostic_commands': [
            'iscsiadm -m discovery -t st -p <target-ip>',
            'iscsiadm -m session',
            'lsblk',
            'multipath -ll',
            'cat /etc/iscsi/initiatorname.iscsi',
        ],
        'solution': '''STEP-BY-STEP NEW LUN CONFIGURATION:

1. VERIFY INITIATOR NAME:
   cat /etc/iscsi/initiatorname.iscsi
   # Note the IQN - must match initiator group on array

2. DISCOVER TARGETS:
   iscsiadm -m discovery -t sendtargets -p <storage-ip>:3260
   # Should list available targets

3. LOGIN TO TARGET:
   iscsiadm -m node -T <target-iqn> -p <storage-ip>:3260 --login
   # For all paths: repeat for each storage IP

4. VERIFY NEW DISKS:
   lsblk | grep sd
   # New disks appear as /dev/sdX
   cat /proc/scsi/scsi

5. CONFIGURE MULTIPATH:
   # Edit /etc/multipath.conf if needed
   multipath -ll
   # New mpath device should appear
   # If not: multipath -r (reconfigure)

6. CREATE FILESYSTEM:
   mkfs.xfs /dev/mapper/mpathX    # or mkfs.gfs2 for cluster
   mkdir /mountpoint
   mount /dev/mapper/mpathX /mountpoint

7. PERSIST ACROSS REBOOTS:
   # Add to /etc/fstab:
   /dev/mapper/mpathX  /mountpoint  xfs  _netdev,nofail  0  0
   # Enable iSCSI at boot:
   systemctl enable iscsid iscsi multipathd

8. VERIFY:
   df -h /mountpoint
   multipath -ll | grep mpathX''',
        'prevention': 'Document all LUN mappings. Use consistent initiator group naming. Label LUNs clearly on the array. Always use multipath for production LUNs.',
        'log_signatures': [
            r'iscsiadm.*discovery',
            r'new.*device.*found',
            r'scsi.*Attached.*disk',
        ],
        'references': ['https://pubs.lenovo.com/iscsi_configuration_for_red_hat_enterprise_linux_express_guide/'],
    },
    {
        'id': 'ADV-008',
        'title': 'LUN Not Visible After Provisioning on Storage Array',
        'category': 'lun',
        'products': ['Alletra', 'Nimble'],
        'severity': 'high',
        'symptoms': 'New LUN created on HPE Alletra/Nimble but Linux host cannot see it. iscsiadm discovery shows target but no new disk after login. lsblk shows no new devices.',
        'root_cause': 'Common causes: 1) Initiator group ACL not configured on array, 2) Wrong IQN in initiator group, 3) iSCSI session already active (needs rescan not new login), 4) LUN masking/mapping not done.',
        'diagnostic_commands': [
            'cat /etc/iscsi/initiatorname.iscsi',
            'iscsiadm -m session -P3 | grep -i "target\\|disk\\|lun"',
            'for i in /sys/class/scsi_host/host*/scan; do echo "- - -" > $i; done',
            'dmesg | tail -20',
            'multipath -r',
        ],
        'solution': '''1. ON STORAGE ARRAY (Nimble/Alletra CLI):
   vol --list                              # Verify volume exists
   initiatorgrp --list                     # Check initiator groups
   vol --info <vol-name> --fields acl      # Check ACL assigned

2. VERIFY IQN MATCHES:
   # On Linux:
   cat /etc/iscsi/initiatorname.iscsi
   # On Array:
   initiatorgrp --info <group-name>        # IQN must match!

3. IF SESSION ALREADY ACTIVE (just need rescan):
   iscsiadm -m node -R                     # Rescan all sessions
   # OR per-host rescan:
   for i in /sys/class/scsi_host/host*/scan; do echo "- - -" > $i; done

4. CHECK DMESG FOR NEW DISK:
   dmesg | grep -i "scsi\\|sd\\|attached"

5. RECONFIGURE MULTIPATH:
   multipath -r
   multipath -ll''',
        'prevention': 'Always verify IQN matches before provisioning. Use automation scripts for consistent LUN provisioning. Document the LUN-to-host mapping.',
        'log_signatures': [
            r'scsi.*no.*lun',
            r'iscsiadm.*no records found',
            r'multipath.*orphan',
        ],
        'references': ['https://infosight.hpe.com/InfoSight/media/cms/active/public/pubs__CLI_Administration_Guide_6_0_x.whz'],
    },
    {
        'id': 'ADV-009',
        'title': 'Multipath Path Failure - Paths Showing Failed/Faulty',
        'category': 'storage',
        'products': ['Alletra', 'Nimble', 'general'],
        'severity': 'high',
        'symptoms': 'multipath -ll shows paths as "failed faulty running". I/O latency increased. Some paths showing [ghost] or [faulty]. Alert from storage about connectivity loss.',
        'root_cause': 'Physical or logical connectivity loss between host HBA/NIC and storage port. Causes: network switch failure, cable issue, storage port offline, iSCSI session timeout, or NIC driver crash.',
        'diagnostic_commands': [
            'multipath -ll',
            'multipathd show paths',
            'iscsiadm -m session -P1',
            'ethtool <iscsi-interface>',
            'ip link show',
            'dmesg | grep -i "iscsi\\|scsi\\|link.*down"',
            'cat /sys/class/scsi_host/host*/link_state',
        ],
        'solution': '''1. IDENTIFY FAILED PATHS:
   multipathd show paths format "%d %t %T %s"

2. CHECK NETWORK CONNECTIVITY:
   ping <storage-data-ip>
   ethtool <interface> | grep "Link detected"

3. IF ISCSI SESSION DOWN:
   iscsiadm -m session -P1            # Check session state
   iscsiadm -m node -T <target> -p <ip> --logout
   iscsiadm -m node -T <target> -p <ip> --login

4. FORCE PATH REINSTATE:
   multipathd reinstate path <sd-device>
   # OR
   echo 1 > /sys/block/sdX/device/rescan

5. IF PATH WON'T RECOVER:
   multipathd del path <sd-device>
   echo "- - -" > /sys/class/scsi_host/hostX/scan
   multipath -r''',
        'prevention': 'Use redundant paths (minimum 4 paths per LUN: 2 controllers x 2 host ports). Configure proper path checkers in multipath.conf. Set up path monitoring alerts.',
        'log_signatures': [
            r'multipath.*path.*fail',
            r'mpath.*path.*down',
            r'scsi.*path.*offline',
            r'device-mapper.*path.*fail',
        ],
        'references': [],
    },
    {
        'id': 'ADV-010',
        'title': 'SCSI Reservation Conflict - Split Brain Storage Access',
        'category': 'storage',
        'products': ['Alletra', 'Nimble', 'GFS2', 'Pacemaker'],
        'severity': 'critical',
        'symptoms': 'SCSI reservation conflict errors in dmesg. I/O errors on shared LUNs. Multiple nodes fighting over disk access. "reservation conflict" messages flooding logs.',
        'root_cause': 'SCSI-3 Persistent Reservations (PR) enforce that only registered nodes can access shared LUNs. Conflicts occur when: fence action fails to clear registrations, split-brain scenario, or incorrect SCSI PR configuration.',
        'diagnostic_commands': [
            'sg_persist -ik /dev/mapper/mpathX',
            'sg_persist -ir /dev/mapper/mpathX',
            'dmesg | grep -i "reservation"',
            'pcs stonith history',
            'fence_scsi -n <node> -d /dev/mapper/mpathX -a status',
        ],
        'solution': '''1. IDENTIFY WHO HOLDS RESERVATION:
   sg_persist -ir /dev/mapper/mpathX     # Read reservations
   sg_persist -ik /dev/mapper/mpathX     # Read registered keys

2. CLEAR STALE REGISTRATIONS (CAREFUL!):
   sg_persist --out --register --param-sark=0 --param-rk=<stale-key> /dev/mapper/mpathX

3. RE-REGISTER THIS NODE:
   sg_persist --out --register --param-sark=<node-key> /dev/mapper/mpathX

4. IF USING FENCE_SCSI:
   fence_scsi -n <dead-node> -d /dev/mapper/mpathX -a off
   # This clears the dead node registration

5. VERIFY:
   sg_persist -ik /dev/mapper/mpathX
   # Only active nodes should have keys''',
        'prevention': 'Ensure fencing is properly configured and tested. Use fence_scsi with proper key mapping. Test fencing regularly. Never disable fencing in production clusters.',
        'log_signatures': [
            r'reservation conflict',
            r'SCSI.*reservation.*conflict',
            r'sd\w+.*reservation conflict',
        ],
        'references': [],
    },
    {
        'id': 'ADV-011',
        'title': 'iSCSI Session Timeout and Recovery',
        'category': 'storage',
        'products': ['Alletra', 'Nimble'],
        'severity': 'high',
        'symptoms': 'iSCSI sessions dropping intermittently. "connection X:0 is operational after recovery" messages. Brief I/O pauses. Storage latency spikes.',
        'root_cause': 'iSCSI sessions time out when: network latency exceeds NOP-out interval, storage controller is busy, network packet loss exceeds threshold, or MTU mismatch causes fragmentation.',
        'diagnostic_commands': [
            'iscsiadm -m session -P3',
            'cat /sys/class/iscsi_connection/connection*/ping_tmo',
            'dmesg | grep -i "iscsi.*recovery\\|iscsi.*timeout"',
            'ethtool -S <interface> | grep -i "error\\|drop"',
            'ping -s 8972 <storage-ip>',
        ],
        'solution': '''1. CHECK SESSION PARAMETERS:
   iscsiadm -m session -P3 | grep -i "timeout\\|interval"

2. TUNE ISCSI TIMERS (in /etc/iscsi/iscsid.conf):
   node.session.timeo.replacement_timeout = 120
   node.conn[0].timeo.noop_out_interval = 5
   node.conn[0].timeo.noop_out_timeout = 10

3. CHECK NETWORK MTU:
   ip link show <interface>
   # Ensure jumbo frames match on host, switch, and storage:
   ping -M do -s 8972 <storage-ip>

4. CHECK FOR PACKET LOSS:
   ping -c 1000 -i 0.01 <storage-ip> | tail -3

5. RESTART ISCSI SESSIONS:
   iscsiadm -m node -T <target> -p <ip> --logout
   iscsiadm -m node -T <target> -p <ip> --login''',
        'prevention': 'Use dedicated storage network (VLAN). Enable jumbo frames end-to-end. Use flow control on switches. Monitor iSCSI session health. Set proper timeout values.',
        'log_signatures': [
            r'iscsi.*session.*recovery',
            r'iscsi.*connection.*timeout',
            r'iscsi.*recv.*timeout',
            r'connection.*operational after recovery',
        ],
        'references': [],
    },


    # ═══════════════════════════════════════════════════════════════
    # KERNEL / OOM / CPU ISSUES
    # ═══════════════════════════════════════════════════════════════
    {
        'id': 'ADV-012',
        'title': 'OOM Killer Terminating Critical Processes',
        'category': 'memory',
        'products': ['general', 'VME'],
        'severity': 'critical',
        'symptoms': 'Processes disappearing without crash log. "Out of memory: Kill process" in dmesg. "oom-kill" or "invoked oom-killer" messages. Service restart loops.',
        'root_cause': 'System ran out of RAM + swap. OOM killer selects victim process based on oom_score (memory usage + other factors). Common causes: memory leak in application, too many VMs on host, insufficient RAM for workload, or swap disabled.',
        'diagnostic_commands': [
            'dmesg | grep -i "oom\\|kill\\|out of memory"',
            'journalctl --since "1 hour ago" | grep -i oom',
            'cat /proc/meminfo',
            'free -h',
            'ps aux --sort=-%mem | head -20',
            'cat /proc/<pid>/oom_score',
            'slabtop -o | head -20',
        ],
        'solution': '''1. IDENTIFY WHAT WAS KILLED:
   dmesg | grep "Killed process"
   # Shows PID, process name, and memory usage at time of kill

2. CHECK CURRENT MEMORY STATE:
   free -h
   cat /proc/meminfo | grep -i "memfree\\|memavail\\|swap"

3. FIND MEMORY HOGS:
   ps aux --sort=-%mem | head -10

4. PROTECT CRITICAL PROCESSES:
   echo -1000 > /proc/<pid>/oom_score_adj    # Protect from OOM
   # For systemd services, add to unit file:
   # OOMScoreAdjust=-1000

5. ADD SWAP (temporary fix):
   fallocate -l 4G /swapfile
   chmod 600 /swapfile
   mkswap /swapfile
   swapon /swapfile

6. LONG-TERM: Add RAM or fix the memory leak''',
        'prevention': 'Monitor memory usage trends. Set memory limits in cgroups/systemd. Protect critical services with oom_score_adj=-1000. Enable swap as safety net. Set up memory pressure alerts at 80% threshold.',
        'log_signatures': [
            r'Out of memory.*Kill process',
            r'oom-kill',
            r'invoked oom-killer',
            r'oom_reaper',
            r'Killed process \d+',
        ],
        'references': ['https://www.oracle.com/technical-resources/articles/it-infrastructure/dev-oom-killer.html'],
    },
    {
        'id': 'ADV-013',
        'title': 'OOM Killer Tuning - Protect Specific Processes',
        'category': 'memory',
        'products': ['general', 'VME', 'QEMU-KVM'],
        'severity': 'medium',
        'symptoms': 'OOM killer repeatedly targeting the wrong process. Critical service killed while non-essential processes survive. Need to control OOM victim selection.',
        'root_cause': 'OOM killer selects victims based on oom_score which factors in: memory usage, process age, nice value, and hardware access. Without tuning, the largest process gets killed — often the critical one.',
        'diagnostic_commands': [
            'cat /proc/*/oom_score_adj | sort -n',
            'for p in /proc/[0-9]*/; do echo "$(cat $p/oom_score_adj 2>/dev/null) $(cat $p/cmdline 2>/dev/null | tr "\\0" " ")"; done | sort -n',
            'sysctl vm.panic_on_oom',
            'sysctl vm.overcommit_memory',
            'systemctl show <service> | grep OOM',
        ],
        'solution': '''TUNING OOM SCORE:
Range: -1000 (never kill) to +1000 (always kill first)

1. PROTECT A PROCESS (runtime):
   echo -1000 > /proc/<pid>/oom_score_adj

2. PROTECT A SYSTEMD SERVICE (permanent):
   systemctl edit <service>
   [Service]
   OOMScoreAdjust=-1000

3. MAKE A PROCESS PREFERRED VICTIM:
   echo 1000 > /proc/<pid>/oom_score_adj

4. SYSTEM-WIDE SETTINGS:
   # Disable overcommit (strict - may cause allocation failures):
   sysctl -w vm.overcommit_memory=2
   sysctl -w vm.overcommit_ratio=80

   # Panic on OOM instead of killing (for HA clusters):
   sysctl -w vm.panic_on_oom=1
   # Node will reboot, triggering cluster failover

5. PERSIST SYSCTL:
   echo "vm.panic_on_oom=1" >> /etc/sysctl.d/99-oom.conf''',
        'prevention': 'Set OOMScoreAdjust for all critical services. Use cgroups memory limits to contain applications. Monitor memory trends. Consider vm.panic_on_oom=1 for cluster nodes.',
        'log_signatures': [
            r'oom_score_adj',
            r'oom_kill_process',
            r'vm\.panic_on_oom',
        ],
        'references': [],
    },
    {
        'id': 'ADV-014',
        'title': 'Kernel Soft Lockup - CPU Stuck in Kernel Code',
        'category': 'kernel',
        'products': ['general', 'VME'],
        'severity': 'critical',
        'symptoms': '"BUG: soft lockup - CPU#X stuck for Xs!" in dmesg. System partially responsive. Some CPUs not servicing interrupts. Watchdog timer firing.',
        'root_cause': 'A CPU has been executing kernel code without yielding for >20 seconds (default). Causes: busy spinlock, interrupt storm, driver bug, extremely high I/O causing long interrupt handlers, or kernel bug.',
        'diagnostic_commands': [
            'dmesg | grep -i "soft lockup\\|hard lockup\\|RCU"',
            'cat /proc/interrupts | sort -t: -k2 -rn | head',
            'mpstat -P ALL 1 5',
            'perf top',
            'cat /proc/sys/kernel/watchdog_thresh',
            'sysctl kernel.softlockup_panic',
        ],
        'solution': '''1. IDENTIFY THE STUCK CPU AND FUNCTION:
   dmesg | grep "soft lockup"
   # Shows: CPU number, function name, and call trace

2. IF CAUSED BY HIGH I/O LOAD:
   iostat -x 1 5
   # Reduce I/O or fix storage bottleneck

3. IF CAUSED BY IRQ STORM:
   watch -n1 "cat /proc/interrupts"
   # Identify rapidly incrementing IRQ

4. TEMPORARY MITIGATION (increase threshold):
   sysctl -w kernel.watchdog_thresh=30
   # Or disable soft lockup detection:
   sysctl -w kernel.soft_watchdog=0

5. IF PERSISTENT - PANIC FOR CRASH DUMP:
   sysctl -w kernel.softlockup_panic=1
   # Next soft lockup will trigger kdump for analysis

6. CHECK FOR KNOWN KERNEL BUGS:
   uname -r   # Note kernel version
   # Search Red Hat bugzilla or HPE advisories''',
        'prevention': 'Keep kernel updated. Monitor CPU utilization per-core. Use irqbalance for interrupt distribution. Test workloads before production deployment.',
        'log_signatures': [
            r'BUG: soft lockup',
            r'soft lockup.*CPU.*stuck',
            r'watchdog.*BUG',
            r'RCU.*stall',
        ],
        'references': ['https://www.suse.com/support/kb/doc/?id=000018705'],
    },
    {
        'id': 'ADV-015',
        'title': 'Hung Task - Process Blocked for More Than 120 Seconds',
        'category': 'kernel',
        'products': ['general', 'GFS2', 'Alletra'],
        'severity': 'high',
        'symptoms': '"INFO: task X blocked for more than 120 seconds" in dmesg. Processes in D (uninterruptible sleep) state. Cannot kill processes with SIGKILL. System sluggish.',
        'root_cause': 'Process is waiting for I/O or a kernel lock that never completes. Common causes: NFS server unreachable, storage path failure, GFS2 DLM lock contention, or kernel deadlock. D-state processes cannot be killed.',
        'diagnostic_commands': [
            'dmesg | grep "blocked for more than"',
            'ps aux | awk \'$8 ~ /D/ {print}\'',
            'cat /proc/<pid>/stack',
            'cat /proc/<pid>/wchan',
            'iostat -x 1 3',
            'cat /proc/sys/kernel/hung_task_timeout_secs',
        ],
        'solution': '''1. IDENTIFY BLOCKED PROCESSES:
   ps aux | awk \'$8 ~ /D/\'
   # Lists all processes in uninterruptible sleep

2. CHECK WHAT THEY ARE WAITING FOR:
   cat /proc/<pid>/stack
   # Shows kernel stack trace - identify if NFS, disk, or lock

3. IF STORAGE RELATED:
   multipath -ll              # Check path status
   iostat -x 1               # Check I/O latency

4. IF NFS RELATED:
   mount | grep nfs
   ping <nfs-server>
   # Consider umount -f or umount -l

5. IF GFS2/DLM RELATED:
   dlm_tool ls               # Check DLM health
   # May need to fence the blocking node

6. ADJUST TIMEOUT (suppress warnings only):
   sysctl -w kernel.hung_task_timeout_secs=300
   # Or disable: sysctl -w kernel.hung_task_timeout_secs=0''',
        'prevention': 'Set proper I/O timeouts. Monitor storage latency. Use async I/O where possible. For NFS: use soft mount option or shorter timeo values.',
        'log_signatures': [
            r'blocked for more than \d+ seconds',
            r'INFO: task.*blocked',
            r'hung_task_timeout',
            r'"echo 0 > /proc/sys/kernel/hung_task_timeout_secs" disables this message',
        ],
        'references': ['https://blog.cloudflare.com/searching-for-the-cause-of-hung-tasks-in-the-linux-kernel/'],
    },
    {
        'id': 'ADV-016',
        'title': 'High CPU Usage - Identifying Root Cause',
        'category': 'cpu',
        'products': ['general', 'VME', 'QEMU-KVM'],
        'severity': 'medium',
        'symptoms': 'System load average > number of CPUs. Commands slow to respond. top shows high %cpu. Users report sluggish performance.',
        'root_cause': 'CPU saturation from: runaway process, too many active processes, kernel overhead (context switching), interrupt processing, or insufficient CPU for workload.',
        'diagnostic_commands': [
            'uptime',
            'top -b -n1 | head -20',
            'mpstat -P ALL 1 5',
            'pidstat -u 1 5',
            'vmstat 1 10',
            'sar -u 1 10',
            'perf top -g',
            'cat /proc/stat | head -5',
        ],
        'solution': '''1. IDENTIFY CPU HOG:
   top -b -n1 -o %CPU | head -15
   pidstat -u 1 5 | sort -k8 -rn | head

2. CHECK IF USER OR SYSTEM CPU:
   mpstat -P ALL 1 3
   # High %sys = kernel/driver issue
   # High %usr = application issue
   # High %wa = waiting for I/O (not true CPU issue)

3. FOR RUNAWAY PROCESS:
   renice +19 -p <pid>        # Lower priority
   kill -STOP <pid>           # Pause it
   kill -9 <pid>              # Kill it

4. FOR HIGH CONTEXT SWITCHING:
   vmstat 1 5                  # Check cs column
   pidstat -w 1 5              # Per-process context switches

5. FOR HIGH INTERRUPT LOAD:
   cat /proc/interrupts | sort -t: -k2 -rn
   irqbalance --oneshot        # Rebalance IRQs

6. CHECK CPU THROTTLING:
   cat /sys/devices/system/cpu/cpu*/cpufreq/scaling_cur_freq
   # If throttled: check temperature or power management''',
        'prevention': 'Set CPU resource limits in cgroups. Monitor CPU trends. Use cpuacct cgroup for per-service CPU tracking. Configure alerts at 80% sustained usage.',
        'log_signatures': [
            r'CPU.*100%',
            r'load average.*high',
            r'kernel.*rcu.*stall',
        ],
        'references': [],
    },
    {
        'id': 'ADV-017',
        'title': 'Kernel Panic - System Crash and Recovery',
        'category': 'kernel',
        'products': ['general'],
        'severity': 'critical',
        'symptoms': 'System unresponsive. Console shows "Kernel panic - not syncing". System reboots unexpectedly. kdump vmcore generated.',
        'root_cause': 'Kernel encountered an unrecoverable error. Causes: hardware failure (bad RAM, CPU), kernel bug, corrupted kernel module, or deliberate panic (panic_on_oom, softlockup_panic).',
        'diagnostic_commands': [
            'ls /var/crash/',
            'crash /var/crash/vmcore /usr/lib/debug/lib/modules/$(uname -r)/vmlinux',
            'journalctl -b -1 | tail -50',
            'cat /proc/cmdline | grep crashkernel',
            'systemctl status kdump',
            'mcelog --client',
        ],
        'solution': '''1. CHECK IF KDUMP CAPTURED THE CRASH:
   ls -la /var/crash/
   # If vmcore exists, analyze it

2. ANALYZE WITH CRASH TOOL:
   crash /var/crash/<date>/vmcore /usr/lib/debug/lib/modules/$(uname -r)/vmlinux
   crash> bt              # Backtrace
   crash> log             # Kernel log buffer
   crash> sys             # System info
   crash> mod             # Loaded modules

3. IF NO VMCORE - CHECK SERIAL CONSOLE LOG:
   journalctl -b -1 | grep -i "panic\\|oops\\|BUG"

4. CHECK HARDWARE ERRORS:
   mcelog --client        # Machine check exceptions
   edac-util -s           # Memory ECC errors
   ipmitool sel list      # IPMI system event log

5. IF RECURRING:
   # Test memory: memtest86+
   # Test disk: smartctl -t long /dev/sdX
   # Update kernel: yum update kernel''',
        'prevention': 'Enable kdump for crash analysis. Keep kernel updated. Monitor hardware health (mcelog, IPMI). Test memory periodically. Use ECC RAM in production.',
        'log_signatures': [
            r'Kernel panic',
            r'kernel panic.*not syncing',
            r'Oops:.*\[#\d+\]',
            r'BUG:.*unable to handle',
        ],
        'references': [],
    },
    {
        'id': 'ADV-018',
        'title': 'Memory Pressure - Swap Thrashing and Page Cache Exhaustion',
        'category': 'memory',
        'products': ['general', 'VME'],
        'severity': 'high',
        'symptoms': 'System extremely slow but not OOM. High swap usage (si/so in vmstat). High %wa in top. Applications experience multi-second pauses.',
        'root_cause': 'Workload exceeds available RAM, causing heavy swap activity. Every memory access may require disk I/O. Page cache is evicted, causing application re-reads from disk.',
        'diagnostic_commands': [
            'free -h',
            'vmstat 1 10',
            'sar -B 1 10',
            'cat /proc/meminfo | grep -i "swap\\|cache\\|free\\|available"',
            'swapon --show',
            'cat /proc/sys/vm/swappiness',
            'smem -t -k | tail -10',
        ],
        'solution': '''1. IDENTIFY SWAP USAGE:
   vmstat 1 5
   # si/so columns show swap in/out per second
   # If si+so > 100 consistently = thrashing

2. FIND WHAT IS USING SWAP:
   for pid in /proc/[0-9]*/; do
     echo "$(cat $pid/status 2>/dev/null | grep VmSwap | awk "{print \\$2}") $(cat $pid/cmdline 2>/dev/null | tr "\\0" " ")"
   done | sort -rn | head -10

3. REDUCE SWAP PRESSURE:
   sysctl -w vm.swappiness=10              # Default is 60
   sysctl -w vm.vfs_cache_pressure=50      # Reduce cache eviction

4. IF POSSIBLE - ADD RAM OR REDUCE WORKLOAD:
   # Kill or migrate non-essential processes
   # Reduce VM memory allocation

5. EMERGENCY - CLEAR SWAP (if enough free RAM now):
   swapoff -a && swapon -a   # Forces everything back to RAM''',
        'prevention': 'Size RAM appropriately for workload (monitor RSS trends). Set swappiness=10 for database/latency-sensitive workloads. Use memory cgroups to limit per-service usage. Alert when available memory < 20%.',
        'log_signatures': [
            r'swap.*full',
            r'kswapd.*consuming',
            r'page allocation failure',
            r'vm\.swappiness',
        ],
        'references': [],
    },


    # ═══════════════════════════════════════════════════════════════
    # HPE ALLETRA / GREENLAKE / NIMBLE ISSUES
    # ═══════════════════════════════════════════════════════════════
    {
        'id': 'ADV-019',
        'title': 'HPE Alletra/Nimble - Array Not Connecting to Data Services Cloud Console',
        'category': 'alletra',
        'products': ['Alletra', 'Nimble', 'GreenLake'],
        'severity': 'high',
        'symptoms': 'Array shows "Disconnected" in DSCC. Cannot manage array from GreenLake console. Array retries connection every 30 seconds. "phone home" failures.',
        'root_cause': 'Network connectivity issue between array management port and HPE cloud services. Causes: DNS not resolving HPE domains, firewall blocking outbound HTTPS, proxy misconfiguration, or NTP out of sync (>5 min drift).',
        'diagnostic_commands': [
            '# On Nimble/Alletra CLI:',
            'network --list',
            'network --test --target cloudservices.hpe.com',
            'date --display',
            'ntp --list',
            'group --info --fields phone_home_enabled',
            '# On network:',
            'nslookup cloudservices.hpe.com',
            'curl -v https://cloudservices.hpe.com',
        ],
        'solution': '''1. VERIFY DNS RESOLUTION FROM ARRAY:
   network --test --target cloudservices.hpe.com

2. CHECK REQUIRED ENDPOINTS (must be reachable via HTTPS/443):
   - cloudservices.hpe.com
   - sdi-device.hpe.com
   - scg.hpe.com
   - infosight.hpe.com

3. VERIFY NTP SYNC:
   date --display
   ntp --list
   # Time must be within 5 minutes of actual time

4. CHECK PROXY SETTINGS (if using proxy):
   group --info --fields proxy_addr,proxy_port

5. RE-REGISTER ARRAY:
   group --set --phone_home_enabled yes
   # Wait 60 seconds, check DSCC portal

6. IF FIREWALL ISSUE:
   # Allow outbound TCP/443 to HPE cloud IPs
   # Check with network team for proxy/firewall logs''',
        'prevention': 'Use dedicated management network with internet access. Configure NTP. Whitelist HPE endpoints in firewall. Monitor DSCC connectivity status.',
        'log_signatures': [
            r'phone.home.*fail',
            r'cloud.*connection.*fail',
            r'DSCC.*disconnect',
        ],
        'references': ['https://infosight.hpe.com/InfoSight/media/cms/active/public/pubs_Hardware_Guide_HPE_Alletra_5000__2120__Nimble_Storage_HFxx__ES3.whz/'],
    },
    {
        'id': 'ADV-020',
        'title': 'HPE Alletra/Nimble - Volume Access Denied for Initiator',
        'category': 'alletra',
        'products': ['Alletra', 'Nimble'],
        'severity': 'high',
        'symptoms': 'Host cannot see LUNs after provisioning. iSCSI login succeeds but no disks visible. "Access denied" in array event logs. SCSI inquiry returns no LUNs.',
        'root_cause': 'Volume Access Control List (ACL) not configured or IQN mismatch. The volume needs an initiator group with the correct host IQN assigned to it.',
        'diagnostic_commands': [
            '# On Array CLI:',
            'vol --list',
            'vol --info <vol-name> --fields access_control_records',
            'initiatorgrp --list',
            'initiatorgrp --info <group-name>',
            '# On Host:',
            'cat /etc/iscsi/initiatorname.iscsi',
            'iscsiadm -m session -P3',
        ],
        'solution': '''1. GET HOST IQN:
   cat /etc/iscsi/initiatorname.iscsi
   # Example: iqn.1994-05.com.redhat:node1.example.com

2. CREATE INITIATOR GROUP ON ARRAY:
   initiatorgrp --create <group-name> --access_protocol iscsi
   initiatorgrp --add_initiators <group-name> --initiator_name <host-iqn>

3. ADD ACL TO VOLUME:
   vol --addacl <vol-name> --initiatorgrp <group-name> --apply_acl_to both

4. VERIFY:
   vol --info <vol-name> --fields access_control_records

5. RESCAN ON HOST:
   iscsiadm -m node -R
   multipath -r
   lsblk''',
        'prevention': 'Automate LUN provisioning with scripts that include ACL setup. Document IQN-to-host mapping. Use naming conventions for initiator groups.',
        'log_signatures': [
            r'access.*denied',
            r'initiator.*not.*authorized',
            r'LUN.*not.*accessible',
        ],
        'references': ['https://infosight.hpe.com/InfoSight/media/cms/active/public/pubs__CLI_Administration_Guide_6_0_x.whz'],
    },
    {
        'id': 'ADV-021',
        'title': 'HPE Alletra/Nimble - Performance Degradation and High Latency',
        'category': 'alletra',
        'products': ['Alletra', 'Nimble'],
        'severity': 'high',
        'symptoms': 'Storage latency > 5ms. IOPS lower than expected. Array InfoSight shows performance alerts. Host I/O wait percentage high.',
        'root_cause': 'Causes: cache miss (working set > cache size), array controller CPU saturation, inter-array replication consuming bandwidth, snapshot overhead, or disk rebuild in progress.',
        'diagnostic_commands': [
            '# On Array CLI:',
            'vol --info <vol-name> --fields avg_latency_usec,iops',
            'pool --info default --fields cache_hit_ratio',
            'array --info --fields status,avg_cpu_usage',
            'disk --list --fields state,smart_data',
            '# On Host:',
            'iostat -xm 1 5',
            'sar -d 1 5',
        ],
        'solution': '''1. CHECK ARRAY HEALTH:
   array --info
   # Look for degraded state, rebuilds, replication

2. CHECK CACHE HIT RATIO:
   pool --info default --fields cache_hit_ratio
   # Should be > 95% for good performance

3. IDENTIFY HOT VOLUMES:
   vol --list --fields name,avg_latency_usec --orderby avg_latency_usec

4. CHECK FOR ACTIVE REBUILDS:
   disk --list --fields state
   # "rebuilding" state impacts performance

5. CHECK REPLICATION LOAD:
   volcoll --list --fields replication_status

6. IF CACHE IS LOW:
   # Consider adding SSD/cache to the array
   # Or move hot volumes to all-flash pool

7. THROTTLE NON-CRITICAL WORKLOADS:
   vol --edit <vol-name> --perfpolicy <lower-priority-policy>''',
        'prevention': 'Monitor InfoSight recommendations. Size cache appropriately for working set. Schedule array maintenance during off-peak hours. Use performance policies to prioritize critical volumes.',
        'log_signatures': [
            r'latency.*exceeded',
            r'cache.*miss.*high',
            r'array.*cpu.*100',
            r'disk.*rebuild',
        ],
        'references': [],
    },
    {
        'id': 'ADV-022',
        'title': 'HPE Alletra/Nimble - Snapshot and Replication Failures',
        'category': 'alletra',
        'products': ['Alletra', 'Nimble'],
        'severity': 'medium',
        'symptoms': 'Scheduled snapshots failing. Replication lagging or disconnected. "snapshot space limit reached" alerts. Volume collection showing errors.',
        'root_cause': 'Causes: snapshot space limit reached (default 200% of volume size), replication partner unreachable, network bandwidth insufficient for replication, or too many snapshots retained.',
        'diagnostic_commands': [
            'snap --list --vol <vol-name>',
            'snap --info <snap-name>',
            'vol --info <vol-name> --fields snap_usage_bytes,snap_limit_pct',
            'volcoll --info <volcoll-name>',
            'replicationpartner --list',
            'replicationpartner --info <partner-name>',
        ],
        'solution': '''1. CHECK SNAPSHOT USAGE:
   vol --info <vol-name> --fields snap_usage_bytes,size,snap_limit_pct
   # If snap_usage > snap_limit: need to delete old snapshots

2. DELETE OLD SNAPSHOTS:
   snap --list --vol <vol-name> --orderby creation_time
   snap --delete <old-snap-name>

3. INCREASE SNAPSHOT LIMIT:
   vol --edit <vol-name> --snap_limit_pct 300

4. FOR REPLICATION FAILURES:
   replicationpartner --test <partner-name>
   # Check network between arrays
   volcoll --handover <volcoll-name>   # Manual sync

5. FOR BANDWIDTH ISSUES:
   # Schedule replication during off-peak hours
   volcoll --edit <volcoll-name> --replication_schedule "0 2 * * *"''',
        'prevention': 'Set snapshot retention policies. Monitor snapshot usage trends. Size replication bandwidth appropriately. Test failover regularly.',
        'log_signatures': [
            r'snapshot.*space.*limit',
            r'replication.*fail',
            r'volcoll.*error',
            r'snap.*limit.*reached',
        ],
        'references': [],
    },
    {
        'id': 'ADV-023',
        'title': 'HPE Alletra Multipath Configuration Best Practices',
        'category': 'alletra',
        'products': ['Alletra', 'Nimble'],
        'severity': 'medium',
        'symptoms': 'Suboptimal multipath performance. Only one path active. Failover taking too long. Paths showing as "ghost" or "shaky".',
        'root_cause': 'Default multipath settings may not be optimal for HPE Alletra/Nimble arrays. The arrays use ALUA (Asymmetric Logical Unit Access) which requires specific multipath configuration.',
        'diagnostic_commands': [
            'multipath -ll',
            'cat /etc/multipath.conf',
            'multipathd show config',
            'multipathd show paths format "%d %s %t %T %o %w"',
        ],
        'solution': '''RECOMMENDED /etc/multipath.conf FOR HPE ALLETRA/NIMBLE:

devices {
    device {
        vendor                  "Nimble"
        product                 "Server"
        path_grouping_policy    group_by_prio
        prio                    alua
        hardware_handler        "1 alua"
        path_selector           "service-time 0"
        path_checker            tur
        no_path_retry           30
        failback                immediate
        fast_io_fail_tmo        5
        dev_loss_tmo            infinity
        rr_min_io_rq            1
        rr_weight               uniform
    }
}

APPLY CHANGES:
1. Edit /etc/multipath.conf
2. systemctl restart multipathd
3. multipath -r
4. Verify: multipath -ll (should show paths with correct priority)''',
        'prevention': 'Always configure multipath.conf before connecting LUNs. Test failover after configuration. Document multipath settings in runbook.',
        'log_signatures': [
            r'multipath.*Nimble',
            r'alua.*transition',
            r'path.*priority.*change',
        ],
        'references': ['https://docs.netapp.com/us-en/ontap-sanhost/hu-hpe-vme-80x.html'],
    },
    {
        'id': 'ADV-024',
        'title': 'HPE GreenLake - API Token Expiry and Authentication Failures',
        'category': 'greenlake',
        'products': ['GreenLake', 'Alletra'],
        'severity': 'medium',
        'symptoms': 'API calls returning 401 Unauthorized. Automation scripts failing. DSCC CLI tools not authenticating. Token refresh failures.',
        'root_cause': 'GreenLake API tokens have expiry times. OAuth2 access tokens typically expire in 2 hours. Refresh tokens expire in 14 days. If automation does not handle token refresh, access is lost.',
        'diagnostic_commands': [
            'curl -v https://sso.common.cloud.hpe.com/as/token.oauth2',
            'echo $GREENLAKE_TOKEN | jwt decode -',
            'date -u',
        ],
        'solution': '''1. GENERATE NEW API TOKEN:
   curl -X POST https://sso.common.cloud.hpe.com/as/token.oauth2 \\
     -d "grant_type=client_credentials" \\
     -d "client_id=<your-client-id>" \\
     -d "client_secret=<your-client-secret>"

2. FOR AUTOMATION - IMPLEMENT TOKEN REFRESH:
   # Store refresh_token securely
   # Before each API call, check token expiry
   # If expired, use refresh_token to get new access_token

3. CHECK TOKEN EXPIRY:
   # Decode JWT and check "exp" field
   echo $TOKEN | cut -d. -f2 | base64 -d | jq .exp

4. EXTEND TOKEN LIFETIME (GreenLake console):
   # Settings > API > Client Credentials > Edit token lifetime

5. IF REFRESH TOKEN EXPIRED:
   # Must re-authenticate through GreenLake console
   # Generate new client credentials''',
        'prevention': 'Implement automatic token refresh in scripts. Set up token expiry monitoring. Use service accounts for automation. Store credentials in vault/secret manager.',
        'log_signatures': [
            r'401.*Unauthorized',
            r'token.*expired',
            r'authentication.*failed',
            r'oauth.*error',
        ],
        'references': ['https://developer.hpe.com/blog/api-console-for-data-services-cloud-console/'],
    },
    {
        'id': 'ADV-025',
        'title': 'HPE Alletra - Firmware Upgrade Considerations and Rollback',
        'category': 'alletra',
        'products': ['Alletra', 'Nimble'],
        'severity': 'medium',
        'symptoms': 'Need to upgrade array firmware. Concerned about downtime or regression. Previous upgrade caused issues.',
        'root_cause': 'Firmware upgrades are necessary for security patches, bug fixes, and new features. Non-disruptive upgrades (NDU) are supported but require proper planning.',
        'diagnostic_commands': [
            'version --display',
            'array --info --fields status',
            'disk --list --fields state',
            'vol --list --fields online',
        ],
        'solution': '''PRE-UPGRADE CHECKLIST:
1. Check current version: version --display
2. Verify all disks healthy: disk --list --fields state
3. Verify no active rebuilds: disk --list | grep rebuild
4. Verify replication is caught up: volcoll --list --fields replication_status
5. Take config backup: group --getconf > /tmp/array_config_backup.txt
6. Verify DSCC connectivity: network --test --target cloudservices.hpe.com

UPGRADE PROCESS (Non-Disruptive):
1. Stage firmware via DSCC or CLI:
   software --download --version <target-version>
2. Start upgrade:
   software --update --version <target-version>
3. Monitor progress:
   software --status
4. Verify after upgrade:
   version --display
   array --info --fields status

ROLLBACK (if issues):
   software --rollback
   # Only available within first 24 hours after upgrade''',
        'prevention': 'Read release notes for known issues. Test in non-production first if possible. Schedule during maintenance window. Ensure backups are current before upgrade.',
        'log_signatures': [
            r'firmware.*upgrade',
            r'software.*update',
            r'controller.*reboot',
        ],
        'references': [],
    },
]



# ═══════════════════════════════════════════════════════════════════════
# NEW DETECTION PATTERNS
# These should be added to the pattern engine for auto-detection
# ═══════════════════════════════════════════════════════════════════════

ADVANCED_PATTERNS = [
    # --- OOM / Memory ---
    {
        'name': 'oom_kill_specific_process',
        'regex': r'Killed process \d+ \((\S+)\).*total-vm:\d+kB',
        'severity': 'CRITICAL',
        'category': 'kernel',
        'description': 'OOM killer terminated a specific process. The system ran out of memory and this process was selected as the victim based on oom_score.',
        'solution_hint': 'Check which process was killed and why. Add RAM, fix memory leak, or protect critical processes with oom_score_adj=-1000.',
        'product': 'general',
    },
    {
        'name': 'memory_allocation_failure',
        'regex': r'page allocation failure.*order=\d+|__alloc_pages.*failed',
        'severity': 'HIGH',
        'category': 'kernel',
        'description': 'Kernel failed to allocate memory pages. System is under severe memory pressure. Higher-order allocations (large contiguous blocks) fail first.',
        'solution_hint': 'Check free memory and fragmentation. Run: cat /proc/buddyinfo. Consider adding RAM or reducing workload.',
        'product': 'general',
    },
    {
        'name': 'swap_space_exhausted',
        'regex': r'swap_free=0|Out of swap space|swap.*full|no swap space available',
        'severity': 'HIGH',
        'category': 'kernel',
        'description': 'All swap space is consumed. System is about to OOM kill processes. Performance is severely degraded due to thrashing.',
        'solution_hint': 'Identify memory-heavy processes: ps aux --sort=-%mem | head. Add swap temporarily: fallocate -l 4G /swapfile && mkswap /swapfile && swapon /swapfile',
        'product': 'general',
    },
    # --- CPU / Lockups ---
    {
        'name': 'hard_lockup',
        'regex': r'NMI.*hard LOCKUP|hard LOCKUP.*CPU|Watchdog.*hard lockup',
        'severity': 'CRITICAL',
        'category': 'kernel',
        'description': 'CPU is completely stuck and not responding to interrupts. This is more severe than a soft lockup - the CPU is not processing ANY interrupts including the timer.',
        'solution_hint': 'Usually indicates hardware issue or severe kernel bug. Check hardware health (mcelog, ipmitool sel list). Update kernel and firmware.',
        'product': 'general',
    },
    {
        'name': 'rcu_stall',
        'regex': r'rcu.*stall.*CPU|rcu_sched.*detected stall|rcu_preempt.*stall',
        'severity': 'HIGH',
        'category': 'kernel',
        'description': 'RCU (Read-Copy-Update) stall detected. A CPU is stuck in kernel code preventing RCU grace period completion. Can cause system hangs.',
        'solution_hint': 'Check for soft lockup or hung task on the same CPU. May be caused by long-running interrupt handler or spinlock contention.',
        'product': 'general',
    },
    {
        'name': 'cpu_throttling',
        'regex': r'CPU.*frequency.*throttl|cpu.*thermal.*throttl|package.*temperature.*threshold',
        'severity': 'MEDIUM',
        'category': 'kernel',
        'description': 'CPU is being throttled due to thermal limits or power constraints. Performance is reduced to prevent hardware damage.',
        'solution_hint': 'Check CPU temperature: sensors. Check cooling (fans, airflow). If in VM, check host CPU overcommit ratio.',
        'product': 'general',
    },
    {
        'name': 'hung_task_warning',
        'regex': r'INFO: task \S+ blocked for more than \d+ seconds|hung_task_timeout_secs',
        'severity': 'HIGH',
        'category': 'kernel',
        'description': 'A process has been in uninterruptible sleep (D-state) for too long. Usually waiting for I/O that never completes. Cannot be killed.',
        'solution_hint': 'Check storage connectivity: multipath -ll, iostat -x. The process is likely waiting for NFS, disk, or GFS2 lock. Fix the underlying I/O issue.',
        'product': 'general',
    },
    # --- iSCSI / Storage Connectivity ---
    {
        'name': 'iscsi_session_dropped',
        'regex': r'iscsi.*session.*dropped|iscsid.*connection.*closed|iscsi.*session.*terminated',
        'severity': 'HIGH',
        'category': 'storage',
        'description': 'iSCSI session to storage array was terminated unexpectedly. I/O to affected LUNs will fail until session is recovered.',
        'solution_hint': 'Check network to storage IPs. Verify iSCSI target is reachable. Check for packet loss. Session may auto-recover based on timers.',
        'product': 'Alletra',
    },
    {
        'name': 'iscsi_login_failed',
        'regex': r'iscsiadm.*login failed|iscsi.*authentication.*fail|iscsi.*login.*rejected',
        'severity': 'HIGH',
        'category': 'storage',
        'description': 'Failed to establish iSCSI session with storage target. Host cannot access storage LUNs.',
        'solution_hint': 'Check CHAP credentials in /etc/iscsi/iscsid.conf. Verify initiator IQN matches array config. Check network connectivity to target IP.',
        'product': 'Alletra',
    },
    {
        'name': 'multipath_all_paths_down',
        'regex': r'mpath\w+.*no.*usable.*path|all paths.*down|no active path|FAILED.*path.*group',
        'severity': 'CRITICAL',
        'category': 'storage',
        'description': 'All multipath paths to a storage device are down. I/O is completely blocked. Data is inaccessible.',
        'solution_hint': 'Check all storage network interfaces: ip link show. Verify iSCSI sessions: iscsiadm -m session. Check storage array health. This usually indicates network isolation from storage.',
        'product': 'Alletra',
    },
    {
        'name': 'multipath_path_reinstated',
        'regex': r'mpath.*reinstated|path.*reinstated|multipathd.*path.*up',
        'severity': 'LOW',
        'category': 'storage',
        'description': 'A previously failed multipath path has recovered and is back online. I/O can now use this path again.',
        'solution_hint': 'Monitor for recurring path failures (flip-flop). If path keeps failing and recovering, investigate root cause (cable, switch port, NIC).',
        'product': 'Alletra',
    },
    # --- GFS2 Additional Patterns ---
    {
        'name': 'gfs2_fsck_required',
        'regex': r'fsck\.gfs2.*required|GFS2.*needs.*repair|GFS2.*inconsistency',
        'severity': 'CRITICAL',
        'category': 'filesystem',
        'description': 'GFS2 filesystem requires fsck repair. Data may be inconsistent. Do NOT mount without running fsck first.',
        'solution_hint': 'Unmount filesystem on ALL nodes. Run: fsck.gfs2 -y /dev/mapper/<device>. Only remount after fsck completes successfully.',
        'product': 'GFS2',
    },
    {
        'name': 'gfs2_lock_dump',
        'regex': r'GFS2.*lock_dlm.*error|GFS2.*glock.*demote.*timeout|gfs2.*glock.*stuck',
        'severity': 'HIGH',
        'category': 'filesystem',
        'description': 'GFS2 distributed lock issue. Lock demotion or promotion is timing out. This can cause filesystem hangs on the affected node.',
        'solution_hint': 'Check DLM status: dlm_tool ls. Look for network issues between nodes. If stuck, may need to fence the node holding the lock.',
        'product': 'GFS2',
    },
    # --- Alletra / Nimble Specific ---
    {
        'name': 'nimble_array_takeover',
        'regex': r'nimble.*takeover|nimble.*controller.*failover|array.*takeover.*complete',
        'severity': 'CRITICAL',
        'category': 'storage',
        'description': 'HPE Nimble/Alletra storage array performed a controller takeover. One controller has assumed ownership of all volumes. I/O may have paused briefly during takeover.',
        'solution_hint': 'Check array status. Identify why takeover occurred (controller failure, manual maintenance, firmware upgrade). Verify all volumes are online post-takeover.',
        'product': 'Alletra',
    },
    {
        'name': 'nimble_disk_error',
        'regex': r'nimble.*disk.*error|nimble.*drive.*fail|nimble.*spare.*activated',
        'severity': 'HIGH',
        'category': 'storage',
        'description': 'A disk in the HPE Nimble/Alletra array has reported errors or failed. Array should auto-rebuild using spare capacity.',
        'solution_hint': 'Login to array: disk --list. Check for failed/degraded disks. Verify rebuild is progressing. Schedule disk replacement if hardware failure.',
        'product': 'Alletra',
    },
    # --- Fencing / Cluster ---
    {
        'name': 'fence_timeout',
        'regex': r'fence.*timed out|stonith.*timeout|fencing.*failed.*timeout',
        'severity': 'CRITICAL',
        'category': 'cluster',
        'description': 'Fencing operation timed out. The cluster could not confirm that the target node was successfully fenced. This may leave the cluster in an unsafe state.',
        'solution_hint': 'Check fence device connectivity (IPMI, iLO). Verify fence agent configuration: pcs stonith show. Test manually: pcs stonith fence <node>.',
        'product': 'Pacemaker',
    },
    {
        'name': 'corosync_ring_error',
        'regex': r'corosync.*ring.*error|corosync.*retransmit.*list|totem.*ring.*not.*available',
        'severity': 'HIGH',
        'category': 'cluster',
        'description': 'Corosync communication ring error. Cluster node communication is degraded. If not resolved, may lead to quorum loss and fencing.',
        'solution_hint': 'Check network between nodes: corosync-cfgtool -s. Look for packet loss on cluster network. Verify firewall allows corosync ports (5404-5405).',
        'product': 'Pacemaker',
    },
    {
        'name': 'pacemaker_resource_migration',
        'regex': r'resource.*migrat|Move.*resource|resource.*failover|rsc_action.*migrate',
        'severity': 'MEDIUM',
        'category': 'cluster',
        'description': 'A cluster resource has been migrated or is failing over to another node. Services will briefly be unavailable during migration.',
        'solution_hint': 'Check why migration occurred: pcs status. Look for node health issues or manual move operations. Verify resource is running on new node.',
        'product': 'Pacemaker',
    },
    {
        'name': 'quorum_disk_heartbeat_lost',
        'regex': r'quorum.*heartbeat.*lost|qdisk.*timeout|quorum.*device.*fail',
        'severity': 'CRITICAL',
        'category': 'cluster',
        'description': 'Quorum device heartbeat lost. If this node loses quorum, all resources will be stopped to prevent split-brain.',
        'solution_hint': 'Check quorum device connectivity: corosync-quorumtool. Verify network/storage path to quorum device. Check if other nodes are also affected.',
        'product': 'Pacemaker',
    },
]
