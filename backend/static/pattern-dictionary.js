/**
 * LogSherlock Pro - Pattern Dictionary/Encyclopedia
 * A searchable reference of all detection patterns for training new engineers.
 * Completely standalone - no external dependencies.
 */

(function() {
'use strict';

// ═══════════════════════════════════════════════════════════════
// PATTERN DATABASE - 50 entries across 14 categories
// ═══════════════════════════════════════════════════════════════

const PATTERNS = [
  // CLUSTER (1-4)
  {
    name: "Cluster Node Failure",
    category: "cluster",
    severity: "CRITICAL",
    regex_preview: "node\\s+\\S+\\s+(failed|unreachable|fenced)",
    description: "Detects when a cluster node becomes unavailable or is fenced by the cluster manager.",
    what_it_means: "A node in the high-availability cluster has stopped responding and may have been fenced (forcibly shut down) to protect shared resources.",
    common_causes: ["Hardware failure (PSU, motherboard)", "Network partition between nodes", "Kernel panic on the affected node", "Overloaded node not responding to heartbeats"],
    fix_steps: ["Check node hardware status via iLO/BMC", "Verify network connectivity between nodes", "Review /var/log/messages on the failed node", "Check cluster quorum status with 'cmviewcl' or 'pcs status'"],
    related_patterns: ["Cluster Quorum Loss", "Network Link Down", "Kernel Panic"]
  },
  {
    name: "Cluster Quorum Loss",
    category: "cluster",
    severity: "CRITICAL",
    regex_preview: "quorum\\s+(lost|not\\s+achieved|dissolved)",
    description: "Detects loss of cluster quorum which can cause split-brain scenarios.",
    what_it_means: "The cluster no longer has a majority of nodes communicating, risking data corruption from split-brain.",
    common_causes: ["Multiple simultaneous node failures", "Network partition isolating nodes", "Misconfigured quorum device", "Switch failure affecting cluster interconnect"],
    fix_steps: ["Identify which nodes are still communicating", "Check cluster interconnect switches", "Verify quorum device accessibility", "Consider manual quorum override if safe"],
    related_patterns: ["Cluster Node Failure", "Network Link Down", "Split Brain Detected"]
  },
  {
    name: "Cluster Resource Failover",
    category: "cluster",
    severity: "HIGH",
    regex_preview: "(resource|package|service)\\s+\\S+\\s+(failover|migrat|relocat)",
    description: "Detects when cluster resources migrate from one node to another.",
    what_it_means: "A service or resource group has moved to another node, either due to failure or manual action.",
    common_causes: ["Primary node failure", "Planned maintenance migration", "Resource health check failure", "Administrator-initiated switchover"],
    fix_steps: ["Verify resource is running on new node", "Check application health post-failover", "Investigate why failover occurred", "Plan failback if needed"],
    related_patterns: ["Cluster Node Failure", "Service Restart Loop", "Application Crash"]
  },
  {
    name: "Split Brain Detected",
    category: "cluster",
    severity: "CRITICAL",
    regex_preview: "split[\\s-]?brain|partition\\s+detected|both\\s+nodes\\s+active",
    description: "Detects split-brain condition where multiple nodes believe they are primary.",
    what_it_means: "Critical cluster integrity issue where nodes operate independently, risking data corruption.",
    common_causes: ["Complete cluster interconnect failure", "Quorum device failure during partition", "Fencing mechanism failure", "Misconfigured heartbeat timeouts"],
    fix_steps: ["IMMEDIATELY stop applications on one side", "Verify data integrity on both nodes", "Restore cluster communication", "Perform data reconciliation if needed"],
    related_patterns: ["Cluster Quorum Loss", "Network Link Down", "Cluster Node Failure"]
  },
  // STORAGE (5-8)
  {
    name: "Disk I/O Error",
    category: "storage",
    severity: "HIGH",
    regex_preview: "(I/O|io)\\s*error.*\\b(sd[a-z]|dm-\\d+|mpath)",
    description: "Detects disk read/write errors indicating potential drive failure.",
    what_it_means: "The operating system encountered errors communicating with a storage device, often a precursor to drive failure.",
    common_causes: ["Failing disk drive (bad sectors)", "Loose SAS/SATA cable", "Storage controller issue", "SAN path intermittent failure"],
    fix_steps: ["Check SMART status: smartctl -a /dev/sdX", "Review storage controller logs", "Check physical cable connections", "Replace drive if errors persist", "Verify multipath status"],
    related_patterns: ["SMART Disk Warning", "Multipath Failure", "Filesystem Corruption"]
  },
  {
    name: "SMART Disk Warning",
    category: "storage",
    severity: "HIGH",
    regex_preview: "SMART.*(threshold|reallocat|pending|uncorrect|offline)",
    description: "Detects SMART self-monitoring alerts indicating drive degradation.",
    what_it_means: "The drive's built-in health monitoring has detected parameters exceeding safe thresholds.",
    common_causes: ["Aging drive reaching end of life", "Excessive vibration or heat", "Manufacturing defect surfacing", "High write amplification on SSDs"],
    fix_steps: ["Run full SMART self-test", "Schedule proactive drive replacement", "Backup data immediately", "Check other drives in same batch/age"],
    related_patterns: ["Disk I/O Error", "Filesystem Corruption", "Hardware ECC Error"]
  },
  {
    name: "Multipath Failure",
    category: "storage",
    severity: "HIGH",
    regex_preview: "mpath.*\\b(fail|lost|offline|degraded)|multipathd.*path.*down",
    description: "Detects loss of redundant storage paths in multipath configurations.",
    what_it_means: "One or more paths to a SAN device are down, reducing redundancy or causing I/O failures.",
    common_causes: ["HBA failure", "SAN switch port issue", "Fibre Channel cable problem", "Storage array port offline", "Zoning misconfiguration"],
    fix_steps: ["Run 'multipath -ll' to check path status", "Verify HBA link status", "Check SAN switch port logs", "Confirm storage array port health", "Rescan paths after fix"],
    related_patterns: ["Disk I/O Error", "Network Link Down", "LVM Volume Error"]
  },
  {
    name: "LVM Volume Error",
    category: "storage",
    severity: "HIGH",
    regex_preview: "lvm.*error|vg\\S+.*missing|pv\\S+.*lost|lvmetad.*failed",
    description: "Detects LVM (Logical Volume Manager) errors affecting volume availability.",
    what_it_means: "A logical volume or volume group has encountered an error, potentially making data inaccessible.",
    common_causes: ["Underlying physical volume failure", "Metadata corruption", "Missing disk after reboot", "VG activated without all PVs"],
    fix_steps: ["Run 'vgdisplay' and 'pvdisplay' to assess state", "Check physical disks for errors", "Use 'vgreduce --removemissing' if PV is gone", "Restore from backup if metadata corrupted"],
    related_patterns: ["Disk I/O Error", "Multipath Failure", "Filesystem Corruption"]
  },
  // FILESYSTEM (9-12)
  {
    name: "Filesystem Corruption",
    category: "filesystem",
    severity: "CRITICAL",
    regex_preview: "(EXT4|XFS|BTRFS).*error|filesystem.*corrupt|journal.*abort",
    description: "Detects filesystem corruption or journal failures.",
    what_it_means: "The filesystem metadata or journal is inconsistent, risking data loss.",
    common_causes: ["Unexpected power loss", "Underlying disk failure", "Kernel bug", "Full filesystem causing journal issues", "Bad RAM corrupting writes"],
    fix_steps: ["Unmount filesystem if possible", "Run fsck (ext4) or xfs_repair", "Check underlying storage health", "Run memtest to rule out RAM issues", "Restore from backup if repair fails"],
    related_patterns: ["Disk I/O Error", "Kernel Panic", "Memory ECC Error"]
  },
  {
    name: "Filesystem Full",
    category: "filesystem",
    severity: "HIGH",
    regex_preview: "(No space left|ENOSPC|100%\\s+/|filesystem.*full)",
    description: "Detects when a filesystem reaches capacity.",
    what_it_means: "No space remains for new writes, causing application failures and potential data loss.",
    common_causes: ["Runaway log files", "Core dump accumulation", "Temp files not cleaned", "Unexpected data growth", "Inode exhaustion"],
    fix_steps: ["Identify large files: du -sh /* | sort -rh", "Clear old logs: find /var/log -mtime +30 -delete", "Check for deleted but open files: lsof +D /path", "Extend filesystem if possible", "Set up monitoring alerts at 80%"],
    related_patterns: ["Application Crash", "Service Restart Loop", "Log Rotation Failure"]
  },
  {
    name: "Inode Exhaustion",
    category: "filesystem",
    severity: "HIGH",
    regex_preview: "(no\\s+space|ENOSPC).*inode|inode.*(full|exhaust|100%)",
    description: "Detects when filesystem runs out of inodes despite having free space.",
    what_it_means: "Cannot create new files even though disk space is available - all inode slots are consumed.",
    common_causes: ["Millions of tiny files (mail queues, sessions)", "Package manager cache buildup", "Excessive hardlinks", "Poorly chosen mkfs inode ratio"],
    fix_steps: ["Find directories with most files: find / -xdev -type d | while read d; do echo $(ls -1 $d | wc -l) $d; done | sort -rn | head", "Remove unnecessary small files", "Consider recreating filesystem with more inodes", "Archive old small files into tarballs"],
    related_patterns: ["Filesystem Full", "Application Crash", "Mail Queue Buildup"]
  },
  {
    name: "NFS Mount Stale",
    category: "filesystem",
    severity: "HIGH",
    regex_preview: "NFS.*stale|ESTALE|nfs.*not responding|nfs.*server.*timed out",
    description: "Detects stale NFS mounts or unresponsive NFS servers.",
    what_it_means: "NFS client cannot access remote filesystem, processes accessing it will hang.",
    common_causes: ["NFS server down or unreachable", "Network issues between client and server", "Exported filesystem unmounted on server", "Firewall blocking NFS ports"],
    fix_steps: ["Check NFS server accessibility: showmount -e server", "Verify network connectivity", "Remount stale mount: umount -f; mount", "Check server-side exports and services", "Use 'soft' mount option to prevent hangs"],
    related_patterns: ["Network Link Down", "Service Restart Loop", "Application Crash"]
  },
  // KERNEL (13-16)
  {
    name: "Kernel Panic",
    category: "kernel",
    severity: "CRITICAL",
    regex_preview: "Kernel panic|BUG:|Oops:|RIP:.*\\[<[0-9a-f]+>\\]",
    description: "Detects kernel panics, oops, and bug conditions.",
    what_it_means: "The kernel encountered an unrecoverable error and halted or produced a diagnostic dump.",
    common_causes: ["Faulty kernel module/driver", "Hardware failure (RAM, CPU)", "Kernel bug triggered by workload", "Out-of-memory with no swap"],
    fix_steps: ["Analyze crash dump with 'crash' tool", "Check hardware diagnostics", "Update kernel to latest stable", "Identify and blacklist faulty modules", "Enable kdump for future crashes"],
    related_patterns: ["Memory ECC Error", "Hardware MCE Error", "OOM Killer Invoked"]
  },
  {
    name: "OOM Killer Invoked",
    category: "kernel",
    severity: "CRITICAL",
    regex_preview: "Out of memory|oom-kill|invoked oom-killer|Killed process",
    description: "Detects when the kernel's OOM killer terminates processes to free memory.",
    what_it_means: "System ran completely out of memory and the kernel forcibly killed processes to survive.",
    common_causes: ["Memory leak in application", "Insufficient RAM for workload", "Missing or full swap space", "Memory cgroup limit reached", "Fork bomb"],
    fix_steps: ["Identify killed process from logs", "Check for memory leaks in application", "Add more RAM or swap", "Configure cgroup memory limits", "Set oom_score_adj for critical processes"],
    related_patterns: ["Memory Leak Detected", "Kernel Panic", "Application Crash"]
  },
  {
    name: "Kernel Taint Detected",
    category: "kernel",
    severity: "MEDIUM",
    regex_preview: "tainted.*kernel|loading.*proprietary|unsigned module",
    description: "Detects kernel taint flags indicating non-standard modules loaded.",
    what_it_means: "Kernel is running with proprietary or unsigned modules, affecting supportability.",
    common_causes: ["Proprietary GPU drivers (NVIDIA)", "Out-of-tree kernel modules", "Unsigned third-party drivers", "Force-loaded modules for wrong kernel version"],
    fix_steps: ["Identify taint source: cat /proc/sys/kernel/tainted", "Use open-source alternatives if available", "Ensure modules match kernel version", "Document taint for support purposes"],
    related_patterns: ["Kernel Panic", "Hardware MCE Error", "Driver Load Failure"]
  },
  {
    name: "Soft Lockup Detected",
    category: "kernel",
    severity: "HIGH",
    regex_preview: "soft\\s*lockup|CPU.*stuck|rcu.*stall|hard\\s*lockup",
    description: "Detects CPU soft/hard lockups where a CPU is stuck in kernel code.",
    what_it_means: "A CPU has been executing kernel code without yielding for too long, indicating a hang.",
    common_causes: ["Buggy kernel driver", "Interrupt storm", "Hardware issue (failing CPU)", "Spinlock contention", "Virtualization overhead"],
    fix_steps: ["Check which process/module triggered lockup", "Update kernel and drivers", "Run hardware diagnostics on CPU", "Check for interrupt storms: watch -n1 cat /proc/interrupts", "Verify not caused by VM overcommit"],
    related_patterns: ["Kernel Panic", "Hardware MCE Error", "Performance CPU Throttle"]
  },
  // NETWORK (17-21)
  {
    name: "Network Link Down",
    category: "network",
    severity: "HIGH",
    regex_preview: "(eth|ens|eno|bond)\\d+.*link\\s*(down|not ready)|carrier lost",
    description: "Detects network interface link state changes to down.",
    what_it_means: "A physical or bonded network interface has lost link, causing connectivity loss.",
    common_causes: ["Cable disconnected or faulty", "Switch port failure", "NIC hardware failure", "Switch reboot/upgrade", "Auto-negotiation mismatch"],
    fix_steps: ["Check physical cable connection", "Verify switch port status", "Check ethtool link status", "Try different cable/port", "Check bond slave status if bonded"],
    related_patterns: ["Cluster Node Failure", "NFS Mount Stale", "Bond Degraded"]
  },
  {
    name: "Bond Degraded",
    category: "network",
    severity: "MEDIUM",
    regex_preview: "bond\\d+.*slave.*down|bonding.*link.*fail|bond.*degraded",
    description: "Detects when a network bond loses one of its slave interfaces.",
    what_it_means: "Network redundancy is reduced - one bond member is down but connectivity continues via remaining members.",
    common_causes: ["Single NIC failure", "One cable disconnected", "Switch port issue on one link", "Driver issue on one interface"],
    fix_steps: ["Check bond status: cat /proc/net/bonding/bond0", "Identify failed slave interface", "Check physical connectivity of failed member", "Replace NIC or cable as needed", "Verify bond recovers after fix"],
    related_patterns: ["Network Link Down", "Cluster Node Failure", "Network Packet Loss"]
  },
  {
    name: "Network Packet Loss",
    category: "network",
    severity: "MEDIUM",
    regex_preview: "(dropped|drop|loss|retrans).*packet|RX.*error|TX.*error",
    description: "Detects significant packet loss or network errors.",
    what_it_means: "Network communication is degraded with packets being lost, causing retransmissions and slowness.",
    common_causes: ["Network congestion", "Duplex mismatch", "Faulty cable/connector", "Switch buffer overflow", "MTU mismatch"],
    fix_steps: ["Check interface stats: ip -s link show", "Verify duplex/speed: ethtool ethX", "Check for MTU mismatches along path", "Monitor switch port counters", "Run ping with sizes to test MTU"],
    related_patterns: ["Network Link Down", "Bond Degraded", "Performance Network Saturation"]
  },
  {
    name: "DNS Resolution Failure",
    category: "network",
    severity: "MEDIUM",
    regex_preview: "(NXDOMAIN|SERVFAIL|name.*resolution.*failed|could not resolve)",
    description: "Detects DNS lookup failures affecting service connectivity.",
    what_it_means: "System cannot resolve hostnames to IP addresses, breaking service-to-service communication.",
    common_causes: ["DNS server unreachable", "Misconfigured /etc/resolv.conf", "DNS server overloaded", "Network issue to DNS server", "DNSSEC validation failure"],
    fix_steps: ["Test DNS: dig @server hostname", "Check /etc/resolv.conf", "Verify DNS server health", "Check firewall rules for port 53", "Try alternate DNS servers temporarily"],
    related_patterns: ["Network Link Down", "Application Crash", "Service Restart Loop"]
  },
  {
    name: "Firewall Blocked Connection",
    category: "network",
    severity: "LOW",
    regex_preview: "(iptables|nftables|firewalld).*(DROP|REJECT|BLOCK|denied)",
    description: "Detects firewall rules blocking network connections.",
    what_it_means: "Network traffic is being blocked by firewall rules, which may be intentional or misconfigured.",
    common_causes: ["Missing firewall rule for new service", "Default deny policy blocking needed traffic", "Rule ordering issue", "IP changed but firewall not updated"],
    fix_steps: ["Identify blocked traffic details from log", "Determine if block is intentional", "Add appropriate firewall rule if needed", "Test connectivity after rule change", "Document firewall change"],
    related_patterns: ["DNS Resolution Failure", "Application Crash", "Security Unauthorized Access"]
  },
  // VIRTUALIZATION (22-24)
  {
    name: "VM Live Migration Failure",
    category: "virtualization",
    severity: "HIGH",
    regex_preview: "(virt|qemu|vmware|hyper-v).*migrat.*(fail|error|abort|timeout)",
    description: "Detects failed virtual machine live migration attempts.",
    what_it_means: "A VM could not be moved to another host, affecting maintenance or load balancing.",
    common_causes: ["Insufficient resources on target host", "Network bandwidth too low for dirty page rate", "Incompatible CPU features between hosts", "Storage not accessible from target", "VM memory changing too fast"],
    fix_steps: ["Check target host resources", "Verify shared storage accessibility", "Compare CPU flags between hosts", "Increase migration bandwidth", "Try offline migration if live fails"],
    related_patterns: ["Performance CPU Throttle", "Memory Pressure High", "Network Packet Loss"]
  },
  {
    name: "Hypervisor Memory Overcommit",
    category: "virtualization",
    severity: "HIGH",
    regex_preview: "(balloon|overcommit|swap).*hypervisor|vmmem.*(pressure|critical)",
    description: "Detects hypervisor memory overcommitment affecting VM performance.",
    what_it_means: "The hypervisor has allocated more memory to VMs than physically available, causing ballooning or swapping.",
    common_causes: ["Too many VMs on host", "VM memory reservations not set", "Unexpected workload spike in VMs", "Memory leak in guest OS"],
    fix_steps: ["Check host memory usage", "Migrate VMs to balance load", "Set memory reservations for critical VMs", "Add more RAM to host", "Enable transparent page sharing"],
    related_patterns: ["OOM Killer Invoked", "Memory Pressure High", "Performance Degradation"]
  },
  {
    name: "VM Snapshot Failure",
    category: "virtualization",
    severity: "MEDIUM",
    regex_preview: "snapshot.*(fail|error|timeout|abort)|quiesce.*fail",
    description: "Detects VM snapshot creation or deletion failures.",
    what_it_means: "Cannot create or manage VM snapshots, affecting backup operations.",
    common_causes: ["Insufficient datastore space", "Too many existing snapshots", "Guest quiesce timeout", "Locked snapshot files", "Datastore connectivity issue"],
    fix_steps: ["Check datastore free space", "Remove old/orphaned snapshots", "Verify VMware tools/guest agent running", "Check for snapshot lock files", "Consolidate snapshot chain"],
    related_patterns: ["Backup Job Failed", "Filesystem Full", "Storage Performance Degraded"]
  },
  // SECURITY (25-28)
  {
    name: "Security Unauthorized Access",
    category: "security",
    severity: "CRITICAL",
    regex_preview: "(unauthorized|forbidden|authentication.*fail|invalid.*credential).*repeated",
    description: "Detects repeated unauthorized access attempts indicating potential breach.",
    what_it_means: "Multiple failed authentication attempts suggest brute-force attack or compromised credential testing.",
    common_causes: ["Brute-force password attack", "Credential stuffing from data breach", "Misconfigured service account", "Expired credentials not updated", "Bot scanning for weak passwords"],
    fix_steps: ["Block offending IP addresses", "Check if any access succeeded", "Enable account lockout policies", "Implement fail2ban or similar", "Review and rotate affected credentials"],
    related_patterns: ["SSH Brute Force", "Privilege Escalation Attempt", "Firewall Blocked Connection"]
  },
  {
    name: "SSH Brute Force",
    category: "security",
    severity: "HIGH",
    regex_preview: "sshd.*(Failed password|Invalid user).*repeated|ssh.*brute",
    description: "Detects SSH brute force login attempts from external sources.",
    what_it_means: "Someone is systematically trying username/password combinations against your SSH service.",
    common_causes: ["Automated bot scanning", "Targeted attack", "SSH exposed to internet", "Weak password policy", "No rate limiting"],
    fix_steps: ["Install and configure fail2ban", "Disable password auth, use key-only", "Change SSH port from default 22", "Restrict SSH access by IP/network", "Enable two-factor authentication"],
    related_patterns: ["Security Unauthorized Access", "Firewall Blocked Connection", "Privilege Escalation Attempt"]
  },
  {
    name: "Privilege Escalation Attempt",
    category: "security",
    severity: "CRITICAL",
    regex_preview: "sudo.*(FAILED|unauthorized)|su.*fail|privilege.*escalat|CVE-\\d+",
    description: "Detects attempts to gain elevated privileges without authorization.",
    what_it_means: "Someone or something is trying to gain root/admin access without proper authorization.",
    common_causes: ["Compromised user account", "Misconfigured sudo rules", "Exploit attempt using known CVE", "Malware attempting elevation", "Insider threat"],
    fix_steps: ["Identify the user and source", "Check if escalation succeeded", "Review sudo/su logs thoroughly", "Lock suspicious accounts", "Patch known privilege escalation CVEs"],
    related_patterns: ["Security Unauthorized Access", "SSH Brute Force", "Audit Policy Violation"]
  },
  {
    name: "Audit Policy Violation",
    category: "security",
    severity: "MEDIUM",
    regex_preview: "audit.*(violation|denied|failure)|selinux.*(denied|error)|apparmor.*DENIED",
    description: "Detects SELinux/AppArmor/audit denials indicating policy violations.",
    what_it_means: "A process attempted an action that security policy explicitly denies.",
    common_causes: ["Application needs updated policy", "SELinux context incorrect after move", "New software not profiled", "Policy too restrictive", "Potential intrusion attempt"],
    fix_steps: ["Review audit log: ausearch -m AVC", "Check if denial is for legitimate action", "Create custom policy module if needed", "Update file contexts: restorecon -Rv /path", "Do NOT just disable SELinux"],
    related_patterns: ["Privilege Escalation Attempt", "Application Crash", "Service Restart Loop"]
  },
  // HARDWARE (29-32)
  {
    name: "Hardware MCE Error",
    category: "hardware",
    severity: "CRITICAL",
    regex_preview: "Machine Check Exception|MCE.*error|mce.*hardware|GHES.*error",
    description: "Detects Machine Check Exceptions indicating hardware failure.",
    what_it_means: "CPU or memory hardware has reported an uncorrectable error to the operating system.",
    common_causes: ["Failing CPU core", "Memory DIMM failure", "CPU overheating", "Power delivery issue", "Motherboard defect"],
    fix_steps: ["Decode MCE: mcelog --client", "Check CPU temperature", "Run hardware diagnostics", "Check for BIOS/firmware updates", "Schedule hardware replacement if recurring"],
    related_patterns: ["Kernel Panic", "Memory ECC Error", "Hardware Temperature Critical"]
  },
  {
    name: "Memory ECC Error",
    category: "hardware",
    severity: "HIGH",
    regex_preview: "EDAC.*error|ECC.*(corrected|uncorrected)|memory.*error.*DIMM",
    description: "Detects ECC memory errors (correctable or uncorrectable).",
    what_it_means: "RAM is experiencing bit-flip errors. Correctable errors are warning signs; uncorrectable cause crashes.",
    common_causes: ["Aging DIMM module", "DIMM not fully seated", "Incompatible memory speed", "Cosmic ray bit-flip (single events)", "Manufacturing defect"],
    fix_steps: ["Check which DIMM: edac-util -s", "Monitor error rate over time", "Run memtest86+ overnight", "Replace DIMM if errors increase", "Check all DIMMs in same bank"],
    related_patterns: ["Hardware MCE Error", "Kernel Panic", "Filesystem Corruption"]
  },
  {
    name: "Hardware Temperature Critical",
    category: "hardware",
    severity: "HIGH",
    regex_preview: "temperature.*(critical|alarm|threshold|shutdown)|thermal.*trip",
    description: "Detects critical temperature readings from hardware sensors.",
    what_it_means: "Component temperature exceeds safe operating range, risking hardware damage or auto-shutdown.",
    common_causes: ["Failed cooling fan", "Blocked airflow/vents", "Ambient temperature too high", "Heatsink detached or paste dried", "Excessive workload in hot environment"],
    fix_steps: ["Check fan status: ipmitool sdr type Fan", "Inspect physical airflow", "Check ambient room temperature", "Clean dust from heatsinks and fans", "Reduce workload temporarily if critical"],
    related_patterns: ["Hardware MCE Error", "Performance CPU Throttle", "Power Supply Failure"]
  },
  {
    name: "Power Supply Failure",
    category: "hardware",
    severity: "HIGH",
    regex_preview: "PSU.*(fail|fault|degraded)|power.*supply.*(error|lost)|AC.*lost",
    description: "Detects power supply unit failures or degradation.",
    what_it_means: "One or more power supplies have failed, reducing redundancy or risking system shutdown.",
    common_causes: ["PSU hardware failure", "Power cord disconnected", "UPS failure", "PDU circuit breaker tripped", "Overloaded power circuit"],
    fix_steps: ["Check PSU LED indicators", "Verify power cord connections", "Check UPS status", "Replace failed PSU (hot-swap if redundant)", "Verify second PSU on separate circuit"],
    related_patterns: ["Hardware Temperature Critical", "Hardware MCE Error", "Cluster Node Failure"]
  },
  // MEMORY (33-35)
  {
    name: "Memory Leak Detected",
    category: "memory",
    severity: "HIGH",
    regex_preview: "(memory|heap|RSS).*(grow|leak|increas).*continuous|VmRSS.*exceed",
    description: "Detects continuously growing memory usage indicating a leak.",
    what_it_means: "An application is consuming ever-increasing memory without releasing it, eventually causing OOM.",
    common_causes: ["Unreleased object references", "Growing cache without eviction", "Connection pool not releasing", "Event listener accumulation", "Circular references preventing GC"],
    fix_steps: ["Identify leaking process: top -o RES", "Take heap dumps at intervals", "Use valgrind or equivalent profiler", "Check for known leaks in app version", "Restart as temporary mitigation"],
    related_patterns: ["OOM Killer Invoked", "Application Crash", "Performance Degradation"]
  },
  {
    name: "Memory Pressure High",
    category: "memory",
    severity: "MEDIUM",
    regex_preview: "(swap|paging).*(high|active|thrash)|memory.*pressure|kswapd.*active",
    description: "Detects system under memory pressure with active swapping.",
    what_it_means: "System is actively swapping pages to disk, severely degrading performance.",
    common_causes: ["Insufficient RAM for workload", "Memory leak slowly consuming", "Too many concurrent processes", "Large file cache pressure", "Misconfigured memory cgroups"],
    fix_steps: ["Check memory usage: free -h", "Identify top consumers: ps aux --sort=-rss | head", "Add more swap temporarily", "Kill unnecessary processes", "Plan memory upgrade"],
    related_patterns: ["Memory Leak Detected", "OOM Killer Invoked", "Performance Degradation"]
  },
  {
    name: "Huge Pages Allocation Failure",
    category: "memory",
    severity: "MEDIUM",
    regex_preview: "huge.*page.*(fail|unable|insufficient)|HugePages.*0|THP.*defrag.*stall",
    description: "Detects failure to allocate huge pages needed by applications.",
    what_it_means: "Applications requiring huge pages (databases, VMs) cannot get the memory they need.",
    common_causes: ["Memory fragmentation preventing allocation", "Insufficient free memory", "Huge pages not reserved at boot", "Competing huge page consumers", "THP defrag causing latency"],
    fix_steps: ["Check current: cat /proc/meminfo | grep Huge", "Reserve at boot: vm.nr_hugepages in sysctl", "Compact memory: echo 1 > /proc/sys/vm/compact_memory", "Consider disabling THP if causing stalls", "Reboot to defragment if needed"],
    related_patterns: ["Memory Pressure High", "Performance Degradation", "Application Crash"]
  },
  // PERFORMANCE (36-39)
  {
    name: "Performance CPU Throttle",
    category: "performance",
    severity: "MEDIUM",
    regex_preview: "cpu.*(throttl|frequency.*reduc|p-state.*limit)|thermal.*throttl",
    description: "Detects CPU frequency throttling due to thermal or power limits.",
    what_it_means: "CPUs are running below their maximum frequency, reducing processing capacity.",
    common_causes: ["Thermal throttling from overheating", "Power cap/budget limit reached", "BIOS power management settings", "Virtualization host overcommit", "Aggressive power saving policy"],
    fix_steps: ["Check CPU frequency: lscpu | grep MHz", "Check thermal status: sensors", "Review BIOS power settings", "Ensure proper cooling", "Adjust CPU governor: cpupower frequency-set -g performance"],
    related_patterns: ["Hardware Temperature Critical", "Performance Degradation", "Soft Lockup Detected"]
  },
  {
    name: "Performance Degradation",
    category: "performance",
    severity: "MEDIUM",
    regex_preview: "(response|latency|throughput).*(degrad|slow|increas|spike)|load average.*\\d{2,}",
    description: "Detects general system performance degradation from load averages or latency.",
    what_it_means: "System is overloaded - response times increasing, throughput decreasing.",
    common_causes: ["CPU saturation", "I/O bottleneck", "Memory pressure causing swapping", "Network congestion", "Lock contention in application", "Runaway process consuming resources"],
    fix_steps: ["Check load: uptime, top, iostat, vmstat", "Identify bottleneck: CPU, I/O, memory, or network", "Find resource-hogging process", "Check for cron jobs or batch processes", "Scale resources or optimize workload"],
    related_patterns: ["Performance CPU Throttle", "Memory Pressure High", "Disk I/O Error"]
  },
  {
    name: "Performance Network Saturation",
    category: "performance",
    severity: "MEDIUM",
    regex_preview: "(bandwidth|throughput|network).*(saturat|capacity|limit)|TX.*queue.*full",
    description: "Detects network interface reaching bandwidth capacity.",
    what_it_means: "Network link is at or near maximum capacity, causing delays and drops.",
    common_causes: ["Backup job saturating link", "DDoS attack flooding interface", "Bulk data transfer", "Insufficient link speed for workload", "Broadcast storm"],
    fix_steps: ["Identify top talkers: iftop or nethogs", "Check for unexpected traffic patterns", "Schedule bulk transfers off-peak", "Implement QoS/traffic shaping", "Upgrade link speed if sustained"],
    related_patterns: ["Network Packet Loss", "Performance Degradation", "Bond Degraded"]
  },
  {
    name: "Storage Performance Degraded",
    category: "performance",
    severity: "MEDIUM",
    regex_preview: "(iops|latency|await).*(high|slow|degrad|spike)|io.*wait.*[5-9]\\d+",
    description: "Detects storage subsystem performance issues from high latency or low IOPS.",
    what_it_means: "Storage is responding slowly, causing application performance issues.",
    common_causes: ["Disk array rebuild in progress", "Cache battery failed (write-through mode)", "Too many VMs on same datastore", "SAN fabric congestion", "Failing drive causing retries"],
    fix_steps: ["Check IO stats: iostat -x 1", "Verify RAID status - is it rebuilding?", "Check storage array cache status", "Look for IO-heavy processes: iotop", "Contact storage admin for array-side check"],
    related_patterns: ["Disk I/O Error", "SMART Disk Warning", "Performance Degradation"]
  },
  // APPLICATION (40-43)
  {
    name: "Application Crash",
    category: "application",
    severity: "HIGH",
    regex_preview: "(segfault|SIGSEGV|SIGABRT|core dump|fatal error|unhandled exception)",
    description: "Detects application crashes from segfaults, signals, or unhandled exceptions.",
    what_it_means: "An application terminated abnormally, likely losing in-flight work.",
    common_causes: ["Buffer overflow/memory corruption", "Null pointer dereference", "Stack overflow from recursion", "Library version incompatibility", "Resource exhaustion"],
    fix_steps: ["Collect core dump if available", "Check application logs for stack trace", "Verify library versions match", "Check recent deployments/changes", "Run under debugger or strace to reproduce"],
    related_patterns: ["OOM Killer Invoked", "Service Restart Loop", "Memory Leak Detected"]
  },
  {
    name: "Application Connection Pool Exhausted",
    category: "application",
    severity: "HIGH",
    regex_preview: "(connection pool|pool).*(exhaust|full|timeout|max)|too many connections",
    description: "Detects connection pool exhaustion in applications.",
    what_it_means: "Application cannot get new database/service connections, causing request failures.",
    common_causes: ["Connection leak (not returning to pool)", "Pool size too small for load", "Backend service slow (connections held longer)", "Sudden traffic spike", "Long-running queries holding connections"],
    fix_steps: ["Check pool metrics/stats", "Identify connection leaks in code", "Increase pool size temporarily", "Add connection timeout settings", "Fix slow queries holding connections"],
    related_patterns: ["Performance Degradation", "Application Crash", "Service Restart Loop"]
  },
  {
    name: "Java Heap Space Error",
    category: "application",
    severity: "HIGH",
    regex_preview: "java\\.lang\\.OutOfMemoryError|heap space|GC overhead limit|Metaspace",
    description: "Detects Java heap memory exhaustion errors.",
    what_it_means: "JVM has run out of heap memory and cannot allocate new objects.",
    common_causes: ["Heap size too small (-Xmx)", "Memory leak in application", "Large data set loaded into memory", "Too many threads/sessions", "Classloader leak (Metaspace)"],
    fix_steps: ["Increase heap: -Xmx setting", "Take heap dump: -XX:+HeapDumpOnOutOfMemoryError", "Analyze dump with Eclipse MAT", "Check for object retention chains", "Tune GC parameters"],
    related_patterns: ["Memory Leak Detected", "Application Crash", "OOM Killer Invoked"]
  },
  {
    name: "Log Rotation Failure",
    category: "application",
    severity: "LOW",
    regex_preview: "logrotate.*(error|fail)|cannot rotate|log.*size.*exceed",
    description: "Detects log rotation failures leading to uncontrolled log growth.",
    what_it_means: "Logs are not being rotated properly and may fill the filesystem.",
    common_causes: ["Logrotate misconfiguration", "Log file locked by process", "Permissions issue on log directory", "Missing postrotate script dependency", "Filesystem full preventing rotation"],
    fix_steps: ["Test config: logrotate -d /etc/logrotate.conf", "Check permissions on log files", "Verify process handles SIGHUP for reopen", "Fix logrotate config syntax", "Manually rotate and compress old logs"],
    related_patterns: ["Filesystem Full", "Application Crash", "Service Restart Loop"]
  },
  // SERVICE (44-46)
  {
    name: "Service Restart Loop",
    category: "service",
    severity: "HIGH",
    regex_preview: "(start-limit|restart).*(hit|exceeded|rapid)|systemd.*failed.*result",
    description: "Detects services caught in a crash-restart loop.",
    what_it_means: "A service keeps crashing and restarting, never reaching stable operation.",
    common_causes: ["Missing configuration file", "Port already in use", "Dependency service not running", "Corrupted application files", "Insufficient permissions"],
    fix_steps: ["Check status: systemctl status service", "Read full journal: journalctl -u service -n 100", "Check configuration validity", "Verify all dependencies are met", "Reset failure counter: systemctl reset-failed"],
    related_patterns: ["Application Crash", "Filesystem Full", "DNS Resolution Failure"]
  },
  {
    name: "Service Dependency Failure",
    category: "service",
    severity: "MEDIUM",
    regex_preview: "(depend|requires|wants).*(fail|unavailable|timeout)|After=.*not found",
    description: "Detects services failing due to unmet dependencies.",
    what_it_means: "A service cannot start because another service or resource it depends on is unavailable.",
    common_causes: ["Dependency service failed to start", "Network not ready when service starts", "Mount point not available yet", "Database not accepting connections", "Wrong service ordering"],
    fix_steps: ["List dependencies: systemctl list-dependencies service", "Check status of dependency services", "Add proper After= and Requires= in unit file", "Use systemctl --failed to find broken deps", "Consider adding restart logic with delay"],
    related_patterns: ["Service Restart Loop", "NFS Mount Stale", "DNS Resolution Failure"]
  },
  {
    name: "Systemd Unit Masked",
    category: "service",
    severity: "LOW",
    regex_preview: "unit.*masked|Failed to start.*masked|cannot start.*masked",
    description: "Detects attempts to start a masked (disabled) systemd unit.",
    what_it_means: "Someone or a process is trying to start a service that has been deliberately masked.",
    common_causes: ["Service masked during troubleshooting and forgotten", "Security hardening masked unnecessary services", "Upgrade masked conflicting service", "Automation trying to start masked unit"],
    fix_steps: ["Check why it was masked", "Unmask if needed: systemctl unmask service", "Update automation to skip masked services", "Document why services are masked"],
    related_patterns: ["Service Dependency Failure", "Service Restart Loop"]
  },
  // BACKUP (47-48)
  {
    name: "Backup Job Failed",
    category: "backup",
    severity: "HIGH",
    regex_preview: "backup.*(fail|error|abort|timeout)|rsync.*error|tar.*error",
    description: "Detects backup job failures from any backup mechanism.",
    what_it_means: "Data backup did not complete successfully, creating a gap in recovery capability.",
    common_causes: ["Target storage full", "Network timeout during transfer", "Source file locked/changed during backup", "Authentication failure to backup server", "Backup window exceeded"],
    fix_steps: ["Check backup logs for specific error", "Verify target storage space", "Test network connectivity to backup target", "Verify credentials haven't expired", "Re-run backup manually and monitor"],
    related_patterns: ["Filesystem Full", "Network Packet Loss", "VM Snapshot Failure"]
  },
  {
    name: "Backup Retention Violation",
    category: "backup",
    severity: "MEDIUM",
    regex_preview: "retention.*(violat|exceed|fail)|backup.*expir|no valid.*backup.*found",
    description: "Detects when backup retention policies are violated or no valid backups exist.",
    what_it_means: "Backup copies may not exist for the required retention period, violating compliance.",
    common_causes: ["Repeated backup failures depleting copies", "Storage capacity forcing early deletion", "Retention policy misconfiguration", "Backup media degradation", "Catalog corruption"],
    fix_steps: ["Audit existing backup inventory", "Identify gap in backup coverage", "Run immediate backup of affected systems", "Fix retention policy configuration", "Verify backup restorability"],
    related_patterns: ["Backup Job Failed", "Filesystem Full", "Storage Performance Degraded"]
  },
  // SYSTEM (49-50)
  {
    name: "System Clock Skew",
    category: "system",
    severity: "MEDIUM",
    regex_preview: "(clock|time).*(skew|drift|sync.*fail|offset.*exceed)|ntpd.*unreachable",
    description: "Detects system time synchronization failures or excessive clock drift.",
    what_it_means: "System clock is not synchronized, affecting logs, authentication, and distributed systems.",
    common_causes: ["NTP server unreachable", "Firewall blocking NTP (port 123)", "VM time sync disabled", "Hardware clock battery dead", "Hypervisor time drift"],
    fix_steps: ["Check NTP status: chronyc tracking or ntpstat", "Verify NTP server accessibility", "Force sync: chronyc makestep", "Check firewall for port 123 UDP", "Enable VM guest time sync"],
    related_patterns: ["DNS Resolution Failure", "Security Unauthorized Access", "Cluster Node Failure"]
  },
  {
    name: "System Boot Failure",
    category: "system",
    severity: "CRITICAL",
    regex_preview: "(boot|grub|initramfs).*(fail|error|panic|emergency)|dracut.*fail|systemd.*emergency",
    description: "Detects system boot failures requiring manual intervention.",
    what_it_means: "System cannot complete normal boot process and may be in emergency/rescue mode.",
    common_causes: ["Missing/corrupted initramfs", "GRUB configuration error", "Root filesystem cannot mount", "Kernel module missing for boot disk", "fstab entry for missing device"],
    fix_steps: ["Boot from rescue media", "Check GRUB config: cat /boot/grub2/grub.cfg", "Rebuild initramfs: dracut --force", "Fix /etc/fstab (use nofail option)", "Reinstall kernel if corrupted"],
    related_patterns: ["Filesystem Corruption", "LVM Volume Error", "Kernel Panic"]
  }
];


// ═══════════════════════════════════════════════════════════════
// CATEGORIES & SEVERITY COLORS
// ═══════════════════════════════════════════════════════════════

const CATEGORIES = [...new Set(PATTERNS.map(p => p.category))].sort();
const SEVERITY_COLORS = { CRITICAL: '#ff4757', HIGH: '#ffa502', MEDIUM: '#2ed573', LOW: '#70a1ff' };

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

const STYLES = `
<style id="pattern-dict-styles">
.pd-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
  z-index: 99999; display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.3s ease;
  pointer-events: none;
}
.pd-overlay.pd-visible {
  opacity: 1; pointer-events: all;
}
.pd-modal {
  background: #1e1e2e; border-radius: 12px; width: 95vw; max-width: 900px;
  height: 90vh; display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5); border: 1px solid #3a3a5a;
  transform: scale(0.95); transition: transform 0.3s ease;
}
.pd-overlay.pd-visible .pd-modal { transform: scale(1); }
.pd-header {
  padding: 20px 24px; border-bottom: 1px solid #3a3a5a;
  display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
}
.pd-header h2 { margin: 0; color: #e0e0e0; font-size: 1.4em; }
.pd-header h2 span { color: #01a982; }
.pd-close-btn {
  background: none; border: none; color: #e0e0e0; font-size: 1.6em;
  cursor: pointer; padding: 4px 10px; border-radius: 6px; transition: background 0.2s;
}
.pd-close-btn:hover { background: #3a3a5a; }
.pd-controls {
  padding: 16px 24px; border-bottom: 1px solid #3a3a5a; flex-shrink: 0;
}
.pd-search {
  width: 100%; padding: 10px 16px; background: #2a2a3e; border: 1px solid #3a3a5a;
  border-radius: 8px; color: #e0e0e0; font-size: 0.95em; outline: none;
  transition: border-color 0.2s; box-sizing: border-box;
}
.pd-search:focus { border-color: #01a982; }
.pd-search::placeholder { color: #888; }
.pd-pills {
  display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px;
}
.pd-pill {
  padding: 4px 12px; border-radius: 20px; font-size: 0.75em; cursor: pointer;
  background: #2a2a3e; color: #aaa; border: 1px solid #3a3a5a;
  text-transform: capitalize; transition: all 0.2s; user-select: none;
}
.pd-pill:hover { border-color: #01a982; color: #01a982; }
.pd-pill.pd-active { background: #01a982; color: #fff; border-color: #01a982; }
.pd-content {
  flex: 1; overflow-y: auto; padding: 16px 24px;
}
.pd-content::-webkit-scrollbar { width: 6px; }
.pd-content::-webkit-scrollbar-track { background: #1e1e2e; }
.pd-content::-webkit-scrollbar-thumb { background: #3a3a5a; border-radius: 3px; }
.pd-count {
  color: #888; font-size: 0.85em; padding: 0 0 12px 0;
}
.pd-entry {
  background: #2a2a3e; border-radius: 8px; margin-bottom: 8px;
  border: 1px solid #3a3a5a; overflow: hidden; transition: border-color 0.2s;
}
.pd-entry:hover { border-color: #01a982; }
.pd-entry-header {
  padding: 12px 16px; cursor: pointer; display: flex;
  align-items: center; gap: 12px; user-select: none;
}
.pd-entry-chevron {
  transition: transform 0.2s; color: #888; font-size: 0.8em; flex-shrink: 0;
}
.pd-entry.pd-expanded .pd-entry-chevron { transform: rotate(90deg); }
.pd-entry-name { color: #e0e0e0; font-weight: 600; flex: 1; }
.pd-entry-cat {
  font-size: 0.7em; padding: 2px 8px; border-radius: 10px;
  background: #1e1e2e; color: #01a982; text-transform: capitalize; flex-shrink: 0;
}
.pd-entry-sev {
  font-size: 0.7em; padding: 2px 8px; border-radius: 10px; font-weight: 700;
  flex-shrink: 0;
}
.pd-entry-body {
  max-height: 0; overflow: hidden; transition: max-height 0.3s ease;
}
.pd-entry.pd-expanded .pd-entry-body { max-height: 800px; }
.pd-entry-details {
  padding: 0 16px 16px 16px; border-top: 1px solid #3a3a5a;
}
.pd-regex {
  background: #1e1e2e; padding: 8px 12px; border-radius: 6px; margin: 12px 0;
  font-family: 'Courier New', monospace; font-size: 0.82em; color: #01a982;
  overflow-x: auto; white-space: nowrap;
}
.pd-desc { color: #ccc; font-size: 0.9em; margin: 8px 0; line-height: 1.5; }
.pd-means { color: #aaa; font-size: 0.85em; font-style: italic; margin: 8px 0; line-height: 1.4; }
.pd-section-title { color: #01a982; font-size: 0.8em; font-weight: 700; margin: 12px 0 6px 0; text-transform: uppercase; letter-spacing: 0.5px; }
.pd-list { margin: 0; padding: 0 0 0 18px; color: #ccc; font-size: 0.85em; }
.pd-list li { margin: 4px 0; line-height: 1.4; }
.pd-related {
  display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;
}
.pd-related-tag {
  font-size: 0.75em; padding: 2px 8px; background: #1e1e2e;
  border-radius: 10px; color: #70a1ff; border: 1px solid #3a3a5a;
}
.pd-toolbar-btn {
  padding: 8px 16px; background: #2a2a3e; color: #01a982; border: 1px solid #01a982;
  border-radius: 6px; cursor: pointer; font-size: 0.85em; font-weight: 600;
  transition: all 0.2s;
}
.pd-toolbar-btn:hover { background: #01a982; color: #fff; }
.pd-empty { text-align: center; color: #888; padding: 40px 20px; font-size: 0.95em; }
@media (max-width: 600px) {
  .pd-modal { width: 100vw; height: 100vh; border-radius: 0; }
  .pd-header { padding: 14px 16px; }
  .pd-controls { padding: 12px 16px; }
  .pd-content { padding: 12px 16px; }
  .pd-entry-header { padding: 10px 12px; gap: 8px; flex-wrap: wrap; }
  .pd-entry-details { padding: 0 12px 12px 12px; }
  .pd-entry-cat, .pd-entry-sev { font-size: 0.65em; }
}
</style>
`;


// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════

let _searchTerm = '';
let _activeCategory = null;
let _expandedEntries = new Set();

// ═══════════════════════════════════════════════════════════════
// RENDER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function getFilteredPatterns() {
  return PATTERNS.filter(p => {
    const matchesCategory = !_activeCategory || p.category === _activeCategory;
    const matchesSearch = !_searchTerm ||
      p.name.toLowerCase().includes(_searchTerm) ||
      p.category.toLowerCase().includes(_searchTerm) ||
      p.description.toLowerCase().includes(_searchTerm) ||
      p.what_it_means.toLowerCase().includes(_searchTerm);
    return matchesCategory && matchesSearch;
  });
}

function renderEntry(pattern, index) {
  const isExpanded = _expandedEntries.has(index);
  const sevColor = SEVERITY_COLORS[pattern.severity] || '#70a1ff';
  return `
    <div class="pd-entry ${isExpanded ? 'pd-expanded' : ''}" data-index="${index}">
      <div class="pd-entry-header" onclick="window._pdToggleEntry(${index})">
        <span class="pd-entry-chevron">&#9654;</span>
        <span class="pd-entry-name">${escapeHtml(pattern.name)}</span>
        <span class="pd-entry-cat">${escapeHtml(pattern.category)}</span>
        <span class="pd-entry-sev" style="background:${sevColor}22;color:${sevColor};border:1px solid ${sevColor}">${pattern.severity}</span>
      </div>
      <div class="pd-entry-body">
        <div class="pd-entry-details">
          <div class="pd-section-title">Regex Pattern</div>
          <div class="pd-regex">${escapeHtml(pattern.regex_preview)}</div>
          <div class="pd-desc">${escapeHtml(pattern.description)}</div>
          <div class="pd-means">"${escapeHtml(pattern.what_it_means)}"</div>
          <div class="pd-section-title">Common Causes</div>
          <ul class="pd-list">${pattern.common_causes.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
          <div class="pd-section-title">Fix Steps</div>
          <ol class="pd-list">${pattern.fix_steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
          <div class="pd-section-title">Related Patterns</div>
          <div class="pd-related">${pattern.related_patterns.map(r => `<span class="pd-related-tag">${escapeHtml(r)}</span>`).join('')}</div>
        </div>
      </div>
    </div>`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderPatternDictionary() {
  const filtered = getFilteredPatterns();
  const pillsHtml = CATEGORIES.map(cat => {
    const active = _activeCategory === cat ? 'pd-active' : '';
    return `<span class="pd-pill ${active}" onclick="window._pdFilterCategory('${cat}')">${cat}</span>`;
  }).join('');

  const entriesHtml = filtered.length > 0
    ? filtered.map((p, i) => renderEntry(p, PATTERNS.indexOf(p))).join('')
    : '<div class="pd-empty">No patterns match your search. Try different keywords or clear filters.</div>';

  return `
    ${STYLES}
    <div class="pd-overlay" id="pd-overlay" onclick="window._pdOverlayClick(event)">
      <div class="pd-modal" onclick="event.stopPropagation()">
        <div class="pd-header">
          <h2>📚 <span>Pattern Dictionary</span></h2>
          <button class="pd-close-btn" onclick="closePatternDictionary()" title="Close (Esc)">&times;</button>
        </div>
        <div class="pd-controls">
          <input type="text" class="pd-search" id="pd-search" placeholder="Search patterns by name, category, or description..." value="${escapeHtml(_searchTerm)}" oninput="window._pdSearch(this.value)">
          <div class="pd-pills">
            <span class="pd-pill ${!_activeCategory ? 'pd-active' : ''}" onclick="window._pdFilterCategory(null)">All (${PATTERNS.length})</span>
            ${pillsHtml}
          </div>
        </div>
        <div class="pd-content">
          <div class="pd-count">Showing ${filtered.length} of ${PATTERNS.length} patterns</div>
          ${entriesHtml}
        </div>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
// OPEN / CLOSE / INTERACTIONS
// ═══════════════════════════════════════════════════════════════

function openPatternDictionary() {
  let container = document.getElementById('pd-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'pd-container';
    document.body.appendChild(container);
  }
  container.innerHTML = renderPatternDictionary();
  requestAnimationFrame(() => {
    const overlay = document.getElementById('pd-overlay');
    if (overlay) overlay.classList.add('pd-visible');
    const searchInput = document.getElementById('pd-search');
    if (searchInput) searchInput.focus();
  });
  document.addEventListener('keydown', _pdEscHandler);
}

function closePatternDictionary() {
  const overlay = document.getElementById('pd-overlay');
  if (overlay) {
    overlay.classList.remove('pd-visible');
    setTimeout(() => {
      const container = document.getElementById('pd-container');
      if (container) container.innerHTML = '';
    }, 300);
  }
  document.removeEventListener('keydown', _pdEscHandler);
  _searchTerm = '';
  _activeCategory = null;
  _expandedEntries.clear();
}

function _pdEscHandler(e) {
  if (e.key === 'Escape') closePatternDictionary();
}

function _pdRefresh() {
  const container = document.getElementById('pd-container');
  if (container && container.innerHTML) {
    container.innerHTML = renderPatternDictionary();
    const overlay = document.getElementById('pd-overlay');
    if (overlay) overlay.classList.add('pd-visible');
    const searchInput = document.getElementById('pd-search');
    if (searchInput) {
      searchInput.focus();
      searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    }
  }
}

// Global interaction handlers
window._pdSearch = function(val) {
  _searchTerm = val.toLowerCase();
  _pdRefresh();
};

window._pdFilterCategory = function(cat) {
  _activeCategory = (_activeCategory === cat) ? null : cat;
  _pdRefresh();
};

window._pdToggleEntry = function(index) {
  if (_expandedEntries.has(index)) {
    _expandedEntries.delete(index);
  } else {
    _expandedEntries.add(index);
  }
  _pdRefresh();
};

window._pdOverlayClick = function(event) {
  if (event.target.id === 'pd-overlay') {
    closePatternDictionary();
  }
};

// ═══════════════════════════════════════════════════════════════
// SELF-INITIALIZATION - Add toolbar button on DOMContentLoaded
// ═══════════════════════════════════════════════════════════════

function initPatternDictionary() {
  // Try to find existing toolbar, otherwise create floating button
  const toolbar = document.querySelector('.toolbar, #toolbar, [class*="toolbar"], [class*="nav-actions"], header nav');
  const btn = document.createElement('button');
  btn.className = 'pd-toolbar-btn';
  btn.innerHTML = '📚 Pattern Dictionary';
  btn.onclick = openPatternDictionary;
  btn.title = 'Open Pattern Dictionary (searchable reference of all detection patterns)';

  if (toolbar) {
    toolbar.appendChild(btn);
  } else {
    // Floating button in top-right area
    btn.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99998;padding:10px 18px;background:#2a2a3e;color:#01a982;border:1px solid #01a982;border-radius:8px;cursor:pointer;font-size:0.9em;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:all 0.2s;';
    btn.onmouseenter = function() { btn.style.background = '#01a982'; btn.style.color = '#fff'; };
    btn.onmouseleave = function() { btn.style.background = '#2a2a3e'; btn.style.color = '#01a982'; };
    document.body.appendChild(btn);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPatternDictionary);
} else {
  initPatternDictionary();
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS (for module environments)
// ═══════════════════════════════════════════════════════════════

if (typeof window !== 'undefined') {
  window.renderPatternDictionary = renderPatternDictionary;
  window.openPatternDictionary = openPatternDictionary;
  window.closePatternDictionary = closePatternDictionary;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderPatternDictionary, openPatternDictionary, closePatternDictionary };
}

})();
