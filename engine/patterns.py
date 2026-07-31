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
