"""Intelligence Layer for LogSherlock Pro Ticket Advisor.

Adds Jira Rovo-style intelligence ON TOP of existing ticket_advisor.py results:
- Confidence scoring (0-100%)
- Severity auto-classification (P1/P2/P3/P4)
- Symptom correlation (multiple symptoms → single root cause)
- Related KB article linking
- Time-to-resolve estimation
- Impact blast radius assessment

This does NOT replace the existing engine — it ENHANCES its output.
Called after ticket_advisor.analyze() or analyze_conversation() returns.
"""

import re
from typing import Dict, List, Tuple


# ─────────────────────────────────────────────────────────────────────────────
# SEVERITY CLASSIFICATION
# ─────────────────────────────────────────────────────────────────────────────

SEVERITY_RULES = [
    # P1 — Production down, multiple systems, data loss risk
    {
        'level': 'P1',
        'label': 'Critical — Production Down',
        'color': '#ff4444',
        'triggers': [
            'production down', 'prod down', 'all vms', 'complete outage',
            'data loss', 'cluster down', 'quorum lost', 'split brain',
            'all nodes', 'site down', 'filesystem withdraw', 'gfs2 withdraw',
            'kernel panic', 'multiple hosts', 'every vm', 'storage offline',
            'san disconnected', 'total failure', 'cannot access any',
        ],
        'category_boost': ['kernel', 'fencing', 'gfs2'],
    },
    # P2 — Single system down, service degraded, HA failover
    {
        'level': 'P2',
        'label': 'High — Service Degraded',
        'color': '#ff8800',
        'triggers': [
            'one node', 'single vm', 'failover', 'degraded', 'read-only',
            'fenced', 'node down', 'service down', 'migration failed',
            'vm not starting', 'cannot start', 'hung', 'unresponsive',
            'morpheus down', 'ui not loading', '502', '503', 'offline',
            'one host', 'vm paused', 'disk full', 'high iowait',
        ],
        'category_boost': ['cluster', 'storage', 'kvm'],
    },
    # P3 — Non-critical, workaround available, cosmetic
    {
        'level': 'P3',
        'label': 'Medium — Workaround Available',
        'color': '#ffcc00',
        'triggers': [
            'display issue', 'shows wrong', 'cosmetic', 'reclassification',
            'mismatch', 'incorrect label', 'slow', 'intermittent',
            'warning', 'alert', 'notification', 'minor', 'reporting',
            'dashboard', 'upgrade planned', 'workaround', 'known issue',
            'one vm affected', 'non-critical',
        ],
        'category_boost': ['morpheus', 'datastore', 'performance'],
    },
    # P4 — Info request, how-to, enhancement
    {
        'level': 'P4',
        'label': 'Low — Information Request',
        'color': '#44cc44',
        'triggers': [
            'how to', 'question', 'information', 'planning', 'upgrade plan',
            'best practice', 'recommendation', 'advice', 'documentation',
            'schedule', 'future', 'enhancement', 'feature request',
        ],
        'category_boost': [],
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# SYMPTOM CORRELATION CHAINS
# ─────────────────────────────────────────────────────────────────────────────

CORRELATION_CHAINS = [
    {
        'id': 'storage_cascade',
        'name': 'Storage I/O → GFS2 Withdrawal → VM Paused',
        'symptoms': ['scsi', 'multipath', 'i/o error', 'gfs2', 'withdraw', 'vm paused', 'read-only'],
        'root_cause': 'Storage path failure causing cascading GFS2 withdrawal and VM pause',
        'min_match': 3,
        'resolution_path': 'Fix storage paths → Recover GFS2 → Resume VMs',
    },
    {
        'id': 'network_cluster_split',
        'name': 'Network Loss → Quorum Loss → Fencing → Service Restart',
        'symptoms': ['network', 'timeout', 'corosync', 'quorum', 'fence', 'stonith', 'failover'],
        'root_cause': 'Network partition causing cluster split and automatic fencing',
        'min_match': 3,
        'resolution_path': 'Verify network → Check fence history → Validate quorum → Restart services',
    },
    {
        'id': 'morpheus_sync_loop',
        'name': 'Cloud Sync → DB Overwrite → Display Mismatch → User Confusion',
        'symptoms': ['sync', 'inventory', 'directory pool', 'gfs2 pool', 'reclassif', 'overwrite', 'display'],
        'root_cause': 'Morpheus cloud sync overwriting datastore classification (MORPH-7774)',
        'min_match': 2,
        'resolution_path': 'Stop UI → Fix DB → Disable sync → Verify → Plan upgrade to 8.1.2',
    },
    {
        'id': 'memory_pressure_cascade',
        'name': 'Memory Pressure → OOM Kill → Service Crash → HA Failover',
        'symptoms': ['oom', 'out of memory', 'killed process', 'memory', 'swap', 'service crash', 'failover'],
        'root_cause': 'Memory exhaustion triggering OOM killer, crashing critical service',
        'min_match': 2,
        'resolution_path': 'Identify memory hog → Increase limits → Restart service → Tune hugepages',
    },
    {
        'id': 'scsi_reservation_conflict',
        'name': 'SCSI PR Conflict → Lock Loss → GFS2 Freeze → Node Fence',
        'symptoms': ['reservation', 'conflict', 'pr_', 'scsi', 'gfs2', 'dlm', 'fence', 'withdraw'],
        'root_cause': 'SCSI-3 Persistent Reservation conflict preventing journal access',
        'min_match': 3,
        'resolution_path': 'Check PR keys → Verify registrations → Clear stale → Re-register → Remount',
    },
    {
        'id': 'disk_full_cascade',
        'name': 'Disk Full → Log Rotation Fail → Service Crash → VM Impact',
        'symptoms': ['disk full', 'no space', 'cannot write', 'log', 'rotate', 'service', 'failed'],
        'root_cause': 'Disk space exhaustion preventing log writes and service operation',
        'min_match': 2,
        'resolution_path': 'Free space → Clear old logs → Fix rotation → Restart services',
    },
    {
        'id': 'certificate_expiry',
        'name': 'Cert Expired → TLS Failure → Service Connection Refused',
        'symptoms': ['certificate', 'expired', 'tls', 'ssl', 'connection refused', 'handshake'],
        'root_cause': 'TLS certificate expiration breaking inter-service communication',
        'min_match': 2,
        'resolution_path': 'Identify expired cert → Renew → Restart affected services → Verify',
    },
    {
        'id': 'migration_failure',
        'name': 'Migration Blocked → Storage Mismatch → VM Stuck → HA Risk',
        'symptoms': ['migration', 'failed', 'cannot migrate', 'storage', 'shared', 'pool', 'stuck'],
        'root_cause': 'VM live migration blocked by storage accessibility mismatch between hosts',
        'min_match': 2,
        'resolution_path': 'Verify shared storage on target → Check pool config → Fix paths → Retry',
    },
    {
        'id': 'ntp_drift_cluster',
        'name': 'NTP Drift → Token Expiry → Auth Failure → Service Disconnect',
        'symptoms': ['ntp', 'clock', 'drift', 'time', 'expired', 'token', 'auth', 'kerberos'],
        'root_cause': 'Clock drift causing authentication token validation failures',
        'min_match': 2,
        'resolution_path': 'Sync NTP → Restart auth services → Regenerate tokens → Verify cluster',
    },
    {
        'id': 'upgrade_rollback',
        'name': 'Upgrade Failed → Service Won\'t Start → Dependency Mismatch',
        'symptoms': ['upgrade', 'failed', 'start', 'dependency', 'version', 'rollback', 'incompatible'],
        'root_cause': 'Software upgrade failure leaving services in inconsistent state',
        'min_match': 2,
        'resolution_path': 'Check upgrade logs → Identify failed step → Rollback or fix deps → Retry',
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# TIME-TO-RESOLVE ESTIMATES
# ─────────────────────────────────────────────────────────────────────────────

TTR_ESTIMATES = {
    'P1': {
        'storage_cascade': ('1-2 hours', 'Storage path recovery + GFS2 remount + VM resume'),
        'network_cluster_split': ('30-60 min', 'Network fix + cluster rejoin + service validation'),
        'scsi_reservation_conflict': ('1-3 hours', 'PR key cleanup + GFS2 recovery across nodes'),
        'default': ('1-4 hours', 'Critical issue requiring immediate hands-on intervention'),
    },
    'P2': {
        'morpheus_sync_loop': ('30-45 min', 'Stop UI + DB fix + disable sync + verify'),
        'memory_pressure_cascade': ('15-30 min', 'Identify process + restart + tune limits'),
        'migration_failure': ('30-60 min', 'Storage verification + path fix + retry migration'),
        'disk_full_cascade': ('15-30 min', 'Free space + restart affected services'),
        'default': ('30 min - 2 hours', 'Service-level issue requiring L4 intervention'),
    },
    'P3': {
        'morpheus_sync_loop': ('15-30 min', 'DB fix + sync disable — cosmetic only'),
        'certificate_expiry': ('15-30 min', 'Cert renewal + service restart'),
        'default': ('1-4 hours', 'Non-urgent, workaround available, fix during business hours'),
    },
    'P4': {
        'default': ('Next business day', 'Information request or planned activity'),
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# KB ARTICLE MAPPING
# ─────────────────────────────────────────────────────────────────────────────

KB_ARTICLES = [
    {'id': 'KB-001', 'title': 'GFS2 Withdrawal Recovery Procedure',
     'keywords': ['gfs2', 'withdraw', 'read-only', 'remount', 'dlm'],
     'category': 'storage', 'url': '#kb-gfs2-withdrawal'},
    {'id': 'KB-002', 'title': 'SCSI-3 Persistent Reservation Troubleshooting',
     'keywords': ['scsi', 'reservation', 'conflict', 'sg_persist', 'pr_key'],
     'category': 'storage', 'url': '#kb-scsi-pr'},
    {'id': 'KB-003', 'title': 'Morpheus Cloud Sync Reclassification (MORPH-7774)',
     'keywords': ['morpheus', 'sync', 'directory pool', 'gfs2 pool', 'datastore_type'],
     'category': 'morpheus', 'url': '#kb-morph-7774'},
    {'id': 'KB-004', 'title': 'Cluster Fencing and STONITH Configuration',
     'keywords': ['fence', 'stonith', 'ipmi', 'ilo', 'fencing', 'power off'],
     'category': 'cluster', 'url': '#kb-fencing'},
    {'id': 'KB-005', 'title': 'KVM Live Migration Prerequisites',
     'keywords': ['migration', 'virsh migrate', 'shared storage', 'live migration'],
     'category': 'kvm', 'url': '#kb-live-migration'},
    {'id': 'KB-006', 'title': 'Multipath Configuration and Failover',
     'keywords': ['multipath', 'mpath', 'dm-multipath', 'path failure', 'failover'],
     'category': 'storage', 'url': '#kb-multipath'},
    {'id': 'KB-007', 'title': 'Corosync Ring and Quorum Recovery',
     'keywords': ['corosync', 'quorum', 'ring', 'totem', 'cluster communication'],
     'category': 'cluster', 'url': '#kb-corosync'},
    {'id': 'KB-008', 'title': 'OOM Killer and Memory Tuning for VMs',
     'keywords': ['oom', 'memory', 'kill', 'hugepages', 'overcommit', 'swap'],
     'category': 'memory', 'url': '#kb-oom'},
    {'id': 'KB-009', 'title': 'Morpheus Appliance Upgrade Procedure',
     'keywords': ['morpheus', 'upgrade', 'morpheus-ctl', 'backup', '8.1'],
     'category': 'morpheus', 'url': '#kb-morpheus-upgrade'},
    {'id': 'KB-010', 'title': 'VME Network Bonding and Bridge Setup',
     'keywords': ['bond', 'bridge', 'nic', 'interface', 'vlan', 'network'],
     'category': 'network', 'url': '#kb-bonding'},
    {'id': 'KB-011', 'title': 'DLM Lockspace Recovery',
     'keywords': ['dlm', 'lockspace', 'lock', 'dlm_tool', 'distributed lock'],
     'category': 'cluster', 'url': '#kb-dlm'},
    {'id': 'KB-012', 'title': 'SELinux Denials for KVM/Libvirt',
     'keywords': ['selinux', 'avc', 'denial', 'libvirt', 'permission', 'setsebool'],
     'category': 'security', 'url': '#kb-selinux'},
    {'id': 'KB-013', 'title': 'VM Snapshot and Backup Best Practices',
     'keywords': ['snapshot', 'backup', 'restore', 'virsh snapshot', 'qcow2'],
     'category': 'backup', 'url': '#kb-snapshots'},
    {'id': 'KB-014', 'title': 'NTP/Chrony Time Sync for Clusters',
     'keywords': ['ntp', 'chrony', 'clock', 'drift', 'time sync', 'stratum'],
     'category': 'network', 'url': '#kb-ntp'},
    {'id': 'KB-015', 'title': 'Pacemaker Resource Constraints and Failover',
     'keywords': ['pacemaker', 'constraint', 'colocation', 'order', 'resource', 'failover'],
     'category': 'cluster', 'url': '#kb-pacemaker'},
    {'id': 'KB-016', 'title': 'iSCSI Target Discovery and Session Recovery',
     'keywords': ['iscsi', 'target', 'session', 'login', 'discovery', 'iscsiadm'],
     'category': 'storage', 'url': '#kb-iscsi'},
    {'id': 'KB-017', 'title': 'Morpheus MySQL/MariaDB Troubleshooting',
     'keywords': ['mysql', 'mariadb', 'morpheus', 'database', 'connection refused'],
     'category': 'morpheus', 'url': '#kb-morpheus-db'},
    {'id': 'KB-018', 'title': 'RabbitMQ Queue Health and Recovery',
     'keywords': ['rabbitmq', 'queue', 'stuck', 'message', 'amqp'],
     'category': 'morpheus', 'url': '#kb-rabbitmq'},
    {'id': 'KB-019', 'title': 'Elasticsearch Cluster Red State Recovery',
     'keywords': ['elasticsearch', 'red', 'shard', 'unassigned', 'cluster health'],
     'category': 'morpheus', 'url': '#kb-elasticsearch'},
    {'id': 'KB-020', 'title': 'HPE Alletra/Nimble Storage Path Recovery',
     'keywords': ['alletra', 'nimble', 'iscsi', 'multipath', 'hpe storage'],
     'category': 'storage', 'url': '#kb-alletra'},
]


# ─────────────────────────────────────────────────────────────────────────────
# MAIN INTELLIGENCE FUNCTION
# ─────────────────────────────────────────────────────────────────────────────

def enhance_results(advisor_result: Dict, original_text: str) -> Dict:
    """Add intelligence layer on top of existing Ticket Advisor results.

    Takes the output from ticket_advisor.analyze() or analyze_conversation()
    and enriches it with confidence, severity, correlation, KB links, and TTR.

    Args:
        advisor_result: The raw result from TicketAdvisor
        original_text: The original ticket description text

    Returns:
        Same dict with added 'intelligence' key containing all enhancements
    """
    text_lower = original_text.lower()
    categories = advisor_result.get('categories', [])

    # 1. Severity Classification
    severity = _classify_severity(text_lower, categories)

    # 2. Symptom Correlation
    correlations = _find_correlations(text_lower)

    # 3. Confidence Scoring
    confidence = _calculate_confidence(advisor_result, correlations, text_lower)

    # 4. Related KB Articles
    kb_articles = _find_kb_articles(text_lower, categories)

    # 5. Time-to-Resolve Estimate
    ttr = _estimate_ttr(severity['level'], correlations)

    # 6. Impact Assessment
    impact = _assess_impact(text_lower, severity['level'])

    # Add intelligence layer to result
    advisor_result['intelligence'] = {
        'severity': severity,
        'confidence': confidence,
        'correlations': correlations,
        'kb_articles': kb_articles,
        'time_to_resolve': ttr,
        'impact': impact,
    }

    return advisor_result


def _classify_severity(text: str, categories: List[str]) -> Dict:
    """Classify ticket severity based on keywords and categories."""
    best_match = None
    best_score = 0

    for rule in SEVERITY_RULES:
        score = 0
        matched_triggers = []

        # Score by trigger keyword matches
        for trigger in rule['triggers']:
            if trigger in text:
                score += 2
                matched_triggers.append(trigger)

        # Boost by category overlap
        for cat in categories:
            if cat in rule.get('category_boost', []):
                score += 3

        # P1 gets extra weight — production-down signals are strong
        if rule['level'] == 'P1' and score > 0:
            score = int(score * 1.5)

        if score > best_score:
            best_score = score
            best_match = {
                'level': rule['level'],
                'label': rule['label'],
                'color': rule['color'],
                'score': score,
                'matched_triggers': matched_triggers[:5],
                'reason': f"Matched {len(matched_triggers)} severity indicators",
            }

    # Default to P3 if nothing matched strongly
    if not best_match or best_score < 2:
        best_match = {
            'level': 'P3',
            'label': 'Medium — Requires Investigation',
            'color': '#ffcc00',
            'score': 1,
            'matched_triggers': [],
            'reason': 'Default severity — insufficient signals for precise classification',
        }

    return best_match


def _find_correlations(text: str) -> List[Dict]:
    """Find symptom correlation chains in the text."""
    matched_chains = []

    for chain in CORRELATION_CHAINS:
        matched_symptoms = []
        for symptom in chain['symptoms']:
            if symptom in text:
                matched_symptoms.append(symptom)

        if len(matched_symptoms) >= chain['min_match']:
            matched_chains.append({
                'chain_id': chain['id'],
                'name': chain['name'],
                'root_cause': chain['root_cause'],
                'resolution_path': chain['resolution_path'],
                'matched_symptoms': matched_symptoms,
                'match_strength': len(matched_symptoms) / len(chain['symptoms']),
                'total_symptoms': len(chain['symptoms']),
            })

    # Sort by match strength
    matched_chains.sort(key=lambda x: x['match_strength'], reverse=True)
    return matched_chains[:3]


def _calculate_confidence(result: Dict, correlations: List[Dict],
                          text: str) -> Dict:
    """Calculate confidence score for the analysis."""
    score = 0
    factors = []

    # Factor 1: Categories detected (more = better context)
    categories = result.get('categories', [])
    cat_count = len(categories)
    if cat_count >= 3:
        score += 25
        factors.append(f'{cat_count} issue categories identified')
    elif cat_count >= 2:
        score += 20
        factors.append(f'{cat_count} issue categories identified')
    elif cat_count >= 1:
        score += 10
        factors.append(f'{cat_count} issue category identified')

    # Factor 2: Known issues matched
    matched_count = len(result.get('matched_issues', []))
    if matched_count >= 2:
        score += 30
        factors.append(f'{matched_count} known issues matched from KB')
    elif matched_count >= 1:
        score += 20
        factors.append(f'{matched_count} known issue matched from KB')

    # Factor 3: Correlation chains found
    if correlations:
        top_strength = correlations[0]['match_strength']
        if top_strength >= 0.7:
            score += 25
            factors.append(f"Strong symptom correlation: {correlations[0]['name']}")
        elif top_strength >= 0.4:
            score += 15
            factors.append(f"Partial symptom correlation: {correlations[0]['name']}")
        else:
            score += 8
            factors.append(f"Weak correlation detected")

    # Factor 4: Specific error messages/logs in ticket
    error_indicators = ['error', 'failed', 'denied', 'timeout', 'panic',
                        'withdraw', 'conflict', 'offline', 'down']
    error_count = sum(1 for e in error_indicators if e in text)
    if error_count >= 4:
        score += 15
        factors.append(f'{error_count} error indicators found — clear failure signals')
    elif error_count >= 2:
        score += 10
        factors.append(f'{error_count} error indicators found')

    # Factor 5: Has actionable details (hostnames, timestamps, commands)
    details_score = 0
    if re.search(r'\b\d{4}-\d{2}-\d{2}', text):
        details_score += 3
    if re.search(r'\b[a-z][a-z0-9\-]+(sv|node|host)\d+\b', text):
        details_score += 3
    if re.search(r'(journalctl|dmesg|pcs|virsh|mount|grep)', text):
        details_score += 4
    if details_score > 0:
        score += min(details_score, 10)
        factors.append('Ticket contains actionable details (timestamps/hosts/commands)')

    # Cap at 100
    score = min(score, 100)

    # Determine confidence level label
    if score >= 85:
        level = 'Very High'
        emoji = '🟢'
    elif score >= 65:
        level = 'High'
        emoji = '🟢'
    elif score >= 45:
        level = 'Medium'
        emoji = '🟡'
    elif score >= 25:
        level = 'Low'
        emoji = '🟠'
    else:
        level = 'Very Low'
        emoji = '🔴'

    return {
        'score': score,
        'level': level,
        'emoji': emoji,
        'factors': factors,
        'recommendation': _confidence_recommendation(score),
    }


def _confidence_recommendation(score: int) -> str:
    """Recommendation based on confidence score."""
    if score >= 85:
        return "High confidence — proceed with the recommended action plan."
    elif score >= 65:
        return "Good confidence — action plan is likely correct. Verify key assumptions first."
    elif score >= 45:
        return "Moderate confidence — collect more diagnostic data before acting."
    elif score >= 25:
        return "Low confidence — request additional logs/details from the reporter."
    else:
        return "Insufficient data — ask for log bundle upload to LogSherlock for automated scan."


def _find_kb_articles(text: str, categories: List[str]) -> List[Dict]:
    """Find relevant KB articles based on text and categories."""
    scored = []

    for article in KB_ARTICLES:
        score = 0
        matched_keywords = []

        for kw in article['keywords']:
            if kw in text:
                score += 2
                matched_keywords.append(kw)

        # Category boost
        if article['category'] in categories:
            score += 3

        if score >= 2:
            scored.append({
                'id': article['id'],
                'title': article['title'],
                'relevance_score': score,
                'matched_keywords': matched_keywords,
                'url': article['url'],
            })

    scored.sort(key=lambda x: x['relevance_score'], reverse=True)
    return scored[:5]


def _estimate_ttr(severity_level: str, correlations: List[Dict]) -> Dict:
    """Estimate time to resolve based on severity and correlation."""
    ttr_map = TTR_ESTIMATES.get(severity_level, TTR_ESTIMATES['P3'])

    # Check if we have a specific estimate for the detected correlation
    if correlations:
        chain_id = correlations[0]['chain_id']
        if chain_id in ttr_map:
            estimate, basis = ttr_map[chain_id]
            return {
                'estimate': estimate,
                'basis': basis,
                'source': f"Based on {correlations[0]['name']} pattern",
            }

    # Default for severity
    estimate, basis = ttr_map['default']
    return {
        'estimate': estimate,
        'basis': basis,
        'source': f"Based on {severity_level} severity average",
    }


def _assess_impact(text: str, severity_level: str) -> Dict:
    """Assess the blast radius / impact of the issue."""
    # Count indicators
    multi_indicators = ['all nodes', 'all vms', 'multiple', 'every', 'cluster-wide',
                        'all hosts', 'all users', 'entire', 'full outage']
    single_indicators = ['one node', 'single', 'one vm', 'specific', 'only one',
                         'this host', 'one user']

    multi_count = sum(1 for i in multi_indicators if i in text)
    single_count = sum(1 for i in single_indicators if i in text)

    if multi_count > single_count:
        scope = 'cluster-wide'
        affected = 'Multiple systems/VMs affected'
        users_impacted = 'All users of the affected service'
    elif single_count > 0:
        scope = 'single-system'
        affected = 'Single node/VM affected'
        users_impacted = 'Limited to specific workload'
    else:
        scope = 'unknown'
        affected = 'Impact scope not determined from ticket'
        users_impacted = 'Requires investigation'

    # Data risk
    data_risk_words = ['data loss', 'corruption', 'withdraw', 'read-only',
                       'delete', 'drop', 'truncate', 'overwrite']
    has_data_risk = any(w in text for w in data_risk_words)

    return {
        'scope': scope,
        'affected_systems': affected,
        'users_impacted': users_impacted,
        'data_at_risk': has_data_risk,
        'requires_immediate_action': severity_level in ('P1', 'P2'),
    }
