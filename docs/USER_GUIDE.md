# LogSherlock Pro — User Guide

## A Step-by-Step Guide for Support Engineers

**Version:** 1.0
**Last Updated:** July 2026
**Audience:** Junior and mid-level support engineers

---

## What is LogSherlock Pro?

LogSherlock Pro is your automated log analysis assistant. Instead of manually grepping through hundreds of megabytes of customer log files, you upload them to LogSherlock and it:

1. **Extracts** archives automatically (7z, zip, tar.gz)
2. **Identifies** what type each log file is (dmesg, syslog, pacemaker, etc.)
3. **Scans** every file against 100+ known error patterns
4. **Correlates** events across multiple cluster nodes
5. **Ranks** findings by severity so you see the most critical issues first
6. **Suggests** solutions from the knowledge base
7. **Generates** RCA reports you can paste directly into Jira

Think of it as having a senior engineer look over your shoulder and point out all the important things in the logs — instantly.

---

## Your First Ticket — Complete Walkthrough

### Step 1: Log In

1. Open your browser and go to `http://logsherlock.internal.hpe.com:5000`
2. Enter your username and password
3. You'll land on the **Dashboard** showing recent tickets and system stats

```
┌─────────────────────────────────────────────────┐
│  LogSherlock Pro Dashboard                      │
├─────────────────────────────────────────────────┤
│                                                 │
│  Open Tickets: 12    Analyzed Today: 8          │
│  Critical Findings: 3  KB Articles: 245         │
│                                                 │
│  [+ New Ticket]                                 │
│                                                 │
│  Recent Tickets:                                │
│  ┌─────────────────────────────────────────┐    │
│  │ #45 - GFS2 mount hang (CRITICAL)       │    │
│  │ #44 - Multipath failover delay (HIGH)  │    │
│  │ #43 - Corosync token timeout (MEDIUM)  │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### Step 2: Create a New Ticket

1. Click **"+ New Ticket"**
2. Fill in the form:

| Field | What to Enter | Example |
|-------|--------------|---------|
| Title | Brief description of the problem | "Node3 fencing loop every 30 min" |
| Jira ID | Your Jira ticket number (optional) | SUPPORT-12345 |
| Description | Customer's problem statement | "Customer reports node3 keeps getting fenced..." |
| Product | Select the HPE product | HPE Serviceguard |
| Priority | How urgent is this | High |

3. Click **"Create Ticket"**

You'll be taken to the ticket detail page.

### Step 3: Upload Log Files

1. On the ticket detail page, find the **"Upload Logs"** section
2. Click **"Choose Files"** or drag-and-drop
3. You can upload:
   - A single compressed archive (`.7z`, `.zip`, `.tar.gz`) — **recommended**
   - Multiple individual log files (`.log`, `.txt`)
   - A mix of both

4. Click **"Upload"**

LogSherlock will:
- Show upload progress
- Automatically extract archives
- List all discovered log files
- Show file types it detected (dmesg, syslog, pcs status, etc.)

```
┌─────────────────────────────────────────────────┐
│  Uploaded Files (3 archives → 47 files)         │
├─────────────────────────────────────────────────┤
│  ✓ node1_sosreport.tar.gz → 16 files           │
│  ✓ node2_sosreport.tar.gz → 15 files           │
│  ✓ node3_sosreport.tar.gz → 16 files           │
│                                                 │
│  Detected: dmesg(3) syslog(3) pcs(3)           │
│            corosync(3) multipath(3) ...         │
└─────────────────────────────────────────────────┘
```

### Step 4: Run Analysis

1. Click the **"Analyze"** button
2. Wait 30-60 seconds (progress bar shows status)
3. When complete, findings appear automatically

### Step 5: Review Your Findings

Findings are listed from most critical to least:

```
┌─────────────────────────────────────────────────────────────┐
│  Analysis Complete — 12 findings                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔴 CRITICAL — SCSI Reservation Conflict                   │
│  Node: node3 | File: dmesg | Confidence: 95%               │
│  "sd 0:0:1:0: reservation conflict"                        │
│  → Solution: Check multipath config, verify fence agent    │
│                                                             │
│  🔴 CRITICAL — GFS2 Filesystem Withdraw                    │
│  Node: node3 | File: messages | Confidence: 92%            │
│  "GFS2: fsid=cluster:shared_vol: withdraw"                 │
│  → Solution: Check DLM status, verify quorum               │
│                                                             │
│  🟠 HIGH — Fencing Action Triggered                        │
│  Node: node3 | File: pacemaker.log | Confidence: 88%       │
│  "stonith-ng: Initiating action fence_node3"               │
│  → Solution: Review fence history, check STONITH config    │
│                                                             │
│  🟡 MEDIUM — Corosync Token Timeout                        │
│  Node: node1 | File: corosync.log | Confidence: 75%        │
│  "Token has not been received in 2000 ms"                  │
│  → Solution: Check network latency between nodes           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 6: Generate Report

1. Click **"Generate RCA Report"**
2. Choose format:
   - **Jira** — Formatted for pasting into Jira comments
   - **HTML** — Formatted report with timeline visualization
   - **JSON** — Structured data for automation
3. The report includes:
   - Executive summary
   - Timeline of events
   - Root cause determination
   - Recommendations
   - All supporting evidence

---

## Understanding Findings

Each finding contains these elements:

| Element | What It Means |
|---------|--------------|
| **Severity** | CRITICAL (service down), HIGH (degraded), MEDIUM (potential issue), LOW (minor), INFO (informational) |
| **Pattern Name** | The type of issue detected (e.g., "SCSI Reservation Conflict") |
| **Category** | Grouping: storage, filesystem, cluster, kernel, memory, network, service |
| **Node** | Which cluster node this was found on |
| **File** | Which log file contained the match |
| **Timestamp** | When the event occurred |
| **Matched Line** | The exact log line that triggered the finding |
| **Context** | Lines before and after the match for context |
| **Confidence** | How confident the tool is (0-100%) |
| **Solution Hint** | What to do next |

### Severity Guide

| Level | Color | Meaning | Action Required |
|-------|-------|---------|-----------------|
| CRITICAL | 🔴 Red | Service outage, data loss risk | Immediate investigation |
| HIGH | 🟠 Orange | Service degraded, failover occurred | Investigate within hours |
| MEDIUM | 🟡 Yellow | Potential issue, may escalate | Monitor and plan fix |
| LOW | 🔵 Blue | Minor anomaly | Note for future reference |
| INFO | ⚪ Gray | Informational event | No action needed |

---

## How to Read Log Analysis Results

### The Timeline View

LogSherlock reconstructs a timeline of events across all nodes:

```
Timeline (July 15, 2026):
─────────────────────────────────────────
10:30:12  [node3] SCSI reservation conflict on /dev/sdb
10:30:14  [node3] GFS2: I/O error on shared_vol
10:30:15  [node3] GFS2: withdraw initiated
10:30:16  [node1] DLM: node3 removed from lockspace
10:30:18  [node1] Pacemaker: node3 unclean, fencing initiated
10:30:22  [node3] STONITH: fence_ipmilan executed
10:30:25  [node1] Pacemaker: node3 fenced successfully
10:30:30  [node1] GFS2: journal recovery for node3
10:30:45  [node3] System boot (restarted after fence)
```

**How to read this:**
- Events are sorted chronologically
- The node in brackets shows WHERE it happened
- The cascade shows the CAUSE → EFFECT chain
- In this example: SCSI conflict → GFS2 withdraw → fencing → recovery

### The Correlation View

When events on different nodes are related, LogSherlock groups them:

```
Correlated Event Chain:
  Root Cause:  SCSI reservation conflict (node3, 10:30:12)
  ├── Effect:  GFS2 withdraw (node3, 10:30:15)
  ├── Effect:  Fencing triggered (node1→node3, 10:30:18)
  └── Effect:  Journal recovery (node1, 10:30:30)
```

---

## Using Investigation Guides

When findings match known issues in the knowledge base, you'll see an **"Investigation Guide"** button. These guides walk you through troubleshooting step-by-step:

### Example: GFS2 Withdraw Investigation Guide

```
📋 Investigation Guide: GFS2 Filesystem Withdraw

Step 1: Confirm the withdraw
   $ grep -i "withdraw" /var/log/messages
   Look for: "GFS2: fsid=<cluster>:<fs>: withdraw"

Step 2: Check DLM lock status
   $ dlm_tool ls
   $ dlm_tool lockdebug <lockspace>
   Look for: stuck locks or "waiting" state

Step 3: Check storage connectivity
   $ multipath -ll
   $ sg_persist -r /dev/<device>
   Look for: reservation conflicts, path failures

Step 4: Review cluster membership
   $ pcs status
   $ corosync-cfgtool -s
   Look for: missing nodes, ring errors

Step 5: Check for fencing
   $ pcs stonith history
   Look for: fence events around the same time

Resolution:
  If SCSI reservation conflict → check fence agent type
  If DLM stuck → restart dlm_controld on affected node
  If path failure → check multipath configuration
```

---

## Generating Reports for Jira

### Quick Copy (Jira Format)

1. Click **"Generate Report"** → **"Jira Format"**
2. The report appears in Jira-compatible markdown
3. Click **"Copy to Clipboard"**
4. Paste directly into your Jira ticket comment

### Example Jira Report Output

```
h2. Root Cause Analysis — SUPPORT-12345

h3. Summary
Node3 experienced repeated fencing due to SCSI reservation conflicts on
shared storage LUN. The reservation conflict caused GFS2 filesystem withdraw,
which triggered Pacemaker to fence the node.

h3. Timeline
|| Time || Node || Event ||
| 10:30:12 | node3 | SCSI reservation conflict on /dev/sdb |
| 10:30:15 | node3 | GFS2 withdraw initiated |
| 10:30:18 | node1 | Fencing action triggered for node3 |
| 10:30:25 | node1 | node3 fenced successfully |

h3. Root Cause
SCSI reservation conflict caused by incompatible fence agent configuration.
The fence agent is not clearing SCSI-3 persistent reservations before
restarting the node.

h3. Recommendations
# Switch to fence_scsi or configure fence_ipmilan to clear reservations
# Verify multipath.conf has "retain_attached_hw_handler yes"
# Test with: sg_persist --out --clear --param-rk=<key> /dev/sdb

h3. Related Knowledge Base
* KB-2024-089: SCSI Reservation Conflicts with Pacemaker
* Runbook: GFS2 Withdraw Recovery Procedure
```

---

## Tips & Tricks

### 1. Upload the Entire SOS Report
Don't cherry-pick files. Upload the complete compressed sosreport — LogSherlock will extract and identify everything relevant automatically.

### 2. Write Good Descriptions
The description helps LogSherlock focus its analysis. Include:
- What the customer is experiencing
- When it started
- Which nodes are affected
- Any recent changes

**Good:** "Node3 GFS2 mount hangs after storage maintenance on July 15"
**Bad:** "logs for review"

### 3. Use the Quick Analysis for Fast Checks
If you just need a quick pattern scan without creating a full ticket:
- Use the **"Quick Analysis"** feature
- Upload files, get results in seconds
- No ticket creation needed

### 4. Mark False Positives
If a finding isn't relevant to your case, click **"Mark as False Positive"**. This helps LogSherlock learn and reduces noise over time.

### 5. Check the Knowledge Base First
Before diving into logs manually, search the KB:
- Type keywords from the error message
- Browse known issues by product
- Check if someone already solved this exact problem

### 6. Use Filters on Findings
When you have 20+ findings, use filters:
- **By severity** — Focus on CRITICAL and HIGH first
- **By category** — Narrow to storage, cluster, or network
- **By node** — See what happened on a specific node

### 7. Check the Timeline for Causation
Events that happen close together in time are usually related. The timeline view shows the cascade:
- First event = likely root cause
- Subsequent events = effects/symptoms

---

## Common Patterns Explained

### SCSI Reservation Conflict

**What it means:** Two or more nodes are fighting over access to the same storage device. SCSI-3 Persistent Reservations are used to control which node "owns" a shared LUN. When a conflict occurs, one node's I/O gets rejected.

**Why it matters:** Causes I/O errors, filesystem hangs, and potentially data corruption.

**What to look for:** `reservation conflict` in dmesg, followed by filesystem errors.

---

### GFS2 Withdraw

**What it means:** The GFS2 filesystem has detected an unrecoverable error and is shutting itself down on this node to protect data integrity. Think of it as a filesystem "panic."

**Why it matters:** The node can no longer access the shared filesystem. Applications using that filesystem will hang or fail.

**What to look for:** `GFS2: fsid=...: withdraw` in messages/syslog.

---

### Fencing (STONITH)

**What it means:** The cluster has decided a node is misbehaving and is forcibly restarting it. STONITH = "Shoot The Other Node In The Head." This protects data by ensuring a broken node can't corrupt shared storage.

**Why it matters:** Tells you the cluster detected a problem serious enough to kill a node.

**What to look for:** `stonith-ng: Initiating` or `fenced` in pacemaker logs.

---

### Quorum Loss

**What it means:** The cluster no longer has a majority of nodes communicating. In a 3-node cluster, you need at least 2 nodes talking to each other. If communication breaks, the minority side becomes "inquorate" and stops services.

**Why it matters:** Services stop, resources unmount, applications go offline.

**What to look for:** `quorum lost` or `This node is not quorate` in corosync logs.

---

### DLM Lock Issues

**What it means:** The Distributed Lock Manager coordinates access to shared resources (like GFS2 files) across nodes. When DLM has issues, nodes can't coordinate and filesystems hang.

**Why it matters:** Precursor to GFS2 withdraw. DLM problems = filesystem problems incoming.

**What to look for:** `dlm: ... wait` or `dlm: lost` in kernel messages.

---

### Multipath Failover

**What it means:** One of the storage paths has failed and traffic has switched to an alternate path. Multipath provides redundancy so that if one HBA, cable, or switch fails, storage access continues.

**Why it matters:** If this is unexpected, it may indicate hardware failure. If all paths fail, storage becomes inaccessible.

**What to look for:** `mpath: ... failed` or `path checker` in multipath logs.

---

### OOM Kill (Out of Memory)

**What it means:** The Linux kernel ran out of memory and killed a process to free RAM. The kernel's OOM killer selects the process using the most memory and terminates it.

**Why it matters:** Important services may be killed, causing application failures or cluster instability.

**What to look for:** `Out of memory: Kill process` or `oom-kill` in dmesg.

---

### Kernel Panic

**What it means:** The Linux kernel encountered an error it cannot recover from and has halted. The system is dead until restarted.

**Why it matters:** Complete system outage. Needs crash dump analysis to determine root cause.

**What to look for:** `Kernel panic - not syncing` in dmesg or kdump.

---

### Corosync Token Timeout

**What it means:** Corosync (the cluster communication layer) hasn't received a heartbeat token within the expected time. This usually means network problems between nodes.

**Why it matters:** If timeouts continue, the cluster will declare the node dead and fence it.

**What to look for:** `Token has not been received in` in corosync.log.

---

## Glossary of Terms

| Term | Full Name | Plain English |
|------|-----------|---------------|
| **GFS2** | Global File System 2 | Shared filesystem that multiple nodes can access simultaneously |
| **DLM** | Distributed Lock Manager | Coordinates which node can access what on GFS2 |
| **SCSI** | Small Computer System Interface | Storage communication protocol |
| **LUN** | Logical Unit Number | A "slice" of storage presented to servers |
| **Multipath** | Device Mapper Multipath | Multiple physical paths to the same storage for redundancy |
| **Pacemaker** | — | Cluster resource manager (decides where services run) |
| **Corosync** | — | Cluster communication layer (how nodes talk to each other) |
| **Quorum** | — | Majority agreement — the cluster needs >50% of nodes to operate |
| **Fencing** | — | Forcibly restarting a misbehaving node to protect data |
| **STONITH** | Shoot The Other Node In The Head | The mechanism that performs fencing |
| **HBA** | Host Bus Adapter | Physical card that connects server to storage |
| **SAN** | Storage Area Network | Network dedicated to storage traffic |
| **sosreport** | — | Red Hat diagnostic bundle (collects all system logs/config) |
| **kdump** | Kernel Dump | Captures memory state when kernel crashes |
| **OOM** | Out Of Memory | System ran out of RAM |
| **MTTR** | Mean Time To Resolution | Average time to fix a support ticket |
| **RCA** | Root Cause Analysis | Report explaining WHY something failed |
| **FTS** | Full-Text Search | Searching inside file contents, not just filenames |
| **IPMI** | Intelligent Platform Management Interface | Hardware management for remote power control |
| **iLO** | Integrated Lights-Out | HPE's server remote management technology |
| **NFS** | Network File System | Filesystem shared over network (different from GFS2) |
| **systemd** | — | Linux service manager (starts/stops services) |
| **journalctl** | — | Tool to query systemd journal (logs) |

---

## Getting Help

- **In-app:** Click the **"?"** icon for contextual help
- **Knowledge Base:** Search for articles matching your issue
- **Team Lead:** Escalate if LogSherlock findings don't match your expectations
- **Tool Support:** Contact the Support Engineering Tools Team for bugs or feature requests

---

*Happy analyzing! Remember: LogSherlock handles the pattern matching — you provide the engineering judgment.*
