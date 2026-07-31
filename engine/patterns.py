"""Pattern detection engine for LogSherlock Pro.

Contains 50+ pre-built patterns for detecting issues in Linux/HPE logs.
Each pattern includes junior-friendly descriptions and solution hints.
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
        solution_hint='Check why the withdraw happened (usually I/O errors or DLM issues). Review storage health. The filesystem needs to be unmounted and remounted after fixing the root cause. May need fsck.gfs2.',
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
