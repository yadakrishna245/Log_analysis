# Sample Jira Ticket Descriptions for Demo

Use these to demo the "🧭 Suggest where to look" feature (Ticket Advisor).
Just paste any of these into the Ticket Context box and click the button.

---

## Ticket 1: HA Failover Not Working

**Paste this:**

```
After an HVM host (demovmehost02) in our HPE VM Essentials 3-node cluster was shut down 
for maintenance, the virtual servers did not perform the HA process and remain on the 
powered-off host. Expected behavior: VMs should automatically migrate to available nodes.
Pacemaker shows resources as stopped. Corosync reports membership changes. Customer is 
down - all production VMs are offline. Priority: P1.
```

---

## Ticket 2: GFS2 Filesystem Read-Only

**Paste this:**

```
Customer reports shared GFS2 filesystem went read-only on all 3 cluster nodes simultaneously.
Error messages mention "filesystem withdraw" and "DLM lock errors". All VMs using the shared
storage are impacted. Morpheus UI shows instance provisioning failures. DLM service appears
to be failing with error -107. Need to identify root cause before mounting again.
```

---

## Ticket 3: Storage Path Failures

**Paste this:**

```
Alletra storage paths intermittently going down. Multipath shows all paths failed for 
mpath0. SCSI reservation conflicts appearing in /var/log/messages. LVM reports PV missing.
iSCSI NOP timeouts occurring. Customer's backup jobs are failing with "Cannot create 
synthetic full". VMs are pausing due to I/O errors. HPE 3PAR/Nimble target not responding.
```

---

## Ticket 4: VM Crash + OOM Kill

**Paste this:**

```
Production VM (vm_webserver01) crashed unexpectedly. Kernel logs show OOM killer invoked 
on qemu-kvm process. Host has 128GB RAM but was running 12 VMs. Java heap space errors
in Morpheus UI. smad process segfaulted. Need to determine if this is memory overcommit 
or memory leak. VM cannot be restarted - libvirt reports "unable to connect to hypervisor".
```

---

## Ticket 5: Network Issues + Split Brain

**Paste this:**

```
Cluster experienced split-brain condition after network flap on bond0. Both nodes think 
they are the active node. Fencing failed because fence device doesn't exist on the target 
node. Corosync token timeouts in logs. KNET link down messages. iptables rules appear to 
be missing. Some VMs are running on multiple hosts simultaneously. P1 - data corruption risk.
```
