# HPE VM Essentials (HVM) — Comprehensive Troubleshooting Knowledge Base

> **Purpose:** Structured troubleshooting knowledge for offline log-analysis, RCA rules, regex pattern matching, and correlation rules in LogSherlock Pro.
>
> **Coverage:** HPE VM Essentials v8.0.1 through v9.0 | Storage (GFS2, NFS, Ceph, iSCSI, FC, Multipath) | Cluster/HA | Migration (VMware-to-HVM, Live, Cold, Storage) | VM Lifecycle | HPE Alletra Integration
>
> **Last Updated:** 2026-08-08

---

## CRITICAL VERSION CLARIFICATION

| Version | Release Date | Notes |
|---------|-------------|-------|
| v8.0.1 | Late 2024 | Initial GA release |
| v8.0.2 | 2025-01-16 | VMDK image support added |
| v8.0.3 | 2025-02-25 | GFS2 mount fix, UUID stability, IOPS improvement |
| v8.0.4 | 2025-03-31 | Alletra MP plugin initial, Cluster Layout v1.2 BETA |
| v8.0.5 | 2025-04-25 | GPU/PCI/USB passthrough, Layout v1.2 GA |
| v8.0.6 | 2025-06-11 | Storage Integration Pack, 14 known issues |
| v8.0.7 | Mid-2025 | ISO volume creation fix, mixed storage clone fix |
| v8.0.8 | 2025-08 | HVM ISO with Ubuntu 24.04 pre-installed |
| v9.0 | 2026-06 | Stretch clusters, memory overcommit |

**⚠️ IMPORTANT:** There is NO version 8.1.x of HPE VM Essentials. References to "8.1" in HPE SimpliVity matrices refer to VMware ESXi version compatibility (ESXi 8.1.2), NOT VM Essentials versions.

---

## PLATFORM ARCHITECTURE

- **Hypervisor:** KVM on Ubuntu 22.04/24.04
- **Cluster Technology:** Corosync/Pacemaker for HA
- **Built-in Storage:** Ceph (distributed across cluster nodes)
- **External Storage:** NFS, iSCSI (Alletra MP plugin), Fibre Channel
- **VM Networking:** Open vSwitch (OVS) with VLAN support
- **Management:** Morpheus-based Manager appliance
- **Migration Tool:** Rapid Migration Tool (RMT) for VMware→HVM

### Critical Log Locations

| Component | Path |
|-----------|------|
| Manager UI | `/var/log/morpheus/morpheus-ui/current` |
| Corosync | `journalctl -u corosync` |
| Pacemaker | `journalctl -u pacemaker` |
| libvirt/KVM | `/var/log/libvirt/libvirtd.log` |
| QEMU per-VM | `/var/log/libvirt/qemu/<vm-name>.log` |
| Ceph | `ceph status`, `ceph health detail` |
| OVS | `journalctl -u openvswitch-switch` |
| System | `/var/log/syslog` |
| DLM | `journalctl -u dlm` or `/var/log/messages` |
| GFS2 | `dmesg` / `journalctl -k` (kernel messages) |
| iSCSI | `journalctl -u iscsid` |
| Multipath | `journalctl -u multipathd` |

---


## SECTION 1: KNOWN ISSUES BY VERSION

### v8.0.3 Fixes (Issues Present in v8.0.1/v8.0.2)

#### KI-001: GFS2 Datastore Mount Failure on New Host Nodes

```
ID: KI-001
Component: GFS2 Storage / Cluster Expansion
Affected Versions: 8.0.1, 8.0.2
Fixed Version: 8.0.3
Severity: HIGH
Confidence: CONFIRMED (Official Release Notes)

Error Signature:
  - GFS2 datastore not mounted on newly added host
  - Sync errors after adding host to existing cluster with GFS2

Log Pattern (regex):
  - "GFS2.*mount.*fail|GFS2.*sync.*error|datastore.*not.*mounted"
  - "gfs2.*dlm_new_lockspace.*error"

Symptoms:
  - New host nodes added to existing HPE VM clusters with GFS2 datastores
    would not have the datastore mounted correctly
  - Sync errors observed after host addition
  - VMs cannot be placed on the new host due to missing storage

Root Cause:
  - Bug in cluster expansion logic failed to properly configure GFS2
    mount on newly joined nodes

Resolution:
  - Upgrade to v8.0.3 or later
  - Manual workaround: remount GFS2 manually on affected hosts

Source: https://hpevm-docs.morpheusdata.com/en/latest/release_notes/current.html
```

#### KI-002: VMs Shutdown During GFS Boot (Cluster Expansion)

```
ID: KI-002
Component: GFS2 Storage / VM Lifecycle
Affected Versions: 8.0.1, 8.0.2
Fixed Version: 8.0.3
Severity: CRITICAL
Confidence: CONFIRMED

Error Signature:
  - Existing VMs unexpectedly shut down when adding new hosts to clusters

Log Pattern (regex):
  - "VM.*shutdown.*unexpected|vm.*power.*off.*during.*cluster"

Symptoms:
  - Adding a new host node to an existing cluster causes running VMs
    to shutdown unexpectedly
  - Service disruption during cluster expansion

Root Cause:
  - GFS2 filesystem operations during node addition triggered VM shutdown

Resolution:
  - Upgrade to v8.0.3 or later
  - Schedule cluster expansion during maintenance windows on older versions

Source: https://hpevm-docs.morpheusdata.com/en/latest/release_notes/current.html
```

#### KI-003: UUID Instability for VM Storage Volumes

```
ID: KI-003
Component: Storage / VM Migration
Affected Versions: 8.0.1, 8.0.2
Fixed Version: 8.0.3
Severity: MEDIUM
Confidence: CONFIRMED

Error Signature:
  - Storage volume UUID changes after VM move or datastore change
  - Volume references broken after migration

Log Pattern (regex):
  - "UUID.*changed|volume.*not.*found|storage.*reference.*invalid"

Symptoms:
  - Moving VM to different host changes disk UUIDs
  - Changing disk datastores updates storage volume UUIDs
  - Backup software loses track of volumes
  - Veeam dirty bitmap errors on migrated VMs

Root Cause:
  - Internal volume management regenerated UUIDs on certain operations

Resolution:
  - Upgrade to v8.0.3 (UUIDs now remain stable across moves/datastore changes)

Source: https://hpevm-docs.morpheusdata.com/en/8.0.3-vme/index.html
```

### v8.0.5 Fixes

#### KI-004: VMs Removed from Hypervisor After Extended Stop

```
ID: KI-004
Component: VM Lifecycle
Affected Versions: 8.0.3, 8.0.4
Fixed Version: 8.0.5
Severity: HIGH
Confidence: CONFIRMED

Error Signature:
  - Stopped VM disappears from host inventory
  - VM definition removed from hypervisor

Log Pattern (regex):
  - "VM.*removed.*from.*host|workload.*disappeared|vm.*not.*found.*on.*hypervisor"

Symptoms:
  - VMs stopped for an extended period are removed from hypervisor hosts
  - VM shows in manager but not on physical host
  - Cannot power on VM — definition lost

Root Cause:
  - Cleanup routine incorrectly removed stopped VM definitions

Resolution:
  - Upgrade to v8.0.5

Source: https://hpevm-docs.morpheusdata.com/en/8.0.5-vme/release_notes/current.html
```

#### KI-005: API 500 Error Adding Cluster Worker

```
ID: KI-005
Component: Cluster Management / API
Affected Versions: 8.0.3, 8.0.4
Fixed Version: 8.0.5
Severity: MEDIUM
Confidence: CONFIRMED

Error Signature:
  - HTTP 500 error when adding cluster worker via API

Log Pattern (regex):
  - "500.*error.*adding.*cluster.*worker|API.*500.*worker"
  - "InternalServerError.*cluster.*worker"

Symptoms:
  - Adding cluster worker via VM Essentials API returns 500 errors
    under certain conditions
  - Cluster expansion via automation fails

Root Cause:
  - API endpoint handling error for worker addition

Resolution:
  - Upgrade to v8.0.5

Source: https://hpevm-docs.morpheusdata.com/en/8.0.5-vme/release_notes/current.html
```

### v8.0.6 Known Issues (Current as of June 2025)

#### KI-006: StorageException — Resource Already Exists (Alletra MP)

```
ID: KI-006
Component: Alletra MP Storage Plugin
Affected Versions: 8.0.6 (plugin v1.1.1)
Fixed Version: TBD
Severity: MEDIUM
Confidence: CONFIRMED

Error Signature:
  "StorageException while creating volume: Resource Already Exists"

Log Pattern (regex):
  - "StorageException.*creating volume.*Resource Already Exists"
  - "StorageException.*Resource.*Already.*Exists"

Symptoms:
  - VM creation fails intermittently
  - Volume creation step fails during provisioning
  - Non-deterministic — retrying may succeed

Root Cause:
  - Race condition in plugin v1.1.1 volume creation logic

Workaround:
  - Retry VM creation
  - Reduce concurrent provisioning operations

Source: https://hpevm-docs.morpheusdata.com/en/8.0.6-vme/release_notes/current.html
```

#### KI-007: VM Migration Failure Under Heavy Write IOPS (Alletra MP)

```
ID: KI-007
Component: Alletra MP Storage / Live Migration
Affected Versions: 8.0.4, 8.0.5, 8.0.6
Fixed Version: Not yet fixed
Severity: HIGH
Confidence: CONFIRMED

Error Signature:
  - Migration fails during heavy write I/O load
  - Migration timeout with active Alletra MP storage

Log Pattern (regex):
  - "migration.*fail.*timeout|migrate.*error.*I/O|migration.*abort"

Symptoms:
  - VM Migration to other hosts fails under heavy write-iops load
  - Migration hangs and eventually times out
  - VM remains on source host

Root Cause:
  - High write I/O during migration causes multipath instability
    with Alletra MP storage

Workaround:
  - Reduce write-iops prior to migration
  - Schedule migrations during low I/O periods

Source: https://hpevm-docs.morpheusdata.com/en/8.0.6-vme/release_notes/current.html
```

#### KI-008: Reconfigure Fails with CD-ROM Attached (Alletra MP)

```
ID: KI-008
Component: Alletra MP Storage / VM Reconfigure
Affected Versions: 8.0.4, 8.0.5, 8.0.6
Fixed Version: Not yet fixed
Severity: MEDIUM
Confidence: CONFIRMED

Error Signature:
  - Reconfigure Instance fails when CD-ROM attached

Log Pattern (regex):
  - "reconfigure.*fail.*CD.?ROM|reconfigure.*error.*cdrom"

Symptoms:
  - Reconfigure Instance with HPE Alletra MP datastore fails
    if there is an attached CD ROM

Root Cause:
  - Plugin cannot handle cdrom device during datastore reconfiguration

Workaround:
  - Delete the CD Drive before performing any reconfigure actions

Source: https://hpevm-docs.morpheusdata.com/en/8.0.6-vme/release_notes/current.html
```

#### KI-009: VM in Shutdown State Won't Migrate (Alletra MP)

```
ID: KI-009
Component: Alletra MP Storage / Migration
Affected Versions: 8.0.4, 8.0.5, 8.0.6
Fixed Version: Not yet fixed
Severity: MEDIUM
Confidence: CONFIRMED

Error Signature:
  - Shutdown VM cannot be migrated

Log Pattern (regex):
  - "cannot.*migrate.*shutdown|migration.*fail.*powered.off"

Symptoms:
  - VM in shutdown state will not migrate to new node until powered on
  - Cold migration of stopped VMs fails with Alletra MP

Workaround:
  - Power on the VM before attempting migration

Source: https://hpevm-docs.morpheusdata.com/en/8.0.6-vme/release_notes/current.html
```

#### KI-010: Ubuntu VM Fails to Start After Snapshot Revert (Alletra MP)

```
ID: KI-010
Component: Alletra MP Storage / Snapshots
Affected Versions: 8.0.6
Fixed Version: Not yet fixed
Severity: HIGH
Confidence: CONFIRMED

Error Signature:
  - VM fails to start after snapshot revert
  - cdrom device unmapped during revert

Log Pattern (regex):
  - "failed.*start.*after.*revert|cdrom.*unmapped|device.*not.*found.*after.*snapshot"

Symptoms:
  - Ubuntu VM created using ISO fails to start after snapshot revert
  - cdrom device becomes unmapped from the host during revert operation

Root Cause:
  - Snapshot revert logic does not properly preserve cdrom device mapping

Resolution:
  - Manually re-attach cdrom device after revert
  - Use Qcow2 images instead of ISO-based VMs

Source: https://hpevm-docs.morpheusdata.com/en/8.0.6-vme/release_notes/current.html
```

#### KI-011: Installer 1.0.7 Fails with VME 8.0.6 TUI

```
ID: KI-011
Component: Installer
Affected Versions: Installer 1.0.7 + VME 8.0.6
Fixed Version: Installer 1.0.8
Severity: HIGH
Confidence: CONFIRMED

Error Signature:
  - Installer fails during TUI-based deployment

Log Pattern (regex):
  - "installer.*fail.*deploy.*manager|TUI.*deploy.*error"

Symptoms:
  - VM Essentials installer 1.0.7 fails to deploy VME manager
    version 8.0.6 when using TUI (Text User Interface)

Root Cause:
  - Incompatibility between installer 1.0.7 and manager 8.0.6

Resolution:
  - Use installer version 1.0.8

Source: https://hpevm-docs.morpheusdata.com/en/8.0.6-vme/release_notes/current.html
```

#### KI-012: ISO Virtual Image Volume Creation Failure (Alletra MP)

```
ID: KI-012
Component: Alletra MP Storage / Provisioning
Affected Versions: 8.0.6
Fixed Version: 8.0.7
Severity: MEDIUM
Confidence: CONFIRMED

Error Signature:
  - Volume creation failure during VM creation with ISO images

Log Pattern (regex):
  - "volume.*creation.*fail|failed.*create.*volume.*ISO"

Symptoms:
  - VM creation with specific ISO virtual images fails at volume creation step

Workaround:
  - Use Qcow2-based images instead of ISO

Resolution:
  - Upgrade to v8.0.7

Source: https://hpevm-docs.morpheusdata.com/en/8.0.6-vme/release_notes/current.html
```

---


## SECTION 2: VMWARE-TO-HVM MIGRATION ISSUES

### MIG-001: QCOW2 Compatibility Version Mismatch (Veeam Backup Failure)

```
ID: MIG-001
Component: Storage / Migration / Backup Integration
Affected Versions: All versions using native migration tool
Fixed Version: Not yet fixed (manual workaround)
Severity: HIGH
Confidence: CONFIRMED (Veeam forums, HPE Discover Barcelona Dec 2025)

Error Message:
  "Failed to perform backup: Failed to start the backup job: internal error:
   unable to execute QEMU command 'transaction': Can't make bitmap
   'VeeamCheckpoint-...' persistent in 'libvirt-1-format': Cannot store
   dirty bitmaps in qcow2 v2 files"

Log Pattern (regex):
  - "Cannot store dirty bitmaps in qcow2 v2"
  - "unable to execute QEMU command.*transaction.*bitmap.*persistent"
  - "qcow2 v2 files"

Keywords: qcow2, compatibility, v2, v3, dirty bitmap, Veeam, backup failure

Symptoms:
  - Migrated VMs appear to work normally
  - Veeam backup jobs fail with dirty bitmap error
  - Only affects VMs migrated via native HPE VME migration tool
  - VMs created natively in VME work fine (they get qcow2 v3)

Environmental Conditions:
  - VM migrated from VMware using HPE VME native migration
  - Veeam backup configured for the migrated VM
  - Incremental backup (CBT/dirty bitmaps) attempted

Root Cause:
  - Native HPE VME migration creates qcow2 disks with compatibility=0.10 (v2)
  - Natively created VMs use compatibility=1.1 (v3)
  - qcow2 v2 format does NOT support persistent dirty bitmaps needed for
    incremental backup

Diagnostic Commands:
  - qemu-img info <disk.qcow2> | grep "compat"
  - Expected: "compat: 1.1" for working backups
  - Problem: "compat: 0.10" on migrated VMs

Resolution:
  1. Move the VM's disk from one datastore to another (storage migration within VME)
  2. The moved disk is automatically converted to compatibility version 1.1
  3. After conversion, Veeam can create checkpoints and run backups
  4. Requires sufficient free space on a second datastore

Post-Fix Validation:
  - qemu-img info <disk.qcow2> | grep "compat" → should show 1.1
  - Run Veeam backup job → should succeed

Source: https://forums.veeam.com/rhv-olvm-sc-hypercore-xcp-ng-hpe-vme-f62/migrated-vms-from-vmware-compatibility-issues-t101279.html
```

### MIG-002: Initramfs Missing VirtIO Drivers (Linux Boot Failure)

```
ID: MIG-002
Component: VM Boot / Migration / Storage Drivers
Affected Versions: All (any Linux VM migrated from VMware to HVM)
Fixed Version: N/A (pre-migration preparation required)
Severity: CRITICAL
Confidence: HIGH

Error Messages:
  "dracut-initqueue timeout"
  "rootfs not found"
  "Kernel panic - not syncing: VFS: Unable to mount root fs on unknown-block(0,0)"
  "Reached target Basic System" (hangs here)
  "waiting for device /dev/vda" timeout

Log Pattern (regex):
  - "dracut-initqueue.*timeout"
  - "VFS.*Unable to mount root fs on unknown-block"
  - "Kernel panic.*not syncing.*VFS"
  - "waiting for.*dev.vd[a-z].*timeout"
  - "rootfs.*not.*found"

Keywords: initramfs, initrd, dracut, virtio, virtio_scsi, virtio_blk, kernel panic

Symptoms:
  - VM boots through GRUB but hangs after loading initramfs
  - Kernel panic: VFS unable to mount root
  - System stuck at "Reached target Basic System"
  - No block devices visible in initrd environment

Environmental Conditions:
  - RHEL/CentOS/Rocky/Alma/Ubuntu/Debian VM
  - Migrated from VMware (using PVSCSI/LSI Logic)
  - Target uses VirtIO disk controller
  - VirtIO modules NOT in initramfs

Root Cause:
  - initramfs/initrd was built on VMware where VirtIO modules are unnecessary
  - After migration, KVM uses virtio_scsi/virtio_blk for disk I/O
  - Kernel loads but cannot see disks (no driver for VirtIO in initramfs)
  - Unable to mount root filesystem → kernel panic

Triggering Conditions:
  - Any VMware→KVM/HVM migration without pre-installing VirtIO drivers
  - Applies to HPE Rapid Migration Tool if VM not prepared

Resolution (Pre-migration — RECOMMENDED):
  # RHEL/CentOS/Rocky/Alma (dracut-based):
  dracut --add-drivers "virtio_balloon virtio_ring virtio_input virtio_pci \
    virtio virtio_blk virtio_net virtio_scsi" --force

  # Debian/Ubuntu (initramfs-tools):
  echo -e "virtio_pci\nvirtio_blk\nvirtio_scsi\nvirtio_net\nvirtio_balloon" \
    >> /etc/initramfs-tools/modules
  update-initramfs -u -k all

Resolution (Post-migration — rescue boot):
  1. Boot from rescue/live CD ISO
  2. Mount root filesystem: mount /dev/vda2 /mnt
  3. Mount boot: mount /dev/vda1 /mnt/boot
  4. Bind mounts: mount --bind /dev /mnt/dev; mount --bind /proc /mnt/proc
  5. Chroot: chroot /mnt
  6. Rebuild initramfs with VirtIO drivers
  7. Exit chroot, unmount, reboot

Verification:
  # RHEL: lsinitrd /boot/initramfs-$(uname -r).img | grep virtio
  # Ubuntu: lsinitramfs /boot/initrd.img-$(uname -r) | grep virtio

Related Patterns:
  - MIG-003 (GRUB issues often co-occur)
  - MIG-005 (NIC rename issues after boot succeeds)

Source: https://forum.proxmox.com/threads/vmware-to-kvm-convert-initramfs-failed-boot.38185/
Tool: https://github.com/nich0lasJ/zerto-hvm-migration-prep (Zerto HVM prep toolkit)
```

### MIG-003: BIOS/UEFI Firmware Mode Mismatch

```
ID: MIG-003
Component: VM Boot / Firmware
Affected Versions: All
Fixed Version: N/A (configuration issue)
Severity: CRITICAL
Confidence: HIGH

Error Messages:
  "Operating System not found"
  "No bootable device"
  "error: can't find command `linux16`"
  "error: can't find command `initrd16`"
  "Booting from Hard Disk..." (hangs indefinitely)

Log Pattern (regex):
  - "Operating System not found"
  - "No bootable device"
  - "can't find command.*linux16"
  - "can't find command.*initrd16"
  - "EFI.*boot.*fail|UEFI.*no.*boot"

Keywords: UEFI, BIOS, GPT, MBR, OVMF, firmware, EFI, linux16, initrd16

Symptoms:
  - VM shows "No bootable device" immediately
  - GRUB shell appears but commands fail
  - "linux16"/"initrd16" errors (BIOS-only commands on UEFI system)
  - VM boots to EFI shell instead of OS

Environmental Conditions:
  - Source VM was UEFI but target configured as BIOS (or vice versa)
  - GPT partition table with BIOS firmware = cannot boot
  - MBR partition table with UEFI firmware = cannot find bootloader

Root Cause:
  - Firmware type mismatch between source and target VM configuration
  - virt-v2v/libguestfs appliance boots in BIOS mode for conversion,
    generating BIOS-style GRUB config (linux16) even for UEFI VMs
  - OVMF firmware package not installed on KVM host

How to Distinguish:
  - "No bootable device" + GPT disk → needs UEFI firmware
  - "linux16 not found" → UEFI VM given BIOS grub config
  - Check: fdisk -l shows GPT → was UEFI; DOS/MBR → was BIOS

Resolution:
  1. Match firmware: UEFI source → UEFI target (use OVMF)
  2. Install OVMF on host: apt install ovmf (Ubuntu) / yum install edk2-ovmf (RHEL)
  3. For linux16/initrd16 errors:
     - Boot rescue mode
     - grub2-mkconfig -o /boot/efi/EFI/redhat/grub.cfg
     - Ensure grub uses "linux" and "initrd" (UEFI) not "linux16"/"initrd16" (BIOS)

Source: https://access.redhat.com/solutions/7142114
```

### MIG-004: Windows INACCESSIBLE_BOOT_DEVICE (BSOD)

```
ID: MIG-004
Component: VM Boot / Windows / Storage Drivers
Affected Versions: All (Windows Server 2012R2-2025)
Fixed Version: N/A (pre-migration preparation required)
Severity: CRITICAL
Confidence: HIGH

Error Message:
  Blue Screen: "INACCESSIBLE_BOOT_DEVICE" (Stop Code 0x0000007B)

Log Pattern (regex):
  - "INACCESSIBLE_BOOT_DEVICE"
  - "Stop.*0x0000007B"
  - "BSOD.*boot.*device"

Keywords: BSOD, blue screen, INACCESSIBLE_BOOT_DEVICE, viostor, vioscsi, VirtIO, Windows

Symptoms:
  - BSOD immediately after migration
  - VM boot loops endlessly
  - Cannot reach Windows login screen
  - Windows Event Log (if accessible): "The driver detected a controller error"

Environmental Conditions:
  - Windows VM migrated from VMware (LSI Logic SAS / PVSCSI)
  - Target uses VirtIO SCSI controller
  - VirtIO storage driver not loaded at boot time

Root Cause:
  - Windows treats boot controller change as critical failure
  - VirtIO SCSI driver (vioscsi/viostor) not registered as boot-start driver
  - Windows cannot find boot partition on new controller type

Resolution (Pre-migration — RECOMMENDED):
  1. Install VirtIO drivers on VMware VM:
     - Download virtio-win ISO from Fedora project
     - Run virtio-win-guest-tools.exe or virtio-win-gt-x64.msi
     - Set driver Start type to 0 (boot):
       HKLM\SYSTEM\CurrentControlSet\Services\vioscsi → Start = 0
       HKLM\SYSTEM\CurrentControlSet\Services\viostor → Start = 0
  2. Or DISM: dism /Online /Add-Driver /Driver:"D:\vioscsi\2k22\amd64" /Recurse

Resolution (Post-migration — Recovery):
  1. Boot VM with SATA controller temporarily (emulated)
  2. Install VirtIO drivers from within Windows
  3. Add dummy VirtIO SCSI disk to trigger driver activation
  4. Change boot disk back to VirtIO SCSI
  5. Or: Windows RE + DISM offline driver injection

Source: https://www.systemfixes.com/blog/2025/08/08/fix-inaccessible-boot-device-bsod-kvm-migration/
```

### MIG-005: NIC Renaming Issues After Migration

```
ID: MIG-005
Component: Networking / Migration
Affected Versions: All (any Linux with predictable naming)
Fixed Version: N/A (expected behavior, requires config update)
Severity: HIGH
Confidence: HIGH

Error/Symptom:
  - Network interface not found after migration
  - No IP address assigned
  - Services bound to old interface name fail

Log Pattern (regex):
  - "interface.*not.*found|NIC.*not.*found"
  - "RTNETLINK.*No such device"
  - "connection.*not.*available.*on.*device"
  - "Failed to start.*network|networking.*failed"

Keywords: ens192, enp1s0, ens3, eth0, predictable naming, udev, netplan, ifcfg

Symptoms:
  - Interface named ens192 (VMware) becomes enp1s0 or ens3 (KVM)
  - Old ifcfg/netplan files reference non-existent interface
  - No network connectivity despite VM booting successfully
  - systemctl status NetworkManager shows no managed interfaces

Root Cause:
  - VMware uses vmxnet3 → named ens192/ens160/eth0
  - KVM uses virtio-net → gets different predictable name (enp1s0, ens3)
  - Network config files still reference old VMware interface name
  - Stale udev rules from VMware persist

Resolution:
  1. Identify new name: ip link show
  2. Update network config:
     - RHEL: mv ifcfg-ens192 → ifcfg-enp1s0, update NAME=/DEVICE=
     - Ubuntu: edit /etc/netplan/*.yaml, change interface name
     - NM: nmcli connection modify "old" connection.interface-name "enp1s0"
  3. Remove stale udev rules:
     rm -f /etc/udev/rules.d/70-persistent-net.rules
  4. To force old-style naming (workaround):
     Add net.ifnames=0 biosdevname=0 to GRUB_CMDLINE_LINUX

Source: https://unix.stackexchange.com/questions/335461/predictable-network-interface-names-break-vm-migration
```

### MIG-006: Fstab Mount Failures (Device Name Changes)

```
ID: MIG-006
Component: Storage / Boot / Migration
Affected Versions: All
Fixed Version: N/A (configuration issue)
Severity: HIGH
Confidence: HIGH

Error Messages:
  "mount: special device /dev/sda1 does not exist"
  "Dependency failed for /boot"
  "You are in emergency mode"
  "A start job is running for /dev/disk/by-..."

Log Pattern (regex):
  - "special device.*dev.sd[a-z].*does not exist"
  - "Dependency failed for"
  - "emergency mode|emergency.target"
  - "A start job is running for.*dev"

Keywords: fstab, /dev/sda, /dev/vda, UUID, emergency mode, mount failure

Symptoms:
  - System drops to emergency/maintenance mode
  - Filesystem mounts fail
  - "Dependency failed" messages in journal

Root Cause:
  - VMware disks: /dev/sda, /dev/sdb (SCSI emulated)
  - KVM VirtIO disks: /dev/vda, /dev/vdb
  - fstab using /dev/sdX notation won't find devices on KVM

Resolution:
  1. Boot from rescue media
  2. Fix fstab — replace /dev/sda → /dev/vda:
     sed -i 's|/dev/sda|/dev/vda|g' /etc/fstab
  3. Better: switch to UUID-based mounting:
     UUID=xxxx-xxxx /boot ext4 defaults 0 2
  4. Also update GRUB if it references /dev/sda

Prevention:
  - Always use UUID= in fstab BEFORE migration

Source: Standard Linux administration knowledge, applicable to all VMware→KVM migrations
```

### MIG-007: LVM Devices File Mismatch (RHEL 8+)

```
ID: MIG-007
Component: LVM / Storage / Migration
Affected Versions: All (RHEL 8+, Rocky 8+, Alma 8+)
Fixed Version: N/A (expected behavior)
Severity: HIGH
Confidence: CONFIRMED

Error Messages:
  "Devices file sys_wwid <wwid> last seen on <devnode> not found"
  "Devices file PVID <ID> last seen on /dev/sda not found"
  "Volume group \"vg_name\" not found"
  "WARNING: Device /dev/vda2 not initialized in udev database"

Log Pattern (regex):
  - "Devices file.*PVID.*not found"
  - "Devices file.*sys_wwid.*not found"
  - "Volume group.*not found"
  - "Device.*not initialized in udev database"

Keywords: LVM, devices file, system.devices, WWID, PV, VG, lvmdevices

Symptoms:
  - LVM volumes not visible after migration
  - VG does not activate at boot
  - pvs/vgs/lvs show "not found" errors
  - System drops to emergency mode

Root Cause:
  - RHEL 8+ uses /etc/lvm/devices/system.devices to track PVs by WWID
  - VMware disk WWID ≠ KVM VirtIO disk WWID (completely different)
  - LVM devices file still references old VMware WWIDs
  - VG won't activate because PVs can't be found

Resolution:
  # Option 1: Refresh devices file
  lvmdevices --update

  # Option 2: Delete and let LVM rediscover
  rm /etc/lvm/devices/system.devices
  vgscan
  vgchange -ay

  # Option 3: Disable devices file
  # In /etc/lvm/lvm.conf: use_devicesfile = 0

Post-Fix Validation:
  pvs → shows PVs on /dev/vdaX
  vgs → shows VG active
  lvs → shows LVs available

Source: https://access.redhat.com/solutions/7025698
```

### MIG-008: GRUB Bootloader Failures After Migration

```
ID: MIG-008
Component: Boot / GRUB / Migration
Affected Versions: All (RHEL 7-9, CentOS, Ubuntu)
Fixed Version: N/A (post-migration repair needed)
Severity: HIGH
Confidence: HIGH

Error Messages:
  "error: file '/boot/grub2/grub.cfg' not found"
  "error: can't find command `linux16`"
  GRUB shell prompt: "grub>"
  VM hangs at "GRUB" text

Log Pattern (regex):
  - "grub.*not found|grub.cfg.*not found"
  - "can't find command.*linux16"
  - "error:.*no such partition"

Keywords: GRUB, grub2, grub.cfg, linux16, initrd16, rescue, bootloader

Symptoms:
  - VM drops to grub> or grub rescue> prompt
  - GRUB loads but fails to find kernel/initrd
  - Boot loops to GRUB menu
  - Wrong root device referenced in grub.cfg

Root Cause:
  - grub.cfg references wrong device (/dev/sda → should be /dev/vda)
  - UEFI VM given BIOS grub commands (linux16 vs linux)
  - libguestfs always boots in BIOS mode during conversion

Resolution:
  1. Boot from rescue media
  2. Mount root + boot partitions
  3. Chroot into system
  4. Regenerate GRUB:
     # BIOS: grub2-mkconfig -o /boot/grub2/grub.cfg && grub2-install /dev/vda
     # UEFI: grub2-mkconfig -o /boot/efi/EFI/redhat/grub.cfg
  5. Verify root= references correct device

Source: https://knowledge.broadcom.com/external/article/449488/
```

### MIG-009: VMware Tools Conflict After Migration

```
ID: MIG-009
Component: Guest Agent / Migration
Affected Versions: All
Fixed Version: N/A (cleanup required)
Severity: MEDIUM
Confidence: HIGH

Error Messages (Windows):
  - Uninstall Error 1603 (cannot detect hypervisor)
  - vmStatsProvider.dll locked
  - VMware SVGA/VMCI/PVSCSI ghost devices in Device Manager

Log Pattern (regex):
  - "VMware Tools.*error.*1603|vmtools.*uninstall.*fail"
  - "vmStatsProvider.*locked|cannot.*remove.*VMware"

Keywords: VMware Tools, open-vm-tools, qemu-guest-agent, ghost devices, uninstall

Symptoms:
  - VMware Tools uninstaller fails (can't detect hypervisor)
  - Leftover drivers cause instability
  - Network loss if vmxnet3 driver removed without VirtIO ready
  - Conflict between VMware Tools services and QEMU Guest Agent

Root Cause:
  - VMware Tools detects it's not on VMware → refuses to uninstall
  - Ghost devices from old hardware remain

Resolution (Best Practice):
  - Uninstall VMware Tools BEFORE migration

Resolution (Linux post-migration):
  apt remove open-vm-tools OR yum remove open-vm-tools
  apt install qemu-guest-agent / yum install qemu-guest-agent
  systemctl enable --now qemu-guest-agent

Resolution (Windows post-migration):
  1. Remove hidden VMware devices via Device Manager
  2. Clean driver store: pnputil /delete-driver <package> /force
  3. Remove VMware services, files, registry keys
  4. Install QEMU Guest Agent

Source: https://community.veeam.com/blogs-and-podcasts-57/how-to-safely-clean-up-your-windows-vms-after-a-vmware-migration-using-veeam-11181
```

---


## SECTION 3: CLUSTER AND HIGH AVAILABILITY ISSUES

### CL-001: Host Joining Cluster Failure — License Socket Limit

```
ID: CL-001
Component: Cluster Management / Licensing
Affected Versions: All
Severity: MEDIUM
Confidence: CONFIRMED

Error Message:
  "Provisioning request exceeds the maximum HPE VM sockets allowed.
   Please check your license and upgrade if necessary."

Log Pattern (regex):
  - "exceeds the maximum HPE VM sockets"
  - "license.*upgrade|socket.*limit.*exceeded"

Symptoms:
  - Cannot add new host to cluster
  - Provisioning operations blocked
  - Error appears in UI Activity tab

Root Cause:
  - License socket count reached maximum
  - New host would exceed licensed socket capacity

Resolution:
  - Check current license usage in Administration > License
  - Upgrade or add stacking license (v8.0.4+ supports stacking)

Source: https://discuss.morpheusdata.com/t/unable-to-create-hpe-vm-mvm-cluster-with-error-in-provisioning-request/2250
```

### CL-002: Host Joining Failure — Network Interface Name Mismatch

```
ID: CL-002
Component: Cluster Management / Networking
Affected Versions: All
Severity: HIGH
Confidence: CONFIRMED (real-world deployment blog)

Error Signature:
  - Cluster creation fails at first attempt
  - UI fields default back after failure

Log Pattern (regex):
  - "interface.*not found|bond.*not found"
  - "cluster.*creation.*fail.*network"

Symptoms:
  - Cluster creation or host addition fails
  - Interface names are case-sensitive (e.g., "Bond0" ≠ "bond0")
  - After failure, many UI fields reset to defaults

Root Cause:
  - Compute Net Interface name entered with wrong case (e.g., capital B)
  - Interface names in Ubuntu/HPE VME are case-sensitive

Resolution:
  - Double-check exact interface name: ip link show
  - Match case exactly in cluster wizard
  - Re-enter all fields after a failed attempt (they reset)

Source: https://my-sddc.net/new-tech-vm-essentials-a-more-serious-deployment/
```

### CL-003: Host Joining Failure — Duplicate machine-id

```
ID: CL-003
Component: Cluster Management / Host Identity
Affected Versions: All
Severity: HIGH
Confidence: CONFIRMED

Error Signature:
  - Cloned hosts get MAC address conflicts
  - Second host cannot properly join cluster

Log Pattern (regex):
  - "mac.*conflict|duplicate.*machine-id|identity.*collision"

Symptoms:
  - Cloned Ubuntu VMs used as HVM hosts have identical machine-id
  - MAC address conflicts on bond interfaces
  - Cluster communication fails between nodes with same identity

Root Cause:
  - Cloned hosts without regenerating /etc/machine-id
  - machine-id drives MAC generation for bond adapters

Resolution:
  sudo rm /etc/machine-id
  systemd-machine-id-setup
  reboot

Prevention:
  - Always regenerate machine-id after cloning a host

Source: https://my-sddc.net/new-tech-vm-essentials-a-more-serious-deployment/
```

### CL-004: Split-Brain — Cluster Partition Without Quorum

```
ID: CL-004
Component: Cluster / Corosync / Quorum
Affected Versions: All
Severity: CRITICAL
Confidence: HIGH

Error Messages:
  "partition WITHOUT quorum"
  "Activity blocked"
  "Quorate: No"

Log Pattern (regex):
  - "partition WITHOUT quorum"
  - "Activity blocked"
  - "Quorate:.*No"
  - "Token.*timeout|ring.*disconnected"

Keywords: split-brain, quorum, corosync, partition, fencing, STONITH

Symptoms:
  - pcs status shows "partition WITHOUT quorum"
  - corosync-quorumtool shows "Activity blocked"
  - Resources stop on minority partition
  - Risk: both sides may try running same VMs (data corruption)

Diagnostic Commands:
  pcs status
  corosync-quorumtool -s
  corosync-cfgtool -s

Root Cause:
  - Network partition on management/cluster network
  - UDP ports 5404/5405 blocked or unreachable
  - MTU mismatch on cluster communication network
  - Bond interface failure on management NIC
  - STONITH not configured (no definitive node death detection)

Contributing Factors:
  - Two-node cluster without proper two_node: 1 configuration
  - No dedicated cluster communication network
  - No quorum device configured for even-numbered clusters

Resolution:
  1. Verify network: corosync-cfgtool -s (check ring status)
  2. Check UDP 5404/5405 connectivity between all nodes
  3. For 2-node: enable two_node: 1 in corosync.conf quorum section
  4. ALWAYS configure STONITH: pcs property set stonith-enabled=true
  5. Emergency: pcs quorum unblock (DANGEROUS - only when majority permanently lost)

Prevention:
  - Use 3+ nodes or configure quorum device
  - Dedicate network interface to cluster heartbeat
  - Configure STONITH/fencing for every node

Source: https://www.simplified.guide/pacemaker/quorum-loss-troubleshoot
```

### CL-005: Fencing/STONITH Not Configured

```
ID: CL-005
Component: Cluster / Fencing
Affected Versions: All
Severity: CRITICAL
Confidence: HIGH

Error Messages:
  "No STONITH resources have been defined"
  "stonith-enabled is not set to true"
  "WARNING: no stonith devices and stonith-enabled is not false"

Log Pattern (regex):
  - "No STONITH resources"
  - "stonith-enabled.*not.*true"
  - "no stonith devices"
  - "WARNING.*stonith"

Symptoms:
  - pcs status shows STONITH warning
  - Failed nodes cannot be definitively confirmed dead
  - VMs on failed host not restarted (no fence confirmation)
  - Risk of data corruption during split-brain

Root Cause:
  - STONITH disabled (stonith-enabled=false)
  - No fence agents configured
  - Missing: fence device for each cluster node

Resolution (HPE iLO):
  pcs property set stonith-enabled=true
  pcs stonith create fence-node1 fence_ipmilan \
    ipaddr=<iLO_IP> login=<user> passwd=<pass> \
    lanplus=1 pcmk_host_list=node1 \
    pcmk_host_check=static-list \
    op monitor interval=60s

Validation:
  # Test fencing agent:
  fence_ipmilan -a <iLO_IP> -l <user> -p <pass> -o status --lanplus
  # Test fencing:
  pcs stonith fence <nodename>
  # Verify:
  pcs stonith show

Source: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/8/html/configuring_and_managing_high_availability_clusters/assembly_configuring-fencing
```

### CL-006: VM HA Failover Timing (~5.5 Minutes Total)

```
ID: CL-006
Component: HA / VM Failover
Affected Versions: All (observed behavior)
Severity: INFORMATIONAL
Confidence: CONFIRMED (real-world testing)

Observed Behavior:
  - Host failure detection: ~4 minutes
  - VM restart on surviving host: ~1 minute
  - Total outage: ~5.5 minutes from host loss to VM responding

Log Pattern (regex):
  - "host.*offline|host.*unreachable|node.*lost"
  - "vm.*restart.*on.*host|failover.*triggered"

Symptoms:
  - Several minutes pass before manager detects host failure
  - VM is then restarted on another host
  - After host recovery, ~10 minutes before fully re-registered

Prerequisites for HA Failover:
  1. VM placement policy set to "Automatic" (not pinned)
  2. Shared storage accessible from all hosts (Ceph/NFS/iSCSI)
  3. STONITH configured for definitive host death detection
  4. Sufficient resources on surviving hosts

Source: https://my-sddc.net/new-tech-vm-essentials-a-more-serious-deployment/
```

### CL-007: VLAN Tagging Conflict with OVS

```
ID: CL-007
Component: Networking / OVS / VLANs
Affected Versions: All
Severity: HIGH
Confidence: CONFIRMED (community-verified fix)

Error Signature:
  - VM networking not working with VLANs
  - VLANs defined in Netplan conflict with Open vSwitch

Log Pattern (regex):
  - "OVS.*VLAN.*conflict|vlan.*not.*working"
  - "no carrier.*bond3|interface.*down"

Symptoms:
  - VMs cannot communicate on VLAN-tagged networks
  - Network traffic doesn't pass through
  - Works fine without VLANs or with physical-layer tagging

Root Cause:
  - Defining VLANs in Netplan (e.g., bond3.vms.101, bond3.vms.102)
    creates conflict with OVS
  - OVS handles VLAN tagging for VM traffic — cannot coexist with
    kernel VLAN interfaces on same bond

Resolution:
  1. Remove ALL VLAN definitions from Netplan (except Management VLAN)
  2. Let OVS/HPE VME handle VLAN tagging for VM networks
  3. Use hpe-vme tool to manage network config
  4. Only keep management VLAN at Netplan level if required

Configuration (correct — in Netplan):
  # bonds:
  #   bond3-vms:
  #     interfaces: [ens192, ens224]
  #     ... NO vlan sub-interfaces here

Then configure compute VLANs in VME cluster wizard.

Source: https://my-sddc.net/new-tech-vm-essentials-a-more-serious-deployment/ (jsuarez25 comment)
```

---


## SECTION 4: GFS2 STORAGE ISSUES

### GFS2-001: dlm_new_lockspace Error (Mount Failure)

```
ID: GFS2-001
Component: GFS2 / DLM / Cluster Storage
Affected Versions: All (GFS2 on any HVM cluster)
Severity: CRITICAL
Confidence: CONFIRMED (Red Hat KB + HPE VME fix in 8.0.3)

Error Messages:
  "gfs2: fsid=<cluster>:<fs>: dlm_new_lockspace error -17"
  "gfs2: fsid=<cluster>:<fs>: dlm_new_lockspace error -16"
  "gfs2: fsid=<cluster>:<fs>: dlm_new_lockspace error -107"
  "gfs2: fsid=<cluster>:<fs>: dlm_new_lockspace error -5"
  "ERROR: Couldn't mount device [/dev/<vg>/<lv>]"

Log Pattern (regex):
  - "gfs2.*dlm_new_lockspace error -\\d+"
  - "Couldn't mount device.*dev"
  - "GFS2.*mount.*fail"

Error Code Meanings:
  -5  (EIO): I/O error communicating with DLM
  -16 (EBUSY): lockspace already exists / DLM busy
  -17 (EEXIST): lockspace name already in use
  -107 (ENOTCONN): Transport endpoint not connected (DLM not running)

Keywords: dlm_new_lockspace, GFS2, DLM, lockspace, mount failure

Symptoms:
  - GFS2 filesystem fails to mount
  - Cluster storage unavailable on one or more nodes
  - VMs cannot be placed on affected hosts

Root Cause (by error code):
  -107: DLM daemon not running or cluster not active
  -17: Previous mount not properly cleaned up
  -16: Another mount operation in progress
  -5: Network I/O issue to DLM

Diagnostic Commands:
  systemctl status dlm
  pcs status
  pcs resource show
  dlm_tool ls        # List lockspaces
  dlm_tool status    # DLM status

Resolution:
  For -107 (not connected):
    systemctl start dlm
    pcs cluster start   # Ensure cluster services running

  For -17 (exists):
    dlm_tool ls         # Check if lockspace already active
    umount -f /mount    # Force unmount if stale
    # Or reboot the node

  For -16 (busy):
    Wait for other mount to complete, or:
    dlm_tool close <lockspace_name>

  For -5 (I/O error):
    Check network between nodes (UDP port 21064 for DLM)
    corosync-cfgtool -s   # Verify ring connectivity

Related: KI-001 (HPE VME 8.0.3 fixed GFS2 mount on new nodes)

Source: https://access.redhat.com/solutions/7084324
```

### GFS2-002: GFS2 Filesystem Withdraw

```
ID: GFS2-002
Component: GFS2 / Data Integrity
Affected Versions: All
Severity: CRITICAL
Confidence: HIGH

Error Messages:
  "GFS2: fsid=<cluster>:<fs>: withdrawing"
  "GFS2: fsid=<cluster>:<fs>: about to withdraw from the filesystem"
  "GFS2: fsid=<cluster>:<fs>: telling LM to withdraw"
  "fatal: filesystem consistency error"
  "function = <func>, file = fs/gfs2/<file>.c, line = <N>"

Log Pattern (regex):
  - "GFS2.*withdraw"
  - "GFS2.*fatal.*filesystem consistency error"
  - "telling LM to withdraw"
  - "function =.*file = fs/gfs2"

Keywords: withdraw, filesystem consistency, data integrity, GFS2, corruption

Symptoms:
  - GFS2 filesystem becomes read-only or unavailable on the node
  - All I/O to the filesystem fails after withdraw
  - VMs on affected storage become unresponsive
  - Cluster may fence the withdrawn node

Root Cause:
  - GFS2 detected inconsistency after I/O operation
  - Data integrity protection mechanism — prevents further corruption
  - Possible causes: storage hardware error, SAN issue, split-brain
    without fencing, firmware bug, kernel bug

Triggering Conditions:
  - I/O errors from underlying storage (multipath failure, SAN issue)
  - Split-brain without proper fencing
  - Kernel bug in GFS2 code (specific versions)
  - Corrupt journal entries

How to Distinguish Causes:
  - Check dmesg for underlying I/O errors BEFORE the withdraw
  - Check if fencing was configured and working
  - Check if multiple nodes withdrew simultaneously (→ storage issue)
  - Single node withdraw (→ likely that node's I/O path issue)

Resolution:
  1. In most cases: reboot or fence the withdrawn node
  2. The withdraw gives opportunity to relocate services to other nodes
  3. After reboot, GFS2 journal replay occurs automatically
  4. If corruption persists: fsck.gfs2 (ONLY when unmounted on ALL nodes)

Recovery Procedure:
  # On ALL nodes:
  umount /mountpoint
  # On ONE node:
  fsck.gfs2 -y /dev/vg/lv
  # Then remount on all nodes

Post-Fix Validation:
  mount | grep gfs2   # Verify mounted
  touch /mountpoint/test   # Verify write access
  gfs2_tool df /mountpoint   # Check filesystem health

Source: https://access.redhat.com/solutions/332223
       https://access.redhat.com/solutions/141203
```

### GFS2-003: Journal Exhaustion (Too Many Nodes)

```
ID: GFS2-003
Component: GFS2 / Journals / Cluster Scaling
Affected Versions: All
Severity: HIGH
Confidence: CONFIRMED

Error Message:
  "Too many nodes mounting filesystem, no free journals"

Log Pattern (regex):
  - "Too many nodes mounting filesystem"
  - "no free journals"
  - "GFS2.*journal.*exhaust"

Keywords: journals, GFS2, cluster scaling, mount failure

Symptoms:
  - GFS2 mount fails on additional node
  - Existing nodes still working
  - Cannot add more hosts to shared storage

Root Cause:
  - GFS2 requires one journal per node that mounts the filesystem
  - Filesystem created with insufficient journals for cluster size
  - Default journal count may be too low

Diagnostic:
  gfs2_tool df /mountpoint   # Shows journal count
  gfs2_jadd -j 2 /dev/vg/lv   # Add journals

Resolution:
  # Add journals (run from mounted node):
  gfs2_jadd -j <count> /dev/vg/lv
  # Then mount on the new node

Prevention:
  - Create GFS2 with enough journals for planned cluster size:
    mkfs.gfs2 -j <num_nodes+2> -p lock_dlm -t cluster:fsname /dev/vg/lv

Source: https://access.redhat.com/solutions/290003
```

### GFS2-004: DLM Hung Tasks (120s Timeout)

```
ID: GFS2-004
Component: DLM / GFS2 / Performance
Affected Versions: All
Severity: HIGH
Confidence: HIGH

Error Messages:
  "INFO: task <process>:<pid> blocked for more than 120 seconds"
  "echo 0 > /proc/sys/kernel/hung_task_timeout_secs disables this message"
  "DLM: ... locking ... waiting"

Log Pattern (regex):
  - "task.*blocked for more than \\d+ seconds"
  - "hung_task_timeout"
  - "DLM.*waiting|dlm.*lock.*timeout"

Keywords: hung task, DLM, 120 seconds, blocked, lock contention

Symptoms:
  - System logs 120-second hung task warnings
  - I/O operations stall
  - VM performance degraded
  - Filesystem appears frozen temporarily

Root Cause:
  - DLM lock contention between nodes
  - Network latency causing DLM responses to be delayed
  - Heavy concurrent access to same GFS2 regions
  - Possible: one node slow to respond to lock requests

Contributing Factors:
  - Too many VMs on same GFS2 filesystem
  - Insufficient network bandwidth for DLM traffic
  - DLM traffic sharing network with other heavy traffic

Diagnostic Commands:
  dlm_tool dump
  dlm_tool lockdump <lockspace>
  cat /sys/kernel/debug/dlm/<lockspace>   # Lock state

Resolution:
  - Ensure dedicated storage network for DLM (bond1-ceph in VME)
  - Reduce lock contention: spread VMs across multiple GFS2 filesystems
  - Increase hung_task_timeout (symptom relief, not fix):
    sysctl -w kernel.hung_task_timeout_secs=300
  - Verify network health between cluster nodes

Source: Red Hat DLM documentation, HPE VM Essentials architecture guide
```

### GFS2-005: GFS2 Filesystem Not Mounting After Node Reboot

```
ID: GFS2-005
Component: GFS2 / Cluster Services / Boot
Affected Versions: All
Severity: HIGH
Confidence: CONFIRMED (Proxmox/KVM community + HPE VME)

Error Messages:
  "Global lock failed: check that global lockspace is started"
  "mount: Transport endpoint is not connected"

Log Pattern (regex):
  - "Global lock failed.*global lockspace"
  - "Transport endpoint is not connected"
  - "mount.*gfs2.*fail.*boot"

Symptoms:
  - After node reboot, GFS2 does not mount automatically
  - Manual mount also fails until cluster services fully started
  - VMs on GFS2 cannot start on rebooted node

Root Cause:
  - GFS2 mount attempted before DLM/cluster services fully initialized
  - Service ordering: corosync → pacemaker → DLM → GFS2 mount
  - If any step delayed, GFS2 mount fails

Resolution:
  1. Ensure proper service ordering (Pacemaker manages GFS2 as resource):
     pcs resource create gfs2-mount Filesystem \
       device="/dev/vg/lv" directory="/mnt/gfs2" fstype="gfs2" \
       clone interleave=true
  2. Verify cluster services started:
     pcs cluster start
     systemctl status corosync pacemaker dlm
  3. Manual recovery: wait for cluster, then mount

Source: https://forum.proxmox.com/threads/gfs2-filesystem-does-not-mount-automatically-after-node-reboot.173173/
       https://unix.stackexchange.com/questions/655446/
```

---


## SECTION 5: NFS STORAGE ISSUES

### NFS-001: NFS Mount Permission Denied

```
ID: NFS-001
Component: NFS Storage / Permissions
Affected Versions: All
Severity: HIGH
Confidence: HIGH

Error Messages:
  "mount.nfs: access denied by server while mounting"
  "Permission denied"
  "RPC: AUTH_TOOWEAK"
  "clnt_create: RPC: Program not registered"

Log Pattern (regex):
  - "access denied by server while mounting"
  - "Permission denied.*nfs|nfs.*permission denied"
  - "RPC.*AUTH_TOOWEAK"
  - "Program not registered"

Keywords: NFS, permission denied, exports, root_squash, mount failure

Symptoms:
  - NFS mount fails from HVM host
  - Manager appliance cannot connect to NFS share
  - Datastore shows as inaccessible

Root Cause:
  - NFS export doesn't include the host IP/subnet
  - root_squash prevents root operations (needed for VM disk files)
  - NFS server firewall blocking ports (2049, 111, mountd)
  - NFS service not running on server

HPE VME Specific Note:
  - NFS connection is made from the Manager appliance, not directly from hosts
  - Manager IP must be in NFS server exports
  - NFSv3 recommended for file shares in HPE VME

Diagnostic Commands:
  showmount -e <nfs_server>        # Check available exports
  rpcinfo -p <nfs_server>          # Check NFS services registered
  nfsstat -c                        # Client stats

Resolution:
  1. On NFS server, ensure export includes Manager IP:
     /export/vms  10.0.0.0/24(rw,no_root_squash,sync,no_subtree_check)
  2. Apply: exportfs -ra
  3. Open firewall: ports 2049 (nfs), 111 (rpcbind), dynamic mountd port
  4. Verify: showmount -e <server> from Manager host

Source: https://access.redhat.com/solutions/3773891
```

### NFS-002: NFS Stale File Handle

```
ID: NFS-002
Component: NFS Storage / File Handles
Affected Versions: All
Severity: HIGH
Confidence: HIGH

Error Messages:
  "Stale file handle"
  "NFS: stale file handle"
  "mount.nfs: Stale file handle"

Log Pattern (regex):
  - "Stale file handle|stale NFS file handle"
  - "NFS.*stale"
  - "ESTALE"

Keywords: stale, file handle, NFS, ESTALE, server reboot, export reload

Symptoms:
  - I/O operations fail with "Stale file handle"
  - ls/read/write on mounted NFS path returns error
  - VMs on NFS storage become unresponsive
  - Unmount may also fail with same error

Root Cause:
  - NFS server rebooted or export reloaded
  - fsid changed on server side after reconfiguration
  - File/directory deleted on server but client still has handle cached
  - Server filesystem recreated with different generation

Resolution:
  1. Try: umount -f /mount && mount /mount
  2. If umount fails: umount -l /mount (lazy unmount) then remount
  3. Ensure consistent fsid= in exports (survives server restarts):
     /export/vms  10.0.0.0/24(rw,fsid=100,no_root_squash,sync)
  4. After NFS server reboot, remount on all clients

Prevention:
  - Always use fsid= option in NFS exports
  - Use hard mount option on clients (default)

Source: https://unix.stackexchange.com/questions/433051/
```

### NFS-003: NFS Datastore Goes Offline (APD State)

```
ID: NFS-003
Component: NFS Storage / Connectivity
Affected Versions: All
Severity: CRITICAL
Confidence: HIGH

Error Signature:
  - NFS datastore becomes inaccessible
  - All VMs on datastore freeze or power off
  - APD (All Paths Down) equivalent state

Log Pattern (regex):
  - "NFS.*server.*not responding"
  - "nfs.*timeout|NFS.*timed out"
  - "datastore.*inaccessible|storage.*offline"

Keywords: APD, NFS, timeout, datastore offline, server not responding

Symptoms:
  - VM I/O freezes (if hard mount)
  - After ~140 seconds, VMs may be restarted on other hosts
  - NFS server unreachable from one or more cluster nodes

Root Cause:
  - NFS server failure or network interruption
  - Network MTU mismatch causing packet drops
  - NFS server overloaded (too many connections)
  - Switch/routing issue on storage network

Diagnostic Commands:
  ping <nfs_server>
  nfsstat -c     # Connection statistics
  mount -v | grep nfs   # Check mount options
  dmesg | grep -i nfs   # Kernel NFS messages

Resolution:
  1. Check NFS server health and connectivity
  2. Verify network path (traceroute, ping with payload)
  3. Check MTU end-to-end: ping -M do -s 8972 <nfs_server>
  4. After connectivity restored: verify mounts auto-recover (hard mount)
  5. If not recovering: umount -f && mount

HPE VME Note:
  - VM failover detection takes ~4-5 minutes
  - Use dedicated storage network (bond2-nfs in reference architecture)

Source: https://knowledge.broadcom.com/external/article/308081/
```

---

## SECTION 6: iSCSI STORAGE ISSUES

### ISCSI-001: iSCSI Target Discovery Failure

```
ID: ISCSI-001
Component: iSCSI / Storage Connectivity
Affected Versions: All
Severity: HIGH
Confidence: HIGH

Error Messages:
  "iscsiadm: No portals found"
  "iscsiadm: cannot make connection to X.X.X.X: Connection refused"
  "iscsiadm: discovery login to X.X.X.X rejected: target error"

Log Pattern (regex):
  - "iscsiadm.*No portals found"
  - "iscsiadm.*cannot make connection.*Connection refused"
  - "iscsiadm.*discovery.*rejected"
  - "iscsi.*target.*connect.*error"

Keywords: iscsiadm, discovery, sendtargets, portal, connection refused

Symptoms:
  - Cannot discover iSCSI targets from HVM host
  - Storage not visible for VM provisioning
  - iscsiadm -m discovery returns no results

Root Cause:
  - Network connectivity failure to target IP
  - iSCSI target service not running / port 3260 not listening
  - Firewall blocking TCP 3260
  - MTU mismatch causing packet fragmentation/drops

Diagnostic Commands:
  iscsiadm -m discovery -t sendtargets -p <target_ip>
  telnet <target_ip> 3260
  ping -s 1472 <target_ip>   # Test jumbo frames
  cat /etc/iscsi/initiatorname.iscsi   # Check IQN

Resolution:
  1. Verify network: ping <target_ip>
  2. Check port: telnet <target_ip> 3260
  3. Verify initiator IQN matches target ACL
  4. Check firewall: ufw allow 3260/tcp
  5. Run discovery: iscsiadm -m discovery -t sendtargets -p <target_ip>

Source: https://knowledge.broadcom.com/external/article/425963
```

### ISCSI-002: iSCSI Session Timeout/Flapping

```
ID: ISCSI-002
Component: iSCSI / Session Management
Affected Versions: All
Severity: HIGH
Confidence: HIGH

Error Messages:
  "connection1:0: ping timeout of 5 secs expired"
  "session recovery timed out after X secs"
  "connection X:0: detected conn error (1020)"
  "iSCSI connection flapping between 'offline' and 'online'"

Log Pattern (regex):
  - "ping timeout.*expired"
  - "session recovery timed out"
  - "detected conn error.*1020"
  - "iscsi.*connection.*flapping|iscsi.*offline.*online"

Keywords: iSCSI, timeout, flapping, ping, session recovery, noop

Symptoms:
  - Storage path intermittently goes offline/online
  - Brief I/O pauses during session recovery
  - VM performance degradation
  - Potential VM freezes during path failures

Root Cause:
  - Network instability / micro-interruptions
  - Default timers too aggressive for environment
  - NIC driver issues
  - Network congestion on iSCSI VLAN

Key Parameters (/etc/iscsi/iscsid.conf):
  node.conn[0].timeo.noop_out_interval = 5
  node.conn[0].timeo.noop_out_timeout = 5
  node.session.timeo.replacement_timeout = 120  # CRITICAL for multipath

Resolution:
  1. Tune replacement_timeout for multipath:
     node.session.timeo.replacement_timeout = 15
  2. Use dedicated iSCSI network (separate from management/VM)
  3. Check NIC driver/firmware updates
  4. Verify no congestion: iperf3 -c <target_ip>

Source: https://knowledge.broadcom.com/external/article/311035
```

### ISCSI-003: iSCSI CHAP Authentication Failure

```
ID: ISCSI-003
Component: iSCSI / Authentication
Affected Versions: All
Severity: MEDIUM
Confidence: HIGH

Error Messages:
  "iscsiadm: initiator reported error (24 - iSCSI login failed
   due to authorization failure)"
  "iscsiadm: Could not login to [iface: default, target: iqn.xxx]"
  "iscsiadm: Could not log into all portals"

Log Pattern (regex):
  - "iSCSI login failed due to authorization"
  - "error.*24.*authorization failure"
  - "Could not login.*target"
  - "Could not log into all portals"

Keywords: CHAP, authentication, login failure, authorization, iSCSI

Symptoms:
  - Cannot login to iSCSI target
  - Discovery succeeds but login fails
  - Error 24 in iscsiadm output

Root Cause:
  - CHAP username/password mismatch
  - Initiator IQN not in target ACL
  - Mutual CHAP not configured symmetrically
  - Authentication method mismatch

Resolution:
  1. Configure CHAP in /etc/iscsi/iscsid.conf:
     node.session.auth.authmethod = CHAP
     node.session.auth.username = <username>
     node.session.auth.password = <password>
  2. Verify initiator IQN matches target ACL exactly
  3. Check target-side logs for rejection reason
  4. Restart iscsid after config changes

Source: https://unix.stackexchange.com/questions/679588/
```

---

## SECTION 7: FIBRE CHANNEL ISSUES

### FC-001: FC HBA Not Detected

```
ID: FC-001
Component: Fibre Channel / HBA
Affected Versions: All
Severity: HIGH
Confidence: HIGH

Error Messages:
  "modprobe: FATAL: Module qla2xxx not found"
  "qla2xxx: Failed to initialize adapter"
  "lpfc: firmware download failed"

Log Pattern (regex):
  - "Module qla2xxx not found"
  - "qla2xxx.*Failed to initialize"
  - "lpfc.*firmware.*failed"
  - "fc_host.*not found"

Keywords: qla2xxx, lpfc, FC HBA, Fibre Channel, firmware, driver

Symptoms:
  - No FC HBA in lspci output
  - systool -c fc_host returns empty
  - Cannot present FC LUNs to host
  - No /sys/class/fc_host entries

Root Cause:
  - Missing FC HBA driver (qla2xxx for QLogic, lpfc for Emulex)
  - Firmware incompatibility with Ubuntu 22.04/24.04 kernel
  - PCIe slot not properly seated
  - BIOS/UEFI not enabling the HBA

Diagnostic Commands:
  lspci | grep -i fibre
  lsmod | grep -E "qla2xxx|lpfc"
  systool -c fc_host -v
  cat /sys/class/fc_host/host*/port_state

Resolution:
  1. Check presence: lspci | grep -i fibre
  2. Load driver: modprobe qla2xxx (or lpfc)
  3. Verify: cat /sys/class/fc_host/host*/port_state
  4. If "Linkdown": check cable/switch
  5. Update firmware to version validated for Ubuntu 22.04/24.04

Source: https://access.redhat.com/solutions/9936
```

### FC-002: FC Zoning — LUN Not Visible

```
ID: FC-002
Component: Fibre Channel / Zoning / LUN Masking
Affected Versions: All
Severity: HIGH
Confidence: HIGH

Error Signature:
  - LUNs visible on some hosts but not others
  - New LUN provisioned but not appearing

Log Pattern (regex):
  - "Inconsistent.*targets.*paths|LUN.*not.*visible"
  - "rport.*blocked|rport.*not found"

Keywords: zoning, WWPN, LUN masking, host group, fabric

Symptoms:
  - fdisk -l shows no new devices after LUN provisioning
  - multipath -ll shows fewer paths than expected
  - Inconsistent device counts across hosts

Root Cause:
  - WWPN not added to zone on FC switch
  - LUN masking on storage array doesn't include host WWPN
  - One-sided or incomplete zone configuration
  - Zone not activated after modification

Diagnostic Commands:
  cat /sys/class/fc_host/host*/port_name   # Get host WWPNs
  echo "1" > /sys/class/fc_host/hostX/issue_lip   # Refresh fabric login
  echo "- - -" > /sys/class/scsi_host/hostX/scan   # Rescan LUNs

Resolution:
  1. Get host WWPNs and verify they're in FC switch zones
  2. Verify LUN masking includes host WWPN on storage array
  3. Use single-initiator zoning (one host + one target per zone)
  4. After zone changes: issue_lip + SCSI rescan
  5. Verify: multipath -ll (shows all expected paths)

Source: https://knowledge.broadcom.com/external/article/399942
```

---

## SECTION 8: MULTIPATH ISSUES

### MP-001: Multipath Device Not Assembling

```
ID: MP-001
Component: Multipath / Storage
Affected Versions: All
Severity: HIGH
Confidence: HIGH

Error Signature:
  - LUN shows as separate sd devices instead of single mpath device
  - multipath -ll shows only 1 path when 2+ exist

Log Pattern (regex):
  - "multipath.*orphan|mpath.*not.*created"
  - "multipathd.*uevent.*add.*failed"

Keywords: multipath, dm-multipath, mpath, WWID, paths, aggregate

Symptoms:
  - Multiple /dev/sdX devices for same LUN
  - multipath -ll shows fewer paths than expected
  - Inconsistent multipath device creation

Root Cause:
  - Second path discovered before multipathd processes first
  - WWID mismatch between paths (storage issue)
  - Device blacklisted in multipath.conf
  - multipathd not running

Diagnostic Commands:
  multipath -ll                        # List devices and paths
  multipath -v3                        # Verbose (show blacklist decisions)
  sg_vpd --page=di /dev/sdX           # Check WWID consistency
  multipathd show paths               # All paths status

Resolution:
  1. Rescan: for host in /sys/class/scsi_host/host*/scan; do echo "- - -" > $host; done
  2. Reconfigure: multipath -r
  3. Verify WWID: sg_vpd --page=di on each path → must match
  4. Check blacklist: multipath -v3 | grep blacklist
  5. If stuck: multipathd reconfigure

HPE VME Required Config (/etc/multipath.conf for Alletra MP):
  defaults {
      find_multipaths yes
      user_friendly_names no
  }

Source: https://ubuntu.com/server/docs/explanation/multipath/configuring-multipath/
```

### MP-002: Multipath Failover Too Slow (I/O Stall)

```
ID: MP-002
Component: Multipath / Failover
Affected Versions: All
Severity: HIGH
Confidence: HIGH

Error Messages:
  - I/O freeze for 25-120 seconds during path switch
  - Applications timeout during failover

Log Pattern (regex):
  - "path.*failed|checker.*failed|mpath.*path.*down"
  - "replacement_timeout.*expired"
  - "no_path_retry.*queue"

Keywords: failover, I/O stall, replacement_timeout, fast_io_fail_tmo, no_path_retry

Symptoms:
  - VM I/O hangs during storage path failure
  - Applications become unavailable for 25-120 seconds
  - Database connections timeout
  - VM appears frozen temporarily

Root Cause:
  - Default replacement_timeout=120 too high for multipath
  - no_path_retry set to "queue" (infinite wait)
  - fast_io_fail_tmo disabled (FC default)
  - Multipath not detecting path failure quickly enough

Resolution — Fast Failover Config:
  # /etc/iscsi/iscsid.conf:
  node.session.timeo.replacement_timeout = 15

  # /etc/multipath.conf:
  defaults {
      polling_interval 5
      no_path_retry fail
      fast_io_fail_tmo 5
      dev_loss_tmo 10
      checker_timeout 15
  }

  # Apply:
  systemctl reload multipathd
  # If boot from SAN:
  update-initramfs -u

Post-Fix Validation:
  # Disconnect one path, time the failover:
  multipath -ll   # Verify path marked as failed quickly
  # I/O should resume within 5-15 seconds

Source: https://access.redhat.com/solutions/137073
```

### MP-003: Local Disks Grabbed by Multipath (Blacklist Issue)

```
ID: MP-003
Component: Multipath / Configuration
Affected Versions: All
Severity: MEDIUM
Confidence: HIGH

Error Signature:
  - Local SCSI disks appearing in multipath -ll
  - Boot issues after multipath grabs local disk

Log Pattern (regex):
  - "multipath.*sda|mpath.*local"
  - "device.*blacklist.*reject"

Keywords: blacklist, local disk, HPE Smart Array, ATA, multipath.conf

Symptoms:
  - Local HPE Smart Array disks managed by multipath
  - Boot partition on multipath device (unintended)
  - Performance impact on local storage

Root Cause:
  - Default multipath.conf doesn't blacklist local SCSI controllers
  - All SCSI devices processed by multipathd

Resolution:
  # Add to /etc/multipath.conf:
  blacklist {
      devnode "^(ram|raw|loop|fd|md|dm-|sr|scd|st)[0-9]*"
      devnode "^hd[a-z]"
      device {
          vendor "ATA"
          product "*"
      }
      device {
          vendor "HPE"
          product "LOGICAL VOLUME"
      }
  }

  # Apply:
  systemctl reload multipathd
  update-initramfs -u   # CRITICAL for boot-time blacklist

Source: https://access.redhat.com/solutions/504833
```

---


## SECTION 9: HPE ALLETRA INTEGRATION ISSUES

### ALT-001: Alletra MP iSCSI Connection Drop (Error 1011)

```
ID: ALT-001
Component: Alletra MP / iSCSI / Connectivity
Affected Versions: All with Alletra MP iSCSI
Severity: CRITICAL
Confidence: CONFIRMED (Broadcom KB)

Error Messages (vmkernel.log/syslog):
  "iscsi_vmk: iscsivmk_StopConnection:736: vmhba64:CH:0 T:42 CN:0:
   iSCSI connection is being marked \"OFFLINE\" (Event:4)"
  "Failed to receive data: Connection closed by peer"
  "NOP timeout (Event:4)"
  "Error 1011: iSCSI connection timeout"

Log Pattern (regex):
  - "iSCSI connection.*OFFLINE.*Event:4"
  - "Failed to receive data.*Connection closed by peer"
  - "NOP.*timeout.*Event:4"
  - "Error 1011.*iSCSI.*timeout"
  - "iscsivmk_StopConnection"

Keywords: Alletra MP, iSCSI, Error 1011, connection drop, NOP timeout, Event:4

Symptoms:
  - Hosts lose access to datastores for 10-15 seconds
  - VMs become unresponsive during connection drop
  - iSCSI sessions flap between offline and online
  - Occurs under load or during specific operations

Root Cause:
  - Single storage controller node handling disproportionate I/O
  - iSCSI service on overloaded controller becomes intermittently unresponsive
  - NOP-Out ping timeouts trigger session disconnection

Contributing Factors:
  - LUN ownership imbalanced across controller nodes
  - Heavy I/O concentrated on few LUNs owned by same controller
  - Insufficient I/O distribution across Active/Optimized paths

Resolution:
  1. Analyze LUN Active/Optimized (AO) ownership distribution
  2. Balance workload across storage controller nodes
  3. Move LUN ownership to less loaded controller
  4. Open HPE support case for assistance with rebalancing
  5. Consider spreading VMs across more LUNs

Source: https://knowledge.broadcom.com/external/article/437440
```

### ALT-002: HPE Peer Motion Zoning Error (OIUERRCS1003/1004)

```
ID: ALT-002
Component: Peer Motion / Storage Migration / FC Zoning
Affected Versions: All with Peer Motion
Severity: HIGH
Confidence: CONFIRMED

Error Messages:
  "createmigration command returns error OIUERRCS1003"
  "createmigration command returns error OIUERRCS1004"

Log Pattern (regex):
  - "OIUERRCS100[34]"
  - "createmigration.*error"
  - "Peer Motion.*zoning.*error"

Keywords: Peer Motion, OIUERRCS1003, OIUERRCS1004, zoning, migration, FC

Symptoms:
  - Cannot initiate Peer Motion migration between arrays
  - createmigration command fails
  - Storage migration blocked

Root Cause:
  - Peer Motion Utility cannot verify proper zoning
  - One-to-one mapping does not exist between source HBA WWPNs
    and destination target port WWPNs
  - Source ports not properly zoned to destination peer ports

Resolution:
  1. Zone each host port on source to one peer port on destination
  2. Include associated virtual ports in zoning
  3. Ensure port pairs (partner nodes) on source zoned to port pairs on destination
  4. Configure zoning BEFORE issuing createmigration commands
  5. Verify with: showmigration command

Post-Migration Note:
  - Source storage retains peer host names after migration
  - These must be manually cleaned up
  - Do NOT remove source-side zoning after data migration completes

Source: https://www.hpe.com/psnow/resources/ebooks/a00114794en_us_v2/
```

### ALT-003: GreenLake/DSCC API Token Expiration

```
ID: ALT-003
Component: GreenLake / DSCC / API
Affected Versions: All with GreenLake integration
Severity: MEDIUM
Confidence: CONFIRMED

Error Message:
  "401 Unauthorized HTTP"

Log Pattern (regex):
  - "401.*Unauthorized|HTTP.*401"
  - "token.*expired|access.*token.*invalid"
  - "DSCC.*authentication.*fail"

Keywords: GreenLake, DSCC, OAuth, token, 401, unauthorized, expired

Symptoms:
  - API calls to Data Services Cloud Console fail
  - Storage operations via DSCC return 401
  - Automation scripts stop working after 2 hours

Root Cause:
  - OAuth 2.0 access token has 7200 second (2 hour) lifetime
  - Token not refreshed before expiry

Resolution:
  1. Implement token refresh logic using client_id and client_secret
  2. Request new token before 2-hour expiry
  3. IMPORTANT: GreenLake does NOT store client secret — if lost, must reset

API Token Refresh:
  POST https://sso.common.cloud.hpe.com/as/token.oauth2
  Content-Type: application/x-www-form-urlencoded
  grant_type=client_credentials&client_id=<id>&client_secret=<secret>

Source: https://developer.hpe.com/blog/api-console-for-data-services-cloud-console/
```

### ALT-004: Alletra/Nimble ESXi Root Account Lockout (Firmware Bug)

```
ID: ALT-004
Component: Alletra/Nimble / Authentication
Affected Versions: Specific Alletra/Nimble firmware versions post-upgrade
Severity: HIGH
Confidence: CONFIRMED (Broadcom KB)

Error Messages:
  "Cannot login root@<IP>"
  "Authentication failure" in /var/log/auth.log
  "Function not implemented"
  Persistent failed login counts in pam_tally2

Log Pattern (regex):
  - "Cannot login root@"
  - "authentication failure.*from.*<storage_mgmt_IP>"
  - "Function not implemented"
  - "pam_tally2.*root.*DENY"

Keywords: root lockout, Nimble, Alletra, pam_tally2, authentication, firmware

Symptoms:
  - ESXi/host root account gets locked out
  - Failed login attempts from storage management appliance IP
  - Occurs after Alletra/Nimble array firmware upgrade
  - Continuous authentication failures

Root Cause:
  - Bug in specific Alletra/Nimble firmware versions
  - Management appliance continuously attempts logins with stale credentials
  - Triggers account lockout on hosts

Resolution:
  1. Apply storage patch from HPE/Nimble support
  2. Update credentials in Alletra/Nimble management interface
  3. Reset lockouts: pam_tally2 --user root --reset
  4. Reregister HPE storage plugin
  5. Ensure Port 22 (SSH) open between vCenter and HPE appliance

Source: https://knowledge.broadcom.com/external/article/424130
```

---

## SECTION 10: LIVE/COLD/STORAGE MIGRATION ISSUES

### LIVMIG-001: Live Migration Timeout

```
ID: LIVMIG-001
Component: Live Migration / KVM
Affected Versions: All
Severity: HIGH
Confidence: HIGH

Error Messages:
  "migration failed: Timed out during operation"
  "libvirtError: Timed out during operation: cannot acquire state change lock"
  "Libvirtd encountered a failure on Destination"

Log Pattern (regex):
  - "migration.*Timed out"
  - "cannot acquire state change lock"
  - "Libvirtd.*failure.*Destination"
  - "migration.*timeout"

Keywords: live migration, timeout, memory dirty, converge, bandwidth

Symptoms:
  - Migration starts but never completes
  - Progress stalls at high percentage (90%+)
  - Eventually times out
  - VM remains on source host

Root Cause:
  - VM dirtying memory faster than network transfer rate
  - Insufficient network bandwidth for migration
  - No convergence mechanism enabled
  - libvirtd not running or unreachable on destination
  - Firewall blocking migration ports (49152-49215)

Diagnostic Commands:
  virsh domjobinfo <vm-name>   # Migration progress
  journalctl -u libvirtd | grep -i migrate   # Migration logs
  iperf3 -c <destination>   # Test bandwidth

Resolution:
  1. Use dedicated migration network (10Gbps recommended)
  2. Enable auto-converge (throttles VM CPU to allow convergence)
  3. Enable compression for bandwidth-limited environments
  4. Verify libvirtd on destination: systemctl status libvirtd
  5. Check firewall: ports 49152-49215 open between hosts

HPE VME Note:
  - Live migration via "Manage Placement" action in UI
  - Observed time: ~1-1.5 minutes for typical VMs in lab
  - Known issue: Alletra MP migration fails under heavy write I/O

Source: https://cubepath.com/en/docs/virtualization-vps/live-vm-migration
```

### LIVMIG-002: Migration Blocked by CPU Compatibility

```
ID: LIVMIG-002
Component: Live Migration / CPU
Affected Versions: All
Severity: MEDIUM
Confidence: HIGH

Error Messages:
  "migration of domain failed: Unsafe migration"
  "CPU feature not supported on destination"
  "qemu: error: host doesn't support requested feature"

Log Pattern (regex):
  - "Unsafe migration"
  - "CPU.*feature.*not supported"
  - "host doesn't support requested feature"
  - "incompatible.*CPU"

Keywords: CPU, host-passthrough, host-model, migration, compatibility

Symptoms:
  - Live migration fails immediately
  - Error about CPU incompatibility
  - Only happens when hosts have different CPU generations

Root Cause:
  - host-passthrough CPU mode exposes ALL host CPU features
  - Different CPU generations have different feature sets
  - Destination CPU missing features present on source

Resolution:
  1. Use host-model CPU mode (exposes common feature set):
     <cpu mode='host-model'><model fallback='allow'/></cpu>
  2. Or use specific minimum-common-denominator model
  3. HPE VME recommendation: Use homogeneous hardware in cluster
  4. Check: virsh capabilities | grep features

Source: https://cubepath.com/en/docs/virtualization-vps/live-vm-migration
```

### LIVMIG-003: Migration Blocked by Device Passthrough

```
ID: LIVMIG-003
Component: Live Migration / Passthrough Devices
Affected Versions: 8.0.5+ (passthrough added in 8.0.5)
Severity: MEDIUM
Confidence: CONFIRMED

Error Signature:
  - Migration fails for VMs with GPU/PCI/USB/NVME passthrough

Log Pattern (regex):
  - "device not migratable|passthrough.*cannot.*migrate"
  - "has attached passthrough device"

Keywords: GPU, PCI, NVME, USB, passthrough, migration blocked

Symptoms:
  - VMs with passed-through devices cannot be live migrated
  - Migration attempt fails immediately with device error
  - Maintenance mode blocked if passthrough VMs on host

Root Cause:
  - Physical devices cannot be transparently moved between hosts
  - Passthrough bypasses hypervisor — no migration path
  - Added in v8.0.5: GPU pooling, PCI, NVME, USB passthrough

Resolution:
  1. Detach passthrough device before migration
  2. Power off VM → remove passthrough → migrate → re-attach on new host
  3. GPU pooling: removing VM releases GPU back to pool
  4. Plan: passthrough VMs should be on hosts that don't need migration
  5. Use anti-affinity rules if needed

Source: https://hpevm-docs.morpheusdata.com/en/8.0.5-vme/release_notes/current.html
```

### STORMIG-001: Storage Migration — No Progress Indicator

```
ID: STORMIG-001
Component: Storage Migration / UI
Affected Versions: All
Severity: LOW (operational awareness)
Confidence: CONFIRMED (observed behavior)

Symptoms:
  - Storage migration initiated via "Reconfigure" action
  - No progress bar or percentage shown in UI
  - Only way to monitor: watch network traffic or Ceph status
  - Observed time: ~11 minutes for ~55GB VM on spinning disk Ceph

Monitoring Methods:
  - Watch Ceph: sudo ceph -w
  - Watch network throughput on storage bonds
  - Check Instance status: "Active" when done

Source: https://my-sddc.net/new-tech-vm-essentials-a-more-serious-deployment/
```

---


## SECTION 11: CEPH STORAGE ISSUES (BUILT-IN)

### CEPH-001: Ceph Cluster Health Degraded

```
ID: CEPH-001
Component: Ceph / Built-in Storage
Affected Versions: All
Severity: HIGH
Confidence: HIGH

Error Messages:
  "HEALTH_WARN" or "HEALTH_ERR" from ceph status
  "X osds down"
  "Degraded data redundancy"
  "undersized+degraded"

Log Pattern (regex):
  - "HEALTH_WARN|HEALTH_ERR"
  - "\\d+ osds? down"
  - "Degraded data redundancy"
  - "undersized.*degraded|degraded.*peering"

Keywords: Ceph, OSD, degraded, HEALTH_WARN, HEALTH_ERR

Symptoms:
  - ceph status shows HEALTH_WARN or HEALTH_ERR
  - VMs may experience slow I/O
  - Risk of data loss if additional OSDs fail
  - Storage migration/provisioning blocked during ERR state

Diagnostic Commands:
  sudo ceph status
  sudo ceph health detail
  sudo ceph osd tree
  sudo ceph osd df
  sudo ceph -w   # Watch in real-time

Root Cause:
  - OSD host offline (host failure, network issue)
  - Disk failure on OSD node
  - Network connectivity issue between Ceph nodes
  - Ceph storage network (bond1-ceph) disruption

Resolution:
  1. Identify issue: ceph health detail
  2. If OSD down due to host: bring host back online
  3. If disk failure: replace disk, recreate OSD
  4. If network: verify bond1-ceph connectivity between all hosts
  5. Wait for automatic recovery (backfill/recovery)
  6. Monitor: ceph -w (shows recovery progress)

HPE VME Architecture Note:
  - Ceph is automatically configured across cluster nodes
  - Each host contributes its spare disk(s) as OSD
  - Default replication factor = 3 (data on 3 nodes)
  - Loss of 1 node = degraded but operational
  - Loss of 2 nodes = data at risk (depending on PG distribution)

Source: https://docs.ceph.com/en/latest/rados/troubleshooting/troubleshooting-osd/
```

### CEPH-002: Ceph OSD Full (Storage Exhaustion)

```
ID: CEPH-002
Component: Ceph / Capacity
Affected Versions: All
Severity: CRITICAL
Confidence: HIGH

Error Messages:
  "OSD near full (XX%)"
  "OSD full (XX%) — writes blocked"
  "HEALTH_ERR X full osd(s)"
  "Insufficient storage space"

Log Pattern (regex):
  - "OSD.*near full|OSD.*full"
  - "HEALTH_ERR.*full"
  - "writes.*blocked|write.*rejected"
  - "Insufficient.*storage"

Keywords: Ceph, full, capacity, OSD, writes blocked, nearfull

Thresholds:
  - nearfull_ratio: 85% (warning)
  - full_ratio: 95% (writes blocked)
  - backfillfull_ratio: 90% (backfill stopped)

Symptoms:
  - VMs cannot write to storage (I/O errors)
  - New VM provisioning fails
  - ceph status shows "full osd(s)"
  - Writes completely blocked at 95%

Resolution:
  1. Identify full OSDs: ceph osd df
  2. Remove unnecessary data (old snapshots, unused VMs)
  3. Reweight OSDs to redistribute: ceph osd reweight <id> <weight>
  4. Add more storage (additional disks/hosts)
  5. Emergency: temporarily increase full_ratio (DANGEROUS)
     ceph osd set-full-ratio 0.97

Prevention:
  - Monitor capacity proactively
  - Set alerts at 75% usage
  - Plan capacity for N+1 host failure

Source: https://cray-hpe.github.io/docs-csm/en-12/operations/utility_storage/troubleshoot_ceph_osds_reporting_full/
```

---

## SECTION 12: VEEAM INTEGRATION ISSUES

### VEEAM-001: Failed to Refresh HPE VME Entities

```
ID: VEEAM-001
Component: Veeam / VME Integration
Affected Versions: Veeam BETA + VME
Severity: MEDIUM
Confidence: CONFIRMED (Veeam forums)

Error Messages:
  "Failed to refresh the HPE Morpheus VM Essentials entities:
   Failed to scan VMs: Error occurred while deserializing the response"
  "Failed to configure additional settings for the HPE Morpheus VM Essentials
   clusters: A connection attempt failed because the connected party did not
   properly respond after a period of time"

Log Pattern (regex):
  - "Failed to refresh.*HPE Morpheus VM Essentials entities"
  - "Failed to scan VMs.*deserializing"
  - "connection attempt failed.*connected party did not.*respond"

Keywords: Veeam, refresh, entities, deserializing, connection, timeout

Symptoms:
  - Veeam cannot discover VMs in HPE VME cluster
  - Entity refresh fails during backup configuration
  - Additional settings configuration times out

Root Cause:
  - Connectivity issue between VBR and cluster nodes
  - API response format incompatibility (beta issues)
  - Network timeout between Veeam and VME Manager

Diagnostic:
  Check: C:\ProgramData\Veeam\Backup\Plugins\HPEMORPHEUSVME\Veeam.HPEMORPHEUSVME.PlatformSvc.log

Resolution:
  1. Verify network connectivity from VBR to all cluster nodes
  2. Check VME Manager API is responding
  3. Update to latest Veeam plugin version
  4. Open Veeam support case with PlatformSvc.log

Source: https://forums.veeam.com/rhv-olvm-sc-hypercore-xcp-ng-hpe-vme-f62/failed-to-refresh-the-hpe-morpheus-vm-essentials-entities-t101481.html
```

---

## SECTION 13: CORRELATION RULES AND PATTERN RELATIONSHIPS

### Multi-Log Pattern Correlations

These rules identify related log messages that, when seen together, indicate
a specific root cause. Individual messages may have multiple causes, but
the COMBINATION narrows it down.

```
CORRELATION RULE: POST-MIGRATION BOOT FAILURE (LINUX)
─────────────────────────────────────────────────────
Pattern 1: "migration.*complete|migration.*success" (migration log)
+ Pattern 2: "dracut-initqueue.*timeout|VFS.*Unable to mount root" (kernel log)
+ Context: VM was recently migrated from VMware
= Root Cause: Missing VirtIO drivers in initramfs
= Action: Boot rescue, rebuild initramfs with virtio modules
= See: MIG-002

CORRELATION RULE: POST-MIGRATION BOOT FAILURE (WINDOWS)
───────────────────────────────────────────────────────
Pattern 1: "migration.*complete" (migration log)
+ Pattern 2: "INACCESSIBLE_BOOT_DEVICE|0x0000007B" (Windows BSOD)
+ Context: Windows VM migrated from VMware to HVM
= Root Cause: VirtIO SCSI driver not boot-start
= Action: Boot with SATA, install VirtIO drivers
= See: MIG-004

CORRELATION RULE: POST-MIGRATION NETWORK LOSS
─────────────────────────────────────────────
Pattern 1: "migration.*complete" (migration log)
+ Pattern 2: "RTNETLINK.*No such device|interface.*not found" (network log)
+ Pattern 3: VM had connectivity on VMware
= Root Cause: NIC rename (vmxnet3→virtio interface name change)
= Action: Update network config with new interface name
= See: MIG-005

CORRELATION RULE: GFS2 MOUNT FAILURE DURING CLUSTER EXPANSION
────────────────────────────────────────────────────────────
Pattern 1: "Adding.*host|cluster.*worker.*add" (manager log)
+ Pattern 2: "gfs2.*dlm_new_lockspace error" (kernel log on new host)
+ Context: HPE VME version < 8.0.3
= Root Cause: Known bug - GFS2 mount not configured on new host
= Action: Upgrade to 8.0.3+, or manually mount GFS2
= See: KI-001

CORRELATION RULE: ALLETRA MIGRATION FAILURE
──────────────────────────────────────────
Pattern 1: "migrate.*fail|migration.*error" (migration log)
+ Pattern 2: Heavy write I/O metrics on VM
+ Context: VM storage on Alletra MP datastore
= Root Cause: Known issue - heavy write-iops blocks migration
= Action: Reduce I/O, retry migration
= See: KI-007

CORRELATION RULE: SPLIT-BRAIN → VM CORRUPTION RISK
──────────────────────────────────────────────────
Pattern 1: "partition WITHOUT quorum" (corosync log)
+ Pattern 2: "stonith-enabled.*false|No STONITH resources" (pcs status)
+ Pattern 3: Both partitions showing VMs running
= Root Cause: Split-brain without fencing protection
= Action: IMMEDIATE - stop VMs on one side, configure STONITH
= See: CL-004, CL-005

CORRELATION RULE: CEPH DEGRADED → VM FAILOVER FAILURE
────────────────────────────────────────────────────
Pattern 1: "HEALTH_WARN|HEALTH_ERR|osds down" (ceph log)
+ Pattern 2: "failover.*fail|cannot.*restart.*VM" (manager log)
+ Context: Host failure in cluster
= Root Cause: Shared storage (Ceph) degraded, cannot start VM on other host
= Action: Resolve Ceph health first, then retry VM placement
= See: CEPH-001

CORRELATION RULE: iSCSI PATH LOSS → VM I/O FREEZE
─────────────────────────────────────────────────
Pattern 1: "iSCSI connection.*OFFLINE|ping timeout.*expired" (iSCSI log)
+ Pattern 2: "task.*blocked for more than.*seconds" (kernel hung_task)
+ Pattern 3: VM application timeouts
= Root Cause: iSCSI path failure with slow multipath failover
= Action: Check path, tune replacement_timeout
= See: ISCSI-002, MP-002

CORRELATION RULE: NFS SERVER FAILURE → MULTIPLE VM IMPACT
────────────────────────────────────────────────────────
Pattern 1: "NFS.*server.*not responding" (kernel NFS log)
+ Pattern 2: Multiple VMs becoming unresponsive simultaneously
+ Context: VMs on NFS-backed datastore
= Root Cause: NFS server failure or network partition
= Action: Check NFS server, verify network, prepare for VM restart
= See: NFS-003
```

---

## SECTION 14: DIAGNOSTIC COMMAND REFERENCE

### Cluster Diagnostics
```bash
pcs status                          # Overall cluster status
pcs cluster status                  # Cluster services status
corosync-quorumtool -s              # Quorum status
corosync-cfgtool -s                 # Ring/node connectivity
pcs stonith show                    # Fencing configuration
pcs stonith fence <node>            # Test fencing (CAREFUL!)
pcs constraint show --full          # All resource constraints
pcs resource show                   # Managed resources
pcs resource clear <resource>       # Remove stale move constraints
```

### Storage Diagnostics
```bash
sudo ceph status                    # Ceph cluster health
sudo ceph osd tree                  # OSD layout
sudo ceph osd df                    # OSD disk usage
sudo ceph -w                        # Real-time Ceph events
df -h | grep -E "(nfs|ceph|mvm)"   # Mounted storage
mount -t gfs2                       # GFS2 mounts
dlm_tool ls                         # DLM lockspaces
multipath -ll                       # Multipath device state
iscsiadm -m session                 # Active iSCSI sessions
cat /sys/class/fc_host/host*/port_state  # FC port state
```

### VM/Hypervisor Diagnostics
```bash
virsh list --all                    # All VMs on host
virsh domjobinfo <vm>               # Migration progress
virsh dominfo <vm>                  # VM details
qemu-img info <disk.qcow2>         # Disk format/compat
ovs-vsctl show                     # OVS bridge config
ip link show                        # Network interfaces
```

### Network Diagnostics
```bash
ping -M do -s 8972 <target>         # Jumbo frame test
iperf3 -c <target>                  # Bandwidth test
corosync-cfgtool -s                 # Cluster ring status
cat /proc/net/bonding/bond*         # Bond health
```

---

## SECTION 15: OFFICIAL HPE DOCUMENT REFERENCES

| Document ID | Title | Content |
|------------|-------|---------|
| sd00006560en_us | HPE Morpheus VM Essentials Software Documentation v8.0.8 | Full docs |
| sd00006166en_us | HPE Storage Integration Pack Release Notes | Alletra plugin |
| a50013873enw | HPE Morpheus VM Essentials Software Migration Guide | VMware→HVM migration |
| a50015833enw | Mastering VMware to VM Essentials Migrations with RMT | RMT deployment guide |
| a50015945enw | Mastering Migrations with Rapid Migration Tool (Setup) | RMT setup details |
| a50013816enw | HPE Morpheus VM Essentials Software (Technical Brief) | Architecture overview |
| a50013599enw | Reference Architecture 8.0.5 (FC + Alletra B10000) | FC storage reference |
| a50013872enw | Reference Architecture 8.0.7 (iSCSI + Alletra B10000) | iSCSI storage reference |
| a50012536enw | SQL Server on VM Essentials + Alletra B10000 | Database workload guide |
| a50014074enw | HPE SimpliVity with HPE VM Essentials FAQ | SimpliVity compatibility |
| a50013392enw | HPE VM Essentials Training (NFS/GFS2 storage setup) | Training course details |
| a50004260enw | HPE Morpheus VM Essentials QuickSpecs | Product specifications |
| a50013032enw | VME to Morpheus Enterprise Upgrade | Upgrade guide |
| a00114794en_us_v2 | HPE Peer Motion Troubleshooting | Peer Motion errors |

### Key Web Resources

| Resource | URL |
|----------|-----|
| VME Documentation Portal | https://hpevm-docs.morpheusdata.com/en/latest/ |
| v8.0.3 Release Notes | https://hpevm-docs.morpheusdata.com/en/latest/release_notes/current.html |
| v8.0.5 Release Notes | https://hpevm-docs.morpheusdata.com/en/8.0.5-vme/release_notes/current.html |
| v8.0.6 Release Notes | https://hpevm-docs.morpheusdata.com/en/8.0.6-vme/release_notes/current.html |
| HPE Morpheus Software Resources | https://www.hpe.com/us/en/morpheus-software/resources.html |
| Alletra MP Integration Guide | https://hpevm-docs.morpheusdata.com/en/8.0.6-vme/integration_guides/Storage/hpe-alletra-mp.html |
| Morpheus Community Forum | https://discuss.morpheusdata.com/ |
| Veeam HPE VME Forum | https://forums.veeam.com/rhv-olvm-sc-hypercore-xcp-ng-hpe-vme-f62/ |
| Real-world Deployment Blog | https://my-sddc.net/new-tech-vm-essentials-a-more-serious-deployment/ |
| Zerto HVM Migration Prep | https://github.com/nich0lasJ/zerto-hvm-migration-prep |
| Veeam Moov Tool (VMware→HPE VME) | https://github.com/VeeamHub/moov |

---

## END OF KNOWLEDGE BASE

Total Issues Catalogued: 45+
Correlation Rules: 8
HPE VME Versions Covered: 8.0.1 through 9.0
Categories: Known Issues, Migration, Cluster/HA, GFS2, NFS, iSCSI, FC, Multipath, Alletra, Ceph, Veeam
