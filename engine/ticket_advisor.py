"""Ticket Advisor Engine for LogSherlock Pro.

Analyzes Jira ticket descriptions and generates structured L4 troubleshooting
responses WITHOUT requiring Ollama or any external AI. Uses pattern matching
against the 455 built-in patterns, 120 known issues, and runbooks to produce
complete ready-to-post replies.

Enhanced with iterative conversation support:
- analyze_conversation(messages) for multi-turn context-aware responses
- Follow-up result analysis with smart pattern detection
- Command safety classification (safe/medium/high risk levels)
- GFS2/Morpheus-specific follow-up detection logic
- All responses complete in <100ms (pure pattern matching, no external calls)

Output includes:
- Root Cause Analysis
- Detailed Action Plan with commands and risk_level
- Safety Notes (production impact assessment)
- Next Steps
- Related Known Issues & Bug IDs
- Conversation metadata (turn number, context detected, processing time)
"""

import re
import time
from typing import Dict, List, Optional, Tuple


# ─────────────────────────────────────────────────────────────────────────────
# FOLLOW-UP PATTERN DEFINITIONS
# ─────────────────────────────────────────────────────────────────────────────

FOLLOWUP_PATTERNS = [
    # DB fix applied but GUI not updated
    {'triggers': ['still shows', 'not corrected', 'gui still', 'display was not', 'directory pool'],
     'context': 'db_fix_gui_mismatch',
     'response': 'sync_overwriting_fix'},

    # Service restarted but no effect
    {'triggers': ['restarted', 'restart', 'incognito', 'hard refresh', 'ctrl+shift+r'],
     'context': 'restart_no_effect',
     'response': 'disable_sync_options'},

    # Customer asking questions about the issue
    {'triggers': ['customer has', 'customer asking', 'what triggers', 'what operation', 'any way to resolve'],
     'context': 'customer_questions',
     'response': 'explain_sync_trigger'},

    # SQL output pasted
    {'triggers': ['mysql>', 'select', 'datastore_type_id', '+----+'],
     'context': 'sql_output',
     'response': 'interpret_sql_results'},

    # Option tested successfully
    {'triggers': ['working', 'fixed', 'shows gfs2', 'confirmed', 'option a worked', 'option b worked'],
     'context': 'fix_confirmed',
     'response': 'maintenance_window_steps'},

    # New errors reported
    {'triggers': ['error', 'failed', 'cannot', 'denied', 'timeout', 'withdrawal'],
     'context': 'new_error',
     'response': 'analyze_new_error'},

    # Command output pasted
    {'triggers': ['root@', '# ', '$ ', 'output:', 'result:'],
     'context': 'command_output',
     'response': 'interpret_command_output'},
]

# ─────────────────────────────────────────────────────────────────────────────
# COMMAND RISK CLASSIFICATION PATTERNS
# ─────────────────────────────────────────────────────────────────────────────

SAFE_COMMAND_PATTERNS = [
    r'\bgrep\b', r'\bcat\b', r'\btail\b', r'\bhead\b', r'\bless\b', r'\bmore\b',
    r'\bmount\s*\|\s*grep\b', r'\bvirsh\s+list\b', r'\bpcs\s+status\b',
    r'\bpcs\s+constraint\s+show\b', r'\bpcs\s+resource\s+show\b',
    r'\bcorosync-cfgtool\b', r'\bcorosync-quorumtool\b',
    r'\bdlm_tool\s+(ls|status)\b', r'\bsg_persist\s+--in\b',
    r'\bmultipath\s+-ll\b', r'\bmultipathd\s+show\b',
    r'\biscsiadm\s+-m\s+session\b', r'\bvirsh\s+dominfo\b',
    r'\bvirsh\s+pool-list\b', r'\bvirsh\s+vol-list\b',
    r'\bjournalctl\b', r'\bdmesg\b', r'\buptime\b', r'\bfree\b', r'\bdf\b',
    r'\btop\b', r'\bhtop\b', r'\biostat\b', r'\bwatch\b',
    r'\bSELECT\b', r'\bselect\b',
    r'\bsystemctl\s+status\b', r'\bhistory\b',
    r'Ctrl\+Shift\+R', r'Hard refresh', r'incognito',
    r'Infrastructure\s*→.*→.*→', r'\bpcs\s+stonith\s+show\b',
    r'\bpcs\s+stonith\s+history\b', r'\bfence_tool\s+dump\b',
]

MEDIUM_COMMAND_PATTERNS = [
    r'\bmorpheus-ctl\s+(stop|start|restart)\b',
    r'\bsystemctl\s+(stop|start|restart|reload)\b',
    r'\bUPDATE\b', r'\bINSERT\b', r'\bALTER\b',
    r'\bUncheck\b', r'\buncheck\b',
    r'\bpcs\s+node\s+standby\b', r'\bpcs\s+resource\s+(move|ban|clear)\b',
    r'\bvirsh\s+(start|shutdown|reboot|suspend|resume)\b',
    r'\biscsiadm.*--login\b', r'\biscsiadm.*--logout\b',
    r'\bservice\s+\w+\s+(stop|start|restart)\b',
    r'\bsed\s+-i\b', r'\bvi\s\b', r'\bvim\s\b',
    r'\bdisable\b.*sync', r'\benable\b.*sync',
]

HIGH_COMMAND_PATTERNS = [
    r'\bfsck\b', r'\be2fsck\b', r'\bxfs_repair\b',
    r'\bvirsh\s+destroy\b', r'\bvirsh\s+undefine\b',
    r'\bDROP\b', r'\bDELETE\s+FROM\b', r'\bTRUNCATE\b',
    r'\bumount\b(?!.*grep)', r'\bforce\b',
    r'\bdd\s+if=\b', r'\bmkfs\b', r'\bparted\b', r'\bfdisk\b',
    r'\brm\s+-rf\b', r'\brm\s+-r\b',
    r'\bpcs\s+cluster\s+(stop|destroy)\b',
    r'\bpcs\s+stonith\s+fence\b',
    r'\bsg_persist\s+--out\b',
    r'\b--force\b', r'\b-f\b.*mount',
]


def _classify_command_risk(command: str) -> Tuple[str, str]:
    """Classify a command's risk level.

    Returns:
        Tuple of (risk_level, risk_reason)
    """
    if not command or command.strip() == '':
        return ('safe', 'No command to execute')

    cmd_lower = command.lower()

    # Check HIGH risk first (most dangerous)
    for pattern in HIGH_COMMAND_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            if 'fsck' in cmd_lower:
                return ('high', 'Filesystem repair can modify data structures')
            if 'destroy' in cmd_lower:
                return ('high', 'Force-kills VM immediately without graceful shutdown')
            if 'drop' in cmd_lower or 'delete from' in cmd_lower or 'truncate' in cmd_lower:
                return ('high', 'Destructive database operation - data loss risk')
            if 'umount' in cmd_lower:
                return ('high', 'Unmounting active filesystem can disrupt services')
            if 'mkfs' in cmd_lower or 'dd if=' in cmd_lower:
                return ('high', 'Overwrites data on target device')
            if 'rm -r' in cmd_lower:
                return ('high', 'Recursive deletion - data loss risk')
            if 'cluster' in cmd_lower and ('stop' in cmd_lower or 'destroy' in cmd_lower):
                return ('high', 'Cluster-wide impact - all services may failover')
            if 'sg_persist' in cmd_lower and '--out' in cmd_lower:
                return ('high', 'Modifies SCSI reservations on shared storage')
            if 'fence' in cmd_lower:
                return ('high', 'Will power-cycle the target node')
            return ('high', 'Potentially destructive operation on production system')

    # Check MEDIUM risk
    for pattern in MEDIUM_COMMAND_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            if 'morpheus-ctl' in cmd_lower:
                return ('medium', 'Service restart - brief UI unavailability (~2-3 min)')
            if 'update' in cmd_lower or 'insert' in cmd_lower or 'alter' in cmd_lower:
                return ('medium', 'Database modification - changes persistent state')
            if 'systemctl' in cmd_lower and any(x in cmd_lower for x in ['stop', 'start', 'restart']):
                return ('medium', 'Service state change - may affect dependent services')
            if 'uncheck' in cmd_lower or 'disable' in cmd_lower:
                return ('medium', 'Configuration change - alters system behavior')
            if 'virsh' in cmd_lower:
                return ('medium', 'VM state change operation')
            if 'standby' in cmd_lower or 'move' in cmd_lower or 'ban' in cmd_lower:
                return ('medium', 'Cluster resource relocation - may trigger failover')
            return ('medium', 'Service/configuration change with recoverable impact')

    # Check SAFE
    for pattern in SAFE_COMMAND_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            return ('safe', 'Read-only operation - no system changes')

    # Default: if contains pipe to grep or just reading, it's safe
    if '| grep' in command or cmd_lower.startswith('cat ') or cmd_lower.startswith('grep '):
        return ('safe', 'Read-only operation - no system changes')

    # GUI instructions are safe
    if '→' in command or 'refresh' in cmd_lower or 'incognito' in cmd_lower:
        return ('safe', 'Browser/GUI action - no backend impact')

    # Unknown commands default to medium for caution
    return ('medium', 'Command impact not fully classified - review before executing')




class TicketAdvisor:
    """Generates structured L4 support responses from ticket descriptions.

    Supports both single-shot analysis (analyze()) and iterative conversation
    flow (analyze_conversation()) for multi-turn troubleshooting sessions.
    """

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

        This is the original single-shot analysis method. Kept for backward compatibility.

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

    # ─────────────────────────────────────────────────────────────────────────
    # ITERATIVE CONVERSATION SUPPORT
    # ─────────────────────────────────────────────────────────────────────────

    def analyze_conversation(self, messages: List[Dict[str, str]]) -> Dict:
        """Analyze a conversation thread and provide context-aware response.

        This is the main new entry point for iterative troubleshooting sessions.
        On first message (single user message), delegates to analyze() for initial analysis.
        On follow-up messages, uses full conversation context for smart next steps.

        Args:
            messages: List of conversation messages in format:
                [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}, ...]
                First user message is always the original Jira ticket description.
                Subsequent user messages are follow-up updates from L3 team.

        Returns:
            Structured response dict with response_type, action_plan (with risk_level),
            formatted_reply, and conversation metadata.
        """
        start_time = time.time()

        if not messages:
            return self._empty_response(start_time)

        # Extract user messages only
        user_messages = [m for m in messages if m.get('role') == 'user']

        if not user_messages:
            return self._empty_response(start_time)

        # First message = original ticket description
        original_ticket = user_messages[0].get('content', '')

        # If only one user message, this is initial analysis
        if len(user_messages) == 1:
            result = self.analyze(original_ticket)
            # Enhance with conversation format
            return self._enhance_to_conversation_format(
                result, start_time, conversation_turn=1, context_detected='initial_ticket'
            )

        # Multiple messages = follow-up conversation
        current_message = user_messages[-1].get('content', '')
        conversation_context = {
            'original_ticket': original_ticket,
            'all_messages': messages,
            'user_messages': user_messages,
            'turn_number': len(user_messages),
            'original_categories': self._detect_categories(original_ticket.lower()),
        }

        followup_result = self._analyze_followup(current_message, conversation_context)

        # Add metadata
        followup_result['metadata'] = {
            'processing_time_ms': round((time.time() - start_time) * 1000, 1),
            'conversation_turn': len(user_messages),
            'context_detected': followup_result.get('_context_detected', 'followup'),
        }

        # Remove internal key
        followup_result.pop('_context_detected', None)

        return followup_result

    def _empty_response(self, start_time: float) -> Dict:
        """Return an empty response for edge cases."""
        return {
            'response_type': 'initial_analysis',
            'root_cause': 'No message content provided for analysis.',
            'action_plan': [],
            'safety_notes': ['No actions to assess.'],
            'next_steps': ['Provide the Jira ticket description for analysis.'],
            'formatted_reply': 'No content provided. Please paste the Jira ticket description.',
            'categories': [],
            'matched_issues': [],
            'metadata': {
                'processing_time_ms': round((time.time() - start_time) * 1000, 1),
                'conversation_turn': 0,
                'context_detected': 'empty',
            },
        }

    def _enhance_to_conversation_format(self, result: Dict, start_time: float,
                                         conversation_turn: int, context_detected: str) -> Dict:
        """Enhance a standard analyze() result to the conversation response format."""
        # Add risk_level to every action_plan step
        enhanced_plan = []
        for step in result.get('action_plan', []):
            cmd = step.get('command', '')
            risk_level, risk_reason = _classify_command_risk(cmd)
            enhanced_plan.append({
                'step': step.get('step', ''),
                'command': cmd,
                'note': step.get('note', ''),
                'risk_level': risk_level,
                'risk_reason': risk_reason,
            })

        return {
            'response_type': 'initial_analysis',
            'root_cause': result.get('root_cause', ''),
            'action_plan': enhanced_plan,
            'safety_notes': result.get('safety_notes', []),
            'next_steps': result.get('next_steps', []),
            'formatted_reply': result.get('formatted_reply', ''),
            'categories': result.get('categories', []),
            'matched_issues': result.get('matched_issues', []),
            'metadata': {
                'processing_time_ms': round((time.time() - start_time) * 1000, 1),
                'conversation_turn': conversation_turn,
                'context_detected': context_detected,
            },
        }



    def _analyze_followup(self, current_message: str, conversation_context: Dict) -> Dict:
        """Analyze a follow-up message in conversation context.

        Detects what the user is reporting (success, failure, partial fix, new info)
        and provides context-aware next steps.

        Args:
            current_message: The latest user message
            conversation_context: Dict with original_ticket, all_messages, user_messages,
                                  turn_number, original_categories

        Returns:
            Structured response dict with follow-up guidance
        """
        msg_lower = current_message.lower()
        original_categories = conversation_context.get('original_categories', [])

        # Detect which follow-up pattern matches
        detected_context = self._detect_followup_context(msg_lower)

        # Route to appropriate response generator
        if detected_context == 'db_fix_gui_mismatch':
            return self._respond_sync_overwriting_fix(current_message, conversation_context, detected_context)
        elif detected_context == 'restart_no_effect':
            return self._respond_disable_sync_options(current_message, conversation_context, detected_context)
        elif detected_context == 'customer_questions':
            return self._respond_explain_sync_trigger(current_message, conversation_context, detected_context)
        elif detected_context == 'sql_output':
            return self._respond_interpret_sql(current_message, conversation_context, detected_context)
        elif detected_context == 'fix_confirmed':
            return self._respond_maintenance_window(current_message, conversation_context, detected_context)
        elif detected_context == 'new_error':
            return self._respond_new_error(current_message, conversation_context, detected_context)
        elif detected_context == 'command_output':
            return self._respond_interpret_command(current_message, conversation_context, detected_context)
        else:
            # Generic follow-up - re-analyze with combined context
            return self._respond_generic_followup(current_message, conversation_context, detected_context)

    def _detect_followup_context(self, msg_lower: str) -> str:
        """Detect which follow-up pattern the message matches.

        Returns the context string for the best matching pattern.
        """
        best_match = None
        best_score = 0

        for pattern in FOLLOWUP_PATTERNS:
            score = 0
            for trigger in pattern['triggers']:
                if trigger.lower() in msg_lower:
                    score += 1
            if score > best_score:
                best_score = score
                best_match = pattern['context']

        return best_match if best_score > 0 else 'generic'

    # ─────────────────────────────────────────────────────────────────────────
    # FOLLOW-UP RESPONSE GENERATORS
    # ─────────────────────────────────────────────────────────────────────────

    def _respond_sync_overwriting_fix(self, message: str, context: Dict, detected: str) -> Dict:
        """DB fix applied but GUI still shows wrong value - sync is overwriting."""
        action_plan = [
            {'step': 'Confirm the cloud sync is overwriting the DB fix',
             'command': "mysql -e \"SELECT id, name, datastore_type_id FROM datastore WHERE name LIKE 'NEOST%';\"",
             'note': 'If type_id reverted to 1, the sync has overwritten your fix',
             'risk_level': 'safe', 'risk_reason': 'Read-only SELECT query'},
            {'step': 'Stop Morpheus UI immediately to halt sync cycle',
             'command': 'morpheus-ctl stop morpheus-ui',
             'note': 'Running VMs unaffected - only stops the web interface and background sync',
             'risk_level': 'medium', 'risk_reason': 'Service restart - brief UI unavailability (~2-3 min)'},
            {'step': 'Re-apply the DB fix',
             'command': "mysql -e \"UPDATE datastore SET datastore_type_id = 5 WHERE datastore_type_id = 1 AND name LIKE 'NEOST%';\"",
             'note': 'Type 5 = GFS2 Pool. This only changes a label, no storage impact.',
             'risk_level': 'medium', 'risk_reason': 'Database modification - changes persistent state'},
            {'step': 'Disable the cloud sync BEFORE starting UI',
             'command': 'morpheus-ctl start morpheus-ui\n# Then immediately: Infrastructure → Clouds → Edit → Uncheck "Inventory Existing Instances" → Save',
             'note': 'You must disable sync within 60 seconds of UI start, before the first sync cycle runs',
             'risk_level': 'medium', 'risk_reason': 'Service restart + configuration change'},
            {'step': 'Verify fix is holding after 5 minutes',
             'command': "mysql -e \"SELECT id, name, datastore_type_id FROM datastore WHERE name LIKE 'NEOST%';\"\n# Also check GUI with Ctrl+Shift+R",
             'note': 'If type_id stays at 5 and GUI shows GFS2 Pool, the fix is holding',
             'risk_level': 'safe', 'risk_reason': 'Read-only verification'},
        ]

        formatted_reply = self._format_followup_reply(
            title="SYNC OVERWRITING DB FIX — Disable Inventory Sync Required",
            analysis="The cloud sync cycle is reverting your DB update back to Directory Pool (type_id=1). "
                     "This happens because the sync reads libvirt XML which shows <pool type='dir'> for GFS2 pools. "
                     "The fix must be paired with disabling the inventory sync to prevent reversion.",
            action_plan=action_plan,
            next_steps=[
                "Once fix is confirmed holding, inform customer the display is corrected",
                "Plan Morpheus 8.1.2 upgrade which permanently fixes MORPH-7774",
                "Do NOT re-enable 'Inventory Existing Instances' until after the upgrade",
            ]
        )

        return {
            'response_type': 'followup_guidance',
            'root_cause': 'Cloud inventory sync is overwriting the manual DB fix on every sync cycle. '
                          'The sync reads libvirt pool XML where GFS2 appears as type=dir, causing Morpheus to reclassify it.',
            'action_plan': action_plan,
            'safety_notes': [
                'morpheus-ctl stop/start only affects the web UI, not running VMs or storage',
                'DB update only changes a classification label, not actual storage configuration',
                'Disabling Inventory sync pauses discovery only - no impact on existing VMs or operations',
            ],
            'next_steps': [
                'Verify DB fix holds for >10 minutes after disabling sync',
                'Plan Morpheus 8.1.2 upgrade for permanent code-level fix (MORPH-7774)',
                'Do NOT re-enable inventory sync until upgrade is complete',
            ],
            'formatted_reply': formatted_reply,
            'categories': context.get('original_categories', []),
            'matched_issues': [],
            '_context_detected': detected,
        }

    def _respond_disable_sync_options(self, message: str, context: Dict, detected: str) -> Dict:
        """Service restarted but issue persists - offer Option A and Option B."""
        action_plan = [
            {'step': 'Option A: Uncheck Inventory Existing Instances (less disruptive)',
             'command': 'Infrastructure → Clouds → [KVM Cloud] → Edit → Uncheck "Inventory Existing Instances" → Save',
             'note': 'This stops the sync that overwrites type. Existing VMs/storage are completely unaffected.',
             'risk_level': 'medium', 'risk_reason': 'Configuration change - disables background discovery'},
            {'step': 'Option A verification: Wait 5 min then check DB',
             'command': "mysql -e \"SELECT id, name, datastore_type_id FROM datastore WHERE name LIKE 'NEOST%';\"",
             'note': 'type_id should remain 5 (GFS2 Pool) after 5 minutes',
             'risk_level': 'safe', 'risk_reason': 'Read-only SELECT query'},
            {'step': 'Option B: Disable the cloud entirely (more disruptive but guaranteed)',
             'command': 'Infrastructure → Clouds → [KVM Cloud] → Edit → Set Status to "Disabled" → Save',
             'note': 'This completely stops all sync operations. Use if Option A alone does not hold.',
             'risk_level': 'medium', 'risk_reason': 'Disables cloud integration - no new discovery/sync'},
            {'step': 'After Option A or B: Re-apply DB fix if needed',
             'command': "morpheus-ctl stop morpheus-ui\nmysql -e \"UPDATE datastore SET datastore_type_id = 5 WHERE datastore_type_id = 1 AND name LIKE 'NEOST%';\"\nmorpheus-ctl start morpheus-ui",
             'note': 'Only needed if type_id has reverted back to 1',
             'risk_level': 'medium', 'risk_reason': 'Service restart + database modification'},
            {'step': 'Final verification',
             'command': "Hard refresh (Ctrl+Shift+R) or incognito window → check datastore display\nmysql -e \"SELECT id, name, datastore_type_id FROM datastore WHERE name LIKE 'NEOST%';\"",
             'note': 'Both GUI and DB should show GFS2 Pool (type_id=5)',
             'risk_level': 'safe', 'risk_reason': 'Read-only verification'},
        ]

        formatted_reply = self._format_followup_reply(
            title="SERVICE RESTART ALONE IS INSUFFICIENT — Two Options to Stop Sync Overwrite",
            analysis="Restarting the service or refreshing the browser does not fix the root cause. "
                     "The Morpheus cloud sync runs on a scheduled interval and will overwrite the DB fix "
                     "every time it runs. You need to DISABLE the sync, not just restart the service.\n\n"
                     "Two options (try A first, escalate to B if needed):",
            action_plan=action_plan,
            next_steps=[
                "Try Option A first (less disruptive)",
                "If Option A does not hold after 10 minutes, apply Option B",
                "Once stable, plan the Morpheus 8.1.2 upgrade for permanent fix",
                "After upgrade, re-enable the cloud integration",
            ]
        )

        return {
            'response_type': 'followup_guidance',
            'root_cause': 'Service restart does not address the root cause. The scheduled cloud inventory sync '
                          'runs independently and overwrites the datastore type on every cycle.',
            'action_plan': action_plan,
            'safety_notes': [
                'Option A (uncheck Inventory): Only pauses background discovery. No impact on existing VMs.',
                'Option B (disable cloud): Stops all sync operations. Existing VMs continue running normally.',
                'Neither option affects KVM/libvirt directly - VMs keep running regardless.',
            ],
            'next_steps': [
                'Apply Option A and monitor for 10 minutes',
                'Escalate to Option B only if A fails',
                'Plan Morpheus 8.1.2 upgrade (permanent fix)',
            ],
            'formatted_reply': formatted_reply,
            'categories': context.get('original_categories', []),
            'matched_issues': [],
            '_context_detected': detected,
        }

    def _respond_explain_sync_trigger(self, message: str, context: Dict, detected: str) -> Dict:
        """Customer asking what triggers the issue - provide explanation."""
        action_plan = [
            {'step': 'Explain the trigger mechanism to the customer',
             'command': '',
             'note': 'See formatted reply below for customer-ready explanation',
             'risk_level': 'safe', 'risk_reason': 'Information only - no system changes'},
            {'step': 'Show the customer the libvirt pool XML as evidence',
             'command': "virsh pool-dumpxml <pool-name> | grep 'type='",
             'note': 'This shows <pool type=dir> which is what Morpheus reads during sync',
             'risk_level': 'safe', 'risk_reason': 'Read-only command'},
            {'step': 'Reference the fix version',
             'command': '',
             'note': 'Morpheus 8.1.2 contains the code fix for MORPH-7774. Until then, workaround is disabling sync.',
             'risk_level': 'safe', 'risk_reason': 'Information only'},
        ]

        explanation = (
            "**What triggers the reclassification:**\n\n"
            "1. Morpheus performs periodic cloud inventory sync with all connected KVM hypervisors\n"
            "2. During sync, it reads libvirt storage pool XML definitions from each host\n"
            "3. GFS2 shared filesystems are defined in libvirt as <pool type='dir'> because "
            "libvirt has NO native GFS2 pool type — it treats them as directory-type pools\n"
            "4. Morpheus sync code (pre-8.1.2) reads type='dir' and maps it to 'Directory Pool'\n"
            "5. This overwrites any manual DB correction on every sync cycle (typically every 5-10 min)\n\n"
            "**What operations trigger a full re-sync:**\n"
            "- Adding new hypervisor hosts to the cloud\n"
            "- Manually clicking 'Refresh' on the cloud\n"
            "- The scheduled inventory cycle (automatic)\n\n"
            "**Resolution path:**\n"
            "- Immediate: Disable inventory sync + manual DB fix (workaround)\n"
            "- Permanent: Upgrade to Morpheus 8.1.2 which fixes MORPH-7774 in code"
        )

        formatted_reply = self._format_followup_reply(
            title="EXPLANATION: What Triggers the Datastore Type Reclassification",
            analysis=explanation,
            action_plan=action_plan,
            next_steps=[
                "Share this explanation with the customer",
                "Confirm workaround (disable sync) is in place",
                "Provide upgrade timeline for Morpheus 8.1.2",
            ]
        )

        return {
            'response_type': 'followup_guidance',
            'root_cause': 'Morpheus cloud sync reads libvirt pool XML where GFS2 pools appear as type=dir. '
                          'The sync code in pre-8.1.2 versions incorrectly maps this to Directory Pool.',
            'action_plan': action_plan,
            'safety_notes': [
                'This explanation is safe to share with the customer',
                'The issue is a known software bug (MORPH-7774), not a misconfiguration',
            ],
            'next_steps': [
                'Share explanation with customer',
                'Confirm workaround is active (inventory sync disabled)',
                'Provide Morpheus 8.1.2 upgrade ETA',
            ],
            'formatted_reply': formatted_reply,
            'categories': context.get('original_categories', []),
            'matched_issues': [],
            '_context_detected': detected,
        }

    def _respond_interpret_sql(self, message: str, context: Dict, detected: str) -> Dict:
        """User pasted SQL output - interpret the results."""
        msg_lower = message.lower()

        # Try to detect type_id values in the output
        has_type_5 = 'type_id' in msg_lower and '5' in message
        has_type_1 = 'type_id' in msg_lower and '1' in message

        if has_type_5 and not has_type_1:
            # DB shows correct value (5 = GFS2)
            analysis = ("SQL output confirms datastore_type_id = 5 (GFS2 Pool) in the database. "
                        "The DB fix is holding correctly.\n\n"
                        "If the GUI still shows 'Directory Pool' despite DB being correct, this is a "
                        "caching issue. Try: hard refresh (Ctrl+Shift+R), incognito window, or wait for "
                        "the UI cache to expire (~5 min).\n\n"
                        "If the GUI updates correctly, the immediate fix is complete. Focus on preventing "
                        "the sync from overwriting it again.")
            response_type = 'verification'
        elif has_type_1:
            # DB shows wrong value (1 = Directory Pool)
            analysis = ("SQL output shows datastore_type_id = 1 (Directory Pool) — the sync has overwritten "
                        "the fix, OR the fix was never applied.\n\n"
                        "The sync must be disabled BEFORE re-applying the DB fix, otherwise it will be "
                        "overwritten again within minutes.")
            response_type = 'followup_guidance'
        else:
            # Generic SQL output interpretation
            analysis = ("SQL output received. Analyzing the results in context of the datastore "
                        "reclassification issue.\n\n"
                        "Key values to check:\n"
                        "- datastore_type_id = 1 means Directory Pool (incorrect for GFS2)\n"
                        "- datastore_type_id = 5 means GFS2 Pool (correct)\n"
                        "- If type_id keeps reverting to 1, the inventory sync is active and overwriting")
            response_type = 'followup_guidance'

        action_plan = [
            {'step': 'Verify current DB state explicitly',
             'command': "mysql -e \"SELECT id, name, datastore_type_id, DATE_FORMAT(last_updated, '%Y-%m-%d %H:%i:%s') as last_updated FROM datastore WHERE name LIKE 'NEOST%';\"",
             'note': 'Check last_updated timestamp to see if sync recently modified the row',
             'risk_level': 'safe', 'risk_reason': 'Read-only SELECT query'},
            {'step': 'Check if inventory sync is still enabled',
             'command': "mysql -e \"SELECT id, name, inventory_level FROM compute_zone WHERE zone_type = 'standard';\"",
             'note': 'If inventory_level is not off, sync is still active and will overwrite',
             'risk_level': 'safe', 'risk_reason': 'Read-only SELECT query'},
            {'step': 'Confirm fix status in GUI',
             'command': 'Open incognito browser → Infrastructure → Storage → check datastore types displayed',
             'note': 'If GUI shows Directory Pool but DB shows 5, it may be a UI cache issue',
             'risk_level': 'safe', 'risk_reason': 'Browser verification only'},
        ]

        formatted_reply = self._format_followup_reply(
            title="SQL OUTPUT INTERPRETATION",
            analysis=analysis,
            action_plan=action_plan,
            next_steps=[
                "Confirm whether inventory sync is disabled",
                "If DB shows type_id=5 but GUI wrong → UI cache issue, hard refresh",
                "If DB shows type_id=1 → sync still active, must disable first",
                "Focus on sync prevention as the priority",
            ]
        )

        return {
            'response_type': response_type,
            'root_cause': 'Interpreting SQL output in context of MORPH-7774 datastore reclassification bug.',
            'action_plan': action_plan,
            'safety_notes': [
                'All verification commands are read-only SELECT queries',
                'No changes will be made during this verification step',
            ],
            'next_steps': [
                'Confirm sync is disabled before any further DB changes',
                'If type_id=5 and GUI correct → fix is holding, monitor',
                'If type_id=1 → re-apply fix with sync disabled',
            ],
            'formatted_reply': formatted_reply,
            'categories': context.get('original_categories', []),
            'matched_issues': [],
            '_context_detected': detected,
        }



    def _respond_maintenance_window(self, message: str, context: Dict, detected: str) -> Dict:
        """Fix confirmed working - provide maintenance window steps (Part A/B/C/D)."""
        msg_lower = message.lower()

        # Determine if they specifically mentioned which option worked
        if 'option b' in msg_lower:
            fix_method = "Option B (cloud disabled)"
        elif 'option a' in msg_lower:
            fix_method = "Option A (inventory sync unchecked)"
        elif 'migration' in msg_lower and 'working' in msg_lower:
            # Migration working - provide close-out response
            return self._respond_migration_confirmed(message, context, detected)
        else:
            fix_method = "workaround applied"

        action_plan = [
            {'step': 'Part A: Document current stable state',
             'command': "mysql -e \"SELECT id, name, datastore_type_id FROM datastore WHERE name LIKE 'NEOST%';\"\nmount | grep gfs2\npcs status",
             'note': 'Capture baseline before any maintenance changes. Save output for the ticket.',
             'risk_level': 'safe', 'risk_reason': 'Read-only verification commands'},
            {'step': 'Part B: Schedule Morpheus 8.1.2 upgrade maintenance window',
             'command': '',
             'note': 'Coordinate with customer for 2-4 hour window. Upgrade includes MORPH-7774 fix. '
                     'Pre-stage: download upgrade package, verify backup, confirm rollback plan.',
             'risk_level': 'safe', 'risk_reason': 'Planning step - no system changes'},
            {'step': 'Part C: Pre-upgrade checklist',
             'command': 'morpheus-ctl status\nmorpheus-ctl backup\ndf -h /opt/morpheus\ncat /etc/morpheus/morpheus.rb',
             'note': 'Verify all services healthy, take backup, confirm disk space (need ~5GB free), save config',
             'risk_level': 'safe', 'risk_reason': 'Read-only status checks and backup'},
            {'step': 'Part D: Post-upgrade verification',
             'command': "# After 8.1.2 upgrade:\n"
                        "# 1. Re-enable 'Inventory Existing Instances' on the cloud\n"
                        "# 2. Wait for one full sync cycle (~10 min)\n"
                        "# 3. Verify:\n"
                        "mysql -e \"SELECT id, name, datastore_type_id FROM datastore WHERE name LIKE 'NEOST%';\"\n"
                        "# Should remain type_id=5 even with sync re-enabled",
             'note': 'If type_id stays at 5 after re-enabling sync, MORPH-7774 fix is confirmed working',
             'risk_level': 'safe', 'risk_reason': 'Post-upgrade verification - read-only checks'},
        ]

        formatted_reply = self._format_followup_reply(
            title=f"FIX CONFIRMED ({fix_method}) — Maintenance Window Planning",
            analysis=f"Great news — the immediate fix is confirmed working via {fix_method}. "
                     f"The datastore now correctly shows as GFS2 Pool.\n\n"
                     f"This is a WORKAROUND. The permanent fix requires upgrading to Morpheus 8.1.2 "
                     f"which contains the MORPH-7774 code fix. Until then, keep the sync disabled.\n\n"
                     f"Here's the maintenance window plan (Parts A through D):",
            action_plan=action_plan,
            next_steps=[
                f"Immediate: Confirm with customer that display is now correct",
                "Short-term: Keep inventory sync disabled (workaround in place)",
                "Medium-term: Schedule Morpheus 8.1.2 upgrade maintenance window",
                "Post-upgrade: Re-enable sync and verify fix holds permanently",
                "If VM migration is needed, test migration BEFORE re-enabling sync",
            ]
        )

        return {
            'response_type': 'verification',
            'root_cause': f'Fix confirmed via {fix_method}. Datastore type displaying correctly as GFS2 Pool. '
                          f'Permanent fix requires Morpheus 8.1.2 upgrade (MORPH-7774).',
            'action_plan': action_plan,
            'safety_notes': [
                'Current fix is stable but temporary - sync must remain disabled',
                'Do NOT re-enable inventory sync until Morpheus 8.1.2 is installed',
                'Running VMs and storage operations are unaffected by the workaround',
                'Backup Morpheus before upgrade (morpheus-ctl backup)',
            ],
            'next_steps': [
                'Notify customer: display fix confirmed, permanent fix planned',
                'Schedule Morpheus 8.1.2 upgrade window',
                'Keep inventory sync disabled until upgrade',
                'Test VM migration if needed before re-enabling sync',
            ],
            'formatted_reply': formatted_reply,
            'categories': context.get('original_categories', []),
            'matched_issues': [],
            '_context_detected': detected,
        }

    def _respond_migration_confirmed(self, message: str, context: Dict, detected: str) -> Dict:
        """Migration confirmed working - close out with upgrade recommendation."""
        action_plan = [
            {'step': 'Confirm all VMs migrated successfully',
             'command': 'virsh list --all\n# Verify all expected VMs are running on target host',
             'note': 'All VMs should be in running state on the destination host',
             'risk_level': 'safe', 'risk_reason': 'Read-only status check'},
            {'step': 'Verify storage access post-migration',
             'command': 'mount | grep gfs2\ndf -h /mnt/',
             'note': 'All GFS2 mounts should be rw and accessible',
             'risk_level': 'safe', 'risk_reason': 'Read-only filesystem check'},
            {'step': 'Document resolution for ticket closure',
             'command': '',
             'note': 'Update Jira with: root cause (MORPH-7774), workaround applied, upgrade planned',
             'risk_level': 'safe', 'risk_reason': 'Documentation only'},
        ]

        formatted_reply = self._format_followup_reply(
            title="MIGRATION CONFIRMED — Resolution Summary & Ticket Closure",
            analysis="VM migration is confirmed working. All components are functioning correctly:\n"
                     "- Datastore type: GFS2 Pool (correct)\n"
                     "- VM migration: successful\n"
                     "- Storage access: confirmed\n\n"
                     "This ticket can be moved to 'Pending Upgrade' or closed with the following resolution.",
            action_plan=action_plan,
            next_steps=[
                "Close ticket with resolution: Workaround applied (MORPH-7774), upgrade to 8.1.2 planned",
                "Schedule Morpheus 8.1.2 upgrade for permanent fix",
                "No further action needed until upgrade window",
            ]
        )

        return {
            'response_type': 'verification',
            'root_cause': 'Issue fully resolved via workaround. Migration confirmed working. '
                          'Root cause: MORPH-7774 (cloud sync reclassification bug). '
                          'Permanent fix: Morpheus 8.1.2 upgrade.',
            'action_plan': action_plan,
            'safety_notes': [
                'System is stable - no further changes needed',
                'Keep inventory sync disabled until 8.1.2 upgrade',
            ],
            'next_steps': [
                'Close ticket or move to Pending Upgrade status',
                'Schedule Morpheus 8.1.2 upgrade',
                'Re-enable sync only after upgrade',
            ],
            'formatted_reply': formatted_reply,
            'categories': context.get('original_categories', []),
            'matched_issues': [],
            '_context_detected': detected,
        }

    def _respond_new_error(self, message: str, context: Dict, detected: str) -> Dict:
        """New error reported - analyze and provide action plan."""
        msg_lower = message.lower()
        original_categories = context.get('original_categories', [])

        # Try to identify the specific error
        error_type = 'unknown'
        if 'timeout' in msg_lower:
            error_type = 'timeout'
        elif 'denied' in msg_lower or 'permission' in msg_lower:
            error_type = 'permission'
        elif 'withdrawal' in msg_lower or 'withdraw' in msg_lower:
            error_type = 'gfs2_withdrawal'
        elif 'cannot' in msg_lower and 'connect' in msg_lower:
            error_type = 'connection'
        elif 'failed' in msg_lower and 'start' in msg_lower:
            error_type = 'service_failure'

        # Build error-specific response
        if error_type == 'gfs2_withdrawal':
            action_plan = [
                {'step': 'Check GFS2 withdrawal status across all nodes',
                 'command': "dmesg | grep -i 'withdraw\\|gfs2'\njournalctl -k | grep -i gfs2 | tail -20",
                 'note': 'Look for withdrawal messages and the triggering error',
                 'risk_level': 'safe', 'risk_reason': 'Read-only log inspection'},
                {'step': 'Check DLM lockspace health',
                 'command': 'dlm_tool ls\ndlm_tool status',
                 'note': 'All lockspaces must show expected node count before recovery',
                 'risk_level': 'safe', 'risk_reason': 'Read-only status check'},
                {'step': 'Verify cluster communication',
                 'command': 'pcs status\ncorosync-cfgtool -s',
                 'note': 'All nodes must be online before attempting GFS2 recovery',
                 'risk_level': 'safe', 'risk_reason': 'Read-only cluster status'},
                {'step': 'Recover GFS2 filesystem (after confirming DLM healthy)',
                 'command': 'umount /mnt/<affected_mount>\nmount /dev/mapper/<device> /mnt/<affected_mount>',
                 'note': 'ONLY proceed if DLM shows all nodes healthy. Do NOT force-mount.',
                 'risk_level': 'high', 'risk_reason': 'Unmounting active filesystem can disrupt services'},
            ]
            analysis = ("New GFS2 withdrawal detected. This is a critical event — the filesystem has gone "
                        "read-only to protect data integrity. Must verify DLM and cluster health before recovery.")
        elif error_type == 'timeout':
            action_plan = [
                {'step': 'Identify what is timing out',
                 'command': "journalctl --since '30 min ago' | grep -i 'timeout\\|timed out'",
                 'note': 'Determine if it is storage, network, or service timeout',
                 'risk_level': 'safe', 'risk_reason': 'Read-only log inspection'},
                {'step': 'Check system load and I/O wait',
                 'command': 'uptime\niostat -x 1 5\nvmstat 1 5',
                 'note': 'High iowait or load average indicates storage bottleneck',
                 'risk_level': 'safe', 'risk_reason': 'Read-only performance check'},
                {'step': 'Check storage path health',
                 'command': 'multipath -ll | head -50\ndmesg | grep -i "scsi\\|error" | tail -20',
                 'note': 'Look for failed paths or SCSI errors',
                 'risk_level': 'safe', 'risk_reason': 'Read-only status check'},
            ]
            analysis = "Timeout error reported. Need to identify the source — storage I/O, network, or service-level."
        elif error_type == 'permission':
            action_plan = [
                {'step': 'Check what permission is denied',
                 'command': "journalctl --since '30 min ago' | grep -i 'denied\\|permission'\naudit2why < /var/log/audit/audit.log | tail -20",
                 'note': 'Identify if this is SELinux, filesystem permissions, or auth issue',
                 'risk_level': 'safe', 'risk_reason': 'Read-only log inspection'},
                {'step': 'Check filesystem permissions on affected path',
                 'command': 'ls -la /path/to/affected/resource\ngetfacl /path/to/affected/resource',
                 'note': 'Compare with expected ownership and permissions',
                 'risk_level': 'safe', 'risk_reason': 'Read-only file check'},
            ]
            analysis = "Permission denied error. Need to identify if it's SELinux, file permissions, or authentication."
        else:
            action_plan = [
                {'step': 'Collect error details',
                 'command': "journalctl --since '1 hour ago' --priority=err | tail -50\ndmesg | tail -30",
                 'note': 'Capture the full error context',
                 'risk_level': 'safe', 'risk_reason': 'Read-only log inspection'},
                {'step': 'Check affected service status',
                 'command': 'systemctl status <service-name>\npcs status',
                 'note': 'Identify which component is reporting the error',
                 'risk_level': 'safe', 'risk_reason': 'Read-only status check'},
                {'step': 'Correlate with recent changes',
                 'command': 'last reboot\nrpm -qa --last | head -20',
                 'note': 'Check if any recent updates or reboots correlate with the error',
                 'risk_level': 'safe', 'risk_reason': 'Read-only system info'},
            ]
            analysis = (f"New error reported (type: {error_type}). Collecting diagnostic information "
                        f"to determine impact and remediation.")

        formatted_reply = self._format_followup_reply(
            title=f"NEW ERROR REPORTED — {error_type.upper().replace('_', ' ')} Analysis",
            analysis=analysis,
            action_plan=action_plan,
            next_steps=[
                "Run the diagnostic commands above and share output",
                "Note the exact timestamp when the error occurred",
                "Check if this correlates with any scheduled operations",
                "If critical (GFS2 withdrawal, cluster split), escalate immediately",
            ]
        )

        return {
            'response_type': 'escalation',
            'root_cause': analysis,
            'action_plan': action_plan,
            'safety_notes': [
                'All initial diagnostic commands are read-only and safe',
                'Do NOT attempt recovery steps until diagnostics are complete',
                'If GFS2 withdrawal: verify DLM health before any remount attempt',
            ],
            'next_steps': [
                'Run diagnostics and share full output',
                'Assess severity and customer impact',
                'Determine if this is related to the original issue or new',
            ],
            'formatted_reply': formatted_reply,
            'categories': original_categories,
            'matched_issues': [],
            '_context_detected': detected,
        }

    def _respond_interpret_command(self, message: str, context: Dict, detected: str) -> Dict:
        """User pasted command output - interpret results."""
        msg_lower = message.lower()
        original_categories = context.get('original_categories', [])

        # Try to detect what type of command output this is
        if 'gfs2' in msg_lower and ('rw' in msg_lower or 'ro' in msg_lower):
            interpretation = "GFS2 mount status output detected."
            if ' ro' in msg_lower or ',ro,' in msg_lower or 'ro,' in msg_lower:
                interpretation += (" WARNING: One or more GFS2 filesystems are mounted read-only. "
                                   "This indicates a withdrawn filesystem that needs recovery.")
                severity = 'critical'
            else:
                interpretation += " All GFS2 mounts appear to be read-write (healthy)."
                severity = 'normal'
        elif 'multipath' in msg_lower or 'mpath' in msg_lower:
            interpretation = "Multipath status output detected."
            if 'failed' in msg_lower or 'faulty' in msg_lower:
                interpretation += " WARNING: Failed paths detected. Check storage array connectivity."
                severity = 'warning'
            else:
                interpretation += " Paths appear healthy."
                severity = 'normal'
        elif 'pcs' in msg_lower or 'cluster' in msg_lower:
            interpretation = "Cluster status output detected."
            if 'offline' in msg_lower or 'failed' in msg_lower or 'stopped' in msg_lower:
                interpretation += " WARNING: Cluster issues detected - offline nodes or failed resources."
                severity = 'warning'
            else:
                interpretation += " Cluster appears healthy."
                severity = 'normal'
        else:
            interpretation = ("Command output received. Analyzing in context of the ongoing ticket. "
                              "Please confirm which command this output is from for precise interpretation.")
            severity = 'info'

        action_plan = [
            {'step': 'Review the command output interpretation above',
             'command': '',
             'note': interpretation,
             'risk_level': 'safe', 'risk_reason': 'Analysis only - no system changes'},
        ]

        if severity == 'critical':
            action_plan.append(
                {'step': 'Immediate action: Check DLM and recover GFS2',
                 'command': 'dlm_tool ls\npcs status\n# If DLM healthy: umount + remount the affected filesystem',
                 'note': 'GFS2 read-only mount requires recovery. Verify DLM first.',
                 'risk_level': 'high', 'risk_reason': 'Filesystem recovery operation'}
            )
        elif severity == 'warning':
            action_plan.append(
                {'step': 'Investigate the warning condition',
                 'command': 'dmesg | tail -50\njournalctl --since "1 hour ago" --priority=warning',
                 'note': 'Gather more context about the warning condition',
                 'risk_level': 'safe', 'risk_reason': 'Read-only log inspection'}
            )

        formatted_reply = self._format_followup_reply(
            title=f"COMMAND OUTPUT INTERPRETATION — Severity: {severity.upper()}",
            analysis=interpretation,
            action_plan=action_plan,
            next_steps=[
                "Confirm interpretation is correct",
                "Run follow-up commands if severity is warning/critical",
                "Provide additional command outputs if needed for full picture",
            ]
        )

        return {
            'response_type': 'followup_guidance' if severity != 'critical' else 'escalation',
            'root_cause': interpretation,
            'action_plan': action_plan,
            'safety_notes': ['Interpretation based on pattern matching against the output content'],
            'next_steps': [
                'Confirm interpretation accuracy',
                'Run suggested follow-up commands',
                'Update ticket with findings',
            ],
            'formatted_reply': formatted_reply,
            'categories': original_categories,
            'matched_issues': [],
            '_context_detected': detected,
        }

    def _respond_generic_followup(self, message: str, context: Dict, detected: str) -> Dict:
        """Generic follow-up when no specific pattern matches."""
        original_ticket = context.get('original_ticket', '')
        original_categories = context.get('original_categories', [])
        turn_number = context.get('turn_number', 1)

        # Re-analyze with combined context
        combined_text = f"{original_ticket}\n\nUpdate: {message}"
        categories = self._detect_categories(combined_text.lower())
        matched_issues = self._find_known_issues(combined_text.lower(), categories)

        action_plan = [
            {'step': 'Clarify the current status',
             'command': '',
             'note': 'Please provide: 1) What was attempted, 2) What happened, 3) Current state',
             'risk_level': 'safe', 'risk_reason': 'Information gathering only'},
            {'step': 'Collect current system state',
             'command': 'pcs status 2>/dev/null || echo "not clustered"\nmount | grep -E "gfs2|nfs|cifs"\nsystemctl list-units --failed',
             'note': 'Basic health check to understand current system state',
             'risk_level': 'safe', 'risk_reason': 'Read-only status commands'},
        ]

        formatted_reply = self._format_followup_reply(
            title=f"FOLLOW-UP (Turn {turn_number}) — Additional Context Needed",
            analysis=f"Received your update. To provide the most accurate next steps, "
                     f"please clarify:\n\n"
                     f"1. What specific action was taken?\n"
                     f"2. What was the result (include any error messages or command output)?\n"
                     f"3. What is the current state of the system?\n\n"
                     f"Based on the original ticket categories ({', '.join(categories)}), "
                     f"here are general diagnostic steps:",
            action_plan=action_plan,
            next_steps=[
                "Share specific command output or error messages",
                "Confirm which steps from the action plan have been completed",
                "Report any new symptoms observed",
            ]
        )

        return {
            'response_type': 'followup_guidance',
            'root_cause': 'Follow-up received. Additional context needed for specific guidance.',
            'action_plan': action_plan,
            'safety_notes': ['All suggested commands are read-only diagnostics'],
            'next_steps': [
                'Provide specific details about what was attempted and the result',
                'Share any command output or error messages',
                'Clarify current system state',
            ],
            'formatted_reply': formatted_reply,
            'categories': categories,
            'matched_issues': [{
                'title': i.get('title', ''),
                'bug_id': i.get('bug_id', ''),
                'solution': i.get('solution', ''),
                'products': i.get('products', []),
            } for i in matched_issues],
            '_context_detected': detected,
        }



    # ─────────────────────────────────────────────────────────────────────────
    # FORMATTING HELPERS
    # ─────────────────────────────────────────────────────────────────────────

    def _format_followup_reply(self, title: str, analysis: str, action_plan: List[Dict],
                                next_steps: List[str]) -> str:
        """Format a follow-up response as ready-to-paste text."""
        lines = []
        lines.append(f"Hi,\n")
        lines.append(f"Follow-up analysis based on the latest update.\n")
        lines.append("─" * 60)
        lines.append(f"\n📋 {title}\n")
        lines.append(analysis)
        lines.append("")

        if action_plan:
            lines.append("─" * 60)
            lines.append("\n🔧 RECOMMENDED ACTIONS\n")
            for i, step in enumerate(action_plan, 1):
                risk_indicator = ''
                rl = step.get('risk_level', 'safe')
                if rl == 'high':
                    risk_indicator = ' 🔴 HIGH RISK'
                elif rl == 'medium':
                    risk_indicator = ' 🟡 MEDIUM'
                else:
                    risk_indicator = ' 🟢 SAFE'

                lines.append(f"Step {i}: {step['step']}{risk_indicator}")
                if step.get('command'):
                    for cmd in step['command'].split('\n'):
                        lines.append(f"    $ {cmd}")
                if step.get('note'):
                    lines.append(f"    ⚠️  {step['note']}")
                if step.get('risk_reason'):
                    lines.append(f"    Risk: {step['risk_reason']}")
                lines.append("")

        if next_steps:
            lines.append("─" * 60)
            lines.append("\n📌 NEXT STEPS\n")
            for i, step in enumerate(next_steps, 1):
                lines.append(f"{i}. {step}")
            lines.append("")

        lines.append("─" * 60)
        lines.append("\nLet me know the results and I'll provide the next guidance.")
        lines.append("\nThanks,")
        lines.append("L4 Support Engineering")

        return '\n'.join(lines)

    # ─────────────────────────────────────────────────────────────────────────
    # ORIGINAL ANALYSIS METHODS (backward compatible)
    # ─────────────────────────────────────────────────────────────────────────

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
            # Add risk indicator if available
            risk_level = step.get('risk_level', '')
            risk_indicator = ''
            if risk_level == 'high':
                risk_indicator = ' 🔴 HIGH RISK'
            elif risk_level == 'medium':
                risk_indicator = ' 🟡 MEDIUM'
            elif risk_level == 'safe':
                risk_indicator = ' 🟢 SAFE'

            lines.append(f"Step {i}: {step['step']}{risk_indicator}")
            if step.get('command'):
                for cmd in step['command'].split('\n'):
                    lines.append(f"    $ {cmd}")
            if step.get('note'):
                lines.append(f"    ⚠️  {step['note']}")
            if step.get('risk_reason'):
                lines.append(f"    Risk: {step['risk_reason']}")
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


# ─────────────────────────────────────────────────────────────────────────────
# SINGLETON INSTANCE
# ─────────────────────────────────────────────────────────────────────────────

# Singleton instance for reuse
_advisor_instance = None


def get_advisor() -> TicketAdvisor:
    """Get or create the singleton TicketAdvisor instance."""
    global _advisor_instance
    if _advisor_instance is None:
        _advisor_instance = TicketAdvisor()
    return _advisor_instance
