"""Main analysis engine for LogSherlock Pro.

Orchestrates log ingestion, pattern matching, finding correlation,
and timeline generation for a ticket.
"""

import os
import re
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

from .ingestion import ingest_ticket_folder, stream_file, parse_timestamp
from .patterns import PatternEngine, BUILT_IN_PATTERNS


# Severity ordering for ranking
SEVERITY_ORDER = {
    'CRITICAL': 5,
    'HIGH': 4,
    'MEDIUM': 3,
    'LOW': 2,
    'INFO': 1,
}

# Keywords that indicate relevance topics
KEYWORD_CATEGORIES = {
    'storage': ['disk', 'lun', 'scsi', 'multipath', 'mpath', 'iscsi', 'fc', 'san',
                'alletra', 'nimble', '3par', 'volume', 'mount', 'filesystem', 'io',
                'write', 'read', 'throughput', 'latency', 'iops'],
    'cluster': ['pacemaker', 'corosync', 'pcs', 'fence', 'stonith', 'quorum',
                'node', 'failover', 'ha', 'cluster', 'dlm', 'gfs2', 'drbd'],
    'network': ['network', 'nic', 'bond', 'vlan', 'ip', 'dns', 'route', 'gateway',
                'firewall', 'iptables', 'tcp', 'connection', 'timeout', 'latency'],
    'virtualization': ['vm', 'kvm', 'qemu', 'libvirt', 'virsh', 'domain', 'guest',
                       'hypervisor', 'migrate', 'morpheus', 'vme'],
    'kernel': ['kernel', 'panic', 'oom', 'crash', 'hang', 'lockup', 'memory',
               'cpu', 'driver', 'module', 'dmesg'],
    'service': ['service', 'systemd', 'failed', 'restart', 'smad', 'daemon',
                'process', 'pid', 'start', 'stop'],
}


def analyze_ticket(ticket_id: int, folder_path: str, description: str = '',
                   db_session=None) -> Dict:
    """Orchestrate full analysis of a ticket's log files.

    Steps:
    1. Ingest and catalog all log files in the folder
    2. Extract keywords from ticket description
    3. Run pattern matching on all files
    4. Rank and correlate findings
    5. Generate timeline

    Returns analysis result dict.
    """
    from models import db, Ticket, LogFile, Finding, Pattern

    result = {
        'ticket_id': ticket_id,
        'files_processed': 0,
        'total_lines': 0,
        'findings': [],
        'timeline': [],
        'correlations': [],
        'summary': {},
    }

    # Step 1: Ingest folder
    try:
        file_infos = ingest_ticket_folder(folder_path, ticket_id)
    except ValueError as e:
        result['error'] = str(e)
        return result

    # Store file info in database
    log_file_records = []
    for fi in file_infos:
        log_file = LogFile(
            ticket_id=ticket_id,
            filename=fi['filename'],
            filepath=fi['filepath'],
            file_type=fi['file_type'],
            file_size=fi['file_size'],
            node_name=fi['node_name'],
            parsed=False,
            line_count=fi['line_count'],
        )
        db.session.add(log_file)
        log_file_records.append((log_file, fi))

    db.session.flush()  # Get IDs assigned

    # Step 2: Extract keywords for relevance boosting
    keywords = extract_keywords(description)

    # Step 3: Pattern matching
    engine = PatternEngine(BUILT_IN_PATTERNS)
    all_findings = []

    for log_file, fi in log_file_records:
        filepath = fi['filepath']
        if not os.path.isfile(filepath):
            continue

        # Scan file
        findings = engine.scan_file_streaming(filepath, context_lines=3, max_findings=500)

        for finding_data in findings:
            # Boost confidence based on keyword relevance
            confidence = _calculate_confidence(finding_data, keywords)
            finding_data['confidence'] = confidence
            finding_data['logfile_id'] = log_file.id
            finding_data['node_name'] = fi.get('node_name')
            finding_data['file_type'] = fi.get('file_type')
            finding_data['filename'] = fi.get('filename')

            # Store in database
            finding = Finding(
                ticket_id=ticket_id,
                logfile_id=log_file.id,
                pattern_name=finding_data['pattern_name'],
                severity=finding_data['severity'],
                line_number=finding_data['line_number'],
                line_content=finding_data['line_content'],
                context_before=finding_data['context_before'],
                context_after=finding_data['context_after'],
                description=finding_data['description'],
                solution_hint=finding_data['solution_hint'],
                category=finding_data['category'],
                confidence=confidence,
            )
            db.session.add(finding)
            all_findings.append(finding_data)

        # Mark file as parsed
        log_file.parsed = True
        result['files_processed'] += 1
        result['total_lines'] += fi['line_count']

    # Update pattern match counts
    pattern_counts = defaultdict(int)
    for f in all_findings:
        pattern_counts[f['pattern_name']] += 1

    for pattern_name, count in pattern_counts.items():
        db_pattern = Pattern.query.filter_by(name=pattern_name).first()
        if db_pattern:
            db_pattern.times_matched = (db_pattern.times_matched or 0) + count

    # Step 4: Rank findings
    ranked = rank_findings(all_findings)
    result['findings'] = ranked

    # Step 5: Correlate across nodes
    correlations = correlate_nodes(all_findings)
    result['correlations'] = correlations

    # Step 6: Generate timeline
    timeline = generate_timeline(all_findings)
    result['timeline'] = timeline

    # Update ticket
    ticket = Ticket.query.get(ticket_id)
    if ticket:
        ticket.findings_count = len(all_findings)
        ticket.status = 'analyzed'

    # Generate summary
    result['summary'] = _generate_summary(all_findings, file_infos)

    db.session.commit()
    return result


def extract_keywords(description: str) -> Dict[str, List[str]]:
    """Extract relevant keywords from ticket description.

    Returns dict with:
    - 'categories': list of relevant categories
    - 'terms': list of specific search terms
    - 'products': list of product names found
    """
    if not description:
        return {'categories': [], 'terms': [], 'products': []}

    description_lower = description.lower()
    words = re.findall(r'\b\w+\b', description_lower)

    # Find matching categories
    matching_categories = []
    for category, kw_list in KEYWORD_CATEGORIES.items():
        for kw in kw_list:
            if kw in description_lower:
                if category not in matching_categories:
                    matching_categories.append(category)
                break

    # Extract specific technical terms
    technical_terms = []
    tech_patterns = [
        r'(?:sd[a-z]+\d*)',  # disk names
        r'(?:mpath[a-z]+)',  # multipath names
        r'(?:dm-\d+)',  # device mapper
        r'(?:eth\d+|ens\d+|enp\S+|bond\d+)',  # network interfaces
        r'(?:\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})',  # IP addresses
        r'(?:node\d+|host\d+|\w+-node\d+)',  # node names
        r'(?:vg\w+|lv\w+)',  # LVM names
    ]
    for pat in tech_patterns:
        matches = re.findall(pat, description_lower)
        technical_terms.extend(matches)

    # Find product references
    products = []
    product_names = ['morpheus', 'kvm', 'alletra', 'nimble', '3par', 'gfs2',
                     'vme', 'pacemaker', 'corosync', 'smad']
    for prod in product_names:
        if prod in description_lower:
            products.append(prod)

    return {
        'categories': matching_categories,
        'terms': list(set(technical_terms)),
        'products': products,
    }


def rank_findings(findings: List[Dict]) -> List[Dict]:
    """Rank findings by severity and relevance.

    Sort order:
    1. Severity (CRITICAL first)
    2. Confidence score
    3. Category grouping
    """
    def sort_key(f):
        sev_score = SEVERITY_ORDER.get(f.get('severity', 'INFO'), 0)
        confidence = f.get('confidence', 1.0)
        return (sev_score * 10 + confidence * 5, confidence)

    sorted_findings = sorted(findings, key=sort_key, reverse=True)
    return sorted_findings


def correlate_nodes(findings: List[Dict]) -> List[Dict]:
    """Find correlated events across different nodes.

    Looks for:
    - Same pattern on multiple nodes (suggests systemic issue)
    - Events happening within close time proximity
    - Related categories on different nodes
    """
    correlations = []

    # Group findings by pattern name
    by_pattern = defaultdict(list)
    for f in findings:
        by_pattern[f['pattern_name']].append(f)

    # Find patterns that appear on multiple nodes
    for pattern_name, pattern_findings in by_pattern.items():
        nodes = set()
        for pf in pattern_findings:
            node = pf.get('node_name')
            if node:
                nodes.add(node)

        if len(nodes) > 1:
            correlations.append({
                'type': 'multi_node_pattern',
                'pattern_name': pattern_name,
                'severity': pattern_findings[0]['severity'],
                'nodes': list(nodes),
                'count': len(pattern_findings),
                'description': f'Pattern "{pattern_name}" found on {len(nodes)} nodes: {", ".join(sorted(nodes))}. This suggests a systemic issue rather than a single node problem.',
            })

    # Group by category and check for cascade patterns
    by_category = defaultdict(list)
    for f in findings:
        by_category[f.get('category', 'unknown')].append(f)

    # Storage → Filesystem cascade
    if 'storage' in by_category and 'filesystem' in by_category:
        correlations.append({
            'type': 'cascade',
            'pattern_name': 'storage_filesystem_cascade',
            'severity': 'HIGH',
            'categories': ['storage', 'filesystem'],
            'description': 'Storage errors detected alongside filesystem errors. This is likely a cascade: storage issues caused filesystem errors.',
        })

    # Cluster + Storage cascade
    if 'cluster' in by_category and 'storage' in by_category:
        correlations.append({
            'type': 'cascade',
            'pattern_name': 'cluster_storage_cascade',
            'severity': 'CRITICAL',
            'categories': ['cluster', 'storage'],
            'description': 'Cluster events detected alongside storage errors. Storage issues may have triggered cluster fencing/failover.',
        })

    return correlations


def generate_timeline(findings: List[Dict]) -> List[Dict]:
    """Generate a chronological timeline of events.

    Parses timestamps from findings and orders them chronologically.
    """
    timeline_events = []

    for f in findings:
        line_content = f.get('line_content', '')
        timestamp = parse_timestamp(line_content)

        event = {
            'timestamp': timestamp.isoformat() if timestamp else None,
            'timestamp_raw': timestamp,
            'pattern_name': f['pattern_name'],
            'severity': f['severity'],
            'category': f.get('category', 'unknown'),
            'node_name': f.get('node_name'),
            'line_number': f.get('line_number'),
            'line_content': line_content[:200],
            'description': f.get('description', ''),
            'filename': f.get('filename', ''),
        }
        timeline_events.append(event)

    # Sort by timestamp (None timestamps go to the end)
    def timeline_sort_key(e):
        ts = e.get('timestamp_raw')
        if ts is None:
            return datetime.max
        return ts

    timeline_events.sort(key=timeline_sort_key)

    # Remove raw datetime objects (not JSON serializable)
    for e in timeline_events:
        e.pop('timestamp_raw', None)

    return timeline_events


def _calculate_confidence(finding: Dict, keywords: Dict) -> float:
    """Calculate confidence score for a finding based on keyword relevance.

    Base confidence is 1.0. Boosted if finding matches ticket keywords.
    """
    confidence = 0.7  # Base confidence

    if not keywords:
        return confidence

    # Boost if category matches ticket description
    finding_category = finding.get('category', '')
    if finding_category in keywords.get('categories', []):
        confidence += 0.2

    # Boost if line content contains technical terms from description
    line_content_lower = finding.get('line_content', '').lower()
    for term in keywords.get('terms', []):
        if term in line_content_lower:
            confidence += 0.1
            break

    # Cap at 1.0
    return min(confidence, 1.0)


def _generate_summary(findings: List[Dict], file_infos: List[Dict]) -> Dict:
    """Generate analysis summary statistics."""
    severity_counts = defaultdict(int)
    category_counts = defaultdict(int)
    node_counts = defaultdict(int)

    for f in findings:
        severity_counts[f.get('severity', 'INFO')] += 1
        category_counts[f.get('category', 'unknown')] += 1
        node = f.get('node_name')
        if node:
            node_counts[node] += 1

    # Determine primary issue category
    primary_category = max(category_counts, key=category_counts.get) if category_counts else 'unknown'

    # Determine overall severity
    if severity_counts.get('CRITICAL', 0) > 0:
        overall_severity = 'CRITICAL'
    elif severity_counts.get('HIGH', 0) > 0:
        overall_severity = 'HIGH'
    elif severity_counts.get('MEDIUM', 0) > 0:
        overall_severity = 'MEDIUM'
    else:
        overall_severity = 'LOW'

    return {
        'total_findings': len(findings),
        'files_analyzed': len(file_infos),
        'severity_breakdown': dict(severity_counts),
        'category_breakdown': dict(category_counts),
        'node_breakdown': dict(node_counts),
        'primary_category': primary_category,
        'overall_severity': overall_severity,
        'nodes_affected': len(node_counts),
    }
