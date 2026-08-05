"""Pattern detection engine for LogSherlock Pro.

This module defines 294 detection patterns for identifying issues in Linux/HPE
system logs (sosreports, support bundles, raw log files). Patterns are organized
across 13 categories: kernel, storage, cluster, network, memory, filesystem,
hardware, security, virtualization, service, performance, application, and backup.

Pattern Format:
    Each pattern is a LogPattern dataclass with:
        - name: str          → Unique identifier (e.g., "kernel_panic", "oom_kill")
        - regex: str         → Python regex string (compiled with re.IGNORECASE)
        - severity: str      → CRITICAL / HIGH / MEDIUM / LOW / INFO
        - category: str      → One of 12 categories above
        - description: str   → Junior-friendly explanation of what this pattern means
        - solution_hint: str → Actionable first steps for investigation/fix
        - product: str       → 'general' or specific product (e.g., 'gfs2', 'corosync')

    MultiLinePattern extends this for stack traces and multi-line blocks:
        - trigger_regex:       First line that starts the match
        - continuation_regex:  Subsequent lines belonging to same block
        - end_regex:           Optional termination pattern
        - max_lines:           Cap on captured lines (default 50)

Usage:
    The PatternEngine class (defined later in this file) pre-compiles all 113
    regexes at instantiation. In production, a module-level singleton is used
    in routes/analysis.py so patterns are compiled only once per Lambda cold start.

    Patterns are also exported as JSON via /api/patterns/export for client-side
    scanning in the browser (index.html uses these with JavaScript RegExp).
"""

import re
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple


@dataclass
class LogPattern:
    """A detection pattern for log analysis."""
    name: str
    regex: str
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW, INFO
    category: str
    description: str
    solution_hint: str
    product: str = 'general'

    def compiled(self) -> re.Pattern:
        return re.compile(self.regex, re.IGNORECASE)


@dataclass
class MultiLinePattern:
    """A multi-line detection pattern for stack traces, tracebacks, etc.

    Matches patterns that span multiple lines (e.g., Java stack traces,
    Python tracebacks, multi-line kernel panics).

    trigger_regex: First line that starts the multi-line match
    continuation_regex: Lines that are part of the same block (e.g., '^\\s+at ')
    end_regex: Optional line that ends the block (if None, ends when continuation fails)
    max_lines: Maximum lines to capture (prevents runaway matches)
    """
    name: str
    trigger_regex: str
    continuation_regex: str
    severity: str
    category: str
    description: str
    solution_hint: str
    end_regex: str = ''
    max_lines: int = 50
    product: str = 'general'


# ── Multi-line patterns for common stack traces ──────────────────────────

MULTILINE_PATTERNS: List[MultiLinePattern] = [
    MultiLinePattern(
        name='java_exception',
        trigger_regex=r'(Exception|Error|Throwable).*:|\bat\s+[\w.$]+\([\w.]+:\d+\)',
        continuation_regex=r'^\s+at\s+|^\s*Caused by:|^\s*\.\.\.\s*\d+\s+more|^\s+\.\.\.',
        severity='HIGH',
        category='service',
        description='Java exception with stack trace detected. This indicates an application-level error that may be causing service failures.',
        solution_hint='Identify the root cause exception (look for "Caused by:" at the bottom). Check if this is a known bug in the application version. Review the stack trace to identify which component failed.',
        product='general',
    ),
    MultiLinePattern(
        name='python_traceback',
        trigger_regex=r'^Traceback \(most recent call last\):',
        continuation_regex=r'^\s+File\s+"|^\s+\w|^\w+Error:|^\w+Exception:',
        end_regex=r'^\w+(Error|Exception):.*',
        severity='HIGH',
        category='service',
        description='Python traceback detected. A Python application has crashed with an unhandled exception.',
        solution_hint='The last line shows the exception type and message. The "File" lines show the call stack. Fix the code at the deepest level that you control.',
        product='general',
    ),
    MultiLinePattern(
        name='kernel_call_trace',
        trigger_regex=r'Call Trace:|BUG:.*kernel|WARNING:.*CPU.*kernel',
        continuation_regex=r'^\s*\[<[0-9a-f]+>\]|^\s+\w+\+0x|^\s*\?.*\+0x|^\s*---\[',
        severity='CRITICAL',
        category='kernel',
        description='Kernel call trace / stack dump detected. This indicates a serious kernel-level issue that may affect system stability.',
        solution_hint='Check if this is a known kernel bug for this version. Look for the function names in the trace. Check if a specific module is causing issues. Consider kernel upgrade if a fix is available.',
        product='general',
    ),
    MultiLinePattern(
        name='coredump_backtrace',
        trigger_regex=r'Core was generated by|Program terminated with signal|#0\s+0x',
        continuation_regex=r'^#\d+\s+0x|^\s+from\s+/|^\s+at\s+/',
        severity='HIGH',
        category='service',
        description='Core dump backtrace detected. A process has crashed and generated a core dump for analysis.',
        solution_hint='Identify the crashed process and the signal that killed it. Look at frame #0 for the crash location. Check for null pointer dereferences or buffer overflows. Report to the software vendor if needed.',
        product='general',
    ),
    MultiLinePattern(
        name='multipath_failure_block',
        trigger_regex=r'multipathd.*:.*fail|multipath.*path.*down|mpath.*failed',
        continuation_regex=r'^\s*\|.*sd|^\s*\\.*sd|^\s*size=|^\s*policy=',
        severity='HIGH',
        category='storage',
        description='Multipath failure block detected. Multiple storage paths are showing errors, which may indicate a storage connectivity issue.',
        solution_hint='Run multipath -ll to see path status. Check physical connections, HBA status, and switch ports. Verify iSCSI sessions with iscsiadm -m session.',
        product='Alletra',
    ),
]


# ============================================================
# BUILT-IN PATTERNS - 50+ patterns organized by category
# ============================================================

BUILT_IN_PATTERNS: List[LogPattern] = [
    # --- SCSI / Storage ---
    LogPattern(
        name='scsi_reservation_conflict',
        regex=r'sd\s*\w+.*reservation\s+conflict|SCSI.*reservation\s+conflict',
        severity='CRITICAL',
        category='storage',
        description='A SCSI reservation conflict means two nodes are fighting over the same disk. This usually happens in cluster environments when fencing fails or split-brain occurs.',
        solution_hint='Check cluster fencing status. Verify SCSI-3 PR registrations with sg_persist. Ensure only one node owns each LUN at a time. Restart the conflicting node if needed.',
        product='Alletra',
    ),
    LogPattern(
        name='scsi_command_failed',
        regex=r'sd\s*\w+.*FAILED.*Result|scsi.*command\s+(failed|abort)|sd\s*\w+.*CDB.*failed',
        severity='HIGH',
        category='storage',
        description='A SCSI command failed to complete. This could mean a disk is failing, a path is broken, or the storage array rejected the command.',
        solution_hint='Check multipath status (multipath -ll). Look for failed paths. Check storage array health. If persistent, the disk may need replacement.',
        product='Alletra',
    ),
    LogPattern(
        name='scsi_medium_error',
        regex=r'SCSI.*medium\s+error|sd\w+.*Medium\s+Error|sense:\s+Medium\s+Error',
        severity='HIGH',
        category='storage',
        description='The disk reported a medium error - this means a physical read/write failure on the disk surface. The disk is likely developing bad sectors.',
        solution_hint='Check SMART data (smartctl -a /dev/sdX). Plan disk replacement. Check if data is recoverable from mirrors/RAID.',
        product='general',
    ),
    # --- GFS2 / Clustered Filesystem ---
    LogPattern(
        name='gfs2_withdraw',
        regex=r'GFS2.*withdraw|gfs2.*filesystem\s+withdraw|GFS2.*forcing\s+withdraw',
        severity='CRITICAL',
        category='filesystem',
        description='GFS2 has withdrawn (disconnected) from the cluster filesystem. This is an emergency action to prevent data corruption. The node can no longer access the filesystem.',
        solution_hint='1. Check dmesg/syslog for the ERROR that triggered the withdraw (I/O error, DLM, reservation conflict)\n2. Check storage paths: multipath -ll (any failed paths?)\n3. Check DLM: dlm_tool status (lockspace healthy?)\n4. Fix underlying cause FIRST (storage, network, PR keys)\n5. Unmount GFS2: umount <mount> (may hang if I/O blocked)\n6. After root cause fixed: run fsck.gfs2 -n /dev/mapper/<device> (DRY-RUN first — read-only check)\n⚠️ WARNING: Only run fsck.gfs2 -y after reviewing -n output. The -y flag WILL delete corrupted/orphaned data to restore consistency. Always dry-run first!\n7. If -n shows issues: fsck.gfs2 -y /dev/mapper/<device>\n8. Remount: mount -t gfs2 /dev/mapper/<device> <mount>',
        product='GFS2',
    ),
    LogPattern(
        name='gfs2_readonly',
        regex=r'GFS2.*read.only|gfs2.*remounting.*ro|Remounting filesystem read-only.*gfs2',
        severity='CRITICAL',
        category='filesystem',
        description='GFS2 filesystem has been remounted as read-only. Applications writing to this filesystem will fail. This is usually triggered by I/O errors.',
        solution_hint='Check dmesg for underlying storage errors. Verify multipath health. Check DLM lock status. May need to unmount, fix storage, and remount.',
        product='GFS2',
    ),
    LogPattern(
        name='dlm_lock_error',
        regex=r'dlm.*error|DLM.*lock\s+(error|timeout|failed)|dlm_controld.*error',
        severity='HIGH',
        category='filesystem',
        description='The Distributed Lock Manager (DLM) encountered an error. DLM coordinates access to shared resources in a cluster. Errors here can cause GFS2 hangs or withdraws.',
        solution_hint='Check corosync/cluster communication. Verify all nodes can reach each other. Check network for packet loss. Review dlm_tool ls output.',
        product='GFS2',
    ),
    # --- Kernel ---
    LogPattern(
        name='kernel_panic',
        regex=r'Kernel\s+panic|kernel\s+panic.*not\s+syncing',
        severity='CRITICAL',
        category='kernel',
        description='The Linux kernel has crashed (panicked). The system is completely unresponsive and needs a reboot. This is the Linux equivalent of a Windows BSOD.',
        solution_hint='Collect the crash dump (kdump/vmcore). Check what module or process caused it. Common causes: bad memory, driver bugs, filesystem corruption. Check if there is a known kernel bug for this version.',
        product='general',
    ),
    LogPattern(
        name='oom_kill',
        regex=r'Out of memory.*Kill|oom-kill|invoked oom-killer|oom_reaper',
        severity='CRITICAL',
        category='kernel',
        description='The system ran out of memory and the OOM killer terminated a process to free RAM. This means the system was under severe memory pressure.',
        solution_hint='Check which process was killed (look for "Killed process" line). Investigate why memory usage was so high. Consider adding RAM or swap, or fixing the memory leak in the application.',
        product='general',
    ),
    LogPattern(
        name='segfault',
        regex=r'segfault\s+at|general\s+protection\s+fault|BUG:\s+unable\s+to\s+handle',
        severity='HIGH',
        category='kernel',
        description='A process crashed due to a segmentation fault (tried to access memory it should not). This is a bug in the software.',
        solution_hint='Identify which process crashed. Check if there is a core dump. Look for known bugs in that software version. Consider updating the package.',
        product='general',
    ),
    # --- Disk Space ---
    LogPattern(
        name='disk_full',
        regex=r'No space left on device|ENOSPC|filesystem.*full|disk\s+quota\s+exceeded',
        severity='HIGH',
        category='filesystem',
        description='A filesystem has run out of space. Any process trying to write files will fail. This can cause application crashes, database corruption, and logging failures.',
        solution_hint='Run df -h to find the full filesystem. Find large files with: find / -xdev -size +100M. Check /var/log for oversized logs. Clear old files or extend the filesystem.',
        product='general',
    ),
    # --- Systemd ---
    LogPattern(
        name='systemd_service_failed',
        regex=r'systemd.*:\s+\S+\.service.*Failed|Failed to start|entered failed state|Main process exited.*code=exited.*status=[1-9]',
        severity='MEDIUM',
        category='service',
        description='A systemd service has failed to start or has crashed. The service is not running and any dependent services may also fail.',
        solution_hint='Check service status: systemctl status <service>. View logs: journalctl -u <service> -n 50. Check configuration files for syntax errors. Try restarting: systemctl restart <service>.',
        product='general',
    ),
    LogPattern(
        name='systemd_timeout',
        regex=r'Timed out.*start|start.*operation timed out|TimeoutStartSec|Job.*timed out',
        severity='MEDIUM',
        category='service',
        description='A service took too long to start and was killed by systemd. The service may have a dependency that is not available.',
        solution_hint='Check what the service depends on (systemctl list-dependencies). Look for network or storage dependencies that might be slow. Increase TimeoutStartSec in the unit file if appropriate.',
        product='general',
    ),
    # --- Pacemaker / Cluster ---
    LogPattern(
        name='pacemaker_fencing',
        regex=r'fenc(ing|ed)\s+node|stonith.*reboot|STONITH.*operation|Peer.*was\s+terminated|fence_action',
        severity='CRITICAL',
        category='cluster',
        description='A cluster node was fenced (forcibly rebooted/powered off). This means the cluster decided this node was unresponsive and killed it to protect shared resources.',
        solution_hint='Check why the node was fenced - look for network issues, high load, or unresponsive services. Review corosync logs for communication failures. Check if the fenced node had hardware issues.',
        product='Pacemaker',
    ),
    LogPattern(
        name='pacemaker_node_lost',
        regex=r'Node\s+\S+\s+state\s+is\s+now\s+lost|member\s+\S+\s+left|lost\s+quorum|cluster\s+partition',
        severity='CRITICAL',
        category='cluster',
        description='The cluster has lost contact with a node. If enough nodes are lost, the cluster may lose quorum and stop all resources.',
        solution_hint='Check network connectivity to the lost node. Verify corosync is running on all nodes. Check for network interface or switch failures. Verify node health (ping, SSH).',
        product='Pacemaker',
    ),
    LogPattern(
        name='pacemaker_resource_failed',
        regex=r'resource.*failed|Failed\s+to\s+(start|stop|promote|demote|monitor)\s+\S+|operation.*on\s+\S+.*error',
        severity='HIGH',
        category='cluster',
        description='A cluster resource (service/filesystem/IP) failed to start, stop, or is not healthy. The cluster may try to move it to another node.',
        solution_hint='Check resource status: pcs status. Look at the resource agent logs. Try to start the resource manually to see the error. Check resource configuration: pcs resource show <resource>.',
        product='Pacemaker',
    ),
    # --- Corosync ---
    LogPattern(
        name='corosync_membership_change',
        regex=r'membership.*changed|new\s+membership|Members\s+(left|joined)|CPG\s+membership',
        severity='MEDIUM',
        category='cluster',
        description='The cluster membership has changed - a node joined or left. This is normal during planned maintenance but unexpected changes indicate problems.',
        solution_hint='Check if this was planned maintenance. If unexpected, check the node that left for network or hardware issues. Verify corosync ring status: corosync-cfgtool -s.',
        product='Pacemaker',
    ),
    LogPattern(
        name='corosync_ring_error',
        regex=r'ring\s+\d+.*error|Totem.*ring.*FAULTY|corosync.*ring.*failed|interface.*\d+.*is\s+now\s+down',
        severity='HIGH',
        category='cluster',
        description='A corosync communication ring has failed. The cluster uses rings for heartbeat communication. A failed ring means nodes may lose contact.',
        solution_hint='Check network interface status. Verify the cluster network is working (ping between nodes on the ring interface). Check switch ports. Review corosync.conf for correct interface bindings.',
        product='Pacemaker',
    ),
    # --- Multipath ---
    LogPattern(
        name='multipath_path_failed',
        regex=r'mpath.*path\s+(failed|down)|multipathd.*failed\s+path|checker.*failed|path\s+\S+\s+state\s+changed\s+to\s+failed',
        severity='HIGH',
        category='storage',
        description='A multipath path to storage has failed. If all paths fail, the disk becomes inaccessible. With multiple paths, the system can still reach storage via remaining paths.',
        solution_hint='Check multipath status: multipath -ll. Verify FC/iSCSI connectivity. Check switch zoning. Look for cable issues. If one path remains, the system is still functional but degraded.',
        product='Alletra',
    ),
    LogPattern(
        name='multipath_path_removed',
        regex=r'mpath.*path.*removed|orphan\s+path|remove.*mpath|multipathd.*remove\s+path',
        severity='HIGH',
        category='storage',
        description='A multipath path was removed from the system. This means the OS can no longer see one of the routes to a storage LUN.',
        solution_hint='Check if this was intentional (maintenance). If not, check FC/iSCSI link status, HBA health, and storage array port status. Rescan with: multipath -r.',
        product='Alletra',
    ),
    LogPattern(
        name='multipath_all_paths_down',
        regex=r'all\s+paths.*down|no\s+(valid|active)\s+path|FAILED.*mpath|mpath\w+\s+\S+\s+failed',
        severity='CRITICAL',
        category='storage',
        description='ALL paths to a multipath device are down. The disk is completely inaccessible. Any I/O to this device will hang or fail.',
        solution_hint='URGENT: Check storage connectivity immediately. Verify FC links, switches, and storage array health. This will cause application failures and potential data loss if writes were in progress.',
        product='Alletra',
    ),
    # --- libvirt / KVM ---
    LogPattern(
        name='libvirt_error',
        regex=r'libvirt.*error|libvirtd.*Error|virConnect.*failed|libvirt.*internal\s+error',
        severity='HIGH',
        category='virtualization',
        description='The libvirt virtualization daemon encountered an error. This can prevent VM operations (start, stop, migrate) from working.',
        solution_hint='Check libvirtd status: systemctl status libvirtd. Review /var/log/libvirt/ logs. Try restarting libvirtd. Check if AppArmor/SELinux is blocking operations.',
        product='KVM',
    ),
    LogPattern(
        name='qemu_error',
        regex=r'qemu.*error|qemu-kvm.*failed|qemu.*abort|KVM.*internal\s+error',
        severity='HIGH',
        category='virtualization',
        description='The QEMU hypervisor hit an error. This can crash a running VM or prevent one from starting.',
        solution_hint='Check VM logs in /var/log/libvirt/qemu/. Verify the VM XML configuration is valid. Check if the required resources (disk, network, memory) are available.',
        product='KVM',
    ),
    LogPattern(
        name='vm_start_failed',
        regex=r'(failed|unable|cannot)\s+to\s+(start|create|boot|launch)\s+(domain|vm|guest)|Domain.*failed\s+to\s+start|virDomainCreate.*failed',
        severity='HIGH',
        category='virtualization',
        description='A virtual machine failed to start. This could be due to resource issues, configuration errors, or storage problems.',
        solution_hint='Check the specific error in libvirt logs. Common causes: disk image not found, insufficient memory, network bridge missing, permission issues on disk files.',
        product='KVM',
    ),
    LogPattern(
        name='vm_crashed',
        regex=r'domain.*crashed|guest.*crashed|qemu.*terminated|VM.*unexpected.*shutdown|domain.*shut\s+off.*crashed',
        severity='CRITICAL',
        category='virtualization',
        description='A virtual machine has crashed unexpectedly. The VM is now powered off and any unsaved work is lost.',
        solution_hint='Check qemu logs for the VM. Look for OOM conditions on the host. Check storage accessibility. Review if the VM was affected by host resource pressure.',
        product='KVM',
    ),
    # --- Network ---
    LogPattern(
        name='iptables_no_chain',
        regex=r'iptables.*No\s+chain|iptables.*Chain.*does\s+not\s+exist|ip6?tables.*bad\s+rule',
        severity='MEDIUM',
        category='network',
        description='An iptables/firewall rule references a chain that does not exist. Firewall rules may not be applied correctly, potentially blocking or allowing unintended traffic.',
        solution_hint='List existing chains: iptables -L. Check if required chains were created by the application. Restart the firewall service to reinitialize chains.',
        product='general',
    ),
    LogPattern(
        name='netplan_apply_failed',
        regex=r'netplan.*apply.*failed|netplan.*error|networkd.*failed.*apply|Failed\s+to\s+apply\s+network\s+config',
        severity='MEDIUM',
        category='network',
        description='Network configuration (netplan) failed to apply. Network settings may not be correct, potentially causing connectivity issues.',
        solution_hint='Check netplan YAML syntax: netplan generate. Common issues: wrong indentation, invalid IP addresses, duplicate interface names. Review files in /etc/netplan/.',
        product='general',
    ),
    LogPattern(
        name='connection_refused',
        regex=r'Connection\s+refused|ECONNREFUSED|connect.*refused|Failed\s+to\s+connect.*refused',
        severity='MEDIUM',
        category='network',
        description='A network connection was refused. This means the target host is reachable but nothing is listening on the requested port.',
        solution_hint='Check if the target service is running. Verify the correct port number. Check firewall rules on the target host. Test with: ss -tlnp | grep <port>.',
        product='general',
    ),
    LogPattern(
        name='connection_timed_out',
        regex=r'Connection\s+timed?\s*out|ETIMEDOUT|connect.*timed?\s*out|timeout.*connect',
        severity='MEDIUM',
        category='network',
        description='A network connection timed out. This usually means a firewall is silently dropping packets, the host is unreachable, or the network path is broken.',
        solution_hint='Check network routing: traceroute <host>. Verify firewall rules along the path. Check if the target host is up. Test with shorter timeouts to confirm.',
        product='general',
    ),
    LogPattern(
        name='dns_resolution_failed',
        regex=r'(could\s+not|unable\s+to|failed\s+to)\s+resolve|Name\s+or\s+service\s+not\s+known|NXDOMAIN|DNS.*SERVFAIL|Temporary failure in name resolution',
        severity='MEDIUM',
        category='network',
        description='DNS name resolution failed. The system cannot translate a hostname to an IP address. This will break any service that uses hostnames.',
        solution_hint='Check /etc/resolv.conf for correct DNS servers. Test with: nslookup <hostname>. Verify DNS server is reachable. Check if the hostname exists in DNS.',
        product='general',
    ),
    LogPattern(
        name='bond_nic_link_down',
        regex=r'(bond\d+|eth\d+|ens\d+|enp\S+).*link\s+(down|is\s+not\s+ready)|NIC\s+Link\s+is\s+Down|carrier.*lost|link.*state.*down',
        severity='HIGH',
        category='network',
        description='A network interface or bond member has lost its link. If this is a bond member, redundancy is reduced. If it is the only interface, network connectivity is lost.',
        solution_hint='Check physical cable connections. Verify switch port status. Check for hardware failures: ethtool <interface>. If bond member, check bond status: cat /proc/net/bonding/bond0.',
        product='general',
    ),

    # --- SMAD ---
    LogPattern(
        name='smad_crash',
        regex=r'smad.*crash|smad.*core\s+dump|smad.*segfault|smad.*terminated|smad.*fatal',
        severity='HIGH',
        category='application',
        description='The SMAD (Service Monitor and Diagnostics) agent has crashed. This means health monitoring of HPE services is offline.',
        solution_hint='Restart SMAD service: systemctl restart smad. Check for crash dumps in /var/crash/. Verify SMAD version and check for known bugs. Check memory usage before crash.',
        product='Morpheus',
    ),
    LogPattern(
        name='smad_high_cpu',
        regex=r'smad.*high\s+cpu|smad.*cpu\s+usage|smad.*100%|smad.*runaway|smad.*stuck',
        severity='MEDIUM',
        category='application',
        description='SMAD is consuming excessive CPU. This can impact other services on the system and may indicate a bug or infinite loop.',
        solution_hint='Check what SMAD is doing: strace -p <pid>. Collect a thread dump. Check if this is a known issue with the SMAD version. Consider restarting if CPU remains high.',
        product='Morpheus',
    ),
    # --- Permission / Access ---
    LogPattern(
        name='permission_denied',
        regex=r'Permission\s+denied|EACCES|Operation\s+not\s+permitted|Access\s+denied|cannot\s+open.*permission',
        severity='MEDIUM',
        category='security',
        description='A process was denied access to a file or resource. This usually means file permissions or SELinux/AppArmor are blocking access.',
        solution_hint='Check file permissions: ls -la <path>. Check SELinux: getenforce, ausearch -m avc. Check AppArmor: aa-status. Verify the process runs as the correct user.',
        product='general',
    ),
    # --- Mount / Filesystem ---
    LogPattern(
        name='mount_failed',
        regex=r'mount.*failed|Failed\s+to\s+mount|mount.*error|mount.*No\s+such\s+(device|file)',
        severity='HIGH',
        category='filesystem',
        description='A filesystem mount operation failed. The filesystem is not accessible. Services depending on it will fail.',
        solution_hint='Check if the device exists: lsblk. Verify the mount point exists. Check filesystem type. Look for errors: dmesg | tail. Try mounting manually with verbose: mount -v <device> <mountpoint>.',
        product='general',
    ),
    LogPattern(
        name='filesystem_error',
        regex=r'EXT4-fs\s+error|XFS.*error|filesystem.*error|journal.*error|metadata\s+I/O\s+error|Aborting\s+journal',
        severity='CRITICAL',
        category='filesystem',
        description='A filesystem-level error occurred. This could mean data corruption. The filesystem may remount read-only to prevent further damage.',
        solution_hint='Check dmesg for disk errors. Run filesystem check (unmount first): fsck /dev/sdX. Check SMART data for disk health. Consider data backup immediately.',
        product='general',
    ),
    LogPattern(
        name='filesystem_readonly_remount',
        regex=r'Remounting\s+filesystem\s+read-only|EXT4-fs.*remount.*ro|going\s+read.only',
        severity='CRITICAL',
        category='filesystem',
        description='A filesystem was automatically remounted as read-only due to errors. All write operations to this filesystem will now fail.',
        solution_hint='This is usually caused by disk hardware errors. Check dmesg for I/O errors. The filesystem needs fsck after unmounting. Check disk SMART status immediately.',
        product='general',
    ),
    # --- CPU / Thermal ---
    LogPattern(
        name='cpu_throttling',
        regex=r'cpu.*throttl|frequency\s+limited|CPU\s+\d+.*MHz.*limited|thermal\s+throttling',
        severity='MEDIUM',
        category='hardware',
        description='The CPU is being throttled (slowed down). This reduces performance and is usually caused by overheating or power limits.',
        solution_hint='Check CPU temperatures: sensors or ipmitool sdr. Verify cooling fans are working. Check for dust buildup. In VMs, check host CPU contention.',
        product='general',
    ),
    LogPattern(
        name='thermal_critical',
        regex=r'critical\s+temperature|thermal.*critical|temperature.*above.*threshold|CPU\s+temperature\s+above',
        severity='CRITICAL',
        category='hardware',
        description='A hardware component has reached a critical temperature. The system may shut down to prevent hardware damage.',
        solution_hint='URGENT: Check physical server cooling immediately. Verify fan status via IPMI/iLO. Check ambient temperature. The server may need to be powered off to prevent damage.',
        product='general',
    ),
    # --- I/O Errors ---
    LogPattern(
        name='io_error_on_device',
        regex=r'I/O\s+error.*dev\s+\S+|end_request.*I/O\s+error|Buffer\s+I/O\s+error|blk_update_request.*I/O\s+error',
        severity='HIGH',
        category='storage',
        description='An I/O error occurred on a disk device. This means the disk could not complete a read or write operation. May indicate disk failure.',
        solution_hint='Check which device: look at the dev name in the error. Check SMART: smartctl -a /dev/sdX. Check multipath if SAN storage. Multiple I/O errors = disk replacement needed.',
        product='general',
    ),
    LogPattern(
        name='io_scheduler_stall',
        regex=r'task\s+\S+:\d+\s+blocked\s+for\s+more\s+than|hung_task_timeout|INFO:\s+task\s+\S+\s+blocked',
        severity='HIGH',
        category='storage',
        description='A process has been blocked waiting for I/O for an abnormally long time. This usually means storage is very slow or unresponsive.',
        solution_hint='Check disk latency: iostat -xz 1. Check multipath for failed paths. Check storage array performance. The blocked process may be unrecoverable without storage fix.',
        product='general',
    ),
    # --- Additional Storage ---
    LogPattern(
        name='lvm_error',
        regex=r'LVM.*error|lvm.*failed|vg.*not\s+found|lv.*not\s+found|PV.*missing',
        severity='HIGH',
        category='storage',
        description='An LVM (Logical Volume Manager) error occurred. A volume group or logical volume may be inaccessible.',
        solution_hint='Check LVM status: vgs, lvs, pvs. Look for missing physical volumes. If a PV is on a failed disk, the VG may be partial. Check multipath if PV is on SAN.',
        product='general',
    ),
    # --- Additional Cluster ---
    LogPattern(
        name='quorum_lost',
        regex=r'lost\s+quorum|Quorum\s+lost|partition\s+WITHOUT\s+quorum|no\s+longer\s+has\s+quorum',
        severity='CRITICAL',
        category='cluster',
        description='The cluster has lost quorum (majority of nodes). All cluster resources will be stopped to prevent split-brain data corruption.',
        solution_hint='Check which nodes are offline. Verify network between nodes. If intentional maintenance, set no-quorum-policy=ignore temporarily. Restore quorum by bringing nodes back online.',
        product='Pacemaker',
    ),
    LogPattern(
        name='split_brain',
        regex=r'split.brain|partition\s+detected|multiple\s+partitions|both\s+sides.*active',
        severity='CRITICAL',
        category='cluster',
        description='A cluster split-brain condition was detected. Both halves of the cluster think they are the active side. This can cause data corruption on shared storage.',
        solution_hint='URGENT: Fence one side immediately. Check which side has quorum. Review fencing history. After resolution, check shared filesystems for corruption.',
        product='Pacemaker',
    ),
    # --- Additional Network ---
    LogPattern(
        name='network_unreachable',
        regex=r'Network\s+is\s+unreachable|ENETUNREACH|No\s+route\s+to\s+host|Destination\s+Host\s+Unreachable',
        severity='HIGH',
        category='network',
        description='The network destination is unreachable. There is no valid route to the target. This indicates a routing problem or a completely disconnected network.',
        solution_hint='Check routing table: ip route. Verify default gateway. Check if interface is up: ip link. Verify network cables and switch ports.',
        product='general',
    ),
    LogPattern(
        name='arp_flux',
        regex=r'ARP.*duplicate|arp.*conflict|Neighbour\s+table\s+overflow|ARP.*mismatch',
        severity='MEDIUM',
        category='network',
        description='An ARP conflict or table overflow was detected. This can cause network communication failures due to incorrect MAC address resolution.',
        solution_hint='Check for duplicate IPs on the network: arping. Review network configuration for overlapping addresses. Check if ARP table size needs increasing.',
        product='general',
    ),
    # --- Additional Application ---
    LogPattern(
        name='java_heap_oom',
        regex=r'java\.lang\.OutOfMemoryError|Java\s+heap\s+space|GC\s+overhead\s+limit|Metaspace',
        severity='HIGH',
        category='application',
        description='A Java application ran out of heap memory. The application may crash or become unresponsive.',
        solution_hint='Increase Java heap size (-Xmx). Check for memory leaks with jmap/jhat. Review GC logs. Consider profiling the application to find the leak source.',
        product='general',
    ),
    LogPattern(
        name='database_connection_error',
        regex=r'(cannot|could\s+not|failed\s+to)\s+connect\s+to\s+(database|postgres|mysql|mariadb|mongodb)|too\s+many\s+connections',
        severity='HIGH',
        category='application',
        description='A database connection failed. This can cause application errors and data unavailability.',
        solution_hint='Check if the database service is running. Verify connection credentials. Check max_connections setting. Look for connection pool exhaustion.',
        product='general',
    ),
    # --- HPE Specific ---
    LogPattern(
        name='morpheus_deploy_failed',
        regex=r'morpheus.*deploy.*fail|provision.*failed|instance.*creation.*failed|morpheus.*error.*provision',
        severity='HIGH',
        category='application',
        description='A Morpheus cloud management deployment or provisioning operation failed.',
        solution_hint='Check Morpheus application logs. Verify cloud credentials. Check target infrastructure capacity. Review the instance configuration for errors.',
        product='Morpheus',
    ),
    LogPattern(
        name='vme_error',
        regex=r'VME.*error|vme.*failed|vm-explorer.*error|backup.*failed.*vme',
        severity='HIGH',
        category='application',
        description='VM Explorer (VME) encountered an error. Backup or VM management operations may have failed.',
        solution_hint='Check VME logs. Verify storage space for backups. Check connectivity to hypervisor. Review VME configuration and credentials.',
        product='VME',
    ),
    LogPattern(
        name='alletra_lun_offline',
        regex=r'alletra.*offline|nimble.*offline|3par.*offline|LUN.*offline|volume.*offline|target.*not.*ready',
        severity='CRITICAL',
        category='storage',
        description='A storage LUN/volume from HPE Alletra (or Nimble/3PAR) has gone offline. Any I/O to this volume will fail.',
        solution_hint='Check storage array management console. Verify array health. Check FC/iSCSI connectivity. The volume may need to be brought online from the array side.',
        product='Alletra',
    ),
    LogPattern(
        name='certificate_expired',
        regex=r'certificate.*expir|SSL.*expir|TLS.*expir|x509.*expir|cert.*not\s+yet\s+valid',
        severity='MEDIUM',
        category='security',
        description='An SSL/TLS certificate has expired or is not yet valid. HTTPS connections and TLS-secured services will fail.',
        solution_hint='Check certificate dates: openssl x509 -in <cert> -noout -dates. Renew the certificate. Update the certificate in the application configuration.',
        product='general',
    ),
    LogPattern(
        name='authentication_failed',
        regex=r'authentication\s+fail|login\s+fail|invalid\s+(password|credential|token)|unauthorized\s+access|401\s+Unauthorized',
        severity='MEDIUM',
        category='security',
        description='An authentication attempt failed. This could be a misconfigured service, expired credentials, or a security issue.',
        solution_hint='Check if credentials are correct. Verify the authentication backend (LDAP/AD) is reachable. Check for locked accounts. Review access logs for brute-force patterns.',
        product='general',
    ),
    LogPattern(
        name='watchdog_timeout',
        regex=r'watchdog.*timeout|watchdog.*triggered|softlockup|hard\s+LOCKUP|RCU.*stall',
        severity='CRITICAL',
        category='kernel',
        description='The kernel watchdog detected a CPU lockup or stall. The system may be completely or partially unresponsive.',
        solution_hint='Check for heavy I/O, kernel module issues, or hardware problems. Collect crash dump if available. Check if any kernel modules are known buggy. May need forced reboot.',
        product='general',
    ),
    LogPattern(
        name='memory_hardware_error',
        regex=r'(EDAC|mce|Machine\s+check).*error|Hardware\s+Error|corrected\s+memory\s+error|uncorrected.*memory',
        severity='HIGH',
        category='hardware',
        description='A hardware memory error was detected. Corrected errors (CE) are usually OK but indicate degradation. Uncorrected errors (UE) can crash the system.',
        solution_hint='Check which DIMM is affected: edac-util -s or ipmitool sel list. Plan DIMM replacement for uncorrected errors. Monitor CE rate - increasing CEs predict UE.',
        product='general',
    ),
    # --- iptables / Firewall Persistence ---
    LogPattern(
        name='iptables_rules_missing',
        regex=r'(Chain .+ \(policy|iptables.*no chain|iptables: No chain)',
        severity='CRITICAL',
        category='network',
        description='iptables rules are missing or chains not found. Rules are lost after reboot when iptables-persistent is not installed.',
        solution_hint='Install iptables-persistent: apt-get install iptables-persistent && iptables-save > /etc/iptables/rules.v4 && systemctl enable netfilter-persistent',
        product='Morpheus',
    ),
    LogPattern(
        name='iptables_empty_ruleset',
        regex=r'(Chain (INPUT|FORWARD|OUTPUT) \(policy ACCEPT\)$|^-P (INPUT|OUTPUT|FORWARD) ACCEPT$)',
        severity='HIGH',
        category='network',
        description='iptables has default ACCEPT policy with no rules - firewall is effectively disabled. Cluster communication ports (443, 9200, 9300, 5672, 3306) may be unprotected.',
        solution_hint='Restore iptables rules from backup or apply Morpheus cluster communication rules for ports 443, 9200, 9300, 5672, 3306',
        product='Morpheus',
    ),
    LogPattern(
        name='netplan_apply_required',
        regex=r'(netplan apply|networkd-dispatcher.*failed|network.*unreachable.*storage|no route to host)',
        severity='HIGH',
        category='network',
        description='Network configuration not applied. Storage access may require manual netplan apply after reboot.',
        solution_hint='Run netplan apply on affected hosts. Check /etc/netplan/*.yaml for correct storage network config. Investigate residual Aruba CX plugin configuration.',
        product='Morpheus',
    ),
    # --- Cluster Quorum / Fencing ---
    LogPattern(
        name='quorum_loss',
        regex=r'(quorum (lost|not reached|membership changed)|corosync.*quorum.*lost|votequorum.*lost|Expected votes:.*\d+.*Total votes:.*\d+)',
        severity='CRITICAL',
        category='cluster',
        description='Cluster quorum lost. Nodes cannot agree on cluster state. Risk of split-brain or self-fencing.',
        solution_hint='Check corosync communication (ports 5405-5407). Verify iptables allows cluster traffic. Check corosync-cfgtool -s for ring status.',
        product='Pacemaker',
    ),
    LogPattern(
        name='self_fencing_risk',
        regex=r'(fenc(e|ing).*trigger|stonith.*action|node.*fenced|self-fencing|peer.*lost)',
        severity='CRITICAL',
        category='cluster',
        description='Self-fencing or fencing event detected. A node was forcibly shut down by the cluster to prevent data corruption.',
        solution_hint='Check why node lost communication. Verify iptables rules, network connectivity, and corosync rings. Review fence history with pcs stonith history.',
        product='Pacemaker',
    ),
    LogPattern(
        name='cluster_communication_failure',
        regex=r'(connection refused.*(5672|9200|9300|3306|443)|cannot connect to (rabbit|elastic|mysql)|cluster.*communication.*fail)',
        severity='CRITICAL',
        category='cluster',
        description='Cluster services cannot communicate. Morpheus requires ports 443 (HTTPS), 9200/9300 (Elasticsearch), 5672 (RabbitMQ), 3306 (MySQL).',
        solution_hint='Verify iptables allows cluster ports: 443, 9200, 9300, 5672, 3306. Check with: iptables -L -n | grep -E "443|9200|9300|5672|3306"',
        product='Morpheus',
    ),
    # --- Aruba CX / Network Plugin ---
    LogPattern(
        name='aruba_cx_residual',
        regex=r'(aruba|cx.plugin|network.*plugin.*removed|stale.*network.*config)',
        severity='MEDIUM',
        category='network',
        description='Possible residual Aruba CX plugin configuration detected. This may interfere with network settings after reboot.',
        solution_hint='Check for leftover Aruba CX plugin config in /etc/netplan/. Remove stale configs and run netplan apply.',
        product='Morpheus',
    ),
    LogPattern(
        name='service_not_persistent',
        regex=r'(netfilter-persistent.*not found|iptables-persistent.*not installed|systemctl.*netfilter.*not found)',
        severity='HIGH',
        category='network',
        description='iptables persistence service not installed. Firewall rules will be lost on every reboot.',
        solution_hint='Install: apt-get install iptables-persistent. Then: iptables-save > /etc/iptables/rules.v4 && systemctl enable netfilter-persistent',
        product='Morpheus',
    ),
    # --- Storage Access ---
    LogPattern(
        name='storage_access_lost',
        regex=r'(storage.*unreachable|mount.*failed|nfs.*server not responding|cannot access.*/mnt|connection timed out.*storage)',
        severity='CRITICAL',
        category='storage',
        description='Storage access lost. VMs and services depending on shared storage will fail.',
        solution_hint='Check network connectivity to storage. Verify netplan config. Run netplan apply if needed. Check multipath status.',
        product='Alletra',
    ),
    # --- VM Provisioning ---
    LogPattern(
        name='vm_provisioning_timeout',
        regex=r'(provision.*timed? ?out|vm.*creation.*timeout|task.*timeout.*provision|exceeded.*timeout.*deploy)',
        severity='HIGH',
        category='virtualization',
        description='VM provisioning or creation timed out. Could be caused by storage access issues, network problems, or resource exhaustion.',
        solution_hint='Check storage connectivity, available disk space, network access to datastore, and Morpheus task logs for detailed error.',
        product='Morpheus',
    ),
    # --- Backup ---
    LogPattern(
        name='backup_failure',
        regex=r'(backup.*(fail|error)|synthetic full.*fail|veeam.*error|backup.*incomplete|Cannot create snapshot)',
        severity='HIGH',
        category='backup',
        description='Backup operation failed. Could be synthetic full backup, snapshot creation, or backup job error.',
        solution_hint='Check storage space, snapshot capability, backup agent logs, and connectivity to backup target.',
        product='VME',
    ),
    # --- APIPA / Dual IP ---
    LogPattern(
        name='dual_ip_apipa',
        regex=r'(169\.254\.[0-9]+\.[0-9]+|APIPA|link-local.*address.*assigned|multiple.*IP.*address)',
        severity='MEDIUM',
        category='network',
        description='APIPA/link-local address (169.254.x.x) detected. This means DHCP failed and the interface fell back to auto-configuration.',
        solution_hint='Check DHCP server availability. Verify network config in /etc/netplan/. Check if the interface has both static and DHCP config.',
        product='VME',
    ),
    # --- vVOL ---
    LogPattern(
        name='vvol_deploy_failure',
        regex=r'(vvol.*fail|vVOL.*error|unable.*deploy.*vmdk.*vvol|virtual volume.*not available|VASA provider.*error)',
        severity='HIGH',
        category='storage',
        description='vVOL (Virtual Volume) deployment or access failure. VMDK cannot be deployed to Alletra vVOL datastore.',
        solution_hint='Check VASA provider connectivity, vVOL datastore health, Alletra array status, and protocol endpoint accessibility.',
        product='Alletra',
    ),
    # --- SCSI Persistent Reservation ---
    LogPattern(
        name='pr_reservation_key',
        regex=r'(PR reservation|persistent reservation.*key|SCSI.*PR.*key|reservation key.*not|pr_key.*missing)',
        severity='HIGH',
        category='storage',
        description='SCSI Persistent Reservation (PR) key issue. GFS2 volumes require PR reservation keys for proper cluster access.',
        solution_hint='Verify PR keys exist on storage LUN. Check sg_persist output. Ensure all nodes have registered reservation keys.',
        product='GFS2',
    ),
    LogPattern(
        name='gfs2_glock_deadlock',
        regex=r'(gfs2_glock_wait|gfs2_create_inode|gfs2_glock_nq.*blocked|glock.*contention|DLM.*glock.*deadlock)',
        severity='CRITICAL',
        category='filesystem',
        description='GFS2 global lock (glock) deadlock detected. Processes are stuck waiting to acquire GFS2 filesystem locks. This freezes ALL filesystem I/O on the GFS2 mount, including heartbeat writes. Commonly triggered by concurrent SCSI rescans + storage pool refreshes + pacemaker resource updates happening simultaneously.',
        solution_hint='Check dmesg for D-state processes with gfs2 in call trace. Identify what triggered the lock contention (SCSI rescan, pool refresh, pcs resource update). Immediate fix: controlled reboot of affected host. Long-term: upgrade to VME 8.1.2+ (MORPH-11774 fix) or avoid concurrent GFS2 operations.',
        product='GFS2',
    ),
    LogPattern(
        name='heartbeat_write_failure',
        regex=r'(Unable to Write Heartbeat|Failed to write heartbeat file|heartbeat.*datastore.*unhealthy|File exists check timed out|MvmHeartbeatFailover.*Error creating heartbeat)',
        severity='CRITICAL',
        category='cluster',
        description='VME agent (MvmHeartbeatFailover) cannot write heartbeat to GFS2 datastore. After 6 consecutive failures (MAX_ISOLATION_FAIL_COUNT=6, every 20 seconds = ~2 minutes), the agent will trigger emergency VM shutdown to protect data integrity. This is a split-brain prevention mechanism.',
        solution_hint='Check GFS2 mount health (mount | grep gfs2). Look for D-state processes (ps aux | grep D). Check if GFS2 is in deadlock state. If heartbeat failures are caused by GFS2 deadlock, a host reboot is needed. Upgrade to VME 8.1.2+ for fix (MORPH-11774).',
        product='VME',
    ),
    LogPattern(
        name='agent_isolation_shutdown',
        regex=r'(All heartbeat datastore paths have been unhealthy.*Shutting down all VMs|isolation.*shutdown|MvmHeartbeatFailover.*Shutting down all VMs to protect data integrity)',
        severity='CRITICAL',
        category='cluster',
        description='VME agent triggered emergency isolation shutdown of ALL VMs on this host. This happens when the agent cannot write heartbeats for 6 consecutive checks (~2 minutes). The agent assumes it has lost cluster membership and shuts down all VMs to prevent split-brain data corruption. The VME Manager VM may also be shut down, preventing failover to other nodes.',
        solution_hint='1. Check why heartbeat writes failed (GFS2 deadlock, storage issue, network) 2. Reboot affected host to clear stale locks 3. Manually restart VMs after verifying storage health 4. Check if VME Manager is affected (prevents cluster-wide failover) 5. Upgrade to VME 8.1.2+ (MORPH-11774).',
        product='VME',
    ),
    LogPattern(
        name='dstate_blocked_process',
        regex=r'(task:\w+\s+state:D|blocked for more than \d+ seconds|hung_task_timeout_secs|INFO: task.*blocked for more than)',
        severity='HIGH',
        category='kernel',
        description='Process stuck in uninterruptible sleep (D-state) for extended period. The kernel hung task detector has triggered. This often indicates I/O subsystem deadlock, typically GFS2 glock contention or storage path failure. Multiple D-state processes suggest a systemic issue like filesystem deadlock.',
        solution_hint='Check call trace in dmesg for the blocked process. If it shows gfs2_glock_wait or gfs2_create_inode, it is a GFS2 deadlock. Check storage paths (multipath -ll). If GFS2 deadlock, reboot the host. If storage path issue, check iSCSI connectivity.',
        product='general',
    ),
    # --- Datastore Decommission / STONITH Fencing Cascade ---
    LogPattern(
        name='stonith_fencing_cascade',
        regex=r'(STONITH.*fenc(e|ing)|stonith.*action.*reboot|fenced.*node.*stonith|Initiating.*stonith|stonith-ng.*scheduling)',
        severity='CRITICAL',
        category='cluster',
        description='STONITH (Shoot The Other Node In The Head) fencing event detected. The cluster is forcibly restarting or isolating nodes to protect data integrity. Multiple STONITH events in sequence indicate a fencing cascade — one node fence triggering others. This can result from orphaned Pacemaker resources, GFS2 unmount failures, or storage path removal while resources are still active.',
        solution_hint='1. Check pcs stonith history for fencing sequence\n2. Look for orphaned resources (pcs resource cleanup)\n3. Check if a datastore decommission or storage change preceded the event\n4. Verify STONITH device configuration still references valid paths\n5. If cascade: reboot all affected nodes after fixing root cause.',
        product='Pacemaker',
    ),
    LogPattern(
        name='gfs2_readonly_cluster_wide',
        regex=r'(GFS2.*read.only|Remounting.*read-only.*gfs2|gfs2.*jid=\d+.*ro|multiple.*datastore.*read.only|storage.*fencing.*read.only)',
        severity='CRITICAL',
        category='filesystem',
        description='GFS2 filesystem transitioned to read-only state. When this affects MULTIPLE datastores simultaneously, it indicates a cluster-wide storage fencing event — typically triggered by STONITH fencing that forces protective read-only transitions to prevent data corruption. Impact: ALL VMs using affected datastores lose write access and will fail.',
        solution_hint='1. Do NOT force remount immediately — check data integrity first\n2. Run fsck.gfs2 on each affected volume before remounting\n3. Check pcs status for the fencing event that caused this\n4. Verify DLM service health (dlm_tool status)\n5. Recovery order: fix root cause → fsck → remount → restart VMs.',
        product='GFS2',
    ),
    LogPattern(
        name='dlm_service_failure',
        regex=r'(dlm.*fail|DLM.*error|dlm_controld.*error|dlm.*lock.*space.*fail|DLM.*connection.*lost|dlm_unlock.*error)',
        severity='CRITICAL',
        category='cluster',
        description='Distributed Lock Manager (DLM) service failure. DLM manages locks for GFS2 filesystems across cluster nodes. DLM failure means GFS2 cannot coordinate access between nodes, leading to filesystem read-only transitions or withdrawals. Often caused by cluster communication loss, STONITH fencing, or Pacemaker resource failures.',
        solution_hint='1. Check DLM status: dlm_tool status, dlm_tool lockdebug\n2. Check Pacemaker/Corosync health: pcs status, corosync-cfgtool -s\n3. Verify cluster communication (corosync rings)\n4. Restart DLM: pcs resource restart dlm-clone\n5. May need full cluster restart if DLM is stuck.',
        product='GFS2',
    ),
    LogPattern(
        name='orphaned_pacemaker_resource',
        regex=r'(orphan.*resource|resource.*orphan|unmanaged.*resource|resource.*no longer.*managed|pcs.*resource.*not found|Failed actions:.*not running)',
        severity='HIGH',
        category='cluster',
        description='Orphaned or unmanaged Pacemaker resource detected. This occurs when a resource configuration is removed from Pacemaker while the underlying service (like a GFS2 mount) is still active. The resource becomes unmanageable — Pacemaker cannot stop or recover it. This can trigger STONITH fencing as the cluster tries to recover a resource it can no longer control.',
        solution_hint='1. List orphaned resources: pcs status --full\n2. Manual cleanup: pcs resource cleanup <resource>\n3. If GFS2 mount orphaned: manually unmount then cleanup\n4. Check if a datastore decommission removed the Pacemaker config before unmount completed\n5. Prevent recurrence: ensure unmount completes before removing Pacemaker resource.',
        product='Pacemaker',
    ),
    LogPattern(
        name='datastore_decommission_race',
        regex=r'(datastore.*stop.*remov|resource.*delete.*before.*unmount|pcs resource.*delete.*gfs2|morpheus.*datastore.*decommission.*fail|Stopped.*datastore.*removing.*resource)',
        severity='CRITICAL',
        category='storage',
        description='Datastore decommission race condition detected. The Morpheus platform removed Pacemaker resource configuration BEFORE the GFS2 unmount completed. This leaves the datastore in an orphaned state that cannot be managed by the cluster, potentially triggering STONITH fencing and a cluster-wide cascade failure affecting all datastores.',
        solution_hint='This is a known Morpheus bug (MORPH-13237). DO NOT decommission datastores via Morpheus UI if they have active I/O or pending unmounts. Workaround: 1. Manually unmount GFS2 (umount) 2. Then remove Pacemaker resource (pcs resource delete) 3. Then remove from Morpheus. Upgrade to VME 9.x where storage orchestration is handled by Morpheus agent directly.',
        product='Morpheus',
    ),
    # --- NIC Flap / Split-Brain / DLM Stateful Merge ---
    LogPattern(
        name='nic_link_flapping',
        regex=r'(NIC Link is Down|NIC Link is up|link status definitely down.*disabling slave|bond\d+:.*slave.*link.*down|ice.*ens\w+.*NIC Link is Down)',
        severity='HIGH',
        category='network',
        description='NIC link flapping detected (rapid up/down cycles). In clustered environments, NIC flapping disrupts LACP bond negotiation and causes transient packet loss that can exceed Corosync TOTEM token timeout. Repeated flapping indicates hardware failure (NIC port, cable, or switch port). Check if this NIC carries cluster heartbeat traffic — if so, cluster split-brain risk is high.',
        solution_hint='1. Check bond slave statistics for link failure count (cat /proc/net/bonding/bond0)\n2. Compare link failures across all NICs — a single port with high count = faulty hardware\n3. Check switch port for errors (CRC, FCS)\n4. Replace NIC or cable if hardware fault confirmed\n5. Add redundant Corosync ring (rrp_mode) to prevent single-NIC heartbeat failure.',
        product='general',
    ),
    LogPattern(
        name='knet_link_down',
        regex=r'(\[KNET\].*link:.*host:.*\d+.*link:.*\d+.*is down|knet.*link.*down|kronosnet.*link.*down)',
        severity='CRITICAL',
        category='cluster',
        description='Corosync KNET (Kronosnet) cluster communication link is down. This means the cluster node has lost heartbeat connectivity to one or more peer nodes. If all links to a node go down and exceed the TOTEM token timeout, the cluster will declare that node dead and form a new membership — potentially causing a split-brain if the node is actually still alive.',
        solution_hint='1. Check physical NIC status (ip link show, ethtool)\n2. Check bond status if using LACP (cat /proc/net/bonding/bond0)\n3. Verify corosync ring status (corosync-cfgtool -s)\n4. Check if NIC is flapping (grep "Link is Down" /var/log/kern.log)\n5. If single ring: add redundant ring immediately.',
        product='Corosync',
    ),
    LogPattern(
        name='totem_token_timeout',
        regex=r'(\[TOTEM\].*[Tt]oken.*not.*received.*\d+\s*ms|\[TOTEM\].*[Ff]ailed to receive.*leave message|\[TOTEM\].*[Aa] new membership.*formed.*Members left)',
        severity='CRITICAL',
        category='cluster',
        description='Corosync TOTEM token timeout — a cluster node failed to pass the token within the configured timeout (typically 3000-5000ms). This triggers membership recalculation. "Members left" in the log means those nodes were expelled from the cluster. This is the precursor to split-brain and fencing events. Common causes: NIC flapping, network congestion, I/O pressure blocking CPU.',
        solution_hint='1. Check if NIC flapping preceded this (grep "Link is Down" kern.log)\n2. Review TOTEM token timeout value in corosync.conf (token: <ms>)\n3. Check for I/O pressure at the time (was there a storage event?)\n4. Verify ring health: corosync-cfgtool -s\n5. Add redundant corosync ring if only one configured.',
        product='Corosync',
    ),
    LogPattern(
        name='dlm_stateful_merge_kill',
        regex=r'(stateful merge|kill due to stateful merge|tell corosync to remove nodeid|dlm_controld.*kill|daemon node \d+ kill)',
        severity='CRITICAL',
        category='cluster',
        description='DLM (Distributed Lock Manager) detected a STATEFUL MERGE condition and is KILLING cluster nodes. This happens when two cluster partitions rejoin after a split-brain, but their DLM lock states have diverged during the split. DLM cannot safely reconcile the conflicting lock states, so it kills nodes to prevent data corruption. This typically results in ALL nodes being killed and corosync exiting with status 255.',
        solution_hint='This is a protective mechanism — DLM killed nodes to prevent corrupted lock state. Recovery: 1. Manually restart corosync on all nodes (rolling or simultaneous)\n2. DLM will recover lockspaces and replay GFS2 journals\n3. Investigate WHY the split-brain occurred (NIC flap? network issue?)\n4. Fix root cause before relying on cluster\n5. Consider adding Restart=on-failure to corosync.service for automatic recovery.',
        product='DLM',
    ),
    LogPattern(
        name='corosync_killed_by_dlm',
        regex=r'(\[CFG\].*[Kk]illed by node \d+.*dlm_controld|\[MAIN\].*Corosync.*exiting with status.*-1|corosync\.service.*[Ff]ailed with result.*exit-code)',
        severity='CRITICAL',
        category='cluster',
        description='Corosync was forcibly killed by dlm_controld on another node. This is part of the DLM stateful merge protection — when DLM detects divergent lock states between rejoining partitions, it instructs corosync to remove nodes. The killed node exits with status -1/255. If corosync.service has no Restart= directive, the node will remain down indefinitely requiring manual intervention.',
        solution_hint='1. Check if corosync will auto-restart (systemctl cat corosync.service | grep Restart)\n2. If no Restart= directive: manually start corosync (systemctl start corosync)\n3. Check pacemaker status — it may be retrying connection continuously\n4. Add Restart=on-failure to corosync.service to prevent extended outages\n5. Investigate the split-brain root cause.',
        product='Corosync',
    ),
    LogPattern(
        name='corosync_no_restart',
        regex=r'(Could not connect to Corosync CFG.*CS_ERR_LIBRARY|cluster reconnect failed.*reattempted|pacemakerd.*Could not connect to Corosync)',
        severity='HIGH',
        category='cluster',
        description='Pacemaker is continuously trying to reconnect to Corosync but failing. This means corosync was killed/crashed and did NOT auto-restart. Pacemaker will retry every second indefinitely, producing these log entries. The cluster is completely non-functional until corosync is manually restarted. This can produce 36+ hours of continuous error logs if not caught.',
        solution_hint='1. Immediately restart corosync: systemctl start corosync\n2. Check why corosync died (grep "Killed by node\\|exiting with status" /var/log/syslog)\n3. Add Restart=on-failure to /etc/systemd/system/corosync.service.d/restart.conf\n4. Run systemctl daemon-reload after adding restart directive\n5. Verify cluster reforms: pcs status.',
        product='Pacemaker',
    ),
    LogPattern(
        name='scsi_alua_path_detach',
        regex=r'(alua:.*[Dd]etach|scsi.*alua.*detach|multipathd.*path removed from map|ALUA.*state.*transition|alua.*port group)',
        severity='HIGH',
        category='storage',
        description='SCSI ALUA (Asymmetric Logical Unit Access) path detach detected. This indicates a storage controller failover or path rebalancing event. When this happens across ALL LUNs simultaneously, it suggests a storage controller cycling/failover event. Mass ALUA detach/reattach adds I/O stress and can contribute to TOTEM token delays in clustered environments.',
        solution_hint='1. Check multipath status after event: multipath -ll\n2. Verify all paths came back: multipathd show paths\n3. Check storage array for controller failover events\n4. Review if this was planned maintenance\n5. If correlated with cluster issues: the I/O storm may have caused TOTEM timeouts.',
        product='Alletra',
    ),
    # --- OOM / VM Kill / Multipath Saturation (MORPHL4-26) ---
    LogPattern(
        name='oom_kill_qemu_vm',
        regex=r'(oom-kill:.*qemu|Out of memory:.*[Kk]illed process.*qemu|oom_reaper.*qemu|invoked oom-killer.*qemu|oom-kill.*machine\.slice)',
        severity='CRITICAL',
        category='virtualization',
        description='Linux OOM killer terminated a QEMU/KVM virtual machine process. The host ran out of available memory and the kernel chose to kill a VM to free RAM. This means the host is severely memory-overcommitted. Other VMs on the same host may be at risk. If the OOM-killed VM was using shared storage, it may have had in-flight writes that are now lost.',
        solution_hint='1. Check which VM was killed: look for domain name in the log (machine-qemu\\x2d<id>\\x2d<name>.scope)\n2. Check host memory: free -h, cat /proc/meminfo\n3. Audit VM memory allocations vs physical RAM: virsh list --all, sum memory with virsh dominfo\n4. Reduce VM count or memory allocation\n5. Do NOT auto-restart the VM without checking if it had in-flight writes to shared storage.',
        product='VME',
    ),
    LogPattern(
        name='vm_running_multiple_hosts',
        regex=r'(VM.*running on multiple|duplicate.*VM.*instance|VM.*already running.*other host|split.brain.*VM|virsh.*destroy.*duplicate)',
        severity='CRITICAL',
        category='virtualization',
        description='A virtual machine is running simultaneously on MULTIPLE hosts — this is a split-brain condition that WILL cause filesystem corruption on the VM disk. When fencing fails and the cluster cannot safely evict a node, Morpheus may start a VM on another host while it is still running on the original. Any writes from both instances corrupt the virtual disk.',
        solution_hint='CRITICAL — DO NOT DELAY:\n1. Identify which host the VM should be on (check Morpheus UI "authoritative" host)\n2. On the WRONG host: virsh destroy <domain> && virsh undefine <domain>\n3. Do NOT just power off — use destroy to immediately kill the process\n4. After cleanup: check VM disk integrity (fsck on guest volume)\n5. Root cause: fix fencing so this cannot recur. Known bug: MORPH-7948 (fixed in 8.0.13-3).',
        product='VME',
    ),
    LogPattern(
        name='lun_assignment_change_storm',
        regex=r'(LUN assignments on this target have changed|SCSI.*LUN.*remap|LUN.*renumber|target.*changed.*Linux SCSI layer does not automatically remap)',
        severity='CRITICAL',
        category='storage',
        description='Mass LUN assignment change detected on SCSI targets. The kernel is reporting that LUN numbering has changed on storage targets but Linux does NOT automatically remap them. This indicates a SAN-level change (new LUN inserted, zone change, host group modification) that shifted SCSI LUN numbering. Can cause STONITH device loss, multipath map corruption, and ALUA transition storms.',
        solution_hint='1. Identify what SAN change occurred (check SAN switch logs, storage array audit)\n2. Verify STONITH device is still accessible: ls -la /dev/disk/by-uuid/<stonith-uuid>\n3. Rescan SCSI buses: echo "- - -" > /sys/class/scsi_host/host*/scan\n4. Rebuild multipath maps: multipathd -k reconfigure\n5. Verify all multipath devices: multipath -ll\n6. Check if fencing device UUID still exists in /dev/disk/by-uuid/.',
        product='Alletra',
    ),
    LogPattern(
        name='multipath_saturation_timeout',
        regex=r'(multipathd.*show paths.*timeout|retryGetSCSIDevicesOfVolume.*\d{2,}s|multipath.*reconfigure.*slow|multipath -ll.*timeout|multipathd.*stalled|couldn.t get.*multipath.*timed out)',
        severity='HIGH',
        category='storage',
        description='Multipath subsystem is saturated and timing out. Commands that normally complete in milliseconds are taking 30-60+ seconds. This indicates an excessive number of LUNs/paths presented to the host (thousands of LUNs × multiple FC paths = tens of thousands of SCSI paths). Common cause: orphaned backup snapshot LUNs accumulating from failed backup operations.',
        solution_hint='1. Count LUNs: multipath -ll | grep -c "^mpath" (should be <200, not thousands)\n2. Count paths: multipathd show paths | wc -l\n3. If excessive: identify orphaned snapshot LUNs on storage array\n4. Unmap orphaned LUNs from host set (does NOT delete data)\n5. After unmap: multipathd -k reconfigure\n6. Verify: multipath -ll should respond in <5 seconds.',
        product='Alletra',
    ),
    LogPattern(
        name='fence_device_missing',
        regex=r'(fence.*device.*does not exist|fence_scsi.*Failed.*device.*not exist|STONITH.*device.*not found|/dev/disk/by-uuid/.*does not exist.*fence)',
        severity='CRITICAL',
        category='cluster',
        description='The STONITH fencing device is MISSING from the system. The block device or UUID that the fence agent needs does not exist. Without a working fencing device: DLM cannot start, GFS2 cannot mount, cluster cannot safely manage nodes. Fencing will retry every ~15 minutes, failing each time, consuming resources. Common cause: SAN LUN remapping or orphaned LUN accumulation displacing the fencing LUN.',
        solution_hint='1. Check if the fencing LUN UUID exists: blkid | grep <uuid>\n2. Check if the device was displaced: ls -la /dev/disk/by-uuid/ | grep <first-few-chars>\n3. If LUN was removed from SAN: re-present it and rescan\n4. If UUID changed: update pcs stonith config with new device path\n5. Temporary: pcs property set stonith-enabled=false to stop the retry loop\n6. MUST fix before re-enabling STONITH — cluster is UNSAFE without fencing.',
        product='Pacemaker',
    ),
    LogPattern(
        name='lsblk_overflow',
        regex=r'(lsblk.*too many|lsblk.*178\d{3}.*lines|lsblk.*Argument list too long|Error Fetching block device stats|lsblk -J.*parsing.*fail|Unexpected end-of-input.*lsblk)',
        severity='HIGH',
        category='storage',
        description='lsblk command output is overflowing or causing parsing failures. This indicates thousands of SCSI/multipath devices are presented to the host, generating massive JSON output (178,000+ lines). The morpheus-node agent cannot parse this truncated output, causing block device stats failures, heartbeat delays, and monitoring gaps. Root cause: excessive LUN count from orphaned backup snapshots.',
        solution_hint='1. Count block devices: lsblk | wc -l (should be <500, not 178,000+)\n2. This is a symptom of orphaned LUN accumulation\n3. Clean up orphaned snapshot LUNs on storage array\n4. Unmap from host set\n5. After cleanup: multipathd -k reconfigure\n6. Verify: lsblk -J should complete in <5 seconds.',
        product='VME',
    ),
    LogPattern(
        name='morpheus_nan_stats_error',
        regex=r'(cpuUsage.*NaN|userCpuUsage.*NaN|mapper_parsing_exception.*NaN|Unknown column.*NaN|double.*supports only finite values.*NaN)',
        severity='MEDIUM',
        category='application',
        description='Morpheus is generating NaN (Not a Number) values for CPU/memory statistics. This causes MySQL and Elasticsearch storage failures for metrics. Usually indicates the host is so overloaded that stats collection is returning divide-by-zero or missing data. Symptom of underlying host instability (memory issues, extreme load, or storage I/O problems).',
        solution_hint='1. Check host load average: uptime (if >50x CPU count, host is critically overloaded)\n2. Check memory: free -h (if swap is 100% used, OOM risk)\n3. This is a symptom — fix the underlying cause (LUN saturation, memory overcommit, hardware fault)\n4. Stats will auto-recover once host load normalizes.',
        product='Morpheus',
    ),
    # --- Cluster Upgrade Failures ---
    LogPattern(
        name='cluster_upgrade_vm_skip',
        regex=r'(VM is powered off and movePoweredOff is disabled|[Ss]kipped.*VM.*powered off|cluster.*upgrade.*skip.*migration|cannot migrate.*powered.off)',
        severity='HIGH',
        category='cluster',
        description='Cluster upgrade process cannot migrate powered-off VMs. The upgrade from cluster version 1.2→1.3 requires all VMs to be migrated off each node before upgrading. Powered-off VMs are skipped but the upgrade may continue and disrupt cluster services, leaving corosync/pacemaker in a broken state.',
        solution_hint='1. Before cluster upgrade: power on ALL VMs or manually move powered-off VMs\n2. If upgrade already failed: restart all cluster nodes\n3. Verify: pcs cluster status, systemctl status corosync\n4. DLM should remount datastores after cluster reforms\n5. Prevention: audit VM power states before any cluster upgrade.',
        product='VME',
    ),
    # --- GFS2 Superblock / Journal Corruption (Power Outage) ---
    LogPattern(
        name='gfs2_superblock_corruption',
        regex=r'(bad superblock on /dev/mapper|wrong fs type.*bad.*superblock|gfs2.*can.t find protocol|mount.*wrong fs type.*gfs2|GFS2.*superblock.*invalid|gfs2.*bad magic number)',
        severity='CRITICAL',
        category='filesystem',
        description='GFS2 filesystem superblock or metadata is corrupted — the filesystem cannot be mounted. This typically occurs after an abrupt power loss that interrupted in-flight I/O before journals could be committed. The mount returns "wrong fs type, bad superblock" even though the device is accessible. Manual fsck.gfs2 is REQUIRED before the filesystem can be mounted again.',
        solution_hint='1. Do NOT repeatedly try to mount — it will not work without fsck\n2. Ensure DLM is stopped for this resource: pcs resource disable <resource>\n3. Run: fsck.gfs2 -y /dev/mapper/<device>\n4. If fsck succeeds: re-enable resource (pcs resource enable <resource>)\n5. If fsck fails: check for stale journals from evicted nodes, try fsck again\n6. Root cause: likely unclean shutdown without graceful unmount. Implement UPS-triggered pcs node standby.',
        product='GFS2',
    ),
    LogPattern(
        name='dlm_error_107',
        regex=r'(dlm.*error.*-107|DLM.*error.*-107|dlm.*ENOTCONN|lockspace.*join.*fail|can.t find protocol fsck_dlm|dlm_controld.*error.*join)',
        severity='CRITICAL',
        category='cluster',
        description='DLM (Distributed Lock Manager) error -107 (ENOTCONN) — cannot connect to or join lockspace. This means the DLM subsystem cannot establish the lock coordination needed for GFS2. Common causes: cluster quorum not achieved, nodes evicted but DLM state not cleaned, stale lockspace from crashed nodes. GFS2 CANNOT mount until DLM is healthy.',
        solution_hint='1. Check cluster quorum: pcs status (need majority of configured nodes)\n2. If nodes cannot rejoin: evict them (pcs cluster node remove <node>)\n3. After eviction: pcs resource cleanup dlm-clone\n4. Verify DLM: dlm_tool status (should show all lockspaces joined)\n5. If stale lockspace: dlm_tool close <lockspace>, then re-enable\n6. GFS2 depends on DLM — fix DLM first, then GFS2.',
        product='DLM',
    ),
    LogPattern(
        name='nbd_lvm_interaction',
        regex=r'(nbd\d+.*lvm|LVM.*nbd|device-mapper.*nbd|lvm.*scan.*nbd|nbd.*lock.*held|pvscan.*nbd)',
        severity='HIGH',
        category='storage',
        description='LVM is scanning or interacting with NBD (Network Block Device) devices used by backup systems (Commvault VSA). This known defect in Morpheus 8.0.x causes LVM to create persistent device locks on NBD devices, which can block GFS2 recovery after a crash. LVM should never scan NBD devices in a cluster environment.',
        solution_hint='1. Apply LVM filter: edit /etc/lvm/lvm.conf\n2. Add filter = [ "r|/dev/nbd.*|", "a|.*|" ] to devices section\n3. Run: vgscan --cache to rebuild LVM cache\n4. Verify: pvs should not show any /dev/nbd devices\n5. This prevents LVM from interfering with GFS2 cluster resource transitions.',
        product='VME',
    ),
    # --- Morpheus Application Errors ---
    LogPattern(
        name='source_image_null_restore_fail',
        regex=r'(Cannot get property.*locations.*on null object|findVirtualImageLocationRecord|Instance is not valid.*validateInstance|NullPointerException.*VirtualImageService)',
        severity='HIGH',
        category='application',
        description='Morpheus backup restore or clone operation failed because the source Virtual Image was deleted from the Library. The validation code throws NullPointerException when trying to access .locations on a null image object. The VM itself is healthy — only restore/clone is blocked. Known bug MORPH-13534 (fixed in 9.0.1.22).',
        solution_hint='WORKAROUND: Use Morpheus API with "imageId": -1 to bypass image validation.\nClone: curl -k -X PUT "https://<appliance>/api/instances/<id>/clone" -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d \'{"name": "<name>", "config": {"imageId": -1}, "provisionPoweredOff": true}\'\nPermanent fix: upgrade to 9.0.1.22+.',
        product='Morpheus',
    ),
    # --- Pacemaker Version Mismatch / Election Storm ---
    LogPattern(
        name='pacemaker_feature_set_mismatch',
        regex=r'(Discarding update with feature set.*greater than our own|feature set.*greater than|CIB.*feature set.*mismatch|Protocol not supported.*rc=-93)',
        severity='CRITICAL',
        category='cluster',
        description='Pacemaker CIB feature set mismatch detected between cluster nodes. A node with a newer Pacemaker version is trying to distribute its CIB, but older nodes reject it. This creates an INFINITE DC election loop that will fill /var/log and make the cluster non-functional. Typically caused by a partial cluster upgrade (one node upgraded, others not).',
        solution_hint='1. IMMEDIATELY stop pacemaker on the newer node: systemctl stop pacemaker corosync\n2. Truncate logs: truncate -s 0 /var/log/pacemaker/pacemaker.log\n3. The ONLY fix is to upgrade ALL nodes to the same Pacemaker version\n4. Do NOT downgrade the already-upgraded node\n5. Upgrade remaining nodes, then restart cluster services on all nodes.',
        product='Pacemaker',
    ),
    LogPattern(
        name='dc_election_storm',
        regex=r'(election.*round.*\d{6,}|election.*count.*exceed|DC.*election.*storm|Starting.*election.*round \d{4,}|Joining.*election.*round)',
        severity='HIGH',
        category='cluster',
        description='DC (Designated Controller) election storm detected — the cluster is cycling through elections at very high rate (millions of rounds). This typically indicates a Pacemaker version mismatch where nodes cannot agree on a DC because the newer node wins but cannot distribute its CIB to older nodes. The election log spam will fill /var/log and crash rsyslog.',
        solution_hint='1. Stop pacemaker on the node causing the storm (usually the newer version)\n2. Truncate logs immediately: truncate -s 0 /var/log/pacemaker/pacemaker.log\n3. Reduce log verbosity: set PCMK_logpriority=warning in /etc/default/pacemaker\n4. Check df -h /var/log — if full, truncate syslog too\n5. Fix root cause: all nodes must be on same Pacemaker version.',
        product='Pacemaker',
    ),
    # --- GFS2 Space Leak ---
    LogPattern(
        name='gfs2_space_accounting_discrepancy',
        regex=r'(Gap DF-DU|df.*used.*GiB.*du.*GiB|space.*not.*reclaimed|GFS2.*accounting.*discrepancy|orphaned.*allocation|rgrplvb)',
        severity='MEDIUM',
        category='filesystem',
        description='GFS2 filesystem space accounting discrepancy detected — df reports significantly more used space than du shows allocated to files. This is a known GFS2 kernel bug where space from deleted-while-open files is never reclaimed. The gap grows over time as files are deleted. Only fsck.gfs2 can recover the space. Fixed in kernel 6.8.0-117-generic.',
        solution_hint='1. Measure gap: compare df -B1 <mount> vs du -sxB1 <mount>\n2. If gap >10% of filesystem: schedule fsck\n3. Exclude memfd from lsof: lsof +L1 <mount> | grep -v memfd\n4. Fix requires offline fsck: unmount on all nodes, then fsck.gfs2 -y\n5. Long-term: upgrade kernel to 6.8.0-117+ and install linux-modules-extra.',
        product='GFS2',
    ),
    LogPattern(
        name='git_repo_transport_error',
        regex=r'(remoteGitFetch transport error|cannot open git-upload-pack|TransportException.*git-upload-pack|GitRepoService.*transport error)',
        severity='MEDIUM',
        category='application',
        description='Morpheus cannot reach a configured Git repository URL. Repeated transport errors indicate either a network issue or a stale/invalid repository configuration. If this error repeats continuously, it may cause UI hangs when loading Task creation forms (the UI waits for all repositories to be validated). Known issue: automation can import references to non-existent repos that cannot be deleted via UI.',
        solution_hint='1. Check if the Git URL is reachable from the Morpheus appliance: curl -I <git-url>\n2. If URL is unreachable and repo is stale: must be deleted via database\n3. If UI is hanging on Task creation: this stale repo is the cause\n4. Database fix: DELETE FROM integration WHERE service_url LIKE \'%<unreachable-url>%\'\n5. Always backup database before manual edits.',
        product='Morpheus',
    ),
    # --- Libvirt/QEMU Teardown Failures ---
    LogPattern(
        name='qemu_sigkill_failed',
        regex=r'(Failed to terminate process \d+ with SIGKILL.*Device or resource busy|cannot parse process status data|End of file from qemu monitor)',
        severity='CRITICAL',
        category='virtualization',
        description='Libvirt failed to kill a QEMU VM process with SIGKILL ("Device or resource busy"). The VM is now stuck in an inconsistent "in shutdown" state — it cannot be started or stopped normally. This happens when QEMU processes are blocked in uninterruptible I/O (D-state) or have kernel-level resource locks that prevent termination. The VM domain object remains in libvirt but is essentially a zombie.',
        solution_hint='1. Check VM state: virsh list --all (look for "in shutdown")\n2. Check QEMU process: ps -o pid,stat,cmd -p <pid> (D-state = I/O blocked)\n3. If still wedged: virsh destroy <domain> (force destroy)\n4. If destroy also fails: check /proc/<pid>/stack for blocked syscall\n5. Last resort: host reboot may be needed to clear kernel-level blocks\n6. After cleanup: virsh start <domain> should succeed.',
        product='KVM',
    ),
    LogPattern(
        name='vm_stuck_in_shutdown',
        regex=r'(domain.*in shutdown|Failed to destroy domain|domain is not running.*move|power.on.*fail.*in shutdown|virsh.*start.*fail.*shutdown)',
        severity='HIGH',
        category='virtualization',
        description='VM domain is stuck in "in shutdown" state — it is neither running nor shut off. This prevents normal start, stop, or migration operations. Usually caused by a failed QEMU teardown where libvirt could not complete process cleanup. Start requests fail silently or with "domain is not running". Migration fails with "domain is not running". Only virsh destroy (force stop) can clear this state.',
        solution_hint='1. Confirm state: virsh domstate <domain> (should show "in shutdown" or similar)\n2. Force destroy: virsh destroy <domain>\n3. Verify: virsh domstate <domain> (should now show "shut off")\n4. Start: virsh start <domain>\n5. If destroy fails: check QEMU PID with pgrep -f <domain>, then kill -9 <pid>\n6. Investigate: check syslog for "End of file from qemu monitor" or SIGKILL failures around the time it got stuck.',
        product='KVM',
    ),
    LogPattern(
        name='root_disk_full_logs',
        regex=r'(No space left on device|disk.*full|/var/log.*100%|cannot write.*no space|opensearch.*fill|elasticsearch.*fill|log.*filled.*disk)',
        severity='CRITICAL',
        category='system',
        description='Root disk or /var/log partition is full or nearly full. This is a critical condition that can cause cascading failures: libvirt cannot write VM state files, QEMU cannot write logs, Morpheus agent cannot update heartbeat status, Pacemaker logs can trigger election storms. In large environments, OpenSearch/Elasticsearch logs are a common culprit. VMs may go to "Unknown" state when their management daemons cannot function due to full disk.',
        solution_hint='1. IMMEDIATE: identify and truncate the largest log files: du -sh /var/log/* | sort -rh | head\n2. Common offenders: OpenSearch (/var/log/opensearch/), Pacemaker, syslog\n3. Truncate without deleting: truncate -s 0 /var/log/<large-file>\n4. After freeing space: restart affected services (morpheus-node, libvirtd)\n5. Prevention: configure log rotation, set max sizes, monitor disk usage.',
        product='general',
    ),
    # --- Libvirtd Stuck Job / DLM Lock Validation ---
    LogPattern(
        name='libvirtd_stuck_job',
        regex=r'(remoteDispatchConnectGetAllDomainStats|cannot acquire state change lock.*held by monitor|Timeout expired while shutting down domains|libvirt-guests.*Timeout|stuck.*job.*domstats)',
        severity='HIGH',
        category='virtualization',
        description='A libvirtd monitoring/stats API call (remoteDispatchConnectGetAllDomainStats) is holding a domain job lock, blocking VM shutdown/destroy/undefine operations. This is a known libvirtd bug class where a stats-polling client (Morpheus stats collector, monitoring agent) does not release its connection cleanly. Can hold the lock for hours/days. Critical impact: if this delays a planned node reboot past Corosync token timeout, the cluster will fence the node — triggering DLM recovery and potentially more lock instability.',
        solution_hint='1. Identify the stuck domstats process: ps aux | grep domstats\n2. Kill the polling client: kill <pid>\n3. If that does not release the lock: systemctl restart libvirtd\n4. WARNING: restarting libvirtd on a node with running VMs is generally safe but verify\n5. Prevention: identify which monitoring tool is calling getAllDomainStats and fix its timeout/cleanup.',
        product='KVM',
    ),
    LogPattern(
        name='dlm_validate_lock_args_warn',
        regex=r'(validate_lock_args.*WARN|WARNING.*fs/dlm/lock\.c|dlm.*lock.*EINVAL|dlm.*lock.*conversion.*fail|validate_lock_args.*lock\.c:\d+)',
        severity='CRITICAL',
        category='cluster',
        description='Kernel WARNING in DLM lock validation code (validate_lock_args at fs/dlm/lock.c). This indicates a race condition between in-flight I/O lock conversion and DLM recovery path after a node is fenced. The lock state becomes momentarily invalid during remove_member → recover_masters → redistribute_locks sequence. Can cause GFS2 glock to become orphaned — all waiters stuck indefinitely. Known bug in kernel <6.10.',
        solution_hint='1. This is a kernel-level bug — no application-level fix\n2. Check for D-state processes: ps -eo pid,stat,wchan:32,cmd | awk \'$2 ~ /^D/\'\n3. If processes stuck in gfs2_glock_wait: reboot the affected node\n4. Long-term: upgrade kernel to >=6.10 where this race condition is fixed\n5. Monitor: check dmesg for validate_lock_args warnings after any node reboot/fencing.',
        product='DLM',
    ),
    LogPattern(
        name='workqueue_cpu_hogging',
        regex=r'(workqueue:.*hogged CPU for >\d+us|fill_page_cache_func hogged CPU|workqueue.*consider switching to WQ_UNBOUND)',
        severity='HIGH',
        category='kernel',
        description='Kernel workqueue is hogging CPU for extended periods (>10ms). fill_page_cache_func is a common offender — it pre-fills page cache for memory-intensive operations. When this repeats thousands of times, it starves other kernel subsystems (DLM, Pacemaker, multipath) of CPU time. In clustered environments, this can cause DLM monitor timeouts which trigger node fencing. Often triggered by rapid mass VM starts that create extreme memory pressure and page cache contention.',
        solution_hint='1. Check host load: uptime, top, vmstat 1\n2. Check memory pressure: free -h, cat /proc/meminfo | grep -i avail\n3. If VMs were just started: too many started simultaneously — stagger them\n4. Monitor for "High CIB load" as escalation indicator\n5. Prevention: reserve CPU/memory for host OS, limit concurrent VM starts\n6. If DLM timeout follows: increase DLM monitor timeout from 20s to 60s.',
        product='general',
    ),
    LogPattern(
        name='dlm_monitor_timeout_fence',
        regex=r'(dlm_monitor.*timed out|dlm.*timed out after \d+ms|monitor.*dlm.*Timed Out|on-fail=fence.*dlm|dlm.*failed.*fence)',
        severity='CRITICAL',
        category='cluster',
        description='DLM resource monitor timed out — Pacemaker will FENCE this node. With DLM configured as on-fail=fence, any DLM monitor timeout (default 20s) is treated as a node integrity risk and results in immediate STONITH fencing. If multiple nodes hit this simultaneously (shared infrastructure stall), the cluster can lose quorum. This is the most aggressive fencing policy and leaves very little tolerance for transient resource spikes.',
        solution_hint='1. PREVENTION (before it happens): increase DLM monitor timeout to 60s in pcs config\n2. If already fenced: reboot node, let it rejoin cluster\n3. Investigate WHY DLM was slow: check for CPU hogging, memory pressure, storage latency\n4. Common triggers: mass VM starts, OOM events, storage path checker delays\n5. Long-term: consider changing on-fail policy or upgrading to VME 9.x.',
        product='Pacemaker',
    ),
    LogPattern(
        name='gfs2_journal_reservation_conflict',
        regex=r'(reservation conflict.*Error \d+ writing to journal|Error 6 writing to journal.*jid|reservation conflict error.*dev.*WRITE.*gfs2)',
        severity='CRITICAL',
        category='storage',
        description='SCSI reservation conflict occurred during GFS2 journal write. This means the storage array rejected a write because the node does not have a valid SCSI Persistent Reservation (PR) key on that path. GFS2 will WITHDRAW the filesystem and go read-only. Known bug MORPH-5492: after reboot, PR keys are not fully re-registered on all paths. This is different from a GFS2 deadlock — this is a storage-layer access denial.',
        solution_hint='1. Check PR keys: mpathpersist -i -k /dev/mapper/<device>\n2. Count keys for this node (cat /var/run/cluster.key for the key value)\n3. If fewer keys than paths: PR registration incomplete (MORPH-5492 bug)\n4. Fix: cold reboot via ILO, or manually re-register with mpathpersist\n5. After fixing: verify key count matches path count, then unstandby\n6. Upgrade to VME 8.1.0+ (permanent fix).',
        product='GFS2',
    ),
    LogPattern(
        name='gfs2_invalid_metadata_block',
        regex=r'(fatal:.*invalid metadata block|bh = \d+.*type:exp=\d+.*found=\d+|gfs2.*fatal.*invalid metadata|foreach_descriptor.*recovery\.c)',
        severity='CRITICAL',
        category='filesystem',
        description='GFS2 journal replay encountered an invalid metadata block — the journal is corrupted and cannot be replayed. This prevents GFS2 from mounting on ANY node in the cluster. The filesystem will attempt to withdraw. This is typically caused by a prior unclean shutdown where journal writes were incomplete (reservation conflict, I/O error, or power loss during journal commit). REQUIRES offline fsck.gfs2 to repair.',
        solution_hint='1. Stop cluster: pcs cluster stop --all\n2. Unmount GFS2 on all nodes\n3. Run: fsck.gfs2 -n /dev/mapper/<device> (read-only check first)\n4. If corruption confirmed: fsck.gfs2 -y /dev/mapper/<device>\n5. Restart cluster: pcs cluster start --all\n6. Verify: GFS2 resources should start successfully\n7. Root cause: investigate what caused the journal corruption (reservation conflict, power loss, etc.).',
        product='GFS2',
    ),
    LogPattern(
        name='iscsi_nop_timeout',
        regex=r'(ISCSI_ERR_NOP_TIMEDOUT|iSCSI.*NOP.*timed out|iscsi.*session.*timeout|DID_TRANSPORT_DISRUPTED|connection.*to.*target.*lost)',
        severity='HIGH',
        category='storage',
        description='iSCSI NOP (keep-alive) timeout or transport disruption detected. The host is losing communication with the iSCSI storage target. If this progresses, storage paths will fail and Morpheus may initiate VM shutdown to protect data integrity. Progressive NOP timeouts followed by DID_TRANSPORT_DISRUPTED indicate the iSCSI connection is degrading and may fail completely.',
        solution_hint='1. Check iSCSI session status: iscsiadm -m session -P 3\n2. Check network path: ping <target-ip>, check switch ports for errors\n3. Verify MTU alignment between host, switches, and storage\n4. Check storage array health and port status\n5. If intermittent: may be network congestion or switch port flapping\n6. If persistent: check cables, NICs, and storage controller health.',
        product='Alletra',
    ),
    LogPattern(
        name='gfs2_metadata_withdraw',
        regex=r'(gfs2_meta_check_ii|gfs2_meta_buffer.*withdraw|File system withdrawn.*metadata|gfs2.*fatal.*jdata.*on disk.*!=|dlm_new_lockspace error -53)',
        severity='CRITICAL',
        category='filesystem',
        description='GFS2 filesystem withdrew during metadata access — kernel stack trace shows gfs2_meta_check_ii, gfs2_meta_buffer, or fillup_metapath. This indicates GFS2 read a metadata block that failed validation (bad checksum or structure). Different from journal corruption — this is live metadata inconsistency, often caused by prior SCSI PR conflicts writing incomplete data or FC/storage path instability causing bad reads. DLM error -53 means lockspace creation failed due to I/O errors on the backing device.',
        solution_hint='1. Verify SCSI PR state: mpathpersist -i -k and -i -r (clear stale reservations)\n2. If PR clean but still withdrawing: offline fsck is needed\n3. Unmount on ALL nodes: mount | grep gfs2 (must show nothing)\n4. Dry-run: fsck.gfs2 -n /dev/mapper/<device>\n5. Repair: fsck.gfs2 -y /dev/mapper/<device>\n6. If withdraw recurs after fsck: investigate FC path stability, MSA behavior, multipath health.',
        product='GFS2',
    ),
    LogPattern(
        name='cluster_port_blocked',
        regex=r'(Connection refused.*(7443|2224|5405|5406|5407)|iptables.*DROP.*(7443|2224)|cluster.*communication.*refused|pcsd.*connection refused|corosync.*connect.*refused)',
        severity='HIGH',
        category='cluster',
        description='Cluster communication port is blocked (connection refused). Ports 7443 (Morpheus agent), 2224 (pcsd), 5405-5407 (corosync) are required for cluster operation. Missing iptables rules or firewall misconfiguration prevents node-to-node communication. Can cause: heartbeat failures, fencing events, quorum loss, pcs status hangs. Common after OS reinstall, netplan apply, or Aruba CX plugin network refresh.',
        solution_hint='1. Check port connectivity: nc -zv <peer-ip> 7443 2224 5405\n2. Check iptables rules: iptables -L -n | grep -E "7443|2224|5405"\n3. If ports blocked: add rules for cluster communication\n4. Check if netplan apply or Aruba CX plugin reset the rules\n5. Make rules persistent: iptables-save > /etc/iptables/rules.v4\n6. Verify cluster recovers after firewall fix: pcs status.',
        product='Pacemaker',
    ),
    LogPattern(
        name='gfs2_mount_control_error',
        regex=r'(mount control error -\d+|control_mount wait.*block|lockspace.*leaving.*mount.*fail|gfs2.*mount control error)',
        severity='CRITICAL',
        category='filesystem',
        description='GFS2 mount control sequence failed. The DLM lockspace was created but GFS2 distributed mount coordination did not complete. Error -4 typically means the mount was interrupted or another node could not participate. The lockspace is freed after failure. Other GFS2 filesystems may still be working (issue isolated to one lockspace). Common causes: dirty journals from unclean shutdown, network link failures disrupting DLM coordination, or resource group inconsistencies requiring fsck.',
        solution_hint='1. Check if other GFS2 mounts work (issue may be isolated to one datastore)\n2. Check network connectivity between nodes: ping, corosync ring status\n3. Check for dirty journals: fsck.gfs2 -n /dev/mapper/<device>\n4. If dirty journals found: unmount everywhere, run fsck.gfs2 -y\n5. If network issue: check switch ports, LACP bonds, link status\n6. Quick recovery: reboot the affected node (clears stale lock state)\n7. If physical link failures found: investigate NIC/cable/switch hardware.',
        product='GFS2',
    ),
    # === HPE VM Essentials / Morpheus Patterns (from VME Operations Guide) ===
    LogPattern(
        name='morpheus_ui_502',
        regex=r'(502 Bad Gateway|morpheus-ui.*failed|nginx.*upstream.*timed out|morpheus-ui.*crash|morpheus-ui.*OOM)',
        severity='CRITICAL',
        category='service',
        description='HPE VM Essentials Manager UI is down (502/503). The morpheus-ui service has crashed or is not responding. Users cannot access the management console. Common causes: RAM exhaustion, DB connection pool full, or service crash.',
        solution_hint='1. sudo morpheus-ctl status (check which service is down)\n2. free -h (check RAM)\n3. sudo morpheus-ctl tail morpheus-ui (check errors)\n4. sudo morpheus-ctl restart morpheus-ui\n5. If still failing: sudo morpheus-ctl stop && sleep 10 && sudo morpheus-ctl start\n6. sudo morpheus-ctl reconfigure (regenerate configs)',
        product='Morpheus',
    ),
    LogPattern(
        name='kvm_storage_access_denied',
        regex=r'(Cannot access storage file|Permission denied.*qcow2|cannot open.*qcow2.*Permission|storage file.*not.*accessible)',
        severity='CRITICAL',
        category='virtualization',
        description='KVM VM cannot access its disk image file. Usually caused by SELinux context mismatch, wrong file ownership, or storage pool not active. VM will fail to start until permissions are corrected.',
        solution_hint='1. ls -laZ /var/lib/libvirt/images/<vm>.qcow2 (check permissions + SELinux)\n2. sudo chown qemu:qemu /var/lib/libvirt/images/<vm>.qcow2\n3. sudo restorecon -Rv /var/lib/libvirt/images/\n4. qemu-img check /var/lib/libvirt/images/<vm>.qcow2 (check integrity)\n5. virsh pool-refresh default',
        product='KVM',
    ),
    LogPattern(
        name='bond_slave_down',
        regex=r'(bond\d+.*link.*down|bond\d+.*slave.*removed|bonding.*Removing slave|bond\d+.*LACP.*Expired|MII link monitoring.*down)',
        severity='HIGH',
        category='network',
        description='Network bond slave interface went down. One of the physical NICs in the bond has lost link. In active-backup mode, traffic fails over to the remaining NIC. In LACP (mode 4), reduced bandwidth occurs. If both slaves go down, all VMs on this host lose network connectivity.',
        solution_hint='1. cat /proc/net/bonding/bond0 (check which slave is down)\n2. ethtool <slave-interface> (check link status, cable)\n3. Check switch port status\n4. If cable/NIC failure: replace hardware\n5. If switch issue: contact network team\n6. If LACP timeout: verify switch LACP config matches host',
        product='KVM',
    ),
    LogPattern(
        name='libvirtd_connection_failed',
        regex=r'(failed to connect.*hypervisor|Cannot connect to.*libvirt|error.*connecting.*qemu.*system|libvirtd.*not running|libvirtd.*refused)',
        severity='CRITICAL',
        category='virtualization',
        description='Cannot connect to KVM hypervisor. The libvirtd daemon is not running or not accepting connections. All VM management operations will fail until libvirtd is restored. Common after host reboot if service not enabled.',
        solution_hint='1. sudo systemctl status libvirtd\n2. sudo systemctl start libvirtd\n3. sudo systemctl enable libvirtd (prevent on reboot)\n4. If AppArmor denial: check /var/log/audit/audit.log\n5. If socket issue: ls -la /var/run/libvirt/libvirt-sock',
        product='KVM',
    ),
    LogPattern(
        name='morpheus_mysql_down',
        regex=r'(morpheus.*mysql.*stopped|mysql.*InnoDB.*crash|morpheus.*database.*connection.*failed|mysql.*too many connections|mysql.*pid.*stale)',
        severity='CRITICAL',
        category='service',
        description='HPE VM Essentials MySQL database is down or corrupted. The Manager UI will show errors and all operations will fail. Common causes: disk full, InnoDB crash, corrupted tables, stale PID file from unclean shutdown.',
        solution_hint='1. df -h /opt/morpheus (check disk space)\n2. sudo rm -f /opt/morpheus/embedded/var/mysql/*.pid (remove stale PID)\n3. sudo journalctl --vacuum-time=3d (free space)\n4. sudo morpheus-ctl start mysql\n5. sudo morpheus-ctl db-repair (repair corrupted tables)',
        product='Morpheus',
    ),
    LogPattern(
        name='rabbitmq_queue_stuck',
        regex=r'(rabbitmq.*timeout|rabbitmq.*connection.*refused|rabbit.*queue.*blocked|rabbitmq.*memory.*alarm|amqp.*channel.*closed)',
        severity='HIGH',
        category='service',
        description='RabbitMQ message queue is stuck or unreachable. Provisioning jobs, backups, and async tasks will hang in "Queued" state. Memory alarm means RabbitMQ stopped accepting messages due to high memory usage.',
        solution_hint='1. sudo rabbitmqctl list_queues name messages (check queue depths)\n2. sudo rabbitmqctl status (check node health)\n3. sudo morpheus-ctl restart rabbitmq\n4. sudo morpheus-ctl restart morpheus-ui (reconnect)\n5. If memory alarm: increase RabbitMQ memory limit or reduce message volume',
        product='Morpheus',
    ),
    LogPattern(
        name='elasticsearch_red',
        regex=r'(elasticsearch.*status.*red|es.*cluster.*health.*red|elasticsearch.*shard.*failed|elasticsearch.*disk.*watermark)',
        severity='HIGH',
        category='service',
        description='Elasticsearch cluster health is RED. Log search will be empty, dashboards incomplete. Causes: disk full (watermark breached), shard allocation failures, or corrupted indices. HPE VM Essentials stores all logs and metrics in ES.',
        solution_hint='1. curl -s localhost:9200/_cluster/health?pretty (confirm status)\n2. curl -s localhost:9200/_cat/indices?v (find problematic indices)\n3. curl -X DELETE localhost:9200/morpheus-logs-2026.05.* (delete old indices)\n4. curl -X POST localhost:9200/_cluster/reroute?retry_failed=true\n5. sudo morpheus-ctl restart elasticsearch',
        product='Morpheus',
    ),
    LogPattern(
        name='vm_migration_failed',
        regex=r'(migration.*failed|unable to.*migrate|migrate.*error|migration.*timed out|CPU.*incompatible.*migration|postcopy.*failed)',
        severity='HIGH',
        category='virtualization',
        description='KVM live migration failed. The VM could not be moved to the destination host. Common causes: SSH connectivity issues, firewall blocking migration ports (49152-49215), CPU model mismatch between hosts, or insufficient resources on target.',
        solution_hint='1. ssh root@target-host "virsh version" (test SSH)\n2. sudo firewall-cmd --permanent --add-port=49152-49215/tcp && sudo firewall-cmd --reload\n3. virsh capabilities | grep -i "model" (CPU must match)\n4. Use cpu mode=host-model instead of host-passthrough\n5. Check target host has enough RAM: free -h on target',
        product='KVM',
    ),
    LogPattern(
        name='ntp_clock_drift',
        regex=r'(clock.*skew|chrony.*clock.*wrong|ntp.*offset.*large|time.*drift|time.*not.*synchronized|System clock.*unsynchronized)',
        severity='HIGH',
        category='service',
        description='System clock is drifting or not synchronized. This causes SSL certificate validation failures, AD/LDAP authentication failures, incorrect timestamps in logs, and cluster quorum issues. Critical for all services that rely on time consistency.',
        solution_hint='1. timedatectl (check NTP sync status)\n2. chronyc tracking (check drift)\n3. sudo chronyc makestep (force immediate sync)\n4. sudo systemctl restart chronyd\n5. Verify: date vs known good time source',
        product='general',
    ),
    LogPattern(
        name='kvm_bridge_missing',
        regex=r'(bridge.*not found|cannot find bridge|br\d+.*does not exist|bridge.*no such device|failed to attach.*bridge)',
        severity='HIGH',
        category='network',
        description='Linux bridge interface not found. VMs attached to this bridge will have no network connectivity. Usually caused by bridge not persisting after reboot, or nmcli connection not activated. VMs may start but have no network.',
        solution_hint='1. brctl show (list existing bridges)\n2. sudo nmcli connection up <bridge-name>\n3. If bridge missing: recreate with nmcli connection add type bridge\n4. Attach VLAN interface: nmcli connection add type bridge-slave\n5. Verify: brctl show should show bridge with VLAN interfaces',
        product='KVM',
    ),
    LogPattern(
        name='qemu_guest_agent_timeout',
        regex=r'(guest agent.*not.*respond|qemu-ga.*timeout|guest-agent.*disconnected|QEMU guest agent.*not.*available|guest.*freeze.*failed)',
        severity='MEDIUM',
        category='virtualization',
        description='QEMU guest agent not responding inside the VM. This affects: backup snapshots (cannot quiesce), filesystem info queries, and graceful shutdown signals. VM is still running but management operations requiring guest cooperation will fail.',
        solution_hint='1. virsh qemu-agent-command <vm> \'{"execute":"guest-ping"}\' (test agent)\n2. Inside VM: systemctl status qemu-guest-agent\n3. Inside VM: systemctl restart qemu-guest-agent\n4. If not installed: yum install qemu-guest-agent && systemctl enable qemu-guest-agent\n5. Check virtio-serial channel exists in VM XML',
        product='KVM',
    ),
    LogPattern(
        name='morpheus_upgrade_failed',
        regex=r'(morpheus.*upgrade.*fail|reconfigure.*error|morpheus.*mixed.*version|morpheus.*migration.*failed|morpheus-ctl.*reconfigure.*error)',
        severity='CRITICAL',
        category='service',
        description='HPE VM Essentials Manager upgrade or reconfigure failed. Services may be in a mixed version state causing unpredictable behavior. Always have a backup before upgrade.',
        solution_hint='1. sudo morpheus-ctl stop\n2. sudo morpheus-ctl reconfigure\n3. sudo morpheus-ctl start\n4. If broken: sudo morpheus-ctl backup restore /backup/pre-upgrade.tar.gz\n5. ALWAYS backup before upgrade: sudo morpheus-ctl backup create',
        product='Morpheus',
    ),
    LogPattern(
        name='disk_full_vm_paused',
        regex=r'(No space left on device.*libvirt|qemu.*block.*full|disk.*quota.*exceeded.*qcow2|VM.*paused.*disk.*full|VIRTIO_BLK.*req.*error.*28)',
        severity='CRITICAL',
        category='storage',
        description='Host storage is full causing VMs to pause. qcow2 thin-provisioned disks grow over time and snapshots compound the problem. VMs will automatically pause to prevent data corruption when the backing store is full.',
        solution_hint='1. df -hT /var/lib/libvirt/images (check usage)\n2. du -sh /var/lib/libvirt/images/* | sort -h (find biggest files)\n3. virsh snapshot-delete <vm> --snapshotname old (delete old snapshots)\n4. Remove temp files/old ISOs\n5. virsh resume <vm> (resume paused VMs after freeing space)',
        product='KVM',
    ),
    LogPattern(
        name='selinux_avc_denial_libvirt',
        regex=r'(avc:.*denied.*svirt|SELinux.*preventing.*qemu|audit.*avc.*denied.*virt|sealert.*libvirt|type=AVC.*target.*svirt)',
        severity='HIGH',
        category='security',
        description='SELinux is blocking KVM/libvirt operations. VMs may fail to start, access disks, or connect to networks due to SELinux policy violations. Common after moving disk images to non-standard paths or after OS updates that change policies.',
        solution_hint='1. sudo ausearch -m avc -ts recent (view recent denials)\n2. sudo restorecon -Rv /var/lib/libvirt/images/ (fix standard paths)\n3. For custom paths: sudo semanage fcontext -a -t svirt_image_t "/custom/path(/.*)?"\n4. Generate fix module: sudo ausearch -m avc -ts recent | audit2allow -M fix && sudo semodule -i fix.pp\n5. Temporary (not recommended): setenforce 0',
        product='KVM',
    ),
    # === SCSI Persistent Reservation & Multipath Patterns ===
    LogPattern(
        name='sg_persist_pr_key_missing',
        regex=r'(NO_KEYS_RETURNED|MISSING_ALL_PR_KEYS|MISSING_CONFIG_KEY|sg_persist.*failed|reservation_key.*mismatch|PR key.*not.*found)',
        severity='CRITICAL',
        category='storage',
        description='SCSI-3 Persistent Reservation key missing or mismatched on a GFS2 LUN path. This means the node cannot prove its reservation claim to the storage array. If all PR keys are missing, fencing may kill this node. If config key does not match read keys, the multipath.conf reservation_key is wrong or was never registered.',
        solution_hint='1. sg_persist --in --read-keys /dev/sdX (READ-ONLY — safe to run, just reads current keys)\n2. Compare with reservation_key in /etc/multipath.conf or /etc/multipath/conf.d/\n⚠️ PRECAUTION: Before registering/clearing PR keys, ensure you know which nodes are ACTIVE. Registering a wrong key or clearing an active node key will cause GFS2 withdraw and potential data corruption!\n3. If key missing: sg_persist --out --register --param-sark=0x<key> /dev/sdX (registers new key — verify key value matches multipath.conf)\n4. Check all paths: multipath -ll <WWID> to find all sdX devices\n5. Verify across all cluster nodes: check sg_persist on every sdX path\n6. If persistent: check if storage array cleared registrations after reboot',
        product='GFS2',
    ),
    LogPattern(
        name='sg_persist_command_failed',
        regex=r'(SG_PERSIST_FAILED|sg_persist.*error|sg_persist.*ioctl|SCSI.*persistent.*reserve.*failed|PR.*registration.*failed)',
        severity='CRITICAL',
        category='storage',
        description='sg_persist command failed on a SCSI device. Cannot read or write persistent reservation keys. This blocks GFS2 fencing validation and could indicate a hardware path failure, device not supporting PR, or permission issue.',
        solution_hint='1. Check device exists: ls -la /dev/sdX\n2. Check multipath path status: multipath -ll\n3. Try with sudo: sudo sg_persist --in --read-keys /dev/sdX\n4. Check if device supports PR: sg_persist --in --report-capabilities /dev/sdX\n5. If path failed: check FC/iSCSI connectivity, rescan SCSI bus',
        product='GFS2',
    ),
    LogPattern(
        name='multipath_device_missing',
        regex=r'(MPATH_FAILED|NO_SDX_FOUND|DEVICE_MISSING|multipath.*device.*not found|no paths|orphan paths|multipath.*failed to.*get)',
        severity='CRITICAL',
        category='storage',
        description='Multipath device has no backing sdX paths or device is completely missing. VMs using this LUN will experience I/O errors. GFS2 filesystems on this device will withdraw. Could indicate FC/iSCSI session loss, storage array path failure, or device removal.',
        solution_hint='1. multipath -ll (check all device states — READ-ONLY, safe to run)\n2. Check FC connectivity: cat /sys/class/fc_host/host*/port_state\n3. Check iSCSI sessions: iscsiadm -m session\n⚠️ PRECAUTION: SCSI rescan (echo "- - -" > /sys/class/scsi_host/hostX/scan) can cause I/O disruption on busy systems. Avoid during heavy VM I/O. On GFS2 clusters, rescan can trigger glock contention if concurrent with other GFS2 operations.\n4. Rescan SCSI: echo "- - -" > /sys/class/scsi_host/hostX/scan (safe but avoid during peak I/O)\n5. If paths show as faulty: multipathd reconfigure\n6. Check storage array admin console for LUN masking changes',
        product='GFS2',
    ),
    LogPattern(
        name='gfs2_no_multipath_found',
        regex=r'(NO_GFS2_MPATH_FOUND|no.*gfs2.*multipath|gfs2.*device.*not visible|no mounted gfs2)',
        severity='HIGH',
        category='storage',
        description='No GFS2 multipath devices found on this cluster node. Either GFS2 filesystems are not mounted, LUNs are not visible, or multipath is not configured for the GFS2 backing devices. This node cannot participate in shared storage.',
        solution_hint='1. lsblk -f | grep gfs2 (check if any GFS2 filesystems exist)\n2. multipath -ll (check if multipath devices are configured)\n3. Check /etc/multipath.conf for WWID entries\n4. Check FC/iSCSI sessions for the storage paths\n5. If new node: configure multipath and register PR keys',
        product='GFS2',
    ),
    LogPattern(
        name='pr_key_cross_host_mismatch',
        regex=r'(CHECK_REQUIRED|cross.*host.*mismatch|PR.*key.*differ|reservation.*inconsist|key.*not.*visible.*all)',
        severity='CRITICAL',
        category='cluster',
        description='PR key registration is inconsistent across cluster nodes. Some nodes see different keys than others on the same LUN paths. This means SCSI-3 fencing cannot reliably protect data — a node could be fenced incorrectly or not fenced when it should be. Immediate investigation required.',
        solution_hint='1. Check sg_persist --in --read-keys on all paths across all nodes\n2. Compare reservation_key in /etc/multipath.conf across all hosts\n3. Ensure all paths on all nodes show the same registered keys\n4. Re-register missing keys: sg_persist --out --register --param-sark=0x<key> /dev/sdX\n5. Check if a node was recently rebuilt or had multipath reconfigured',
        product='GFS2',
    ),
    LogPattern(
        name='morpheus_service_down',
        regex=r'(down:.*morpheus|morpheus-ui.*down|morpheus-ctl.*down|run:.*morpheus.*FAIL|morpheus.*service.*dead|morphd.*down)',
        severity='CRITICAL',
        category='service',
        description='One or more HPE VM Essentials (Morpheus) services are in down state. Check morpheus-ctl status output. Down services cause: UI unavailable (morpheus-ui), no async jobs (rabbitmq), no logging (elasticsearch), no data persistence (mysql).',
        solution_hint='1. sudo morpheus-ctl status (identify which services are down)\n2. sudo morpheus-ctl start <service-name>\n3. If service won\'t start: check logs in /var/log/morpheus/<service>/current\n4. Check disk space: df -h /opt/morpheus\n5. Full restart: sudo morpheus-ctl stop && sleep 10 && sudo morpheus-ctl start\n6. If persistent: sudo morpheus-ctl reconfigure',
        product='Morpheus',
    ),
    LogPattern(
        name='morpheus_node_agent_missing',
        regex=r'(morpheus.*agent.*not installed|morpheus-node-ctl.*not found|morpheus-node.*service.*not|morphd.*not running|morpheus-morphd.*dead)',
        severity='HIGH',
        category='service',
        description='Morpheus node agent is not installed or not running on this KVM host. The host cannot communicate with the Manager appliance — provisioning, monitoring, and management operations will fail for VMs on this host.',
        solution_hint='1. Check if installed: morpheus-node-ctl status\n2. If not installed: reinstall morpheus-node agent from Manager UI\n3. If installed but not running: systemctl start morpheus-morphd\n4. Check connectivity to Manager: curl -k https://<manager-url>:443\n5. Check /var/log/morpheus-node/morphd/ for error logs',
        product='Morpheus',
    ),
    LogPattern(
        name='host_cpu_critical',
        regex=r'(CPU.*utilization.*9[5-9]|CPU.*usage.*100|cpu.*overload|load average:.*\d{2,}\.|system.*CPU.*saturat)',
        severity='HIGH',
        category='performance',
        description='Host CPU utilization is critically high (>95%). VMs will experience performance degradation. All workloads on this host are competing for CPU cycles. May need to migrate VMs to other hosts or add vCPU limits.',
        solution_hint='1. top -b -n 1 | head -20 (identify CPU consumers)\n2. virsh list (check how many VMs are running)\n3. virsh setvcpus <non-critical-vm> 2 --live (reduce vCPUs)\n4. virsh migrate --live <vm> qemu+ssh://less-loaded-host/system\n5. Check for runaway processes inside VMs\n6. Consider CPU pinning: virsh vcpupin to isolate workloads',
        product='KVM',
    ),
    LogPattern(
        name='host_disk_critical',
        regex=r'(filesystem.*9[5-9]%|disk.*usage.*9[5-9]%|No space left|disk.*full|/opt/morpheus.*100%|/var.*100%)',
        severity='CRITICAL',
        category='storage',
        description='Host filesystem is at critical capacity (>95%). Services will start failing: MySQL cannot write, Elasticsearch stops indexing, VM disk images cannot grow. Immediate action needed to prevent outage.',
        solution_hint='1. df -hT (identify full filesystem)\n2. du -sh /var/log/morpheus/* | sort -h (find largest logs)\n3. sudo journalctl --vacuum-time=3d (clean old journal)\n4. Find and remove old snapshots: virsh snapshot-list <vm>\n5. Clean old backups: find /backup -mtime +30 -delete\n6. Extend LVM: lvextend -L +50G /dev/vg/lv && resize2fs /dev/vg/lv',
        product='general',
    ),
    LogPattern(
        name='multipath_path_faulty',
        regex=r'(multipath.*faulty|multipath.*failed|dm-\d+.*path.*failed|mpath.*offline|multipathd.*path.*checker.*failed)',
        severity='HIGH',
        category='storage',
        description='One or more multipath paths are in faulty/failed state. Remaining paths handle all I/O which may cause performance degradation. If all paths fail, VMs using that LUN will lose storage access. Common causes: FC port offline, cable failure, storage controller path down.',
        solution_hint='1. multipath -ll (check which paths are faulty)\n2. Check FC port state: cat /sys/class/fc_host/host*/port_state\n3. Check physical connectivity: cable, switch port, SFP\n4. Rescan SCSI bus: echo "1" > /sys/class/fc_host/hostX/issue_lip\n5. If path recovers: multipathd reconfigure\n6. Contact storage admin if paths remain down',
        product='general',
    ),
    LogPattern(
        name='nic_interface_down',
        regex=r'(NIC.*Link is Down|link.*state.*down|carrier.*lost|eth\d+.*DOWN|ens\d+.*DOWN|bond.*no active slave|interface.*link down)',
        severity='HIGH',
        category='network',
        description='Network interface link is down. If this is part of a bond, traffic fails over to surviving slave. If it is the only path or both bond slaves are down, all network connectivity for VMs on this host is lost.',
        solution_hint='1. ip link show (check interface states)\n2. ethtool <interface> (check link status, speed)\n3. cat /proc/net/bonding/bond0 (check slave states)\n4. Check physical: cable, switch port, SFP transceiver\n5. Try: ip link set <interface> up\n6. If persistent: check switch config, replace cable/NIC',
        product='KVM',
    ),
    LogPattern(
        name='corosync_quorum_lost',
        regex=r'(quorum.*lost|not.*quorate|quorum.*no|partition.*without.*quorum|membership.*changed.*no quorum)',
        severity='CRITICAL',
        category='cluster',
        description='Cluster has lost quorum. Depending on no-quorum-policy, resources may be stopped or the node may fence itself. GFS2 filesystems will be frozen or withdrawn. New VMs cannot be started. Critical cluster emergency.',
        solution_hint='1. corosync-quorumtool -s (check quorum status)\n2. Check which nodes are online: corosync-quorumtool -l\n3. Check network between nodes: ping other node IPs\n4. Check corosync rings: corosync-cfgtool -s\n5. If network issue: check switches, bonds, VLANs\n6. If node crashed: investigate dmesg/journalctl on failed node',
        product='Pacemaker',
    ),
    LogPattern(
        name='dlm_lockspace_error',
        regex=r'(dlm.*error|dlm.*lockspace.*leave|dlm.*recover|dlm_controld.*error|DLM.*connection.*fail)',
        severity='CRITICAL',
        category='cluster',
        description='DLM (Distributed Lock Manager) error detected. DLM manages GFS2 distributed locks. If DLM lockspace leaves or has errors, GFS2 filesystems on this node will withdraw or become read-only. Often caused by corosync membership changes or network partitions.',
        solution_hint='1. dlm_tool ls (check lockspace status)\n2. dlm_tool status (check DLM daemon health)\n3. Check corosync: corosync-quorumtool -s\n4. Check if node left membership: journalctl -u corosync\n5. If lockspace left: remount GFS2 after dlm recovers\n6. If persistent: restart DLM and GFS2 services',
        product='GFS2',
    ),
    LogPattern(
        name='gfs2_withdraw_detected',
        regex=r'(gfs2.*withdraw|GFS2.*Withdrawing|gfs2.*jid=.*withdrawn|filesystem.*withdraw|gfs2.*error.*withdrawing)',
        severity='CRITICAL',
        category='filesystem',
        description='GFS2 filesystem has withdrawn on this node. The filesystem is now read-only or inaccessible. VMs with disks on this GFS2 mount will experience I/O errors. Withdraw happens to protect data integrity when the node detects it cannot safely participate in distributed locking.',
        solution_hint='1. cat /sys/fs/gfs2/*/withdraw (check withdraw status)\n2. mount | grep gfs2 (check mount state)\n3. Check DLM: dlm_tool ls (lockspace must be active)\n4. Check network/corosync connectivity between nodes\n5. Recovery: unmount, fsck.gfs2 -y /dev/mapper/<device>, remount\n6. If recurring: check storage paths, network stability, corosync logs',
        product='GFS2',
    ),
    LogPattern(
        name='vm_block_io_error',
        regex=r'(domblkerror|virsh.*blkerror|block.*error.*vd[a-z]|virtio.*blk.*error|qemu.*write.*error.*vd)',
        severity='HIGH',
        category='virtualization',
        description='VM virtual disk (vdX) is experiencing block I/O errors. The backing storage is failing for this VM. Could be caused by: storage path failure, GFS2 withdraw on the datastore, disk image corruption, or host storage full.',
        solution_hint='1. virsh domblkerror <vm> (check which disk has errors)\n2. virsh domblklist <vm> (find backing file path)\n3. Check backing storage: df -h, multipath -ll\n4. Check GFS2 health: cat /sys/fs/gfs2/*/withdraw\n5. If storage OK: qemu-img check <disk-path>\n6. If storage issue: fix multipath/GFS2 first, then resume VM',
        product='KVM',
    ),
    LogPattern(
        name='ovs_bridge_error',
        regex=r'(ovs-vswitchd.*error|ovsdb.*connection.*failed|bridge.*not.*found.*ovs|ovs.*port.*error|openvswitch.*fail)',
        severity='HIGH',
        category='network',
        description='Open vSwitch error detected. OVS provides virtual networking for VMs. If ovs-vswitchd or ovsdb-server fails, VM network connectivity through OVS bridges will be disrupted. Port misconfigurations can cause traffic blackholing.',
        solution_hint='1. systemctl status ovs-vswitchd ovsdb-server\n2. ovs-vsctl show (check bridge/port config)\n3. ovs-vsctl list-br (list bridges)\n4. If service down: systemctl restart openvswitch-switch\n5. Check logs: journalctl -u ovs-vswitchd\n6. If port issue: ovs-vsctl del-port <bridge> <port> && ovs-vsctl add-port <bridge> <port>',
        product='KVM',
    ),
    LogPattern(
        name='ceph_health_warn',
        regex=r'(HEALTH_WARN|HEALTH_ERR|ceph.*osd.*down|ceph.*pg.*degraded|ceph.*nearfull|ceph.*full ratio)',
        severity='HIGH',
        category='storage',
        description='Ceph cluster health warning or error. Ceph provides distributed storage for VMs. HEALTH_WARN means degraded redundancy. HEALTH_ERR means data may be at risk. OSD down means reduced I/O capacity. Nearfull means approaching storage capacity limit.',
        solution_hint='1. ceph status (check overall health)\n2. ceph health detail (see specific warnings)\n3. ceph osd status (check OSD states)\n4. If OSD down: systemctl start ceph-osd@<id>\n5. If nearfull: ceph df detail (check pool usage)\n6. Add capacity or rebalance: ceph osd reweight',
        product='KVM',
    ),
    LogPattern(
        name='fc_host_link_down',
        regex=r'(fc_host.*port_state.*Linkdown|fc.*link.*failure|fibre.*channel.*lost|HBA.*offline|fc_host.*Online.*Offline)',
        severity='CRITICAL',
        category='hardware',
        description='Fibre Channel HBA port has gone offline. All storage LUNs accessed through this FC port will lose their paths. If redundant paths exist, I/O continues on remaining paths. If all FC ports are down, complete storage loss occurs for this host.',
        solution_hint='1. cat /sys/class/fc_host/host*/port_state (check all FC ports)\n2. cat /sys/class/fc_host/host*/port_name (identify which HBA)\n3. Check physical: SFP, cable, switch port\n4. Check FC switch zone configuration\n5. echo "1" > /sys/class/fc_host/hostX/issue_lip (attempt link reinit)\n6. If hardware failure: replace HBA/cable/SFP',
        product='general',
    ),
    LogPattern(
        name='iscsi_session_lost',
        regex=r'(iscsid.*connection.*closed|iscsi.*session.*failed|iscsi.*target.*lost|iscsiadm.*no.*session|iscsi.*login.*failed|iscsi.*timeout)',
        severity='CRITICAL',
        category='storage',
        description='iSCSI session has been lost or failed to connect. Storage targets accessed via iSCSI are no longer reachable. VMs using iSCSI-backed storage will experience I/O errors. Common causes: network disruption, target portal down, authentication failure.',
        solution_hint='1. iscsiadm -m session (check active sessions)\n2. iscsiadm -m discovery -t sendtargets -p <portal-ip>\n3. iscsiadm -m node --login (attempt reconnect)\n4. Check network to target: ping <target-ip>\n5. Check target portal service status\n6. Check /etc/iscsi/initiatorname.iscsi and authentication credentials',
        product='general',
    ),
    LogPattern(
        name='morpheus_health_diagnose_fail',
        regex=r'(morpheus-ctl health.*fail|health.*diagnose.*FAIL|health check.*failed|morpheus.*health.*degraded)',
        severity='HIGH',
        category='service',
        description='HPE VM Essentials health diagnostics reported failures. The built-in health check (morpheus-ctl health --diagnose) has detected issues with one or more subsystems. This is an early warning before full service failure.',
        solution_hint='1. sudo morpheus-ctl health --diagnose (see full report)\n2. sudo morpheus-ctl status (check service states)\n3. Check disk: df -h /opt/morpheus\n4. Check memory: free -h\n5. Check individual services: morpheus-ctl tail <service>\n6. If multiple failures: sudo morpheus-ctl reconfigure',
        product='Morpheus',
    ),
    # === Health Report & Service Status Patterns ===
    LogPattern(
        name='health_report_critical',
        regex=r'\[CRIT\]',
        severity='CRITICAL',
        category='service',
        description='Health report check flagged a CRITICAL check. This indicates a system resource (CPU >90%, memory >95%, disk >95%), cluster quorum loss, failed resources, or faulty multipath paths that require immediate attention.',
        solution_hint='1. Read the health report line to identify WHICH check failed\n2. CPU >90%: migrate VMs, check for runaway processes\n3. Memory >95%: stop idle VMs, enable KSM\n4. Disk >95%: clean logs, delete old snapshots, extend LVM\n5. Quorum lost: check corosync, network between nodes\n6. Multipath faulty: check FC/iSCSI, cables, storage array',
        product='VME',
    ),
    LogPattern(
        name='morpheus_ctl_service_down',
        regex=r'^down:\s*(morpheus-ui|mysql|nginx|rabbitmq|elasticsearch|morphd|check-ports)',
        severity='CRITICAL',
        category='service',
        description='morpheus-ctl status output showing a service in DOWN state. The Manager appliance has one or more critical services stopped. UI access, database, messaging, or search may be unavailable depending on which service is down.',
        solution_hint='1. Identify which service is down from the output\n2. morpheus-ui down: sudo morpheus-ctl restart morpheus-ui\n3. mysql down: check disk space, remove stale PID, morpheus-ctl start mysql\n4. rabbitmq down: morpheus-ctl restart rabbitmq\n5. elasticsearch down: check disk watermark, morpheus-ctl restart elasticsearch\n6. nginx down: morpheus-ctl restart nginx\n7. Full recovery: sudo morpheus-ctl stop && sleep 10 && sudo morpheus-ctl start',
        product='Morpheus',
    ),
    LogPattern(
        name='virsh_vm_not_running',
        regex=r'(shut off|crashed|paused)\s*$',
        severity='MEDIUM',
        category='virtualization',
        description='virsh list output shows a VM in shut-off, crashed, or paused state. If this is a production VM that should be running, it requires investigation. Crashed VMs may indicate host resource issues or storage problems.',
        solution_hint='1. Check if VM should be running (compare with expected state)\n2. If crashed: virsh start <vm> to restart\n3. If paused: check storage (disk full causes VM pause) — virsh resume <vm>\n4. If shut off but should be running: virsh start <vm>, then virsh autostart <vm>\n5. Check VM logs: /var/log/libvirt/qemu/<vm>.log for crash reason',
        product='KVM',
    ),
    LogPattern(
        name='multipath_sdx_path_failed',
        regex=r'(failed|faulty)\s+\d+:\d+:\d+:\d+\s+sd[a-z]',
        severity='CRITICAL',
        category='storage',
        description='multipath -ll output shows a storage path in failed/faulty state. This sdX device is no longer providing I/O to the multipath device. If all paths fail, the LUN becomes inaccessible causing VM storage errors and GFS2 withdrawals.',
        solution_hint='1. Identify the failed path from multipath -ll output\n2. Check FC HBA: cat /sys/class/fc_host/host*/port_state\n3. Check iSCSI: iscsiadm -m session\n4. Physical check: cable, switch port, SFP transceiver\n5. Rescan: echo "- - -" > /sys/class/scsi_host/hostX/scan\n6. If path recovers: multipathd reconfigure',
        product='general',
    ),
    LogPattern(
        name='bond_no_active_slave',
        regex=r'(Slave Interface:.*\nMII Status: down|Currently Active Slave: None|Number of ports: 0)',
        severity='CRITICAL',
        category='network',
        description='Bond status output shows a slave interface is DOWN or bond has no active slaves. Network redundancy is compromised or completely lost. If both slaves are down, all network connectivity for VMs is lost.',
        solution_hint='1. cat /proc/net/bonding/bond0 (check which slave is down)\n2. ethtool <slave-interface> (check link status)\n3. Check physical: cable, switch port, SFP\n4. If switch issue: contact network team\n5. If NIC failure: replace hardware, reassign bond slave',
        product='KVM',
    ),
    LogPattern(
        name='filesystem_usage_critical',
        regex=r'\s(9[0-9]|100)%\s+/(opt|var|boot|home|\s*$)',
        severity='HIGH',
        category='storage',
        description='df output shows a filesystem at 90%+ capacity. Critical thresholds: >85% WARN, >95% CRIT. High disk usage on /opt/morpheus causes MySQL/ES failures, on /var causes log loss, on / causes system instability.',
        solution_hint='1. Identify which filesystem is full from df output\n2. /opt/morpheus: clean old morpheus backups, rotate logs\n3. /var: sudo journalctl --vacuum-time=3d, logrotate\n4. /var/lib/libvirt: delete old snapshots, remove unused ISOs\n5. Extend: lvextend -L +50G /dev/vg/lv && resize2fs\n6. Prevention: set up disk usage monitoring alerts',
        product='general',
    ),
    LogPattern(
        name='sg_persist_no_keys_registered',
        regex=r'(No registered reservation keys|key.*count.*0|PR generation.*0x0|registration.*count:.*0)',
        severity='CRITICAL',
        category='storage',
        description='sg_persist output shows NO persistent reservation keys registered on a datastore LUN. This means SCSI-3 fencing cannot protect this LUN. If a node fails, other nodes cannot eject it from the shared storage, risking data corruption.',
        solution_hint='1. Verify device is GFS2 datastore: lsblk -f | grep gfs2\n2. Check multipath.conf for reservation_key setting\n3. Register key: sg_persist --out --register --param-sark=0x<KEY> /dev/sdX\n4. Do this for ALL sdX paths of the multipath device\n5. Verify: sg_persist --in --read-keys /dev/sdX\n6. Check all nodes in cluster have same key registered',
        product='GFS2',
    ),
    LogPattern(
        name='timedatectl_ntp_not_synced',
        regex=r'(System clock synchronized: no|NTP synchronized: no|NTP service: inactive|systemd-timesyncd.*not.*running)',
        severity='HIGH',
        category='service',
        description='timedatectl output shows system clock is NOT synchronized. Time drift causes: SSL certificate errors, Active Directory authentication failures, cluster quorum issues, log timestamp inconsistencies, and backup scheduling problems.',
        solution_hint='1. timedatectl (check sync status)\n2. sudo systemctl enable --now systemd-timesyncd\n3. Or: sudo systemctl enable --now chronyd\n4. sudo chronyc makestep (force immediate sync)\n5. Verify: timedatectl | grep synchronized\n6. Check /etc/systemd/timesyncd.conf for correct NTP servers',
        product='general',
    ),
    LogPattern(
        name='virsh_block_io_error',
        regex=r'(domblkerror.*error|block.*device.*error|I/O error.*vd[a-z]|read error.*vd[a-z])',
        severity='CRITICAL',
        category='virtualization',
        description='virsh domblkerror output shows a VM disk is experiencing I/O errors. The VM may be in paused state or experiencing application crashes. Root cause is typically: backing storage failure, GFS2 withdraw, or full storage pool.',
        solution_hint='1. virsh domblkerror <vm> (check error type)\n2. virsh domblklist <vm> (find backing storage path)\n3. Check backing storage: multipath -ll, df -h\n4. Check GFS2: cat /sys/fs/gfs2/*/withdraw\n5. If storage recovered: virsh resume <vm>\n6. Check qemu-img check <disk-path> for corruption',
        product='KVM',
    ),
    # ====================================================================
    # HARDWARE PATTERNS (6 new)
    # ====================================================================
    LogPattern(
        name='ecc_memory_correctable',
        regex=r'(EDAC.*CE|corrected.*memory.*error|Hardware Error.*corrected|mce.*memory.*scrubbing)',
        severity='MEDIUM',
        category='hardware',
        description='Correctable ECC memory error detected. Hardware is auto-correcting bit flips. A few are normal but increasing rate indicates DIMM is degrading and will eventually fail uncorrectably.',
        solution_hint='1. edac-util -s — check error counts\n2. cat /sys/devices/system/edac/mc/mc*/csrow*/ce_count\n3. Track rate — if increasing, plan DIMM replacement\n4. Identify failing DIMM slot from EDAC logs\n5. Schedule replacement during next maintenance window',
        product='general',
    ),
    LogPattern(
        name='pcie_error',
        regex=r'(PCIe.*error|AER.*error|pcieport.*error|correctable error received|uncorrectable error)',
        severity='HIGH',
        category='hardware',
        description='PCI Express bus error detected. This can cause device disconnection (NIC, HBA, GPU). Uncorrectable errors may crash the system. Common causes: loose card, faulty slot, or dying hardware.',
        solution_hint='1. lspci -vvv — check device status\n2. dmesg | grep -i aer — check AER details\n3. Reseat the affected PCIe card\n4. Try a different PCIe slot\n5. Update firmware/driver for the device\n6. If persistent, replace the card or motherboard',
        product='general',
    ),
    LogPattern(
        name='disk_smart_failure',
        regex=r'(SMART.*failure|predictive failure|Current_Pending_Sector|Reallocated_Sector_Ct.*[1-9]|offline uncorrectable)',
        severity='CRITICAL',
        category='hardware',
        description='SMART disk health check reports failure or degradation. The disk is predicting its own death — data loss is imminent if not replaced. Reallocated sectors mean the disk is running out of spare sectors.',
        solution_hint='1. smartctl -a /dev/sdX — full SMART data\n2. Check Reallocated_Sector_Ct and Current_Pending_Sector\n3. Schedule IMMEDIATE disk replacement\n4. Ensure backups are current\n5. If in RAID: mark disk for replacement, rebuild on new disk\n6. Do NOT ignore — disk WILL fail',
        product='general',
    ),
    LogPattern(
        name='fan_failure',
        regex=r'(fan.*fail|fan.*critical|fan.*speed.*0|cooling.*alert|thermal.*shutdown.*imminent)',
        severity='CRITICAL',
        category='hardware',
        description='Fan failure or critical cooling alert. Server may overheat and perform emergency thermal shutdown. Data loss possible if shutdown is ungraceful.',
        solution_hint='1. ipmitool sensor list | grep -i fan\n2. Check iLO/iDRAC/BMC for hardware alerts\n3. Replace failed fan immediately\n4. If in datacenter, check ambient temperature\n5. Reduce workload until fan is replaced\n6. May need to migrate VMs off this host',
        product='general',
    ),
    LogPattern(
        name='power_supply_failure',
        regex=r'(power supply.*fail|PSU.*fault|redundancy.*lost|power.*unit.*error|AC.*lost)',
        severity='CRITICAL',
        category='hardware',
        description='Power supply failure or redundancy loss detected. Server is running on single PSU — another failure means complete power loss. Urgent hardware intervention needed.',
        solution_hint='1. Check iLO/iDRAC/BMC power status\n2. ipmitool sdr | grep -i power\n3. Replace failed PSU immediately\n4. Verify both power feeds are active\n5. Check UPS status\n6. Consider migrating critical VMs until fixed',
        product='general',
    ),
    LogPattern(
        name='raid_degraded',
        regex=r'(RAID.*degrad|array.*degrad|md\d+.*degraded|drive.*rebuild|RAID.*fail)',
        severity='CRITICAL',
        category='hardware',
        description='RAID array is degraded — at least one disk has failed. Data is at risk: another disk failure will cause data loss. Rebuild must start immediately.',
        solution_hint='1. cat /proc/mdstat — check array status\n2. mdadm --detail /dev/mdX\n3. Identify failed disk and replace ASAP\n4. mdadm --manage /dev/mdX --add /dev/sdY\n5. Monitor rebuild: watch cat /proc/mdstat\n6. Do NOT reboot during rebuild unless necessary',
        product='general',
    ),


    # ====================================================================
    # PERFORMANCE PATTERNS (8 new)
    # ====================================================================
    LogPattern(
        name='high_load_average',
        regex=r'load average[s]?:\s*(\d{2,})\.\d+',
        severity='HIGH',
        category='performance',
        description='System load average is extremely high (double digits+). This means more processes are waiting for CPU than available cores. System will feel sluggish, services may timeout.',
        solution_hint='1. Check: uptime, top -bn1\n2. Identify top consumers: ps aux --sort=-%cpu | head -20\n3. Check for runaway processes or fork bombs\n4. If IO-bound: iostat -x 1 5 to check disk wait\n5. Consider killing non-essential processes\n6. Scale up CPU if persistent',
        product='general',
    ),
    LogPattern(
        name='io_wait_high',
        regex=r'(%iowait|iowait|wa)\s*[:\s]+\s*([3-9]\d|100)\.',
        severity='HIGH',
        category='performance',
        description='IO wait is above 30%, meaning CPUs are idle waiting for disk operations. Applications will be slow. Usually caused by: slow storage, too many disk operations, or failing disks.',
        solution_hint='1. iostat -x 1 5 — check await and %util columns\n2. iotop — find which process is causing IO\n3. Check for failing disks: dmesg | grep -i error\n4. Check multipath status if SAN storage\n5. Consider IO scheduler tuning or faster storage',
        product='general',
    ),
    LogPattern(
        name='memory_pressure_high',
        regex=r'(kswapd|direct reclaim|memory pressure|compaction_stall|allocstall)',
        severity='HIGH',
        category='performance',
        description='Kernel is under memory pressure — actively reclaiming pages. This causes latency spikes as processes wait for memory. Precursor to OOM kills.',
        solution_hint='1. free -h — check available memory\n2. cat /proc/meminfo | grep -i dirty\n3. Check for memory leaks: ps aux --sort=-rss | head\n4. Consider vm.swappiness tuning\n5. Add more RAM or reduce workload\n6. Check if transparent hugepages are causing issues',
        product='general',
    ),
    LogPattern(
        name='swap_usage_high',
        regex=r'(swap (total|used).*[1-9]\d{6,}|swapon.*\d+[MG].*used|SwapFree:\s*[0-9]{1,4}\s*kB)',
        severity='MEDIUM',
        category='performance',
        description='System is actively using significant swap space. This severely degrades performance as disk is 100x slower than RAM. Processes may experience hangs and timeouts.',
        solution_hint='1. free -h — check swap usage\n2. cat /proc/swaps — see swap devices\n3. Find swap consumers: for f in /proc/*/status; do awk "/VmSwap/{print $2}" $f; done\n4. Consider adding RAM\n5. Tune vm.swappiness=10 for production servers',
        product='general',
    ),
    LogPattern(
        name='context_switch_storm',
        regex=r'(context switch|ctxt)\s*[:\s]+\s*\d{8,}',
        severity='MEDIUM',
        category='performance',
        description='Extremely high context switch rate detected. This indicates too many threads fighting for CPU, causing overhead. Performance will degrade as CPU spends time switching instead of working.',
        solution_hint='1. vmstat 1 5 — check cs column\n2. pidstat -w 1 5 — find processes causing switches\n3. Check for too many threads: ps -eLf | wc -l\n4. Reduce thread count in applications\n5. Consider CPU pinning for critical processes',
        product='general',
    ),
    LogPattern(
        name='disk_latency_high',
        regex=r'(await|svctm|latency)\s*[=:\s]+\s*(\d{3,})\s*(ms|msec)',
        severity='HIGH',
        category='performance',
        description='Disk latency is in hundreds of milliseconds — extremely slow. Normal is <10ms for SSD, <20ms for HDD. Applications will timeout, databases will stall.',
        solution_hint='1. iostat -x 1 5 — check await column per device\n2. Check for queue depth saturation: avgqu-sz\n3. Verify multipath is balanced across paths\n4. Check storage array health\n5. Consider IO scheduler change: echo deadline > /sys/block/sdX/queue/scheduler',
        product='general',
    ),
    LogPattern(
        name='cpu_soft_lockup',
        regex=r'(BUG: soft lockup|soft lockup.*CPU|watchdog.*BUG.*soft lockup)',
        severity='CRITICAL',
        category='performance',
        description='CPU soft lockup detected — a CPU has been stuck executing kernel code for >20 seconds without yielding. System is partially frozen. May cascade to watchdog reset.',
        solution_hint='1. Check dmesg for the full stack trace\n2. Identify which process/syscall caused it\n3. Common causes: storage IO stall, spinlock contention\n4. Check if storage paths are healthy\n5. May need kernel parameter: kernel.softlockup_panic=0\n6. If repeated, likely hardware or driver issue',
        product='general',
    ),
    LogPattern(
        name='numa_imbalance',
        regex=r'(numa.*imbalance|node\s+\d+.*free.*0|NUMA.*mismatch|cross.node.*allocation)',
        severity='MEDIUM',
        category='performance',
        description='NUMA memory imbalance detected. Processes are accessing memory from remote NUMA nodes, causing 2-3x latency penalty. VMs and databases are especially sensitive to this.',
        solution_hint='1. numactl --hardware — check node memory\n2. numastat -m — see per-node allocation\n3. Pin VMs to NUMA nodes: virsh numatune\n4. Check automatic NUMA balancing: cat /proc/sys/kernel/numa_balancing\n5. For databases: numactl --interleave=all',
        product='general',
    ),

    # ====================================================================
    # SECURITY PATTERNS (7 new)
    # ====================================================================
    LogPattern(
        name='ssh_brute_force',
        regex=r'(Failed password.*from.*repeated|maximum authentication attempts|Too many authentication failures|pam_unix.*authentication failure.*rhost)',
        severity='HIGH',
        category='security',
        description='SSH brute force attack detected. Multiple failed login attempts from an external IP. The attacker is trying common username/password combinations to gain access.',
        solution_hint='1. Check: journalctl -u sshd | grep Failed\n2. Block IP: firewall-cmd --add-rich-rule="rule family=ipv4 source address=X.X.X.X reject"\n3. Install fail2ban for auto-blocking\n4. Disable password auth: PasswordAuthentication no in sshd_config\n5. Use SSH keys only\n6. Change SSH port if exposed to internet',
        product='general',
    ),
    LogPattern(
        name='unauthorized_sudo',
        regex=r'(sudo.*NOT in sudoers|sudo.*incident.*reported|user NOT in sudoers|COMMAND.*not allowed)',
        severity='HIGH',
        category='security',
        description='User attempted sudo without authorization. This could be a legitimate user who needs elevated access, or an attacker trying to escalate privileges after gaining initial access.',
        solution_hint='1. Check who: grep "NOT in sudoers" /var/log/secure\n2. Verify if legitimate: contact the user\n3. If legitimate: visudo to add access\n4. If suspicious: check user login history, review commands\n5. Consider audit trail: auditctl -w /etc/sudoers',
        product='general',
    ),
    LogPattern(
        name='file_integrity_changed',
        regex=r'(AIDE.*changed|tripwire.*violation|integrity.*check.*fail|rpm -V.*[SM5DLUGTP])',
        severity='HIGH',
        category='security',
        description='File integrity monitoring detected unauthorized file changes. System binaries or config files were modified outside of normal package management. Could indicate compromise.',
        solution_hint='1. Review changed files: aide --check\n2. Compare with package: rpm -V <package>\n3. Check modification time: stat <file>\n4. If binary changed: reinstall package\n5. Check for rootkits: rkhunter --check\n6. Review recent user activity in /var/log/secure',
        product='general',
    ),
    LogPattern(
        name='firewall_zone_misconfigured',
        regex=r'(firewall.*zone.*public.*interface|FirewallD.*not running|firewalld.*dead|nftables.*failed)',
        severity='HIGH',
        category='security',
        description='Firewall is misconfigured, not running, or interfaces are in wrong zones. System may be exposed to unauthorized network access. Critical for production servers.',
        solution_hint='1. firewall-cmd --state\n2. firewall-cmd --get-active-zones\n3. firewall-cmd --list-all\n4. Ensure correct zone for each interface\n5. systemctl enable --now firewalld\n6. Verify required ports only: firewall-cmd --list-ports',
        product='general',
    ),
    LogPattern(
        name='ssl_certificate_expiring',
        regex=r'(certificate.*expir|ssl.*expir|x509.*not after|cert.*will expire|TLS.*expir)',
        severity='HIGH',
        category='security',
        description='SSL/TLS certificate is expired or expiring soon. Services using this certificate will show security warnings, and clients may refuse to connect. Automated renewals may have failed.',
        solution_hint='1. openssl x509 -in cert.pem -noout -dates\n2. Check all certs: find /etc/pki -name "*.pem" -exec openssl x509 -noout -enddate -in {} \\;\n3. Renew with certbot or your CA\n4. Restart affected services after renewal\n5. Set up monitoring/auto-renewal',
        product='general',
    ),
    LogPattern(
        name='audit_policy_violation',
        regex=r'(auditd.*overflow|audit.*backlog.*limit|type=AVC.*denied|type=SYSCALL.*key=)',
        severity='MEDIUM',
        category='security',
        description='Linux audit subsystem flagged a policy violation or is experiencing backlog overflow. Audit overflow means security events are being DROPPED — you have a blind spot.',
        solution_hint='1. ausearch -m AVC -ts recent\n2. If overflow: increase backlog in /etc/audit/auditd.conf\n3. auditctl -l — list current rules\n4. aureport --summary — get overview\n5. Check disk space for audit logs\n6. sealert -a /var/log/audit/audit.log for SELinux issues',
        product='general',
    ),
    LogPattern(
        name='account_lockout',
        regex=r'(account.*locked|pam_tally.*deny|pam_faillock.*locked|user account.*expired|account is locked)',
        severity='MEDIUM',
        category='security',
        description='User account has been locked out due to too many failed login attempts or account expiration. If this is a service account, associated services will fail to start.',
        solution_hint='1. pam_tally2 --user=<username> — check attempts\n2. pam_tally2 --user=<username> --reset — unlock\n3. faillock --user <username> --reset\n4. chage -l <username> — check expiry\n5. If service account: passwd -u <username>\n6. Review why lockout happened — security event?',
        product='general',
    ),

    # ====================================================================
    # KERNEL PATTERNS (6 new)
    # ====================================================================
    LogPattern(
        name='kernel_taint',
        regex=r'(Tainted:.*[PFWROECBUILDAHMT]|kernel.*tainted|module.*taints kernel)',
        severity='MEDIUM',
        category='kernel',
        description='Kernel is tainted — an out-of-tree, proprietary, or unsigned module was loaded. Support teams may not investigate crashes on tainted kernels. Common with GPU drivers and some storage drivers.',
        solution_hint='1. cat /proc/sys/kernel/tainted — check taint flags\n2. dmesg | grep -i taint — find which module\n3. Taint flags: P=proprietary, O=out-of-tree, F=forced\n4. If crash occurs: try reproducing without the tainting module\n5. Update the offending driver to a supported version',
        product='general',
    ),
    LogPattern(
        name='kernel_rcu_stall',
        regex=r'(rcu_sched.*stall|rcu.*detected stall|rcu_preempt.*stall|INFO: rcu.*self-detected stall)',
        severity='CRITICAL',
        category='kernel',
        description='RCU (Read-Copy-Update) stall detected — a CPU has been stuck in kernel code without yielding for a long time. The system is partially locked up. Often precedes or accompanies soft lockups.',
        solution_hint='1. Check dmesg for the full stack trace on the stalled CPU\n2. Common causes: spinlock held too long, interrupt storm\n3. Check storage paths — IO stall is common trigger\n4. Verify NIC driver is not blocking: ethtool -S\n5. Consider kernel parameter: rcupdate.rcu_cpu_stall_timeout=60\n6. May indicate hardware issue (faulty CPU/memory)',
        product='general',
    ),
    LogPattern(
        name='kernel_oops',
        regex=r'(kernel.*Oops|BUG:.*kernel|Oops:.*\[#\d+\]|general protection fault)',
        severity='CRITICAL',
        category='kernel',
        description='Kernel oops detected — a non-fatal kernel error. The kernel encountered an unexpected condition (null pointer, protection fault). System may continue but is in an unstable state.',
        solution_hint='1. Capture full dmesg output\n2. Check stack trace for the faulting module\n3. If module-related: update or remove the module\n4. Check if kernel version has known bugs\n5. If repeated: update kernel or apply vendor patch\n6. Consider kdump for detailed crash analysis',
        product='general',
    ),
    LogPattern(
        name='kernel_hung_task',
        regex=r'(hung_task|blocked for more than \d+ seconds|task.*blocked.*uninterruptible|INFO: task.*blocked)',
        severity='HIGH',
        category='kernel',
        description='Process has been stuck in uninterruptible sleep (D-state) for more than 120 seconds. Usually waiting for IO that never completes. The process cannot be killed normally.',
        solution_hint='1. ps aux | grep " D " — find D-state processes\n2. cat /proc/<pid>/wchan — see what it waits on\n3. Check storage: multipath -ll, dmesg\n4. Common cause: NFS/CIFS mount with unreachable server\n5. Try: echo 1 > /proc/sysrq-trigger (show blocked tasks)\n6. May need to fix underlying IO path or reboot',
        product='general',
    ),
    LogPattern(
        name='kernel_module_load_fail',
        regex=r'(modprobe.*FATAL|insmod.*failed|module.*not found|modprobe.*module.*not found in|Required key not available)',
        severity='HIGH',
        category='kernel',
        description='Kernel module failed to load. This can prevent hardware from working (NIC, storage HBA, GPU) or features from functioning. Common after kernel updates when modules need rebuilding.',
        solution_hint='1. modprobe <module> — try loading manually\n2. modinfo <module> — check if it exists\n3. dkms status — check if DKMS modules need rebuild\n4. dkms autoinstall — rebuild for current kernel\n5. Verify kernel-devel package matches running kernel\n6. Check Secure Boot if "Required key not available"',
        product='general',
    ),
    LogPattern(
        name='kernel_panic_on_oops',
        regex=r'(Kernel panic.*not syncing|VFS:.*unable to mount root|not syncing:.*Fatal exception|Attempted to kill init)',
        severity='CRITICAL',
        category='kernel',
        description='Kernel panic — system has completely crashed and halted. No recovery without reboot. Common causes: failed root mount, corrupted initramfs, critical driver crash, or OOM with panic_on_oom.',
        solution_hint='1. Check kdump/vmcore if configured\n2. Review serial console or crash dump\n3. If VFS mount issue: check fstab and initramfs\n4. Boot to rescue mode and fix\n5. dracut --force to rebuild initramfs\n6. Check if recent kernel update broke things',
        product='general',
    ),


    # ====================================================================
    # BACKUP PATTERNS (4 new)
    # ====================================================================
    LogPattern(
        name='backup_space_insufficient',
        regex=r'(backup.*no space|backup.*insufficient.*space|backup.*disk full|No space left.*backup)',
        severity='HIGH',
        category='backup',
        description='Backup failed due to insufficient disk space. Backup repository or staging area is full. Data protection is compromised until resolved — no new backups are being created.',
        solution_hint='1. df -h <backup_path> — check space\n2. Remove oldest backups: find <path> -mtime +30 -delete\n3. Check retention policy — too many kept?\n4. Compress old backups: gzip\n5. Expand backup volume: lvextend\n6. Consider offloading to object storage',
        product='general',
    ),
    LogPattern(
        name='backup_timeout',
        regex=r'(backup.*timed? ?out|backup.*exceeded.*time|backup job.*timeout|backup.*did not complete)',
        severity='HIGH',
        category='backup',
        description='Backup job timed out before completing. Data is not fully protected. Causes: too much data changed, slow network to backup target, storage performance issues, or resource contention.',
        solution_hint='1. Check backup logs for which phase timed out\n2. Increase timeout: adjust backup schedule/policy\n3. Check network to backup target: iperf3\n4. Consider incremental vs full backup\n5. Schedule during low-activity window\n6. Check if concurrent backups are competing for IO',
        product='general',
    ),
    LogPattern(
        name='backup_corruption_detected',
        regex=r'(backup.*corrupt|backup.*checksum.*mismatch|backup.*integrity.*fail|restore.*verification.*fail)',
        severity='CRITICAL',
        category='backup',
        description='Backup data corruption detected. The backup cannot be reliably restored. This is a data protection emergency — you may not have any valid recovery point.',
        solution_hint='1. Check storage media for errors\n2. Attempt to verify other recent backups\n3. Run immediate new backup if source data is intact\n4. Check for bit-rot: scrub backup storage\n5. Review backup software logs for root cause\n6. Consider different backup storage medium',
        product='general',
    ),
    LogPattern(
        name='snapshot_failed',
        regex=r'(snapshot.*fail|snapshot.*error|cannot create snapshot|snapshot.*abort|snapshot.*overflow)',
        severity='HIGH',
        category='backup',
        description='VM or LVM snapshot creation failed. This blocks backup operations and point-in-time recovery. Common causes: insufficient space in snapshot pool, too many existing snapshots, or COW overflow.',
        solution_hint='1. lvs — check snapshot usage percent\n2. Remove old snapshots: lvremove\n3. Extend snapshot: lvextend -L +10G\n4. Check COW space: lvs -a | grep cow\n5. For VMs: virsh snapshot-list <domain>\n6. Reduce IO during snapshot creation',
        product='general',
    ),

    # ====================================================================
    # SYSTEM PATTERNS (5 new)
    # ====================================================================
    LogPattern(
        name='systemd_dependency_failed',
        regex=r'(Dependency failed|Job.*failed.*dependency|dependency.*not.*met|Bound.*terminated)',
        severity='HIGH',
        category='system',
        description='A systemd service could not start because a service it depends on failed. This can cascade — one failed service can prevent multiple others from starting.',
        solution_hint='1. systemctl list-dependencies <service> — see deps\n2. systemctl status <failed_dep> — check why dep failed\n3. journalctl -u <service> — check logs\n4. Fix the root dependency first\n5. systemctl reset-failed && systemctl start <service>',
        product='general',
    ),
    LogPattern(
        name='boot_failure',
        regex=r'(Failed to start.*Emergency|emergency\.target|rescue\.target.*reached|dracut.*failed|initramfs.*emergency)',
        severity='CRITICAL',
        category='system',
        description='System booted into emergency/rescue mode — normal boot failed. Common causes: bad fstab entry, corrupted filesystem, missing initramfs, or failed root mount.',
        solution_hint='1. Check: journalctl -xb — boot logs\n2. If fstab issue: mount -o remount,rw / then fix /etc/fstab\n3. If initramfs: dracut --force --regenerate-all\n4. If filesystem: fsck /dev/<device>\n5. If GRUB: check boot parameters\n6. Verify root= parameter matches actual root device',
        product='general',
    ),
    LogPattern(
        name='time_jump_detected',
        regex=r'(time.*jump|clock.*jump|time.*step|System clock.*changed|systemd-timesyncd.*jumped)',
        severity='HIGH',
        category='system',
        description='System clock jumped significantly. This breaks: TLS certificate validation, cluster quorum (corosync), scheduled tasks, log ordering, and Kerberos authentication. May indicate NTP fix or VM resume.',
        solution_hint='1. timedatectl — check current sync status\n2. journalctl --since "1 hour ago" | grep -i time\n3. If VM: check hypervisor clock sync settings\n4. chronyc tracking — verify NTP source\n5. If cluster: check corosync token timeouts\n6. May need to restart time-sensitive services',
        product='general',
    ),
    LogPattern(
        name='core_dump_generated',
        regex=r'(core dump|dumped core|coredump|systemd-coredump|Process.*dumping core)',
        severity='MEDIUM',
        category='system',
        description='A process crashed and generated a core dump. This indicates a software bug (segfault, abort, assertion failure). If it is a critical service, it may have restarted or be down.',
        solution_hint='1. coredumpctl list — see recent dumps\n2. coredumpctl info <PID> — get details\n3. coredumpctl debug <PID> — open in gdb\n4. Check if service auto-restarted: systemctl status\n5. Report to vendor with core dump and logs\n6. Check if known bug in current version',
        product='general',
    ),
    LogPattern(
        name='entropy_pool_exhausted',
        regex=r'(random.*pool.*exhausted|urandom.*warning|getrandom.*blocked|entropy.*insufficient|random: crng init done)',
        severity='MEDIUM',
        category='system',
        description='System random number pool is exhausted or not yet initialized. Cryptographic operations (SSH, TLS, key generation) may block or use weak randomness. Common in VMs without hardware RNG.',
        solution_hint='1. cat /proc/sys/kernel/random/entropy_avail\n2. Install: yum install rng-tools\n3. Enable: systemctl enable --now rngd\n4. For VMs: add virtio-rng device\n5. Check: cat /sys/devices/virtual/misc/hw_random/rng_available\n6. Alternative: install haveged daemon',
        product='general',
    ),


    # ====================================================================
    # APPLICATION PATTERNS (4 new)
    # ====================================================================
    LogPattern(
        name='mysql_replication_broken',
        regex=r'(Slave.*SQL.*error|replica.*stopped|replication.*broken|Seconds_Behind_Master.*NULL|Last_SQL_Error)',
        severity='CRITICAL',
        category='application',
        description='MySQL/MariaDB replication is broken. The replica is no longer receiving updates from the primary. Data divergence is growing every second. Applications reading from replica will serve stale data.',
        solution_hint='1. SHOW SLAVE STATUS\\G — check Last_SQL_Error\n2. If duplicate key: SET GLOBAL sql_slave_skip_counter = 1; START SLAVE;\n3. If position lost: CHANGE MASTER with correct GTID\n4. Check network to primary: telnet <primary> 3306\n5. If badly diverged: rebuild replica from backup\n6. Monitor Seconds_Behind_Master after fix',
        product='general',
    ),
    LogPattern(
        name='elasticsearch_cluster_red',
        regex=r'(cluster health.*red|ClusterBlockException|unassigned.*shard|index.*read.only|FORBIDDEN/12/index read-only)',
        severity='CRITICAL',
        category='application',
        description='Elasticsearch cluster is in RED state — primary shards are unassigned. Data is being lost or queries are returning incomplete results. Usually caused by node failure or disk full.',
        solution_hint='1. curl localhost:9200/_cluster/health?pretty\n2. curl localhost:9200/_cat/shards?v&h=index,shard,prirep,state,unassigned.reason\n3. If disk full: curl -XPUT localhost:9200/_all/_settings -d \'{"index.blocks.read_only_allow_delete": null}\'\n4. Clear disk space\n5. Check node status: curl localhost:9200/_cat/nodes?v',
        product='general',
    ),
    LogPattern(
        name='redis_maxmemory_reached',
        regex=r'(maxmemory.*reached|OOM command not allowed|Can\'t save in background|redis.*MISCONF|used_memory.*exceeds)',
        severity='HIGH',
        category='application',
        description='Redis has hit its memory limit. Write operations are being rejected. Applications relying on Redis for caching or queuing will fail. Background saves may also be failing.',
        solution_hint='1. redis-cli INFO memory — check used_memory\n2. redis-cli CONFIG SET maxmemory <higher>\n3. Set eviction policy: CONFIG SET maxmemory-policy allkeys-lru\n4. Check for key bloat: redis-cli --bigkeys\n5. Consider Redis cluster for scaling\n6. Monitor: DBSIZE and INFO memory regularly',
        product='general',
    ),
    LogPattern(
        name='nginx_upstream_timeout',
        regex=r'(upstream timed out|upstream prematurely closed|no live upstreams|connect\(\) failed.*upstream|upstream.*connection refused)',
        severity='HIGH',
        category='application',
        description='Nginx cannot reach its backend/upstream servers. Users are seeing 502/504 errors. The backend application is either down, overloaded, or unreachable.',
        solution_hint='1. Check backend: systemctl status <app>\n2. Test directly: curl localhost:<backend_port>\n3. Check connections: ss -tlnp | grep <port>\n4. If overloaded: increase proxy_read_timeout\n5. Scale backend or add more upstream servers\n6. Check logs: /var/log/nginx/error.log',
        product='general',
    ),

    # ====================================================================
    # NETWORK PATTERNS (2 new)
    # ====================================================================
    LogPattern(
        name='tcp_connection_reset',
        regex=r'(Connection reset by peer|ECONNRESET|TCP.*reset|RST.*received|broken pipe)',
        severity='MEDIUM',
        category='network',
        description='TCP connection was forcibly reset by the remote end. This can indicate: remote service crashed, firewall killing idle connections, load balancer timeout, or network instability.',
        solution_hint='1. Check if remote service is running\n2. Check firewall timeout settings (conntrack)\n3. Enable TCP keepalive: sysctl net.ipv4.tcp_keepalive_time=300\n4. Check load balancer idle timeout settings\n5. If intermittent: check for MTU issues (ping -M do -s 1472)\n6. tcpdump for exact RST source',
        product='general',
    ),
    LogPattern(
        name='network_packet_loss',
        regex=r'(\d+% packet loss|packets? lost|rx_dropped|tx_dropped|RX errors:\s*[1-9]|TX errors:\s*[1-9])',
        severity='HIGH',
        category='network',
        description='Network packet loss or interface errors detected. Applications will experience retransmissions, slow connections, and timeouts. Can cause cluster split-brain if inter-node communication is affected.',
        solution_hint='1. ip -s link — check error counters\n2. ethtool -S <interface> — detailed NIC stats\n3. ping -c 100 <gateway> — measure loss\n4. Check cable/switch port: ethtool <interface>\n5. If bonding: cat /proc/net/bonding/bond0\n6. Check for duplex mismatch or speed issues',
        product='general',
    ),

    # ====================================================================
    # CLUSTER PATTERN (1 new)
    # ====================================================================
    LogPattern(
        name='pacemaker_maintenance_mode',
        regex=r'(maintenance-mode.*true|maintenance.*mode.*enabled|Maintenance mode.*active|is-managed.*false.*all)',
        severity='MEDIUM',
        category='cluster',
        description='Cluster is in maintenance mode — Pacemaker will NOT monitor, start, stop, or recover any resources. If a service fails, it stays failed. Often left on accidentally after maintenance.',
        solution_hint='1. pcs property show maintenance-mode\n2. If accidentally left on: pcs property set maintenance-mode=false\n3. Check individual resource maintenance: pcs resource show\n4. pcs resource manage <resource> — re-enable specific resource\n5. Verify all resources came back: pcs status\n6. Set alerts for maintenance mode duration',
        product='general',
    ),

    # ====================================================================
    # STORAGE PATTERN (1 new)
    # ====================================================================
    LogPattern(
        name='thin_pool_full',
        regex=r'(thin pool.*full|thin.*metadata.*full|pool.*out of space|dm-thin.*no space|WARNING.*pool.*is.*100)',
        severity='CRITICAL',
        category='storage',
        description='LVM thin pool is 100% full. ALL thin volumes in this pool are now frozen — IO will hang or error. VMs using thin LVs will pause. This is often the root cause of mysterious cluster-wide outages.',
        solution_hint='1. lvs — check data_percent and metadata_percent\n2. Emergency extend: lvextend -L +50G <vg>/<pool>\n3. If metadata full: lvextend --poolmetadatasize +1G\n4. Set autoextend: /etc/lvm/lvm.conf thin_pool_autoextend_threshold\n5. Remove old snapshots to free space\n6. Monitor: lvs -o+data_percent regularly',
        product='general',
    ),

    # ====================================================================
    # VME HEALTH MONITORING PATTERNS (10 new - from HPE official doc sd00006551)
    # ====================================================================
    LogPattern(
        name='morpheus_cpu_warning',
        regex=r'(morpheus.*cpu.*([5-9]\d|100)%|CPU.*usage.*warning|appliance.*cpu.*exceeded|System CPU.*([5-9]\d|100))',
        severity='HIGH',
        category='service',
        description='HPE VME appliance CPU usage exceeds 50% (official HPE warning threshold). Per HPE Health docs, this triggers yellow/warning state. If persistent, appliance needs CPU upgrade or workload reduction.',
        solution_hint='1. Check: Administration → Health → CPU section\n2. morpheus-ctl status — see if any service is spinning\n3. top -bn1 | head -20 — find top consumers\n4. Common causes: elasticsearch indexing, backup jobs, multiple concurrent provisions\n5. If persistent: upgrade appliance CPU allocation\n6. Check scheduled tasks overlap in Administration → Settings',
        product='Morpheus',
    ),
    LogPattern(
        name='morpheus_memory_warning',
        regex=r'(morpheus.*memory.*9[5-9]%|morpheus.*memory.*100%|System Memory.*usage.*9[5-9]|memory.*warning.*threshold)',
        severity='HIGH',
        category='service',
        description='HPE VME appliance memory usage above 95% (official HPE error threshold). Per HPE Health docs, this means the Morpheus JVM is consuming nearly all available RAM. Services may OOM.',
        solution_hint='1. Administration → Health → Memory section\n2. free -h on the appliance\n3. Check Morpheus JVM: morpheus-ctl tail morpheus-ui | grep -i heap\n4. If JVM is consuming too much: adjust JAVA_OPTS in /etc/morpheus/morpheus.rb\n5. Consider moving to HA multi-node architecture\n6. Restart morpheus-ui to clear memory leaks: morpheus-ctl restart morpheus-ui',
        product='Morpheus',
    ),
    LogPattern(
        name='morpheus_swap_warning',
        regex=r'(swap.*usage.*(6[0-9]|[7-9]\d|100)%|SwapUsed.*([6-9]\d|100)|morpheus.*swap.*exceed|Used Swap.*(6[0-9]|[7-9]\d))',
        severity='HIGH',
        category='service',
        description='HPE VME appliance swap usage exceeds 60% (official HPE warning threshold). System is memory-starved and swapping heavily. All operations (UI, API, DB) will be slow. Swap indicates insufficient RAM.',
        solution_hint='1. Administration → Health → Memory → Used Swap\n2. free -h — check swap used vs total\n3. Find swap hogs: for p in /proc/[0-9]*/status; do awk "/VmSwap|Name/{printf $2 \" \"}END{print \"\"}" $p; done | sort -k2 -nr | head\n4. Solution: ADD MORE RAM to the appliance VM\n5. Temporary: morpheus-ctl restart to free leaked memory\n6. Tune vm.swappiness=10 in /etc/sysctl.conf',
        product='Morpheus',
    ),
    LogPattern(
        name='morpheus_storage_warning',
        regex=r'(filesystem.*"/".*([8-9]\d|100)%|root.*partition.*([8-9]\d|100)%|morpheus.*storage.*warning|/opt/morpheus.*(8[0-9]|9[0-9]|100)%)',
        severity='CRITICAL',
        category='service',
        description='HPE VME appliance root filesystem exceeds 80% (warning) or 90% (error). Per HPE Health docs, this is Storage health indicator. MySQL and Elasticsearch will crash if disk fills completely.',
        solution_hint='1. Administration → Health → Storage indicator\n2. df -h / && df -h /opt/morpheus\n3. Clean: morpheus-ctl cleanse (removes old temp files)\n4. Rotate logs: morpheus-ctl log-rotate\n5. Common culprits: /opt/morpheus/backups, /var/log/morpheus, ES data\n6. Extend disk: lvextend + resize2fs/xfs_growfs\n7. Set up automated cleanup in Administration → Settings → Retention',
        product='Morpheus',
    ),
    LogPattern(
        name='morpheus_db_connections_exceeded',
        regex=r'(max.*connections.*exceeded|Too many connections|max_connections|connection pool.*exhaust|database.*connection.*refused|Aborted connection.*max)',
        severity='CRITICAL',
        category='service',
        description='HPE VME database (MySQL) max connections exceeded. Per HPE Health docs, this triggers warning state. New operations (UI, API, provisioning) will fail. Usually caused by connection leaks or sudden load spike.',
        solution_hint='1. Administration → Health → Database section\n2. Check Max Used Connections vs Max Connections\n3. mysql -e "SHOW STATUS LIKE \'Threads_connected\'"\n4. mysql -e "SHOW STATUS LIKE \'Max_used_connections\'"\n5. Increase: set global max_connections=500 (in /etc/morpheus/morpheus.rb)\n6. morpheus-ctl reconfigure && morpheus-ctl restart mysql\n7. Check for connection leaks: SHOW PROCESSLIST',
        product='Morpheus',
    ),
    LogPattern(
        name='morpheus_db_slow_queries',
        regex=r'(slow.*quer|Slow_queries.*[1-9]|query.*took.*\d{4,}ms|long_query_time|Query_time:.*[5-9]\d)',
        severity='MEDIUM',
        category='service',
        description='HPE VME database reporting slow queries. Per HPE Health docs, slow queries trigger warning state. UI will feel sluggish. Usually caused by missing indexes, table locks, or undersized buffer pool.',
        solution_hint='1. Administration → Health → Database → Slow Queries count\n2. Check slow query log: /var/log/morpheus/mysql/slow.log\n3. EXPLAIN <slow_query> — check for full table scans\n4. Increase InnoDB buffer pool: /etc/morpheus/morpheus.rb → mysql[\'innodb_buffer_pool_size\'] = \'4G\'\n5. morpheus-ctl reconfigure\n6. Check lock waits: SHOW ENGINE INNODB STATUS',
        product='Morpheus',
    ),
    LogPattern(
        name='morpheus_elastic_unhealthy',
        regex=r'(elasticsearch.*status.*yellow|elasticsearch.*status.*red|elastic.*health.*warning|index.*unassigned.*shard|elastic.*cluster.*red|ClusterBlockException)',
        severity='HIGH',
        category='service',
        description='HPE VME Elasticsearch indices not reporting "green" health. Per HPE Health docs, any non-green index triggers warning. Yellow = missing replicas (OK in single-node). Red = data loss/unavailable shards.',
        solution_hint='1. Administration → Health → Elastic section\n2. Check: curl -s localhost:9200/_cluster/health?pretty\n3. Find problem index: curl -s localhost:9200/_cat/indices?v&health=red\n4. If yellow on single-node: normal (no replicas)\n5. If red: curl -XPOST localhost:9200/_cluster/reroute?retry_failed=true\n6. Check disk space: ES needs >15% free\n7. If unassigned shards: check /var/log/morpheus/elasticsearch/current',
        product='Morpheus',
    ),
    LogPattern(
        name='morpheus_queue_backup',
        regex=r'(queue.*message.*count.*(1\d{3,}|[2-9]\d{3,})|rabbitmq.*queue.*overflow|rabbitmq.*messages.*pile|queue.*1000.*messages|rabbitmq.*busy)',
        severity='HIGH',
        category='service',
        description='HPE VME RabbitMQ queues have >1000 messages backed up. Per HPE Health docs, this is error state. Messages are not being consumed fast enough — provisioning tasks, stats collection, and events will be delayed or lost.',
        solution_hint='1. Administration → Health → Queues section\n2. List queues: morpheus-ctl rabbitmq-ctl list_queues name messages\n3. Find stuck queues: look for queues with high message count\n4. Common cause: morpheus-ui or worker service crashed/stuck\n5. Restart consumers: morpheus-ctl restart morpheus-ui\n6. If queue is too large (>100k): purge dead queues\n7. morpheus-ctl rabbitmq-ctl purge_queue <queue_name>',
        product='Morpheus',
    ),
    LogPattern(
        name='morpheus_health_check_failed',
        regex=r'(health.*check.*fail|health.*status.*error|appliance.*health.*critical|morpheus-ctl.*status.*dead|morpheus.*service.*not running)',
        severity='CRITICAL',
        category='service',
        description='HPE VME overall health check failed. One or more critical services (MySQL, Elasticsearch, RabbitMQ, morpheus-ui) are down. The appliance may be partially or fully non-functional.',
        solution_hint='1. morpheus-ctl status — identify dead services\n2. morpheus-ctl tail <service> — check logs for crash reason\n3. Common: morpheus-ctl restart morpheus-ui (OOM or JVM crash)\n4. If MySQL: check /var/log/morpheus/mysql/error.log\n5. If ES: check /var/log/morpheus/elasticsearch/current\n6. Nuclear option: morpheus-ctl restart (restarts all services)\n7. Check disk space FIRST: df -h (most common root cause)',
        product='Morpheus',
    ),
    LogPattern(
        name='morpheus_appliance_reconfigure_failed',
        regex=r'(morpheus-ctl reconfigure.*fail|reconfigure.*error|chef.*error.*morpheus|morpheus-ctl.*FATAL)',
        severity='CRITICAL',
        category='service',
        description='HPE VME appliance reconfigure command failed. Configuration changes were not applied. This can leave the appliance in an inconsistent state where services reference different configs.',
        solution_hint='1. Check full output of reconfigure for the FIRST error\n2. Common causes: disk full, permission issues, DNS resolution failure\n3. Verify /etc/morpheus/morpheus.rb syntax\n4. Check: morpheus-ctl cleanse (clean temp files)\n5. Try again: morpheus-ctl reconfigure\n6. If SSL issue: check certificate paths in morpheus.rb\n7. Last resort: morpheus-ctl reconfigure --force',
        product='Morpheus',
    ),
    # === Common Production Log Patterns (Jira Ticket Keywords) ===
    LogPattern(
        name='connection_refused',
        regex=r'(Connection refused|ECONNREFUSED|connect.*refused|Cannot.*connect.*port|dial.*connection refused|Failed.*to connect)',
        severity='HIGH',
        category='network',
        description='Connection refused — the target service/port is not listening. Either the service is down, crashed, binding to wrong interface, or firewall is blocking.',
        solution_hint='1. Check if service is running: systemctl status <service>\n2. Check port binding: ss -tulpn | grep :<port>\n3. Check firewall: iptables -L -n | grep <port>\n4. If remote: verify network path: nc -zv <host> <port>\n5. Check service logs for crash: journalctl -u <service> -n 50',
        product='general',
    ),
    LogPattern(
        name='connection_timeout',
        regex=r'(Connection timed out|ETIMEDOUT|context deadline exceeded|i/o timeout|connect timeout|read.*timeout|operation.*timed out)',
        severity='HIGH',
        category='network',
        description='Connection timeout — cannot reach the target host/port within the allowed time. Usually indicates network path issues, firewall dropping packets (not rejecting), DNS issues, or target server overloaded.',
        solution_hint='1. Test connectivity: nc -zv <host> <port> (or telnet)\n2. Check DNS: dig <hostname>\n3. Check route: traceroute <host>\n4. Check firewall (dropped vs rejected): iptables -L -n\n5. Check target server load: uptime, top on remote',
        product='general',
    ),
    LogPattern(
        name='tls_certificate_error',
        regex=r'(certificate.*expired|x509.*certificate|SSL.*handshake.*fail|cert.*verify failed|certificate.*not valid|TLS.*error|unable to get local issuer)',
        severity='HIGH',
        category='security',
        description='TLS/SSL certificate error — certificate expired, not trusted, hostname mismatch, or handshake failure. Affects HTTPS connections, API calls, and agent communication.',
        solution_hint='1. Check cert expiry: openssl s_client -connect <host>:443 | openssl x509 -noout -dates\n2. Check cert chain: openssl s_client -connect <host>:443 -showcerts\n3. If expired: renew/replace certificate\n4. If CA not trusted: add CA cert to system trust store\n5. If hostname mismatch: check SAN/CN vs actual hostname',
        product='general',
    ),
    LogPattern(
        name='dns_resolution_failure',
        regex=r'(could not resolve|NXDOMAIN|Name or service not known|Temporary failure in name resolution|DNS.*resolution.*fail|getaddrinfo.*failed|no.*such.*host)',
        severity='HIGH',
        category='network',
        description='DNS resolution failure — cannot resolve hostname to IP address. This blocks all connectivity to the target and can cascade to service failures.',
        solution_hint='1. Test DNS: dig <hostname> or nslookup <hostname>\n2. Check resolvers: cat /etc/resolv.conf\n3. Test specific resolver: dig @<dns-server> <hostname>\n4. Check if hostname is correct (typo?)\n5. If internal DNS: verify forward/reverse zone entries',
        product='general',
    ),
    LogPattern(
        name='too_many_open_files',
        regex=r'(Too many open files|EMFILE|ENFILE|file.*descriptor.*limit|fd.*exhausted|ulimit.*exceeded)',
        severity='HIGH',
        category='system',
        description='File descriptor limit reached — the process has exhausted its allowed file descriptors. This causes connection failures, file open errors, and service degradation.',
        solution_hint='1. Check current limits: ulimit -n (per-process), cat /proc/sys/fs/file-nr (system)\n2. Find FD count per process: lsof -p <PID> | wc -l\n3. Increase limit: edit /etc/security/limits.conf (nofile soft/hard)\n4. For systemd services: add LimitNOFILE=65536 in unit file\n5. Find FD leakers: ls -la /proc/<PID>/fd | wc -l for each suspect',
        product='general',
    ),
    LogPattern(
        name='disk_space_exhausted',
        regex=r'(No space left on device|ENOSPC|disk.*full|filesystem.*full|write.*failed.*space|cannot.*allocate.*space|Disk quota exceeded)',
        severity='CRITICAL',
        category='filesystem',
        description='Disk space exhausted — no free space remaining on the filesystem. Services will fail to write, logs will stop, databases will crash, and VMs may pause.',
        solution_hint='1. Check space: df -h (all mounts), df -i (inodes) — READ-ONLY, safe\n2. Find largest consumers: du -sh /* | sort -rh | head\n⚠️ PRECAUTION: On GFS2 shared filesystems, deleting files while other nodes are accessing them can cause DLM lock contention. Coordinate with team before large deletions on shared storage.\n3. Quick wins: journalctl --vacuum-size=100M, truncate large logs (safe on local fs)\n4. Find deleted-but-open files: lsof +L1 | grep deleted (space freed only when process closes file)\n5. If /var/log full: rotate logs, check for runaway process\n6. For thin-provisioned storage: check ARRAY-LEVEL pool (df shows virtual free, array may be full)',
        product='general',
    ),
    LogPattern(
        name='read_only_filesystem',
        regex=r'(Read-only file system|EROFS|remount.*read.?only|filesystem.*read.?only|mount.*ro|ext4.*error.*remounting.*read)',
        severity='CRITICAL',
        category='filesystem',
        description='Filesystem remounted as read-only — usually triggered by disk I/O errors, filesystem corruption, or metadata inconsistency. All write operations will fail.',
        solution_hint='1. Check dmesg for underlying I/O errors: dmesg | grep -i error\n2. Check disk health: smartctl -a /dev/sdX\n⚠️ PRECAUTION: Do NOT blindly run fsck on a mounted filesystem! Unmount first. For GFS2: unmount on ALL nodes before fsck.\n3. If ext4: umount first, then e2fsck -n /dev/sdX (DRY-RUN — read-only check first)\n4. If dry-run shows errors: e2fsck -y /dev/sdX (WARNING: may delete corrupted files)\n5. If GFS2: check for gfs2 withdraw messages, fix storage paths first\n6. If multipath: check path status — read-only often means reservation conflict or path loss',
        product='general',
    ),
    LogPattern(
        name='permission_denied_generic',
        regex=r'(Permission denied|EACCES|operation not permitted|EPERM|Access denied|cannot.*permission|insufficient.*privilege)',
        severity='MEDIUM',
        category='security',
        description='Permission denied — a process cannot access a resource due to file permissions, SELinux policy, capabilities, or ownership issues.',
        solution_hint='1. Check file permissions: ls -la <path>\n2. Check SELinux: getenforce, ausearch -m avc -ts recent\n3. Check process user: id (who am I running as?)\n4. Check capabilities: getcap <binary>\n5. If SELinux: restorecon -Rv <path> or audit2allow to create policy',
        product='general',
    ),
    LogPattern(
        name='segfault_crash',
        regex=r'(segfault at|SIGSEGV|segmentation fault|Segmentation violation|trapping.*segfault|signal.*11)',
        severity='HIGH',
        category='application',
        description='Segmentation fault — a process accessed invalid memory and crashed. This is a software bug (or occasionally hardware memory issue). Core dump may be available for analysis.',
        solution_hint='1. Check coredump: coredumpctl list, coredumpctl info <PID>\n2. Get backtrace: coredumpctl gdb <PID> → bt\n3. Check if reproducible or one-time\n4. If hardware suspected: run memtest86\n5. Update the affected software to latest version',
        product='general',
    ),
    LogPattern(
        name='process_killed_signal',
        regex=r'(Killed.*process|OOM.*killer|exit.*code.*137|killed by signal.*9|SIGKILL|oom_reaper.*task)',
        severity='CRITICAL',
        category='memory',
        description='Process killed by OOM killer or SIGKILL — the system ran out of memory and killed a process to recover. Exit code 137 = killed by signal 9.',
        solution_hint='1. Check OOM events: dmesg | grep -i \"oom\\|killed process\"\n2. Find what was killed: dmesg | grep \"Killed process\" (shows PID and RSS)\n3. Check memory: free -m at the time (or sar -r)\n4. Protect critical processes: OOMScoreAdjust=-1000 in systemd unit\n5. Add more RAM or reduce workload',
        product='general',
    ),
    LogPattern(
        name='inode_exhaustion',
        regex=r'(No space left on device.*inode|inode.*full|inode.*exhausted|no free inodes|cannot create.*No space)',
        severity='HIGH',
        category='filesystem',
        description='Inode exhaustion — the filesystem has no free inodes (file entries) even though disk space may be available. Cannot create new files until inodes are freed.',
        solution_hint='1. Check inodes: df -i (look for 100% IUse%)\n2. Find directories with many small files: find / -xdev -printf \"%h\\n\" | sort | uniq -c | sort -rn | head -20\n3. Clean up small temp files, old sessions, email queue\n4. Recreate filesystem with more inodes if chronic: mkfs -N <count>\n5. Common culprits: /tmp, /var/spool, session files, pip/npm cache',
        product='general',
    ),
    LogPattern(
        name='http_5xx_error',
        regex=r'(HTTP.*5\d\d|status.*5\d\d|Internal Server Error|502 Bad Gateway|503 Service Unavailable|504 Gateway Timeout)',
        severity='HIGH',
        category='application',
        description='HTTP 5xx server error — the application or upstream service returned an error. 502=proxy cannot reach backend, 503=service overloaded/down, 504=upstream timeout.',
        solution_hint='1. Check application logs: journalctl -u <service>\n2. 502: backend service is down → check status, restart\n3. 503: overloaded → check connections, scale up\n4. 504: upstream timeout → check slow queries, external deps\n5. Check if recent deploy caused regression',
        product='general',
    ),
    LogPattern(
        name='java_exception_oom',
        regex=r'(java\.lang\.OutOfMemoryError|heap space|GC overhead limit|PermGen space|Metaspace|Java heap space|JVM.*out of memory)',
        severity='CRITICAL',
        category='application',
        description='Java OutOfMemoryError — the JVM has exhausted its heap memory. This typically crashes the application. Common in Morpheus (Grails/Java), Elasticsearch, and Tomcat.',
        solution_hint='1. Check JVM heap size: jcmd <PID> VM.flags | grep -i heap\n2. Increase heap: -Xmx4g (set max heap to 4GB)\n3. Check for memory leaks: jmap -histo:live <PID> | head -20\n4. For Morpheus: edit JAVA_OPTS in morpheus.rb\n5. Generate heap dump for analysis: jmap -dump:live,format=b,file=heap.hprof <PID>',
        product='Morpheus',
    ),
    LogPattern(
        name='null_pointer_exception',
        regex=r'(NullPointerException|NullReferenceException|null.*pointer|cannot.*invoke.*null|Cannot get property.*on null)',
        severity='HIGH',
        category='application',
        description='NullPointerException — code attempted to use a null reference. In Morpheus context, this often occurs when referencing deleted resources (images, volumes, networks).',
        solution_hint='1. Check stack trace for the exact method/line\n2. Common in Morpheus: deleted Virtual Image referenced during clone/restore\n3. Workaround: use API with imageId:-1 to bypass validation\n4. Check if referenced resource still exists in DB\n5. Upgrade to version with fix if known bug',
        product='Morpheus',
    ),
    LogPattern(
        name='hibernate_locking_exception',
        regex=r'(OptimisticLockingFailure|StaleObjectState|Batch update returned unexpected row count|actual row count.*0.*expected.*1|Hibernate.*lock.*exception)',
        severity='HIGH',
        category='application',
        description='Hibernate/Database optimistic locking failure — a database record was modified or deleted by another process during a transaction. Common during storage migration and concurrent operations in Morpheus.',
        solution_hint='1. This is a concurrency/race condition in the application\n2. Retry the operation (often succeeds on second attempt)\n3. If during storage migration: some disks may not have migrated\n4. Check for orphaned DB records: compare DB vs actual infrastructure\n5. Report to engineering with full stack trace',
        product='Morpheus',
    ),
    LogPattern(
        name='morpheus_provisioning_exceeds_license',
        regex=r'(Provisioning request exceeds.*maximum|license.*limit.*exceeded|socket.*limit.*reached|Please check your license|license.*not.*valid)',
        severity='HIGH',
        category='application',
        description='VME provisioning blocked by license limits — the requested operation would exceed the licensed socket/VM count. Cannot provision new VMs until license is upgraded or workloads are reduced.',
        solution_hint='1. Check current license usage: Administration → License\n2. Compare active sockets vs licensed count\n3. Decommission unused VMs to free capacity\n4. Upgrade license if at genuine capacity\n5. Note: stacked licenses are supported in VME 8.0.4+',
        product='VME',
    ),
    LogPattern(
        name='morpheus_ui_not_loading',
        regex=r'(morpheus-ui.*not.*loading|morpheus-ui.*timeout|morpheus-ui.*stopped|morpheus-ctl.*stop.*timeout|HTTP Status 404.*morpheus)',
        severity='CRITICAL',
        category='service',
        description='Morpheus/VME UI is not loading — the web interface is inaccessible. May show HTTP 404, blank page, or timeout. Critical as all management operations are blocked.',
        solution_hint='1. Check service: morpheus-ctl status morpheus-ui\n2. Restart: morpheus-ctl restart morpheus-ui\n3. If stop times out: morpheus-ctl kill morpheus-ui, then start\n4. Check logs: morpheus-ctl tail morpheus-ui\n5. Check disk space: df -h (full disk prevents WAR deployment)\n6. If post-upgrade: morpheus-ctl reconfigure',
        product='Morpheus',
    ),
    LogPattern(
        name='morpheus_cloud_sync_failure',
        regex=r'(cloud.*sync.*fail|inventory.*sync.*error|sync.*timeout.*cloud|cloud.*refresh.*fail|Cannot.*enumerate.*cloud)',
        severity='MEDIUM',
        category='service',
        description='Morpheus cloud sync/inventory refresh failure — VME cannot synchronize state with the underlying infrastructure. VMs may show stale status in UI.',
        solution_hint='1. Check cloud connectivity: Infrastructure → Clouds → status\n2. Verify credentials: check if password/token has expired\n3. Check network: can Morpheus reach hypervisor API?\n4. Manual sync: Infrastructure → Clouds → Refresh\n5. Check morpheus-ui logs for specific sync error',
        product='Morpheus',
    ),
    LogPattern(
        name='morpheus_instance_stuck_provisioning',
        regex=r'(Instance.*stuck.*provisioning|provisioning.*state.*indefinite|stuck.*Provisioning|provision.*never.*complete|cloud-init.*complete.*agent.*not)',
        severity='MEDIUM',
        category='service',
        description='Morpheus Instance stuck in Provisioning state — the VM deployed but Morpheus agent cannot report back. Usually network connectivity issue from VM to appliance.',
        solution_hint='1. Check VM network: can VM reach Morpheus appliance on port 443?\n2. From VM: curl -k https://<appliance>/api/health\n3. Check agent: systemctl status morpheus-node-agent\n4. Check firewall between VM and appliance\n5. Manual complete via API if network fixed: POST /api/instances/<id>/complete-provisioning',
        product='Morpheus',
    ),
    LogPattern(
        name='multipath_path_checker_timeout',
        regex=r'(path checkers took longer than|multipathd.*checker.*timeout|checker.*timed out|multipathd.*path.*check.*slow|path.*check.*exceeded)',
        severity='HIGH',
        category='storage',
        description='Multipath path checker timeout — multipathd path health checks are taking longer than allowed. Indicates severe storage I/O congestion or too many LUNs.',
        solution_hint='1. Check LUN count: multipath -ll | grep -c mpath\n2. If excessive LUNs (>500): likely orphaned LUN accumulation\n3. Check storage I/O: iostat -x 1 3\n4. If many faulty paths: multipathd show paths format \"%d %s %T\"\n5. Reduce LUN count: remove orphaned/unused LUNs from host set',
        product='Alletra',
    ),
    LogPattern(
        name='multipath_path_failed',
        regex=r'(multipath.*path.*failed|multipathd.*failed path|remaining active paths:\s*\d|path.*mark.*failed|sd\w+.*offline|checker.*failed.*path)',
        severity='HIGH',
        category='storage',
        description='Multipath path has been marked as failed. If the last active path fails, all I/O to that LUN will stop. VMs using this storage will hang or crash.',
        solution_hint='1. Check remaining paths: multipath -ll <device> (READ-ONLY — safe diagnostic command)\n2. If 0 active paths: CRITICAL — all I/O will fail, VMs will hang\n3. Check fabric connectivity: FC port_state, iSCSI sessions\n⚠️ PRECAUTION: Do NOT remove/delete SCSI devices (echo 1 > /sys/block/sdX/device/delete) while VMs are actively using the LUN. This will cause immediate I/O failure and potential data corruption. Only remove confirmed-dead paths.\n4. Rescan (safe): echo 1 > /sys/block/sd<X>/device/rescan\n5. Check array: is the LUN still presented to this host?',
        product='general',
    ),
    LogPattern(
        name='multipathd_startup_hang',
        regex=r'(multipathd.*start.*fail|multipathd.*timeout|multipathd.*killed.*systemd|multipathd.*hang|Job for multipathd.*failed.*timeout)',
        severity='CRITICAL',
        category='storage',
        description='Multipathd service hangs during startup — killed by systemd after ~3 minute timeout. Usually caused by non-responding paths that multipathd tries to check during initialization.',
        solution_hint='1. Check for non-responding paths: sg_inq /dev/sd* (find hanging devices)\n2. Remove stale/dead SCSI devices: echo 1 > /sys/block/sd<X>/device/delete\n3. Start multipathd after cleaning dead paths\n4. If too many LUNs: remove orphaned LUN mappings from array\n5. Use multipathd -k interactively to troubleshoot',
        product='general',
    ),
    LogPattern(
        name='gfs2_journal_recovery',
        regex=r'(GFS2.*journal.*recover|GFS2.*Trying to acquire journal lock|journal.*recovery.*failed|jid=\d+.*Trying|GFS2.*journal.*replay)',
        severity='HIGH',
        category='filesystem',
        description='GFS2 journal recovery in progress — replaying journal entries from a node that left the cluster. During recovery, access to the filesystem may stall.',
        solution_hint='1. Wait for recovery to complete (check dmesg for completion message)\n2. If \"Trying to acquire journal lock...Busy\": another node is holding it\n3. Check cluster membership: pcs status (is the failed node still listed?)\n4. If stuck: fence the failed node to release journal lock\n⚠️ WARNING: Do NOT run fsck.gfs2 while journal recovery is in progress! Wait for recovery to complete or fail before considering fsck. Running fsck during active recovery can cause additional corruption.\n5. After recovery: verify GFS2 is RW: touch <mount>/test && rm <mount>/test\n6. If recovery fails and mount is broken: unmount on all nodes, then fsck.gfs2 -n (dry-run first)',
        product='GFS2',
    ),
    LogPattern(
        name='gfs2_too_many_journals',
        regex=r'(Too many nodes.*mounting|no free journals|GFS2.*no.*journal.*available|journal.*count.*exceeded|GFS2.*lock_dlm.*mount.*fail.*journal)',
        severity='HIGH',
        category='filesystem',
        description='GFS2 mount failure — no free journals available. The filesystem was created with a limited number of journals and all are in use or locked by previously-fenced nodes.',
        solution_hint='1. Check journal count: gfs2_edit -p master <device> | grep journals\n2. Check who holds journals: dlm_tool ls <fsname>\n3. If node was fenced: its journal may still be locked\n4. Free journal: fence the dead node properly, let recovery complete\n5. Add journals: gfs2_jadd -j 1 <mount> (if additional journal needed)',
        product='GFS2',
    ),
    LogPattern(
        name='dlm_stateful_merge',
        regex=r'(dlm.*stateful merge|dlm.*kill.*node|dlm.*fence.*merge|DLM.*detected.*merge|dlm_controld.*fence_all)',
        severity='CRITICAL',
        category='cluster',
        description='DLM detected a stateful merge condition — two cluster partitions rejoin with divergent lock states. DLM will KILL ALL NODES to prevent data corruption. This is catastrophic for all cluster services.',
        solution_hint='1. ALL NODES WILL GO DOWN — this is expected behavior to prevent corruption\n2. After all nodes restart: verify corosync reforms cleanly\n3. Check GFS2 journals replay correctly\n4. Investigate root cause: what caused the initial cluster split?\n5. Add redundant corosync rings to prevent future splits\n6. Add Restart=on-failure to corosync.service on all nodes',
        product='DLM',
    ),
    LogPattern(
        name='vm_unknown_state',
        regex=r'(VM.*Unknown.*state|Instance.*Unknown|VM.*state.*unknown|server.*status.*unknown|virsh.*list.*not.*present|VM.*not found on.*host)',
        severity='HIGH',
        category='virtualization',
        description='VM in Unknown state — Morpheus cannot determine the VM state. The VM may have been destroyed, migrated without Morpheus knowledge, or the hypervisor lost track of it.',
        solution_hint='1. Check on all hosts: virsh list --all on EVERY cluster node\n2. If found on wrong host: update Morpheus server record\n3. If not found anywhere: check if disk still exists (qemu-img info)\n4. Check if recent migration/failover occurred\n5. If disk exists: re-define VM from XML and register in Morpheus',
        product='VME',
    ),
    LogPattern(
        name='vm_shutdown_unexpected',
        regex=r'(VM.*unexpect.*shutdown|VM.*powered off.*unexpect|Instance.*stopped.*automat|unexpected.*power.*off|virsh.*shutdown.*without.*request)',
        severity='HIGH',
        category='virtualization',
        description='VM was unexpectedly shut down — either by heartbeat isolation protection, OOM killer, storage failure, or administrative action not initiated through Morpheus.',
        solution_hint='1. Check heartbeat agent logs: was isolation protection triggered?\n2. Check dmesg for OOM: dmesg | grep -i oom\n3. Check storage: multipath -ll (any failed paths?)\n4. Check host load: was CPU/memory exhausted?\n5. Check if another admin issued virsh shutdown/destroy',
        product='VME',
    ),
    LogPattern(
        name='heartbeat_write_failure',
        regex=r'(Unable to Write Heartbeat|heartbeat.*write.*fail|hb\.properties.*fail|heartbeat.*datastore.*unhealthy|All heartbeat.*paths.*unhealthy|File exists check timed out)',
        severity='CRITICAL',
        category='cluster',
        description='Heartbeat write failure — the VME agent cannot write to heartbeat datastore. After 6 consecutive failures (MAX_ISOLATION_FAIL_COUNT=6, ~2 minutes), ALL VMs will be automatically shut down to protect data integrity.',
        solution_hint='1. URGENT: Fix within 2 minutes or all VMs will be shut down!\n2. Check GFS2 mount: mount | grep <heartbeat-datastore>\n3. Check storage paths: multipath -ll\n4. Check for D-state processes: ps aux | grep \" D \"\n5. If already triggered: VMs need manual restart after fixing storage\n6. Check: ls -la <datastore>/mvm-hb/<cluster>/<host>/hb.properties',
        product='VME',
    ),
    LogPattern(
        name='morpheus_ensureagentmount_failure',
        regex=r'(ensureAgentMount.*failed|agent mount.*register.*fail|ensureAgentMount.*remount|mount.*agent.*error|datastore.*refresh.*timeout)',
        severity='HIGH',
        category='storage',
        description='Morpheus agent mount failure — the VME agent cannot mount or remount a datastore. This typically occurs after a node reboot when shared LUN access is disrupted.',
        solution_hint='1. Check multipath status: multipath -ll <device>\n2. Check if LUN is still presented: sg_inq /dev/mapper/<device>\n3. Check for stale SCSI PR keys: mpathpersist -i -k /dev/mapper/<device>\n4. Rescan SCSI bus: rescan-scsi-bus.sh -r\n5. Wait for retry (agent retries periodically)',
        product='VME',
    ),
    # === Additional Cluster/Corosync/DLM Patterns ===
    LogPattern(
        name='corosync_retransmit_storm',
        regex=r'(corosync.*retransmit|corosync.*not.*acknowledg|TOTEM.*retransmit.*list|corosync.*missed.*message|retransmit.*timeout.*corosync)',
        severity='HIGH',
        category='cluster',
        description='Corosync message retransmission storm — cluster communication is degraded with excessive message retransmissions. This precedes token loss and potential fencing.',
        solution_hint='1. Check network quality between nodes: ping -c 100 -i 0.01 <other-node>\n2. Check for packet loss: ip -s link show <cluster-iface>\n3. Check corosync ring status: corosync-cfgtool -s\n4. If bond: check slave health: cat /proc/net/bonding/bond0\n5. Increase token timeout if retransmits are transient: token: 5000 in corosync.conf',
        product='Corosync',
    ),
    LogPattern(
        name='corosync_exit_abnormal',
        regex=r'(corosync.*exit.*status.*[1-9]|Corosync Cluster Engine exiting with status|corosync.*SIGABRT|corosync.*terminated|corosync.*service.*failed)',
        severity='CRITICAL',
        category='cluster',
        description='Corosync process exited abnormally. If Restart= is not configured in systemd unit, corosync will stay dead and pacemaker cannot manage resources. All cluster services will be impacted.',
        solution_hint='1. Check if corosync is running: systemctl status corosync\n2. If dead: systemctl start corosync\n3. Check exit reason: journalctl -u corosync --since \"5 min ago\"\n4. Add Restart=on-failure to corosync.service unit to prevent this\n5. If DLM killed corosync: check for lockspace merge condition',
        product='Corosync',
    ),
    LogPattern(
        name='dlm_lockspace_recovery',
        regex=r'(dlm.*recovery|dlm.*lockspace.*recover|DLM.*recovery.*done|dlm.*new.*master|dlm.*recover.*locks|dlm_controld.*recovery)',
        severity='HIGH',
        category='cluster',
        description='DLM lockspace recovery in progress — the distributed lock manager is recovering after a node left the cluster. During recovery, GFS2 I/O may stall.',
        solution_hint='1. Wait for recovery to complete: dlm_tool status\n2. Check which node departed: pcs status, corosync-cmapctl | grep members\n3. Monitor GFS2 for stalls during recovery: check for D-state processes\n4. If recovery hangs: may need cluster-wide restart\n5. After recovery: verify GFS2 mount RW on all nodes',
        product='DLM',
    ),
    LogPattern(
        name='pacemaker_cib_error',
        regex=r'(CIB.*error|CIB.*update.*fail|cib.*connection.*lost|cib.*sync.*fail|High CIB load|CIB.*diff.*error|pacemaker-based.*error)',
        severity='HIGH',
        category='cluster',
        description='Pacemaker CIB (Cluster Information Base) error — cluster configuration database issue. May cause resource management failures or split-brain decisions.',
        solution_hint='1. Check CIB status: cibadmin --query\n2. Verify all nodes see same CIB: pcs status --full\n3. If "High CIB load": reduce frequency of resource operations\n4. If sync failure: check corosync connectivity between nodes\n5. Backup CIB: pcs config backup <name>',
        product='Pacemaker',
    ),
    LogPattern(
        name='pacemaker_resource_unmanaged',
        regex=r'(resource.*unmanaged|resource.*blocked|resource.*NOT.*managed|resource.*maintenance|resource.*target-role.*Stopped)',
        severity='MEDIUM',
        category='cluster',
        description='Pacemaker resource is unmanaged or blocked. The cluster will not start, stop, or monitor this resource until it is re-enabled.',
        solution_hint='1. Check resource state: pcs resource show <resource>\n2. Clear unmanaged state: pcs resource manage <resource>\n3. If blocked by constraint: pcs constraint show --full\n4. Clear ban constraints: pcs resource clear <resource>\n5. Cleanup: pcs resource cleanup <resource>',
        product='Pacemaker',
    ),
    LogPattern(
        name='fence_agent_timeout',
        regex=r'(fence.*agent.*timed out|stonith.*timeout|fence.*operation.*failed|Timed out waiting to power|Unable to obtain.*plug status|fencing.*failed.*target)',
        severity='CRITICAL',
        category='cluster',
        description='Fence agent (STONITH) operation timed out — the cluster cannot confirm that a node has been killed. This is extremely dangerous as it may lead to split-brain or VMs running on multiple hosts.',
        solution_hint='1. Check fence device accessibility: fence_<type> -o status -n <node>\n2. Verify credentials/ILO/IPMI connectivity\n3. Check if fence device is on same VLAN/subnet\n4. For fence_scsi: check if LUN registrations are valid\n5. URGENT: if fencing fails and node is truly down, manually power off via ILO',
        product='Pacemaker',
    ),
    # === Additional Network Patterns ===
    LogPattern(
        name='lacp_negotiation_failure',
        regex=r'(LACP.*negotiation.*fail|LACP.*partner.*timeout|802.3ad.*partner.*down|bond.*LACP.*rate.*timeout|team.*LACP.*expired)',
        severity='HIGH',
        category='network',
        description='LACP link aggregation negotiation failure — the bonded interface cannot establish LACP with the switch. Traffic on the affected link will stop until LACP is re-established.',
        solution_hint='1. Check bond status: cat /proc/net/bonding/bond0\n2. Verify switch LACP config matches host (rate, mode)\n3. Check physical: cable, SFP, switch port status\n4. Try manual LACP restart: ifdown/ifup bond interface\n5. Verify LACP timeout matches: fast (1s) vs slow (30s)',
        product='general',
    ),
    LogPattern(
        name='mtu_mismatch',
        regex=r'(MTU.*mismatch|packet.*too.*large|ICMP.*frag.*needed|pmtu.*discovery.*fail|message.*too long.*UDP|oversized.*frame.*drop)',
        severity='MEDIUM',
        category='network',
        description='MTU mismatch detected — packets larger than the path MTU are being dropped or fragmented. This commonly affects iSCSI (requires jumbo frames) and cluster heartbeat communication.',
        solution_hint='1. Check interface MTU: ip link show\n2. Test path MTU: ping -M do -s 8972 <target> (for 9000 jumbo)\n3. Verify switch ports allow jumbo frames end-to-end\n4. For iSCSI: set MTU 9000 on all interfaces in the storage path\n5. For corosync: ensure cluster interfaces have matching MTU',
        product='general',
    ),
    LogPattern(
        name='arp_table_overflow',
        regex=r'(arp.*table.*overflow|neighbour.*table.*overflow|gc_thresh.*exceeded|net_ratelimit.*neighbour.*overflow)',
        severity='MEDIUM',
        category='network',
        description='ARP/neighbour table overflow — the kernel ARP cache is full. New ARP entries cannot be learned, causing connectivity issues to new hosts.',
        solution_hint='1. Check ARP table size: ip neigh show | wc -l\n2. Increase limits: sysctl -w net.ipv4.neigh.default.gc_thresh3=8192\n3. Also set: gc_thresh1=4096, gc_thresh2=6144\n4. Make persistent: add to /etc/sysctl.d/99-arp.conf\n5. Investigate why so many ARP entries needed (VLAN sprawl?)',
        product='general',
    ),
    LogPattern(
        name='iscsi_session_timeout',
        regex=r'(iSCSI.*session.*timeout|iscsid.*connection.*timeout|iSCSI.*login.*timeout|iscsi.*target.*unreachable|ISCSI_ERR_CONN_FAILED)',
        severity='HIGH',
        category='network',
        description='iSCSI session connection timeout — the host cannot reach the iSCSI target. All LUNs on this session will become unavailable until the session is re-established.',
        solution_hint='1. Check sessions: iscsiadm -m session -P 3\n2. Ping iSCSI target portal: ping <target-ip>\n3. Check network path: traceroute <target-ip>\n4. Check interface MTU (iSCSI typically needs jumbo frames)\n5. Restart iSCSI: systemctl restart iscsid; iscsiadm -m node -L all',
        product='Alletra',
    ),
    # === Additional Storage/Multipath Patterns ===
    LogPattern(
        name='multipath_path_reinstated',
        regex=r'(multipath.*reinstated|path.*reinstated|multipathd.*reinstated|sd\w+.*added.*to.*path|path.*group.*active.*from.*failed)',
        severity='INFO',
        category='storage',
        description='Multipath path reinstated — a previously failed storage path has recovered. While this is a recovery event, frequent reinstatements indicate an unstable storage path that should be investigated.',
        solution_hint='1. Check path stability: multipathd show paths format "%d %s %T"\n2. If reinstating frequently: investigate underlying cause\n3. Check: cable, SFP, switch port errors, HBA logs\n4. Monitor: multipath -ll for consistent path states\n5. If alternating failed/active: check ALUA trespass events on array',
        product='general',
    ),
    LogPattern(
        name='lun_assignment_change',
        regex=r'(LUN assignments.*changed|target.*lun.*changed|SCSI.*attached.*LUN|device.*LUN.*remap|inquiry.*changed|device_add.*sd)',
        severity='MEDIUM',
        category='storage',
        description='LUN assignment change detected on the storage target. This can disrupt in-flight I/O and may indicate storage array reconfiguration or snapshot revert operations.',
        solution_hint='1. Check if storage team made changes: verify with array admin\n⚠️ PRECAUTION: rescan-scsi-bus.sh can disrupt I/O on busy systems. Use -r flag to remove stale devices but NEVER during heavy VM I/O or concurrent GFS2 operations. Prefer targeted rescan over full bus rescan.\n2. If targeted rescan needed: rescan-scsi-bus.sh -r (removes stale + adds new — less disruptive than -r -f -m)\n3. Check multipath: multipath -ll (verify correct LUN IDs)\n4. If after snapshot revert: rescan-scsi-bus.sh -r -f -m to fully rebuild (⚠️ only when VMs are stopped/paused)\n5. Monitor for VM I/O errors following LUN change',
        product='Alletra',
    ),
    LogPattern(
        name='thin_provision_space_exhausted',
        regex=r'(thin.*pool.*full|thin.*provision.*out.*space|CPG.*exhausted|storage.*pool.*capacity.*exceed|data.*pool.*alloc.*fail|ENOSPC.*thin)',
        severity='CRITICAL',
        category='storage',
        description='Thin-provisioned storage pool is full at the array level. VMs will get ENOSPC errors and may pause even though the virtual volume shows free space. This is a physical capacity issue.',
        solution_hint='1. Check array CPG/pool utilization: showcpg, showvv (READ-ONLY diagnostic on array)\n2. URGENT: free space by deleting snapshots or old volumes on the array\n3. Add physical disks to the pool if available\n⚠️ PRECAUTION: Do NOT resume paused VMs (virsh resume) until array-level space is freed! Resuming a VM while the pool is still full will immediately re-trigger ENOSPC and may corrupt in-flight writes.\n4. Temporarily pause non-critical VMs to reduce write load\n5. Alert: VMs may auto-pause with "no space" errors\n6. After space freed: virsh resume <VM> one at a time, verify each starts cleanly',
        product='Alletra',
    ),
    # === Additional Hardware Patterns ===
    LogPattern(
        name='hba_link_failure',
        regex=r'(lpfc.*link.*down|qla2xxx.*link.*down|HBA.*link.*failure|FC.*link.*lost|fc_host.*port_state.*Linkdown|Fibre.*Channel.*link.*fail)',
        severity='CRITICAL',
        category='hardware',
        description='Fibre Channel HBA link down — the host has lost connectivity to the FC fabric. All LUNs on this HBA path will become unavailable until the link is restored.',
        solution_hint='1. Check FC port state: cat /sys/class/fc_host/host*/port_state\n2. Check physical connection: SFP, cable, switch port\n3. Check switch port errors: show interface <port>\n4. If multiple hosts affected: switch/fabric issue\n5. Check HBA firmware: systool -c fc_host -v',
        product='general',
    ),
    LogPattern(
        name='raid_degraded',
        regex=r'(RAID.*degrad|raid.*fail.*disk|md.*degraded|mdadm.*fail|array.*degraded|RAID.*rebuild|smartctl.*FAILING)',
        severity='CRITICAL',
        category='hardware',
        description='RAID array is degraded — a disk has failed and the array is running with reduced redundancy. Data loss risk increases if another disk fails before rebuild completes.',
        solution_hint='1. Check array status: cat /proc/mdstat or ssacli ctrl all show config\n2. Identify failed disk: dmesg | grep -i error.*sd\n3. Check SMART status: smartctl -a /dev/sdX\n4. Replace failed disk immediately\n5. Monitor rebuild progress: watch cat /proc/mdstat',
        product='general',
    ),
    LogPattern(
        name='nic_link_flapping',
        regex=r'(NIC.*link.*is (Up|Down).*NIC.*link.*is (Up|Down)|Link.*Up.*Link.*Down.*Link.*Up|carrier.*lost.*carrier.*got|link.*flap|bond.*link.*status.*changed)',
        severity='HIGH',
        category='hardware',
        description='NIC link flapping — the network interface is rapidly cycling between up and down states. This disrupts cluster heartbeats and can cause STONITH fencing.',
        solution_hint='1. Check link failure count: ethtool -S <iface> | grep link_failure\n2. Check cable/SFP: replace if error count is rising\n3. Check switch port: show interface <port> counters\n4. If bond: check bond slave stats: cat /proc/net/bonding/bond0\n5. Replace NIC if link failures exceed 10/day',
        product='general',
    ),
    LogPattern(
        name='ecc_memory_error',
        regex=r'(EDAC.*CE.*error|EDAC.*UE.*error|mce.*memory|Hardware Error.*Memory|DIMM.*error|corrected.*memory.*error|Machine.*check.*bank)',
        severity='HIGH',
        category='hardware',
        description='ECC memory error detected — correctable errors (CE) indicate degrading DIMM, uncorrectable errors (UE) may cause system crash or data corruption.',
        solution_hint='1. Check EDAC: edac-util --status or cat /sys/devices/system/edac/mc/mc*/csrow*/ch*_ce_count\n2. Check MCE logs: mcelog --client\n3. If UE: schedule immediate DIMM replacement\n4. If CE increasing: schedule DIMM replacement in next maintenance\n5. Check ILO/iDRAC for memory health alerts',
        product='general',
    ),
    LogPattern(
        name='disk_smart_warning',
        regex=r'(SMART.*error|Reallocated_Sector|Current_Pending_Sector|Offline_Uncorrectable|smartd.*warning|SMART.*Health.*FAILED|SMART.*threshold)',
        severity='HIGH',
        category='hardware',
        description='SMART disk health warning — disk is reporting pre-failure indicators. Disk replacement should be planned before complete failure.',
        solution_hint='1. Check SMART: smartctl -a /dev/sdX\n2. Look at: Reallocated_Sector_Ct, Current_Pending_Sector, Offline_Uncorrectable\n3. If any values above zero and growing: replace disk\n4. Start immediate backup of data on this disk\n5. If in RAID: replace disk, let array rebuild',
        product='general',
    ),
    LogPattern(
        name='pcie_aer_error',
        regex=r'(AER.*Corrected error|AER.*Uncorrected.*error|PCIe.*error|pci.*Bus.*Error|pcieport.*AER|pcie.*link.*down)',
        severity='HIGH',
        category='hardware',
        description='PCIe Advanced Error Reporting (AER) error — a PCIe device (NIC, HBA, GPU, NVMe) has reported errors. May indicate hardware failure, bad slot contact, or firmware issue.',
        solution_hint='1. Identify device: dmesg | grep -i AER (check PCI address)\n2. Map to device: lspci -s <addr>\n3. Check if card is seated properly\n4. Update device firmware/driver\n5. If persistent: move card to different PCIe slot\n6. Check for thermal issues in the server',
        product='general',
    ),
    # === Additional System/Boot Patterns ===
    LogPattern(
        name='nfs_stale_handle',
        regex=r'(Stale.*file.*handle|ESTALE|NFS.*stale|stale NFS file handle|nfs.*return.*stale)',
        severity='HIGH',
        category='filesystem',
        description='NFS stale file handle — the file or directory no longer exists on the NFS server, or the NFS export was modified/remounted. Processes accessing stale handles will get errors.',
        solution_hint='1. Identify stale mount: df -h, mount | grep nfs\n2. Try remount: umount -l <mount> && mount <mount> (lazy unmount if busy)\n⚠️ PRECAUTION: umount -f (force) can cause data loss if processes have open writes! Use umount -l (lazy) first — it detaches cleanly when processes finish.\n3. If umount hangs: check NFS server accessibility: showmount -e <server>\n4. Check NFS server exports: exportfs -v (on server side)\n5. For VMs on NFS storage: pause VMs before remounting NFS datastore',
        product='general',
    ),
    LogPattern(
        name='nfs_server_not_responding',
        regex=r'(nfs.*server.*not responding|NFS.*timed out|nfs.*no response|RPC.*timeout|portmap.*not responding|nfs.*connection.*reset)',
        severity='CRITICAL',
        category='filesystem',
        description='NFS server not responding — all processes accessing this NFS mount will hang in D-state until the server recovers. If VMs use NFS-backed storage, they will become unresponsive.',
        solution_hint='1. Check NFS server: ping <nfs-server> (basic connectivity)\n2. Check NFS service on server: systemctl status nfs-server (or showmount -e <server>)\n3. Check network path: traceroute <nfs-server>\n⚠️ WARNING: Do NOT kill processes stuck on NFS mount — they are in uninterruptible sleep (D-state) and cannot be killed. Fix the NFS server or use umount -l (lazy unmount) which will complete when server recovers.\n4. If server is truly down: umount -l <mount> (lazy — completes when accessible)\n5. Check firewall: NFS needs ports 111, 2049 + mountd port\n6. Verify NFS version compatibility: nfsstat -m',
        product='general',
    ),
    LogPattern(
        name='nfs_export_permission_denied',
        regex=r'(NFS.*permission denied|access denied by server|mount.*nfs.*access|exportfs.*denied|no_root_squash|all_squash.*denied)',
        severity='MEDIUM',
        category='filesystem',
        description='NFS export permission denied — the NFS server is rejecting mount or access requests. Usually due to export configuration, IP filtering, or root_squash settings.',
        solution_hint='1. On NFS server: check exports: cat /etc/exports, exportfs -v\n2. Verify client IP is in allowed list\n3. Check root_squash: if root access needed, use no_root_squash (⚠️ security risk in production)\n4. Refresh exports on server: exportfs -ra\n5. Check if sec= mount option matches server config (sys, krb5, etc.)',
        product='general',
    ),
    LogPattern(
        name='xfs_corruption',
        regex=r'(XFS.*corruption|xfs.*shutdown|xfs.*force shutdown|XFS.*Metadata.*error|xfs_repair|xfs.*Internal error)',
        severity='CRITICAL',
        category='filesystem',
        description='XFS filesystem corruption or forced shutdown detected. The filesystem has encountered metadata inconsistency and shut down to prevent further damage.',
        solution_hint='1. Check dmesg for the specific XFS error that triggered shutdown\n2. Unmount the filesystem: umount <mount>\n⚠️ PRECAUTION: ALWAYS run xfs_repair -n (dry-run) FIRST to assess damage without making changes!\n3. Dry-run: xfs_repair -n /dev/<device> (read-only check, shows what would be fixed)\n4. If dry-run shows fixable issues: xfs_repair /dev/<device> (WARNING: may lose data in damaged areas)\n5. If log is dirty: xfs_repair -L /dev/<device> (DANGEROUS — zeroes the log, last resort only!)\n6. After repair: mount and verify data integrity',
        product='general',
    ),
    LogPattern(
        name='ext4_filesystem_error',
        regex=r'(EXT4-fs.*error|ext4.*remounting.*read-only|ext4.*filesystem.*error|ext4.*abort|e2fsck.*recommended)',
        severity='HIGH',
        category='filesystem',
        description='EXT4 filesystem error detected — the filesystem encountered corruption and may have been remounted read-only. fsck is required to repair.',
        solution_hint='1. Check dmesg for specific error: dmesg | grep -i ext4\n2. Unmount filesystem (MUST be unmounted for fsck)\n⚠️ PRECAUTION: ALWAYS run e2fsck -n (dry-run) FIRST! This checks without modifying anything.\n3. Dry-run: e2fsck -n /dev/<device> (read-only check)\n4. If issues found: e2fsck -p /dev/<device> (auto-fix safe errors only)\n5. For more serious damage: e2fsck -y /dev/<device> (WARNING: answers yes to all — may delete corrupted files)\n6. NEVER run fsck on a mounted filesystem — this WILL cause corruption!',
        product='general',
    ),
    # === Additional System/Boot Patterns ===
    LogPattern(
        name='systemd_service_crash_loop',
        regex=r'(systemd.*start-limit-hit|systemd.*service.*failed.*start|Failed.*start.*times|service.*entered.*failed.*state|systemd.*restart.*too.*fast)',
        severity='HIGH',
        category='system',
        description='Systemd service in crash loop — a service is repeatedly failing to start and has hit the restart limit. Manual intervention required.',
        solution_hint='1. Check status: systemctl status <service>\n2. View logs: journalctl -u <service> --no-pager -n 50\n3. Reset failure count: systemctl reset-failed <service>\n4. Check resource issues: disk full, port in use, permission denied\n5. Try manual start with debug: systemctl start <service> && journalctl -f -u <service>',
        product='general',
    ),
    LogPattern(
        name='systemd_dependency_failure',
        regex=r'(systemd.*Dependency.*failed|systemd.*job.*dependency|Requires.*failed|After.*not.*reached|systemd.*ordering.*cycle)',
        severity='MEDIUM',
        category='system',
        description='Systemd dependency failure — a service cannot start because one of its dependencies (Requires/After) has failed or is not available.',
        solution_hint='1. Check dependency tree: systemctl list-dependencies <service>\n2. Check failed units: systemctl --failed\n3. Fix the failed dependency first\n4. Check for circular dependencies: systemd-analyze verify <unit>\n5. Temporary override: systemctl edit <service> → remove dependency',
        product='general',
    ),
    LogPattern(
        name='time_sync_failure',
        regex=r'(chrony.*can.?t.*synchronize|ntpd.*no.*server.*suitable|time.*not.*synchronized|timedatectl.*NTP.*no|System clock.*wrong|clock.*skew.*detected)',
        severity='HIGH',
        category='system',
        description='Time synchronization failure — system clock cannot sync with NTP servers. This causes certificate validation failures, cluster membership issues, and log timestamp inconsistencies.',
        solution_hint='1. Check chrony: chronyc tracking, chronyc sources\n2. Check if NTP server is reachable: ntpdate -q <server>\n3. Force sync: chronyc makestep\n4. Check firewall: allow UDP 123 outbound\n5. For clusters: time skew > 1s can cause corosync issues',
        product='general',
    ),
    LogPattern(
        name='grub_boot_failure',
        regex=r'(grub.*error|GRUB.*unknown.*filesystem|error:.*file.*not found.*grub|GRUB.*rescue|BLS.*entry.*missing|initramfs.*not found)',
        severity='CRITICAL',
        category='system',
        description='GRUB bootloader error — system cannot find boot files, kernel, or initramfs. Server will not boot without manual intervention.',
        solution_hint='1. Boot from rescue ISO/USB\n2. Mount root filesystem: mount /dev/<root> /mnt\n3. Reinstall GRUB: grub2-install --root-directory=/mnt /dev/sdX\n4. Regenerate config: grub2-mkconfig -o /mnt/boot/grub2/grub.cfg\n5. Rebuild initramfs: dracut --force /mnt/boot/initramfs-$(uname -r).img $(uname -r)',
        product='general',
    ),
    LogPattern(
        name='lvm_volume_activation_failure',
        regex=r'(lvm.*activation.*fail|vgchange.*error|lvchange.*fail|WARNING.*PV.*not found|Couldn.*t find device|lvm.*device.*missing)',
        severity='HIGH',
        category='system',
        description='LVM volume activation failure — a physical volume, volume group, or logical volume cannot be activated. May be due to missing disks, corrupted metadata, or path changes.',
        solution_hint='1. Scan for PVs: pvscan, vgscan, lvscan\n2. Check missing devices: vgs -o +devices\n3. If device renamed: vgchange -ay --partial <vg>\n4. Check multipath: multipath -ll (device may have new name)\n5. If disk truly gone: vgreduce --removemissing <vg>',
        product='general',
    ),
    # === Additional Virtualization/KVM Patterns ===
    LogPattern(
        name='qemu_monitor_eof',
        regex=r'(End of file from qemu monitor|qemu.*monitor.*disconnect|qemu.*monitor.*EOF|Lost connection to QEMU.*monitor|monitor.*socket.*closed)',
        severity='CRITICAL',
        category='virtualization',
        description='QEMU monitor connection lost — the hypervisor management channel to the VM has disconnected. The VM may have crashed, or QEMU process may be stuck. virsh commands will fail for this VM.',
        solution_hint='1. Check if QEMU process exists: ps aux | grep qemu | grep <vm>\n2. If process exists but D-state: host reboot may be required\n3. If process gone: VM crashed, check /var/log/libvirt/qemu/<vm>.log\n4. Force cleanup: virsh destroy <vm>\n5. Check for storage errors preceding the disconnect',
        product='KVM',
    ),
    LogPattern(
        name='libvirt_lock_timeout',
        regex=r'(libvirt.*cannot acquire.*lock|Timed out.*state change lock|libvirtd.*lock.*timeout|virsh.*lock.*error|domain.*job.*timed out)',
        severity='HIGH',
        category='virtualization',
        description='Libvirt lock acquisition timeout — a long-running operation is holding the domain lock, preventing other management operations. Common with stuck migrations or large disk operations.',
        solution_hint='1. Check which job is holding lock: virsh domjobinfo <vm>\n2. Abort the stuck job: virsh domjobabort <vm>\n3. If that fails: restart libvirtd (will drop stuck jobs)\n4. Check for: stuck migration, snapshot in progress, backup running\n5. Monitor: virsh domjobinfo <vm> repeatedly to see if progress',
        product='KVM',
    ),
    LogPattern(
        name='vm_balloon_driver_error',
        regex=r'(balloon.*error|virtio-balloon.*fail|balloon.*deflat.*fail|Memory.*balloon.*not.*respond|balloon.*target.*not.*reached)',
        severity='MEDIUM',
        category='virtualization',
        description='VirtIO balloon driver error — the memory balloon device cannot inflate/deflate properly. This affects dynamic memory management between host and guest.',
        solution_hint='1. Check balloon status: virsh dommemstat <vm>\n2. Verify balloon driver in guest: lsmod | grep virtio_balloon\n3. Check if balloon target is realistic: virsh dommemstat <vm> | grep actual\n4. Restart balloon: virsh setmem <vm> <max> --live\n5. If guest unresponsive: balloon will not work',
        product='KVM',
    ),
    LogPattern(
        name='virtio_driver_error',
        regex=r'(virtio.*error|viostor.*error|vioscsi.*error|virtio_net.*fail|virtio_blk.*error|Event ID.*129.*viostor|VirtIO.*SCSI.*timeout)',
        severity='HIGH',
        category='virtualization',
        description='VirtIO driver error in guest VM — the paravirtualized driver (storage/network/SCSI) has encountered an error. May cause I/O failures or network disconnection inside the VM.',
        solution_hint='1. In Windows guest: check Event Viewer → System → Event ID 129\n2. Check VirtIO driver version: Device Manager → Properties\n3. Update VirtIO drivers: install latest virtio-win ISO\n4. Check host storage health: multipath -ll\n5. If viostor timeout: may be host-side I/O stall propagating to guest',
        product='KVM',
    ),
    LogPattern(
        name='ovmf_uefi_boot_failure',
        regex=r'(OVMF.*error|UEFI.*boot.*fail|EFI.*shell|pflash.*error|nvram.*corrupt|Secure Boot.*fail|OVMF_VARS.*missing)',
        severity='HIGH',
        category='virtualization',
        description='OVMF/UEFI boot failure — VM dropped to EFI shell or cannot boot due to corrupted NVRAM, missing UEFI variables, or Secure Boot issues.',
        solution_hint='1. Restore NVRAM: cp /var/morpheus/kvm/OVMF_VARS_4M.fd /var/lib/libvirt/qemu/nvram/<vm>_VARS.fd\n2. Check boot order in UEFI shell: FS0:\\EFI\\boot\\bootx64.efi\n3. Fix GPT: sgdisk --move-second-header /dev/mapper/<disk>\n4. If Secure Boot: verify firmware path in VM XML\n5. Disable Secure Boot if not required: virsh edit → remove secure=yes',
        product='KVM',
    ),
    # === Additional Morpheus/VME Service Patterns ===
    LogPattern(
        name='morpheus_2fa_auth_failure',
        regex=r'(2FA.*fail|Invalid verification code|two.?factor.*fail|TOTP.*invalid|MFA.*authentication.*error)',
        severity='MEDIUM',
        category='security',
        description='Two-factor authentication failure — users cannot log in with 2FA codes. May indicate time sync issue between server and authenticator app.',
        solution_hint='1. Check server time: timedatectl (must be within 30s of UTC)\n2. Sync time: chronyc makestep\n3. If all 2FA users affected: server clock is likely wrong\n4. If single user: re-enroll authenticator app\n5. Emergency: disable 2FA via morpheus-ctl console',
        product='Morpheus',
    ),
    LogPattern(
        name='morpheus_db_pool_exhaustion',
        regex=r'(pool.*exhausted|connection.*pool.*full|Cannot get.*connection.*pool|HikariPool.*connection.*timeout|ActiveConnections.*MaximumPoolSize)',
        severity='CRITICAL',
        category='service',
        description='Morpheus database connection pool exhausted — all available connections are in use. New requests will fail until connections are returned. Usually caused by long-running queries or workflows holding connections.',
        solution_hint='1. Restart morpheus-ui: morpheus-ctl restart morpheus-ui\n2. Increase pool: edit morpheus.rb → db.pool.max=100\n3. Check for stuck workflows: Provisioning → Executions\n4. Check MySQL processlist: morpheus-ctl mysql → show processlist;\n5. Identify long queries: show full processlist; → kill <id>',
        product='Morpheus',
    ),
    LogPattern(
        name='morpheus_elasticsearch_cluster_red',
        regex=r'(elasticsearch.*cluster.*red|elasticsearch.*unassigned.*shards|ES.*cluster.*health.*red|morpheus.*search.*unavailable|elasticsearch.*index.*read.?only)',
        severity='HIGH',
        category='service',
        description='Morpheus embedded Elasticsearch cluster is in RED state — some indices have unassigned shards. Search, logging, and monitoring features may be degraded.',
        solution_hint='1. Check ES health: curl -s localhost:9200/_cluster/health | jq\n2. Check unassigned shards: curl localhost:9200/_cat/shards?v | grep UNASSIGNED\n3. If disk full: free space → remove read-only: curl -X PUT localhost:9200/_all/_settings -d \'{"index.blocks.read_only_allow_delete":null}\'\n4. Restart ES: morpheus-ctl restart elasticsearch\n5. Check logs: morpheus-ctl tail elasticsearch',
        product='Morpheus',
    ),
    LogPattern(
        name='morpheus_rabbitmq_queue_blocked',
        regex=r'(rabbitmq.*blocked|rabbitmq.*resource.*alarm|rabbit.*flow.*control|AMQP.*connection.*blocked|publishers.*blocked|memory.*alarm.*rabbit)',
        severity='HIGH',
        category='service',
        description='Morpheus RabbitMQ queue is blocked — memory or disk alarm has triggered flow control. Message publishing is paused until resource pressure is relieved.',
        solution_hint='1. Check RabbitMQ status: morpheus-ctl rabbitmq-status\n2. Check alarms: rabbitmqctl status | grep -A5 alarms\n3. If memory alarm: reduce RabbitMQ memory usage or add RAM\n4. If disk alarm: free disk space on appliance\n5. Restart: morpheus-ctl restart rabbitmq',
        product='Morpheus',
    ),
    LogPattern(
        name='morpheus_agent_install_failure',
        regex=r'(morpheus.*agent.*install.*fail|morpheus-node.*install.*error|agent.*download.*fail|curl.*morpheus.*agent.*error|SSL.*handshake.*fail.*agent)',
        severity='MEDIUM',
        category='service',
        description='Morpheus agent installation failed on a VM. This prevents the VM from reporting status, metrics, and completing provisioning.',
        solution_hint='1. Check network from VM to Morpheus appliance: curl -k https://<appliance>/api/health\n2. Check firewall: port 443 must be open from VM to appliance\n3. If FIPS: upgrade to Morpheus 6.2.2+ for FIPS-compatible ciphers\n4. Manual install: download agent package and install offline\n5. Check DNS resolution from VM to Morpheus hostname',
        product='Morpheus',
    ),
    # === Additional Backup Patterns ===
    LogPattern(
        name='veeam_worker_connection_failed',
        regex=r'(veeam.*worker.*fail|veeam.*connect.*error|VeeamHpeMorpheusVmeSvc.*error|Failed to connect to the worker core service)',
        severity='HIGH',
        category='backup',
        description='Veeam backup worker connection failed. The Veeam HPE VME plugin cannot connect to the worker service, preventing backup operations.',
        solution_hint='1. Check VeeamHpeMorpheusVmeSvc service: sc query VeeamHpeMorpheusVmeSvc\n2. Check logs: C:\\ProgramData\\Veeam\\Backup\\Plugins\\HPEMORPHEUSVME\\\n3. Enable debug: edit appsettings.json → set log level to Debug\n4. Restart service: Restart-Service VeeamHpeMorpheusVmeSvc\n5. Check firewall between Veeam server and VME hosts',
        product='VME',
    ),
    LogPattern(
        name='veeam_entity_refresh_failed',
        regex=r'(Failed to refresh.*HPE Morpheus.*entities|Failed to scan VMs.*Error.*deserializ|veeam.*refresh.*morpheus.*fail)',
        severity='HIGH',
        category='backup',
        description='Veeam failed to refresh HPE Morpheus VM Essentials entities. Cannot enumerate VMs for backup operations. May be a serialization or API compatibility issue.',
        solution_hint='1. Check VME API accessibility from Veeam server\n2. Verify VME credentials in Veeam are valid\n3. Check VME API version compatibility with Veeam plugin version\n4. Check Veeam platform service logs for detailed error\n5. Try removing and re-adding the VME integration in Veeam',
        product='VME',
    ),
    LogPattern(
        name='commvault_nbd_device_lock',
        regex=r'(nbd.*device.*busy|nbd.*lock|commvault.*nbd|qemu-nbd.*already.*use|nbd\d+.*mounted|Device or resource busy.*nbd)',
        severity='HIGH',
        category='backup',
        description='NBD (Network Block Device) lock conflict — typically from Commvault backup agent holding device locks. This can prevent GFS2 operations and cause DLM issues during cluster recovery.',
        solution_hint='1. Check NBD devices: lsblk | grep nbd\n2. Check who holds the lock: fuser /dev/nbd*\n3. Kill stale qemu-nbd: pkill -f qemu-nbd\n4. Disconnect NBD: qemu-nbd -d /dev/nbd0\n5. Add LVM filter to exclude NBD: edit /etc/lvm/lvm.conf filter = ["r|/dev/nbd|"]',
        product='general',
    ),
    LogPattern(
        name='backup_snapshot_chain_broken',
        regex=r'(snapshot.*chain.*broken|parent.*snapshot.*not found|incremental.*backup.*fail.*parent|backup.*chain.*invalid|Cannot find parent disk)',
        severity='HIGH',
        category='backup',
        description='Backup snapshot chain is broken — incremental backups cannot find the parent snapshot. A full backup is required to re-establish the chain.',
        solution_hint='1. Delete the broken backup chain in backup console\n2. Create a new full backup as the new base\n3. Avoid manually deleting snapshots tracked by backup software\n4. Check if VM was restored to a prior snapshot (breaks chain)\n5. Configure retention to auto-cleanup old chains',
        product='general',
    ),
    LogPattern(
        name='backup_storage_timeout',
        regex=r'(backup.*storage.*timeout|backup.*target.*unreachable|backup.*repository.*error|backup.*write.*timeout|backup.*copy.*fail.*timeout)',
        severity='HIGH',
        category='backup',
        description='Backup operation timed out writing to storage target. The backup repository may be full, unreachable, or experiencing I/O issues.',
        solution_hint='1. Check backup repository accessibility: ping/mount test\n2. Check repository free space: df -h <mount>\n3. Check network bandwidth to repository\n4. Check for concurrent backup jobs competing for bandwidth\n5. Increase backup timeout if repository is remote/slow',
        product='general',
    ),
    # === Additional Performance Patterns ===
    LogPattern(
        name='cpu_steal_time_high',
        regex=r'(steal.*time.*[5-9]\d|steal.*time.*100|%steal\s+[5-9]\d|cpu.*steal.*high|hypervisor.*overcommit)',
        severity='HIGH',
        category='performance',
        description='High CPU steal time detected — the hypervisor is taking CPU cycles away from this VM. Indicates CPU overcommitment on the host.',
        solution_hint='1. Check steal time: top (look at %st column)\n2. On host: check total vCPU allocation vs physical cores\n3. Reduce vCPU count on VMs or migrate VMs to less loaded host\n4. Check if other VMs on same host are CPU-intensive\n5. Consider CPU pinning for latency-sensitive workloads',
        product='KVM',
    ),
    LogPattern(
        name='disk_io_scheduler_issue',
        regex=r'(blk_update_request.*I/O error|io.*scheduler.*deadline|cfq.*io.*stall|elevator.*noop|mq-deadline.*dispatch|blk-mq.*timeout)',
        severity='MEDIUM',
        category='performance',
        description='Block I/O scheduler issue detected — may indicate suboptimal I/O scheduling for the workload type or I/O request timeouts.',
        solution_hint='1. Check current scheduler: cat /sys/block/sda/queue/scheduler\n2. For SSDs/NVMe: use none/mq-deadline\n3. For HDDs: use bfq or mq-deadline\n4. Change: echo mq-deadline > /sys/block/sda/queue/scheduler\n5. Make persistent: add elevator=mq-deadline to kernel cmdline',
        product='general',
    ),
    LogPattern(
        name='memory_pressure_reclaim',
        regex=r'(kswapd.*high.*order|direct.*reclaim|page.*allocation.*failure.*order|compaction.*failure|memory.*pressure.*high|vmscan.*throttle)',
        severity='HIGH',
        category='performance',
        description='Memory pressure detected — kernel is aggressively reclaiming memory pages. Applications may experience latency spikes during reclaim.',
        solution_hint='1. Check memory: free -h, vmstat 1 5 (look at si/so columns)\n2. Identify memory consumers: ps aux --sort=-%mem | head -20\n3. Check if swap is being used heavily: swapon --show\n4. Consider adding RAM or reducing workload\n5. Tune vm.swappiness and vm.min_free_kbytes',
        product='general',
    ),
    LogPattern(
        name='numa_imbalance',
        regex=r'(numa.*imbalance|numa.*migration|task.*migration.*numa|numa_balancing|numad.*error|memory.*remote.*node)',
        severity='MEDIUM',
        category='performance',
        description='NUMA memory imbalance detected — processes are accessing memory on remote NUMA nodes, causing performance degradation.',
        solution_hint='1. Check NUMA topology: numactl --hardware\n2. Check VM NUMA placement: virsh numatune <domain>\n3. Pin VMs to NUMA nodes: virsh numatune <domain> --mode strict --nodeset 0\n4. Check numastat for cross-node memory access\n5. For large VMs: ensure vCPUs and memory fit within one NUMA node',
        product='KVM',
    ),
    LogPattern(
        name='network_packet_drops',
        regex=r'(rx_dropped|tx_dropped|packet.*drop|net.*buffer.*overflow|netdev_budget.*exceeded|softnet_stat.*dropped|napi.*poll.*budget)',
        severity='MEDIUM',
        category='performance',
        description='Network packet drops detected — packets are being dropped due to buffer overflow, budget exhaustion, or ring buffer full.',
        solution_hint='1. Check drops: ip -s link show <iface>\n2. Increase ring buffer: ethtool -G <iface> rx 4096 tx 4096\n3. Increase netdev_budget: sysctl -w net.core.netdev_budget=600\n4. Check interrupt affinity: cat /proc/interrupts | grep <iface>\n5. Enable RSS/RPS for multi-queue distribution',
        product='general',
    ),
    # === Additional Kernel Patterns ===
    LogPattern(
        name='kernel_taint_flags',
        regex=r'(Tainted:.*[PFOESWBRICUDAL]|kernel.*tainted|module.*taint|proprietary.*module.*loaded)',
        severity='MEDIUM',
        category='kernel',
        description='Kernel taint flags detected — the kernel state has been modified by out-of-tree modules, previous crashes, or forced module loads. Support may be limited.',
        solution_hint='1. Check taint flags: cat /proc/sys/kernel/tainted\n2. Common causes: proprietary GPU drivers, forced module loads\n3. Check which module tainted: dmesg | grep -i taint\n4. If after crash: previous OOM/panic left taint flag\n5. Clean boot required to clear taint flags',
        product='general',
    ),
    LogPattern(
        name='kernel_rcu_stall',
        regex=r'(rcu.*stall|rcu_sched.*detected stall|rcu_preempt.*stall|INFO:.*rcu.*stall)',
        severity='CRITICAL',
        category='kernel',
        description='RCU (Read-Copy-Update) stall detected — a CPU is stuck in kernel code and not yielding to RCU grace periods. Often indicates a kernel bug or hardware issue causing infinite loops.',
        solution_hint='1. Check which CPU is stalled: look at RCU stall message for CPU number\n2. Check if CPU is in D-state: ps -eo pid,stat,wchan,cmd | grep ^D\n3. Check for NMI watchdog: dmesg | grep NMI\n4. May indicate: bad driver, hardware failure, or kernel deadlock\n5. If persistent: collect crash dump, upgrade kernel',
        product='general',
    ),
    LogPattern(
        name='kernel_watchdog_reset',
        regex=r'(watchdog.*reset|watchdog.*timeout|watchdog.*expired|NMI.*watchdog.*hard.*LOCKUP|BUG:.*hard.*LOCKUP.*CPU)',
        severity='CRITICAL',
        category='kernel',
        description='Hardware watchdog timeout or hard lockup detected — a CPU has been locked up and not responding to NMI interrupts. This is typically a severe hardware or kernel issue.',
        solution_hint='1. Check for hardware issues: MCE errors, thermal throttle\n2. Check NMI history: dmesg | grep NMI\n3. Check if related to specific driver: dmesg | grep -B5 lockup\n4. Test hardware: memtest86, CPU stress test\n5. Update BIOS/firmware and kernel',
        product='general',
    ),
    LogPattern(
        name='kernel_workqueue_hogged_cpu',
        regex=r'(workqueue.*hogged CPU|kworker.*hogged.*cpu.*for|workqueue.*CPU.*intensive|worker.*pool.*stall)',
        severity='HIGH',
        category='kernel',
        description='Kernel workqueue hogging CPU — a kernel worker thread consumed excessive CPU time. This can cause scheduler delays and DLM/Pacemaker timeouts in cluster environments.',
        solution_hint='1. Identify the workqueue function: look for function name in message\n2. Common: fill_page_cache_func (memory), writeback (I/O)\n3. If cluster: may trigger DLM timeout → fencing\n4. Reserve CPU for critical services: isolcpus kernel param\n5. Check for storage I/O bottleneck causing writeback stalls',
        product='general',
    ),
    # === HPE VME Release Note Patterns (v8.0.4/8.0.5/8.0.6) ===
    LogPattern(
        name='nsx_firewall_rule_sync_failure',
        regex=r'(NSX.*firewall.*sync.*fail|NSX.*negate.*selection.*lost|NSX.*rule.*port.*cleared|firewall.*rule.*update.*error.*NSX|NSX-T.*policy.*sync.*error)',
        severity='HIGH',
        category='network',
        description='NSX firewall rule synchronization issue detected. Rules with "Negate Selection" may not sync correctly, or service ports may be cleared during updates. Fixed in VME 8.0.6.',
        solution_hint='1. Check NSX integration sync status in VME UI\n2. Verify firewall rules in NSX match VME (check negation flags)\n3. Check if service ports are present after rule modification\n4. Upgrade to VME 8.0.6+ where NSX sync issues are fixed\n5. Manually re-apply ports/negation if lost after sync',
        product='VME',
    ),
    LogPattern(
        name='rubrik_backup_sync_failure',
        regex=r'(rubrik.*sync.*fail|rubrik.*duration.*lost|rubrik.*integration.*error|rubrik.*backup.*duration.*null|rubrik.*retention.*invalid)',
        severity='MEDIUM',
        category='backup',
        description='Rubrik backup integration issue — backup durations may be lost after sync, or retention settings may be incorrect. Fixed in VME 8.0.6.',
        solution_hint='1. Check Rubrik integration status: Administration → Integrations\n2. Verify backup duration data is present after sync\n3. Note: retention count config does not apply to Rubrik (managed by Rubrik SLA)\n4. Upgrade to VME 8.0.6+ which fixes duration loss after sync\n5. Manually re-sync Rubrik integration if data is stale',
        product='VME',
    ),
    LogPattern(
        name='veeam_backup_sync_timeout',
        regex=r'(veeam.*sync.*fail|veeam.*backup.*job.*timeout|veeam.*large.*number.*VM|veeam.*integration.*sync.*error|veeam.*job.*fail.*sync)',
        severity='MEDIUM',
        category='backup',
        description='Veeam backup job sync failure — typically occurs when large numbers of VMs are attached to a backup job. Fixed in VME 8.0.6.',
        solution_hint='1. Check Veeam integration sync status in VME\n2. If sync fails with large VM count: upgrade to VME 8.0.6+\n3. Workaround: split large backup jobs into smaller groups\n4. Check Veeam server connectivity from VME appliance\n5. Verify Veeam API credentials are valid',
        product='VME',
    ),
    LogPattern(
        name='sso_token_expiry_incorrect',
        regex=r'(SSO.*token.*expir|token.*expiration.*incorrect|Custom.*External.*SSO.*token|identity.*source.*token.*year|token.*defaulting.*one.*year)',
        severity='MEDIUM',
        category='security',
        description='SSO token expiration may be defaulting to one year instead of the configured interval in global client settings. Fixed in VME 8.0.6.',
        solution_hint='1. Check token expiration in Administration → Settings → Client Settings\n2. If using Custom External SSO: verify token TTL matches configured interval\n3. Upgrade to VME 8.0.6+ where token expiry respects global settings\n4. Workaround: manually expire tokens via API if overly long-lived\n5. Review active sessions for tokens with unexpected expiry dates',
        product='VME',
    ),
    LogPattern(
        name='hypervisor_console_keymap_issue',
        regex=r'(keymap.*error|console.*keyboard.*wrong|hypervisor.*console.*key.*incorrect|caps.*lock.*not.*detect|ctrl.*c.*not.*work.*console|AZERTY.*keymap|French.*keymap)',
        severity='LOW',
        category='application',
        description='Hypervisor console keymap issue — keyboard layout not mapping correctly. French, German, UK, Italian keymaps fixed in VME 8.0.4/8.0.6. Caps lock detection fixed in 8.0.5.',
        solution_hint='1. Verify keyboard layout setting in console session\n2. For French/German/UK/Italian: upgrade to VME 8.0.4+\n3. For caps lock detection: upgrade to VME 8.0.5+\n4. For Ctrl+C/Z shortcuts: upgrade to VME 8.0.5+\n5. Workaround: use VNC client directly instead of web console',
        product='VME',
    ),
    LogPattern(
        name='alletra_plugin_cdrom_failure',
        regex=r'(Alletra.*cdrom.*fail|reconfigure.*CD.*ROM.*fail|cdrom.*unmapped.*revert|Alletra.*volume.*creation.*ISO|StorageException.*Resource Already Exists)',
        severity='HIGH',
        category='storage',
        description='HPE Alletra MP Plugin issue with CD ROM devices or ISO volumes. Known issues include: reconfigure failing with attached CD ROM, cdrom unmapping during snapshot revert, and intermittent "Resource Already Exists" errors. See VME 8.0.4-8.0.6 known issues.',
        solution_hint='1. Remove CD ROM device before reconfigure: virsh detach-disk <vm> <cdrom-device>\n2. For ISO image failures: use Qcow2 images instead\n3. For "Resource Already Exists": retry, check for orphaned volumes on array\n4. After snapshot revert: re-attach cdrom manually\n5. Use Alletra MP plugin v1.1.1+ and VME 8.0.7+ when available',
        product='Alletra',
    ),
    LogPattern(
        name='vme_role_permission_escalation',
        regex=r'(role.*access.*elevated|permission.*NONE.*changed.*FULL|role.*default.*access.*restart|unexpected.*permission.*grant|Tools.*menu.*unauthorized)',
        severity='HIGH',
        category='security',
        description='VME Role permission escalation issue — newly created roles with NONE defaults may be elevated to FULL after restart, or incorrect Tools menu access may be granted. Fixed in VME 8.0.4.',
        solution_hint='1. Audit all custom roles: check that access levels match intended configuration\n2. After any restart: verify role permissions have not changed\n3. Upgrade to VME 8.0.4+ where role elevation bug is fixed\n4. Check Tools menu access for users with limited permissions\n5. Re-create affected roles if permissions were incorrectly elevated',
        product='VME',
    ),


]


class PatternEngine:
    """Engine for matching log lines against patterns."""

    def __init__(self, patterns: Optional[List[LogPattern]] = None):
        """Initialize with patterns. Uses BUILT_IN_PATTERNS if none provided."""
        self.patterns = patterns if patterns is not None else BUILT_IN_PATTERNS
        self._compiled = [(p, re.compile(p.regex, re.IGNORECASE)) for p in self.patterns]

    def match_line(self, line: str) -> List[Tuple[LogPattern, re.Match]]:
        """Match a single line against all patterns.

        Returns list of (pattern, match) tuples for all matching patterns.
        """
        matches = []
        for pattern, compiled in self._compiled:
            m = compiled.search(line)
            if m:
                matches.append((pattern, m))
        return matches

    def scan_lines(self, lines: List[Tuple[int, str]], context_lines: int = 3,
                   max_findings: int = 500) -> List[Dict]:
        """Scan a list of (line_number, line_content) tuples for pattern matches.

        Returns list of finding dicts with context.
        """
        findings = []
        all_lines = list(lines)
        line_map = {ln: content for ln, content in all_lines}
        line_numbers = [ln for ln, _ in all_lines]

        for idx, (line_num, line_content) in enumerate(all_lines):
            if len(findings) >= max_findings:
                break

            matches = self.match_line(line_content)
            for pattern, match in matches:
                # Get context
                ctx_before_lines = []
                ctx_after_lines = []

                for offset in range(1, context_lines + 1):
                    before_idx = idx - offset
                    after_idx = idx + offset
                    if before_idx >= 0:
                        ctx_before_lines.insert(0, all_lines[before_idx][1])
                    if after_idx < len(all_lines):
                        ctx_after_lines.append(all_lines[after_idx][1])

                findings.append({
                    'pattern_name': pattern.name,
                    'severity': pattern.severity,
                    'line_number': line_num,
                    'line_content': line_content[:4096],
                    'context_before': '\n'.join(ctx_before_lines),
                    'context_after': '\n'.join(ctx_after_lines),
                    'description': pattern.description,
                    'solution_hint': pattern.solution_hint,
                    'category': pattern.category,
                    'confidence': 1.0,
                })

        return findings

    def scan_file_streaming(self, filepath: str, context_lines: int = 3,
                            max_findings: int = 500) -> List[Dict]:
        """Scan a file using streaming with context window.

        Memory efficient - keeps only a sliding window in memory.
        """
        from .ingestion import stream_file

        findings = []
        window: List[Tuple[int, str]] = []
        window_size = context_lines * 2 + 1

        for line_num, line_content in stream_file(filepath):
            window.append((line_num, line_content))
            if len(window) > window_size * 10:
                # Process the window periodically
                batch_findings = self._process_window(window, context_lines, max_findings - len(findings))
                findings.extend(batch_findings)
                # Keep only the context tail
                window = window[-(context_lines):]

            if len(findings) >= max_findings:
                break

        # Process remaining window
        if window and len(findings) < max_findings:
            batch_findings = self._process_window(window, context_lines, max_findings - len(findings))
            findings.extend(batch_findings)

        return findings[:max_findings]

    def _process_window(self, window: List[Tuple[int, str]], context_lines: int,
                        remaining: int) -> List[Dict]:
        """Process a window of lines for pattern matches."""
        findings = []
        processed_lines = set()

        for idx, (line_num, line_content) in enumerate(window):
            if line_num in processed_lines:
                continue
            if len(findings) >= remaining:
                break

            matches = self.match_line(line_content)
            if not matches:
                continue

            processed_lines.add(line_num)

            for pattern, match in matches:
                ctx_before_lines = []
                ctx_after_lines = []

                for offset in range(1, context_lines + 1):
                    before_idx = idx - offset
                    after_idx = idx + offset
                    if before_idx >= 0:
                        ctx_before_lines.insert(0, window[before_idx][1])
                    if after_idx < len(window):
                        ctx_after_lines.append(window[after_idx][1])

                findings.append({
                    'pattern_name': pattern.name,
                    'severity': pattern.severity,
                    'line_number': line_num,
                    'line_content': line_content[:4096],
                    'context_before': '\n'.join(ctx_before_lines),
                    'context_after': '\n'.join(ctx_after_lines),
                    'description': pattern.description,
                    'solution_hint': pattern.solution_hint,
                    'category': pattern.category,
                    'confidence': 1.0,
                })

        return findings

    def get_patterns_by_category(self, category: str) -> List[LogPattern]:
        """Get all patterns in a category."""
        return [p for p in self.patterns if p.category == category]

    def get_patterns_by_product(self, product: str) -> List[LogPattern]:
        """Get all patterns for a specific product."""
        return [p for p in self.patterns if p.product == product or p.product == 'general']

    def scan_multiline(self, lines: List[Tuple[int, str]],
                       multiline_patterns: Optional[List['MultiLinePattern']] = None,
                       max_findings: int = 100) -> List[Dict]:
        """Scan for multi-line patterns (stack traces, tracebacks, etc.).

        This handles patterns that span multiple consecutive lines like:
        - Java exceptions + stack traces
        - Python tracebacks
        - Kernel call traces
        - Core dump backtraces

        Algorithm:
        1. Scan each line for a trigger_regex match
        2. Once triggered, collect continuation lines matching continuation_regex
        3. Stop when continuation fails or end_regex matches or max_lines reached
        4. Report the entire block as a single finding

        Returns list of multi-line finding dicts.
        """
        if multiline_patterns is None:
            multiline_patterns = MULTILINE_PATTERNS

        findings = []
        compiled_ml = [
            (mp, re.compile(mp.trigger_regex, re.IGNORECASE),
             re.compile(mp.continuation_regex, re.IGNORECASE),
             re.compile(mp.end_regex, re.IGNORECASE) if mp.end_regex else None)
            for mp in multiline_patterns
        ]

        idx = 0
        while idx < len(lines) and len(findings) < max_findings:
            line_num, line_content = lines[idx]

            for mp, trigger_re, cont_re, end_re in compiled_ml:
                if trigger_re.search(line_content):
                    # Found a trigger — collect the block
                    block_lines = [(line_num, line_content)]
                    block_idx = idx + 1

                    while block_idx < len(lines) and len(block_lines) < mp.max_lines:
                        next_num, next_content = lines[block_idx]

                        # Check end condition
                        if end_re and end_re.search(next_content):
                            block_lines.append((next_num, next_content))
                            break

                        # Check continuation
                        if cont_re.search(next_content):
                            block_lines.append((next_num, next_content))
                            block_idx += 1
                        else:
                            break

                    # Only report if we captured more than just the trigger line
                    if len(block_lines) > 1:
                        block_text = '\n'.join(content for _, content in block_lines)
                        findings.append({
                            'pattern_name': mp.name,
                            'severity': mp.severity,
                            'category': mp.category,
                            'line_number': line_num,
                            'line_count': len(block_lines),
                            'line_content': block_lines[0][1][:4096],
                            'full_block': block_text[:8192],
                            'context_before': '',
                            'context_after': '',
                            'description': mp.description,
                            'solution_hint': mp.solution_hint,
                            'confidence': 0.9,
                            'is_multiline': True,
                        })
                        # Skip past this block to avoid re-triggering
                        idx = block_idx
                        break
            idx += 1

        return findings
