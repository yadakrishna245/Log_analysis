# Demo Log Files — Synthetic Data

**⚠️ This is 100% synthetic/fake data for demonstration purposes only.**

No real customer data, hostnames, IP addresses, or proprietary information is included.

## What's Inside

`collect_demovmehost01_20260802_100000.tar.gz` — A simulated HPE VM Essentials log collection bundle.

### Structure
```
collect_demovmehost01_20260802_100000/
├── var/log/
│   ├── messages                    # System messages (kernel, services, hardware)
│   ├── gfs2_filesystem.log         # GFS2 shared filesystem events
│   ├── morpheus/morpheus-ui.log    # Morpheus application logs
│   ├── cluster/corosync.log        # Corosync cluster communication
│   ├── pacemaker/pacemaker.log     # Pacemaker resource manager
│   └── libvirt/qemu/
│       └── vm_webserver01.log      # QEMU/KVM virtual machine logs
├── sos_commands/
│   ├── networking/network_info.log # Network config & routing
│   ├── storage/storage_info.log    # Multipath, LVM, storage status
│   └── cluster/pcs_status.log      # Pacemaker cluster status
└── etc/ (empty config dirs)
```

### Simulated Scenario
A catastrophic cluster failure where:
1. **Network flap** on bond0 causes communication loss between nodes
2. **Corosync** loses heartbeat → quorum lost → nodes fenced
3. **GFS2** shared filesystem withdraws due to DLM lock errors
4. **VMs fail to migrate** — HA doesn't kick in, OOM kills qemu processes
5. **Storage paths go down** — multipath loses all paths
6. **Morpheus** app crashes with DB connection errors, Java OOM

### Pattern Coverage
This demo file triggers **90+ detection patterns** across:
- 🔴 CRITICAL: Kernel panic, OOM kill, GFS2 withdraw, quorum loss, split brain, fencing cascade
- 🟠 HIGH: SCSI errors, multipath failures, VM crashes, libvirt errors, DLM failures
- 🟡 MEDIUM: Service failures, network issues, certificate expiry, DNS failures
- 🔵 LOW: CPU throttling, ARP conflicts, APIPA addresses

## How to Use
1. Go to https://d3tv1czat55yad.cloudfront.net
2. Drag-and-drop `collect_demovmehost01_20260802_100000.tar.gz` into the scanner
3. Watch it detect all patterns in under 1 second (9KB file)
4. Show the RCA summary, cascade chain, and severity breakdown

## Fake Details Used
- Hostname: `demovmehost01`, `demovmehost02`, `demovmehost03`
- IPs: `192.168.100.x`, `10.10.10.x`, `10.0.1.x`
- Cluster: `democluster`
- VMs: `vm_webserver01`, `vm_database01`, `vm_appserver01`, `vm_mailserver01`
- Storage: `mpath0`, `mpath1`, `vg_shared`, HPE Alletra
