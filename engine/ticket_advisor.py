"""Ticket Advisor Engine for LogSherlock Pro.

Analyzes Jira ticket descriptions and generates structured L4 troubleshooting
responses WITHOUT requiring Ollama or any external AI. Uses pattern matching
against the 455 built-in patterns, 120 known issues, and runbooks to produce
complete ready-to-post replies.

Output includes:
- Root Cause Analysis
- Detailed Action Plan with commands
- Safety Notes (production impact assessment)
- Next Steps
- Related Known Issues & Bug IDs
"""

import re
import time
from typing import Dict, List, Optional, Tuple


class TicketAdvisor:
    """Generates structured L4 support responses from ticket descriptions."""

    def __init__(self):
        self._load_knowledge()

    def _load_knowledge(self):
        """Load known issues, runbooks, and patterns."""
        try:
            from knowledge.known_issues import KNOWN_ISSUES
            self.known_issues = KNOWN_ISSUES
        except ImportError:
            self.known_issues = []

        try:
            from knowledge.runbooks import RUNBOOKS
            # RUNBOOKS is a dict, convert to list of dicts
            if isinstance(RUNBOOKS, dict):
                self.runbooks = [{'key': k, **v} for k, v in RUNBOOKS.items()]
            else:
                self.runbooks = RUNBOOKS
        except ImportError:
            self.runbooks = []

        try:
            from engine.patterns import BUILT_IN_PATTERNS
            self.patterns = BUILT_IN_PATTERNS
        except ImportError:
            self.patterns = []

        # Build keyword index for fast lookup
        self._build_keyword_index()

    def _build_keyword_index(self):
        """Build keyword-to-issue mapping for fast matching."""
        self.keyword_map = {
            'gfs2': ['gfs2', 'gfs', 'withdraw', 'dlm', 'lockspace', 'shared filesystem'],
            'scsi_reservation': ['reservation conflict', 'scsi-3 pr', 'persistent reservation', 'sg_persist'],
            'morpheus': ['morpheus', 'morpheus-ui', 'morpheus-ctl', 'smad', 'cloud sync', 'inventory'],
            'datastore': ['datastore', 'datastore_type', 'directory pool', 'gfs2 pool', 'storage pool'],
            'cluster': ['pacemaker', 'corosync', 'cluster', 'ha', 'failover', 'quorum', 'stonith'],
            'storage': ['lun', 'multipath', 'mpath', 'iscsi', 'fibre channel', 'alletra', 'nimble', 'san'],
            'kvm': ['kvm', 'libvirt', 'qemu', 'virsh', 'vm', 'virtual machine', 'domain', 'migration'],
            'network': ['bond', 'nic', 'interface', 'vlan', 'network', 'ip address', 'routing'],
            'memory': ['oom', 'out of memory', 'swap', 'hugepage', 'memory pressure'],
            'fencing': ['fence', 'stonith', 'fencing', 'ipmi', 'ilo', 'power off'],
            'kernel': ['kernel panic', 'oops', 'bug:', 'call trace', 'null pointer', 'segfault'],
            'performance': ['slow', 'latency', 'timeout', 'hung', 'load average', 'cpu', 'iowait'],
            'backup': ['backup', 'restore', 'replication', 'snapshot', 'disaster recovery'],
            'security': ['selinux', 'apparmor', 'permission denied', 'authentication', 'certificate'],
        }

    def analyze(self, description: str, ticket_key: str = '', summary: str = '') -> Dict:
        """Main entry point - analyze ticket and generate structured response.

        Args:
            description: Full ticket description text
            ticket_key: Optional Jira ticket key (e.g., 'MORPHL4-77')
            summary: Optional ticket summary/title

        Returns:
            Dict with structured response sections
        """
        start_time = time.time()

        full_text = f"{summary}\n{description}".lower()

        # Step 1: Detect issue categories
        categories = self._detect_categories(full_text)

        # Step 2: Find matching known issues
        matched_issues = self._find_known_issues(full_text, categories)

        # Step 3: Find relevant runbook steps
        runbook_steps = self._find_runbook_steps(full_text, categories)

        # Step 4: Extract key details from description
        details = self._extract_details(description)

        # Step 5: Generate the structured response
        response = self._generate_response(
            categories=categories,
            matched_issues=matched_issues,
            runbook_steps=runbook_steps,
            details=details,
            description=description,
            ticket_key=ticket_key,
            summary=summary,
        )

        response['metadata'] = {
            'processing_time_ms': round((time.time() - start_time) * 1000, 1),
            'categories_detected': categories,
            'known_issues_matched': len(matched_issues),
            'patterns_referenced': len(response.get('related_patterns', [])),
        }

        return response

    def _detect_categories(self, text: str) -> List[str]:
        """Detect which issue categories are present in the text."""
        detected = []
        for category, keywords in self.keyword_map.items():
            for kw in keywords:
                if kw in text:
                    detected.append(category)
                    break
        return detected

    def _find_known_issues(self, text: str, categories: List[str]) -> List[Dict]:
        """Find matching known issues from the KB."""
        matches = []
        text_words = set(text.split())

        for issue in self.known_issues:
            score = 0
            issue_text = f"{issue.get('title', '')} {issue.get('symptoms', '')} {issue.get('root_cause', '')}".lower()

            # Score by word overlap
            issue_words = set(issue_text.split())
            common = text_words & issue_words
            # Only count meaningful words (>3 chars)
            meaningful = [w for w in common if len(w) > 3]
            score = len(meaningful)

            # Boost if products match categories
            products = [p.lower() for p in issue.get('products', [])]
            for cat in categories:
                if cat in ' '.join(products):
                    score += 5

            # Boost for key phrase matches
            title_lower = issue.get('title', '').lower()
            if any(phrase in text for phrase in [title_lower[:30]] if len(title_lower) > 10):
                score += 10

            if score >= 5:
                matches.append({**issue, '_score': score})

        # Sort by score, return top 5
        matches.sort(key=lambda x: x['_score'], reverse=True)
        return matches[:5]

    def _find_runbook_steps(self, text: str, categories: List[str]) -> List[Dict]:
        """Find relevant runbook entries."""
        matches = []
        for rb in self.runbooks:
            rb_text = f"{rb.get('title', '')} {rb.get('description', '')} {' '.join(rb.get('tags', []))}".lower()
            if any(cat in rb_text for cat in categories):
                matches.append(rb)
            elif any(word in rb_text for word in text.split() if len(word) > 4):
                matches.append(rb)

        return matches[:3]

    def _extract_details(self, description: str) -> Dict:
        """Extract structured details from the ticket description."""
        details = {
            'hostnames': [],
            'timestamps': [],
            'error_messages': [],
            'commands_shown': [],
            'versions': [],
            'lun_ids': [],
        }

        # Extract hostnames (common patterns)
        hostnames = re.findall(r'\b([a-z][a-z0-9\-]+(?:sv|node|host)\d+)\b', description.lower())
        details['hostnames'] = list(set(hostnames))[:10]

        # Extract timestamps
        timestamps = re.findall(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}', description)
        if not timestamps:
            timestamps = re.findall(r'\d{1,2}/\d{1,2}\s+\d{2}:\d{2}', description)
        details['timestamps'] = timestamps[:10]

        # Extract error keywords
        error_lines = re.findall(r'(?:error|failed|critical|warning|denied|conflict|withdraw|timeout)[^\n]{0,100}', description.lower())
        details['error_messages'] = error_lines[:10]

        # Extract LUN IDs
        luns = re.findall(r'(?:LUN|lun)\s*(\d+)', description)
        details['lun_ids'] = list(set(luns))

        # Extract version info
        versions = re.findall(r'(?:version|v)\s*(\d+\.\d+[\.\d]*)', description.lower())
        details['versions'] = list(set(versions))

        return details


    def _generate_response(self, categories, matched_issues, runbook_steps,
                           details, description, ticket_key, summary) -> Dict:
        """Generate the full structured L4 response."""

        # Build root cause section
        root_cause = self._build_root_cause(categories, matched_issues, description)

        # Build action plan
        action_plan = self._build_action_plan(categories, matched_issues, runbook_steps, description)

        # Build safety notes
        safety_notes = self._build_safety_notes(categories, action_plan)

        # Build next steps
        next_steps = self._build_next_steps(categories, matched_issues)

        # Build the full formatted reply text
        formatted_reply = self._format_reply(
            root_cause=root_cause,
            action_plan=action_plan,
            safety_notes=safety_notes,
            next_steps=next_steps,
            matched_issues=matched_issues,
            details=details,
            ticket_key=ticket_key,
        )

        # Related patterns
        related_patterns = self._get_related_patterns(categories)

        return {
            'root_cause': root_cause,
            'action_plan': action_plan,
            'safety_notes': safety_notes,
            'next_steps': next_steps,
            'matched_issues': [{
                'title': i.get('title', ''),
                'bug_id': i.get('bug_id', ''),
                'solution': i.get('solution', ''),
                'products': i.get('products', []),
            } for i in matched_issues],
            'related_patterns': related_patterns,
            'formatted_reply': formatted_reply,
            'categories': categories,
        }

    def _build_root_cause(self, categories, matched_issues, description) -> str:
        """Build root cause analysis text."""
        desc_lower = description.lower()

        # Specific known scenarios
        if 'gfs2' in categories and 'scsi_reservation' in categories and 'morpheus' in categories:
            return ("Two related issues detected:\n\n"
                    "1) SCSI-3 Persistent Reservation conflict on shared LUN causing GFS2 journal write "
                    "failures. When a node cannot write to its GFS2 journal due to reservation conflicts, "
                    "GFS2 withdraws the filesystem to protect data integrity. The filesystem remounts "
                    "read-only, and the DLM lockspace is released.\n\n"
                    "2) Morpheus cloud sync reclassification bug (MORPH-7774). When Morpheus syncs with "
                    "KVM hypervisors, it reads libvirt storage pool XML. GFS2 pools appear as "
                    "<pool type='dir'> (libvirt has no native GFS2 type). Morpheus pre-8.1.2 reclassifies "
                    "these as 'Directory Pool' on every sync cycle. Adding new hosts triggered a full "
                    "cloud re-sync which exposed this bug.")

        if 'gfs2' in categories and 'scsi_reservation' in categories:
            return ("SCSI-3 Persistent Reservation conflict on shared LUN causing GFS2 journal write "
                    "failures. When a node cannot write to its GFS2 journal due to reservation conflicts, "
                    "GFS2 withdraws the filesystem to protect data integrity. The filesystem remounts "
                    "read-only, and the DLM lockspace is released.")

        if 'datastore' in categories and 'morpheus' in categories:
            return ("Morpheus cloud sync reclassification bug (MORPH-7774). When Morpheus syncs with "
                    "KVM hypervisors, it reads libvirt storage pool XML definitions. GFS2 pools are defined "
                    "as <pool type='dir'> in libvirt (libvirt has no native GFS2 pool type). The Morpheus "
                    "sync code in versions prior to 8.1.2 sees type='dir' and reclassifies the datastore "
                    "as 'Directory Pool'. This triggers on every cloud inventory sync cycle.")

        if 'gfs2' in categories and 'cluster' in categories:
            return ("GFS2 filesystem issue in clustered environment. GFS2 depends on DLM (Distributed Lock "
                    "Manager) which requires healthy corosync communication between all cluster nodes. "
                    "If cluster communication is disrupted, DLM locks cannot be granted/released, causing "
                    "GFS2 to hang or withdraw.")

        if 'cluster' in categories and 'fencing' in categories:
            return ("Cluster fencing event — a node was fenced (power-cycled) by the cluster to protect "
                    "shared resources. This typically happens when corosync communication is lost and the "
                    "surviving nodes cannot confirm the failed node has released its resource locks.")

        if matched_issues:
            # Use the top matched issue's root cause
            top_issue = matched_issues[0]
            return top_issue.get('root_cause', 'Root cause matches known issue: ' + top_issue.get('title', ''))

        # Generic based on categories
        if 'storage' in categories:
            return ("Storage subsystem issue detected. Check multipath status, SCSI errors in dmesg, "
                    "and verify all paths are active to the storage array.")

        if 'kvm' in categories:
            return ("KVM/libvirt virtualization issue. Check VM state with virsh, review libvirt logs, "
                    "and verify hypervisor resource availability (CPU, memory, storage).")

        if 'performance' in categories:
            return ("Performance degradation detected. Check system load (top/htop), I/O wait (iostat), "
                    "memory pressure (free -h), and identify the bottleneck resource.")

        return ("Issue requires further log analysis to determine root cause. Upload the relevant log "
                "bundle to LogSherlock for automated pattern detection across 455 patterns.")

    def _build_action_plan(self, categories, matched_issues, runbook_steps, description) -> List[Dict]:
        """Build step-by-step action plan with commands."""
        steps = []
        desc_lower = description.lower()

        # GFS2 + SCSI reservation + Morpheus combined scenario
        if 'gfs2' in categories and 'scsi_reservation' in categories and 'morpheus' in categories:
            steps = [
                {'step': 'Fix Morpheus datastore type — stop UI to prevent sync overwrite',
                 'command': 'morpheus-ctl stop morpheus-ui',
                 'note': 'Running VMs are NOT affected — they run on KVM/libvirt, not Morpheus UI'},
                {'step': 'Update datastore type to GFS2 in Morpheus database',
                 'command': "mysql -e \"UPDATE datastore SET datastore_type_id = 5 WHERE id IN (20, 22, 23, 24);\"",
                 'note': 'Type 5 = GFS2 Pool. Only changes a classification label.'},
                {'step': 'Start Morpheus UI and disable auto-sync',
                 'command': 'morpheus-ctl start morpheus-ui',
                 'note': 'After UI starts: Infrastructure → Clouds → Edit → Uncheck "Inventory Existing Instances" → Save'},
                {'step': 'Verify SCSI-3 PR registrations on affected LUNs',
                 'command': 'sg_persist --in --read-keys /dev/mapper/mpathX\nsg_persist --in --read-reservation /dev/mapper/mpathX',
                 'note': 'All cluster nodes should have active registrations'},
                {'step': 'Recover withdrawn GFS2 on affected node',
                 'command': 'umount /mnt/<uuid>\nmount /dev/mapper/mpathX /mnt/<uuid>',
                 'note': 'Ensure DLM lockspace is healthy before remounting (dlm_tool ls)'},
                {'step': 'Verify fix — check GUI and filesystem status',
                 'command': 'Hard refresh browser (Ctrl+Shift+R)\nmount | grep gfs2\ncat /proc/mounts | grep gfs2',
                 'note': 'GUI should show GFS2 Pool. All nodes should have rw mounts.'},
            ]

        # GFS2 + SCSI reservation scenario
        elif 'gfs2' in categories and 'scsi_reservation' in categories:
            steps = [
                {'step': 'Verify SCSI-3 PR registrations on the affected LUN',
                 'command': 'sg_persist --in --read-keys /dev/mapper/mpathX\nsg_persist --in --read-reservation /dev/mapper/mpathX',
                 'note': 'All cluster nodes should have active registrations'},
                {'step': 'Check GFS2 filesystem status on all nodes',
                 'command': 'mount | grep gfs2\ncat /proc/mounts | grep gfs2',
                 'note': 'Look for ro (read-only) mounts indicating withdrawn filesystems'},
                {'step': 'Check DLM lockspace status',
                 'command': 'dlm_tool ls\ndlm_tool status',
                 'note': 'All lockspaces should show all expected nodes'},
                {'step': 'Recover withdrawn GFS2 filesystem',
                 'command': 'umount /mnt/<uuid>\nmount /dev/mapper/mpathX /mnt/<uuid>',
                 'note': 'Unmount and remount to rejoin the lockspace. Ensure DLM is healthy first'},
                {'step': 'Verify fence agent configuration',
                 'command': 'pcs stonith show\npcs stonith history',
                 'note': 'Fencing must work correctly to prevent data corruption'},
            ]

        # Morpheus datastore reclassification
        elif 'datastore' in categories and 'morpheus' in categories:
            steps = [
                {'step': 'Check current datastore type in Morpheus DB',
                 'command': "mysql -e \"SELECT id, name, datastore_type_id FROM datastore WHERE name LIKE 'NEOST%';\"",
                 'note': 'Type 1=Directory Pool, 5=GFS2 Pool'},
                {'step': 'Stop Morpheus UI to prevent sync from overwriting',
                 'command': 'morpheus-ctl stop morpheus-ui',
                 'note': 'Running VMs are NOT affected — they run on KVM/libvirt, not Morpheus UI'},
                {'step': 'Update datastore type to GFS2 in database',
                 'command': "mysql -e \"UPDATE datastore SET datastore_type_id = 5 WHERE id IN (20, 22, 23, 24);\"",
                 'note': 'Change from Directory Pool (1) to GFS2 Pool (5)'},
                {'step': 'Start Morpheus UI',
                 'command': 'morpheus-ctl start morpheus-ui',
                 'note': 'UI will be available in ~2-3 minutes'},
                {'step': 'Disable automatic cloud sync to prevent reversion',
                 'command': 'Infrastructure → Clouds → Edit KVM cloud → Uncheck "Inventory Existing Instances" → Save',
                 'note': 'This prevents the sync from overwriting the DB fix. Can be re-enabled after 8.1.2 upgrade'},
                {'step': 'Verify fix in GUI',
                 'command': 'Hard refresh browser (Ctrl+Shift+R) or open incognito window',
                 'note': 'All datastores should now show as GFS2 Pool'},
            ]

        # Cluster/fencing issues
        elif 'cluster' in categories:
            steps = [
                {'step': 'Check cluster status',
                 'command': 'pcs status\npcs status --full',
                 'note': 'Look for failed resources, offline nodes, or pending actions'},
                {'step': 'Check corosync ring health',
                 'command': 'corosync-cfgtool -s\ncorosync-quorumtool',
                 'note': 'All rings should be active, quorum should be maintained'},
                {'step': 'Review fence history',
                 'command': 'pcs stonith history\nfence_tool dump',
                 'note': 'Check for recent fence events and their results'},
                {'step': 'Check resource constraints and locations',
                 'command': 'pcs constraint show --full\npcs resource show --full',
                 'note': 'Look for location constraints that may prevent failover'},
            ]

        # Storage issues
        elif 'storage' in categories:
            steps = [
                {'step': 'Check multipath status',
                 'command': 'multipath -ll\nmultipathd show paths',
                 'note': 'All paths should be active/ready'},
                {'step': 'Check for SCSI errors',
                 'command': 'dmesg | grep -i "scsi\\|error\\|reservation"\njournalctl -k | grep -i scsi',
                 'note': 'Look for reservation conflicts, command timeouts, or path failures'},
                {'step': 'Verify iSCSI sessions (if applicable)',
                 'command': 'iscsiadm -m session -P 3\nsystemctl status iscsid multipathd',
                 'note': 'All targets should be connected with active sessions'},
            ]

        # KVM/VM issues
        elif 'kvm' in categories:
            steps = [
                {'step': 'Check VM states',
                 'command': 'virsh list --all\nvirsh dominfo <vm-name>',
                 'note': 'Identify paused, crashed, or shut-off VMs'},
                {'step': 'Check libvirt logs for errors',
                 'command': 'tail -100 /var/log/libvirt/qemu/<vm-name>.log\njournalctl -u libvirtd --since "1 hour ago"',
                 'note': 'Look for I/O errors, migration failures, or resource issues'},
                {'step': 'Verify storage pool status',
                 'command': 'virsh pool-list --all --details\nvirsh vol-list <pool-name>',
                 'note': 'All pools should be running with available capacity'},
            ]

        # If matched issues have solutions, use those
        elif matched_issues:
            solution = matched_issues[0].get('solution', '')
            for i, line in enumerate(solution.split('\n'), 1):
                line = line.strip()
                if line:
                    # Try to split numbered steps
                    cleaned = re.sub(r'^\d+\.\s*', '', line)
                    steps.append({'step': cleaned, 'command': '', 'note': ''})

        # Fallback generic
        if not steps:
            steps = [
                {'step': 'Collect system logs from the affected timeframe',
                 'command': 'journalctl --since "2024-07-28 13:00" --until "2024-07-28 14:00" > /tmp/incident_logs.txt',
                 'note': 'Adjust timestamps to match the incident window'},
                {'step': 'Upload log bundle to LogSherlock for automated analysis',
                 'command': 'tar czf logs_bundle.tar.gz /var/log/messages /var/log/syslog dmesg.txt',
                 'note': 'The scanner will match against 455 patterns automatically'},
                {'step': 'Check system health',
                 'command': 'uptime; free -h; df -h; dmesg | tail -50',
                 'note': 'Quick health check for obvious issues'},
            ]

        return steps


    def _build_safety_notes(self, categories, action_plan) -> List[str]:
        """Build production safety notes for the action plan."""
        notes = []

        if 'morpheus' in categories:
            notes.append("morpheus-ctl stop/start morpheus-ui — only restarts the web interface. Running VMs are completely unaffected since they run on KVM/libvirt, not the Morpheus UI process. Users lose GUI access for ~2-3 minutes during restart.")
            notes.append("DB update (SET datastore_type_id) — only changes a classification label in the Morpheus database. Does NOT touch actual storage, VMs, or cluster operations.")
            notes.append("Unchecking 'Inventory Existing Instances' — only pauses background discovery scans. No impact on running VMs, storage, networking, or HA.")

        if 'gfs2' in categories:
            notes.append("GFS2 remount — ensure DLM lockspace is healthy before remounting. Remounting while DLM is degraded can cause further withdrawals.")
            notes.append("Never force-mount GFS2 without proper DLM recovery. Data corruption risk is HIGH if multiple nodes mount without lock coordination.")

        if 'cluster' in categories:
            notes.append("Cluster maintenance — put the node in standby (pcs node standby <node>) before performing disruptive operations to prevent unexpected failovers.")
            notes.append("Fence testing — only test fencing during maintenance windows. A fence test will actually power-cycle the target node.")

        if 'storage' in categories:
            notes.append("Storage operations — never remove multipath devices while I/O is active. Ensure no filesystems are mounted on the device before path removal.")
            notes.append("SCSI reservation changes — coordinate with all nodes accessing the shared LUN. Clearing reservations while other nodes hold them causes data loss.")

        if 'kvm' in categories:
            notes.append("VM operations — live migration requires shared storage accessible from both source and destination hosts. Verify storage connectivity before attempting migration.")
            notes.append("Force-destroying a VM (virsh destroy) is equivalent to pulling the power cord. Use virsh shutdown for graceful stop when possible.")

        if not notes:
            notes.append("All diagnostic commands (checking status, reading logs) are read-only and production-safe.")
            notes.append("Before making any changes, take a backup/snapshot of the current state.")

        return notes

    def _build_next_steps(self, categories, matched_issues) -> List[str]:
        """Build recommended next steps."""
        steps = []

        if matched_issues:
            top = matched_issues[0]
            if top.get('bug_id'):
                steps.append(f"Reference internal bug: {top['bug_id']}")
            if top.get('affected_versions'):
                steps.append(f"Check if running affected version: {top['affected_versions']}")

        if 'morpheus' in categories and 'datastore' in categories:
            steps.append("Plan Morpheus 8.1.2 upgrade for permanent fix (contains MORPH-7774 code fix)")
            steps.append("After GUI fix is stable, address remaining items: VM local-storage XML fix, GFS2 remount on affected node")
            steps.append("Test the fix in lab first before applying to production")

        if 'gfs2' in categories:
            steps.append("Monitor GFS2 filesystem health after recovery: watch -n5 'cat /proc/fs/gfs2/*/about'")
            steps.append("Schedule maintenance window to investigate root cause of SCSI reservation conflicts")

        if 'cluster' in categories:
            steps.append("Monitor cluster stability for 24h after recovery")
            steps.append("Review and test fence agent configuration")

        if not steps:
            steps.append("Upload log bundle to LogSherlock for comprehensive automated scan")
            steps.append("Schedule a call to discuss findings and plan remediation")
            steps.append("Monitor system for recurrence")

        steps.append("Provide update to customer with timeline for permanent fix")

        return steps

    def _get_related_patterns(self, categories) -> List[Dict]:
        """Get relevant detection patterns for the detected categories."""
        category_map = {
            'gfs2': ['filesystem', 'cluster', 'storage'],
            'scsi_reservation': ['storage'],
            'morpheus': ['service', 'application'],
            'datastore': ['storage', 'virtualization'],
            'cluster': ['cluster'],
            'storage': ['storage'],
            'kvm': ['virtualization'],
            'network': ['network'],
            'memory': ['memory'],
            'fencing': ['cluster'],
            'kernel': ['kernel'],
            'performance': ['performance'],
            'backup': ['backup'],
            'security': ['security'],
        }

        relevant_categories = set()
        for cat in categories:
            relevant_categories.update(category_map.get(cat, []))

        related = []
        for p in self.patterns:
            if p.category in relevant_categories:
                related.append({
                    'name': p.name,
                    'severity': p.severity,
                    'category': p.category,
                    'description': p.description,
                })
                if len(related) >= 15:
                    break

        return related


    def _format_reply(self, root_cause, action_plan, safety_notes, next_steps,
                      matched_issues, details, ticket_key) -> str:
        """Format the complete ready-to-paste Jira reply text."""
        lines = []

        # Header
        lines.append(f"Hi,\n")
        lines.append(f"Here's the analysis and recommended action plan.\n")

        # Root Cause
        lines.append("─" * 60)
        lines.append("\n📋 ROOT CAUSE ANALYSIS\n")
        lines.append(root_cause)
        lines.append("")

        # Affected components
        if details.get('hostnames'):
            lines.append(f"Affected hosts: {', '.join(details['hostnames'][:5])}")
        if details.get('timestamps'):
            lines.append(f"Incident timeframe: {details['timestamps'][0]} — {details['timestamps'][-1]}" if len(details['timestamps']) > 1 else f"Incident time: {details['timestamps'][0]}")
        if details.get('lun_ids'):
            lines.append(f"LUN(s) involved: {', '.join(details['lun_ids'])}")
        lines.append("")

        # Action Plan
        lines.append("─" * 60)
        lines.append("\n🔧 ACTION PLAN\n")
        for i, step in enumerate(action_plan, 1):
            lines.append(f"Step {i}: {step['step']}")
            if step.get('command'):
                for cmd in step['command'].split('\n'):
                    lines.append(f"    $ {cmd}")
            if step.get('note'):
                lines.append(f"    ⚠️  {step['note']}")
            lines.append("")

        # Safety Notes
        lines.append("─" * 60)
        lines.append("\n🛡️ SAFETY NOTES (Production Impact)\n")
        for note in safety_notes:
            lines.append(f"• {note}")
        lines.append("")

        # Related Known Issues
        if matched_issues:
            lines.append("─" * 60)
            lines.append("\n📚 RELATED KNOWN ISSUES\n")
            for issue in matched_issues[:3]:
                bug = f" ({issue.get('bug_id', '')})" if issue.get('bug_id') else ''
                lines.append(f"• {issue.get('title', '')}{bug}")
                prods = ', '.join(issue.get('products', []))
                if prods:
                    lines.append(f"  Products: {prods}")
            lines.append("")

        # Next Steps
        lines.append("─" * 60)
        lines.append("\n📌 NEXT STEPS\n")
        for i, step in enumerate(next_steps, 1):
            lines.append(f"{i}. {step}")
        lines.append("")

        # Footer
        lines.append("─" * 60)
        lines.append("\nLet me know if you need any clarification or have questions about the action plan.")
        lines.append("\nThanks,")
        lines.append("L4 Support Engineering")

        return '\n'.join(lines)


# Singleton instance for reuse
_advisor_instance = None


def get_advisor() -> TicketAdvisor:
    """Get or create the singleton TicketAdvisor instance."""
    global _advisor_instance
    if _advisor_instance is None:
        _advisor_instance = TicketAdvisor()
    return _advisor_instance
