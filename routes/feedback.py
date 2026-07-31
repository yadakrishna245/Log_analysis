"""Feedback & Learning routes for LogSherlock Pro.

Enables the self-learning loop: when engineers resolve a NEW issue that
wasn't caught by existing patterns, they can feed the solution back into
the system. The tool then catches it automatically next time.

Flow:
    1. Engineer resolves unknown issue manually
    2. Submits the error pattern + solution via API/UI
    3. Tool validates the regex, stores as new pattern + known issue
    4. Next time that error appears → auto-detected instantly

No AI. Just structured human feedback → regex → future auto-detection.
"""

import re
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from models import db, Pattern, KnowledgeEntry, Finding, Ticket

feedback_bp = Blueprint('feedback', __name__)


# ──────────────────────────────────────────────────────────────
# 1. Submit New Pattern (from resolved ticket)
# ──────────────────────────────────────────────────────────────

@feedback_bp.route('/api/feedback/pattern', methods=['POST'])
def submit_pattern():
    """Submit a new detection pattern after manually resolving an issue.

    This is the core of the self-learning loop. When an engineer finds
    a new error signature that the tool didn't catch, they submit it here.

    Required fields:
        - name: Unique pattern identifier (e.g., "ceph_osd_down")
        - regex: The regex pattern to match in logs
        - severity: CRITICAL | HIGH | MEDIUM | LOW
        - category: storage | cluster | network | virtualization | kernel | service
        - description: What this error means (plain English for junior engineers)
        - solution_hint: How to fix it

    Optional fields:
        - product: Which product (Alletra, GFS2, Pacemaker, etc.)
        - source_ticket_id: The ticket where this was first discovered
        - sample_log_line: An example log line that matches

    Returns the created pattern with a test result against the sample line.
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    # Validate required fields
    required = ['name', 'regex', 'severity', 'category', 'description', 'solution_hint']
    missing = [f for f in required if not data.get(f, '').strip()]
    if missing:
        return jsonify({'error': f'Missing required fields: {", ".join(missing)}'}), 400

    name = data['name'].strip().lower().replace(' ', '_').replace('-', '_')
    regex_str = data['regex'].strip()
    severity = data['severity'].strip().upper()
    category = data['category'].strip().lower()
    description = data['description'].strip()
    solution_hint = data['solution_hint'].strip()
    product = data.get('product', 'general').strip()
    source_ticket_id = data.get('source_ticket_id')
    sample_log_line = data.get('sample_log_line', '')

    # Validate severity
    valid_severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
    if severity not in valid_severities:
        return jsonify({'error': f'Invalid severity. Must be one of: {valid_severities}'}), 400

    # Validate category
    valid_categories = ['storage', 'cluster', 'network', 'virtualization', 'kernel', 'service', 'filesystem']
    if category not in valid_categories:
        return jsonify({'error': f'Invalid category. Must be one of: {valid_categories}'}), 400

    # Validate regex compiles
    try:
        compiled = re.compile(regex_str, re.IGNORECASE)
    except re.error as e:
        return jsonify({'error': f'Invalid regex pattern: {str(e)}'}), 400

    # Check if pattern name already exists
    existing = Pattern.query.filter_by(name=name).first()
    if existing:
        return jsonify({'error': f'Pattern with name "{name}" already exists (id={existing.id})'}), 409

    # Test regex against sample log line
    test_result = None
    if sample_log_line:
        match = compiled.search(sample_log_line)
        test_result = {
            'sample_line': sample_log_line,
            'matched': bool(match),
            'match_text': match.group() if match else None,
        }

    # Create the pattern
    pattern = Pattern(
        name=name,
        regex=regex_str,
        severity=severity,
        category=category,
        description=description,
        solution_hint=solution_hint,
        product=product,
        times_matched=0,
    )
    db.session.add(pattern)
    db.session.commit()

    response = {
        'message': f'Pattern "{name}" created successfully. It will now auto-detect this issue in future analyses.',
        'pattern': pattern.to_dict(),
        'test_result': test_result,
    }

    # If source ticket provided, link it
    if source_ticket_id:
        ticket = Ticket.query.get(source_ticket_id)
        if ticket:
            response['source_ticket'] = {
                'id': ticket.id,
                'title': ticket.title,
                'jira_id': ticket.jira_id,
            }

    return jsonify(response), 201


# ──────────────────────────────────────────────────────────────
# 2. Submit New Known Issue (with full root cause + solution)
# ──────────────────────────────────────────────────────────────

@feedback_bp.route('/api/feedback/known-issue', methods=['POST'])
def submit_known_issue():
    """Submit a new known issue after resolving it.

    Creates a knowledge base entry so future tickets with similar
    symptoms are automatically matched to this solution.

    Required fields:
        - title: Short descriptive title
        - symptoms: What you see in logs / system behavior
        - root_cause: Why this happens
        - solution: Step-by-step fix

    Optional fields:
        - product: Product name
        - category: Issue category
        - prevention: How to avoid in future
        - related_tickets: Comma-separated Jira IDs
        - source_ticket_id: Ticket where this was discovered
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    required = ['title', 'symptoms', 'root_cause', 'solution']
    missing = [f for f in required if not data.get(f, '').strip()]
    if missing:
        return jsonify({'error': f'Missing required fields: {", ".join(missing)}'}), 400

    # Check for duplicate title
    existing = KnowledgeEntry.query.filter_by(title=data['title'].strip()).first()
    if existing:
        return jsonify({'error': f'Known issue with title "{data["title"]}" already exists (id={existing.id})'}), 409

    entry = KnowledgeEntry(
        title=data['title'].strip(),
        category=data.get('category', 'known_issue').strip(),
        product=data.get('product', '').strip(),
        symptoms=data['symptoms'].strip(),
        root_cause=data['root_cause'].strip(),
        solution=data['solution'].strip(),
        prevention=data.get('prevention', '').strip(),
        related_tickets=data.get('related_tickets', '').strip(),
    )
    db.session.add(entry)
    db.session.commit()

    return jsonify({
        'message': f'Known issue "{entry.title}" added to knowledge base. Future tickets with similar symptoms will match automatically.',
        'knowledge_entry': entry.to_dict(),
    }), 201


# ──────────────────────────────────────────────────────────────
# 3. Auto-Suggest Pattern from Resolved Ticket
# ──────────────────────────────────────────────────────────────

@feedback_bp.route('/api/feedback/suggest-from-ticket/<int:ticket_id>', methods=['POST'])
def suggest_pattern_from_ticket(ticket_id):
    """Auto-generate a pattern suggestion from a resolved ticket.

    Analyzes the ticket's resolution notes and log files to suggest
    a regex pattern that would catch this issue in future logs.

    The engineer reviews and approves/edits before it becomes active.

    How it works:
        1. Reads the ticket resolution text
        2. Scans uploaded log files for error-like lines (ERROR, FAIL, panic, etc.)
        3. Extracts common error signatures from unmatched lines
        4. Proposes regex patterns for review

    Returns suggested patterns (NOT auto-added — requires engineer approval).
    """
    ticket = Ticket.query.get_or_404(ticket_id)

    if not ticket.resolution:
        return jsonify({
            'error': 'Ticket has no resolution text. Please add resolution details first.',
            'hint': 'PUT /api/tickets/{id} with {"resolution": "your resolution notes"}'
        }), 400

    # Get existing pattern names to avoid duplicates
    existing_patterns = {p.name for p in Pattern.query.all()}

    # Get log files for this ticket
    from engine.ingestion import stream_file
    import os

    from flask import current_app
    ticket_folder = os.path.join(current_app.config['UPLOAD_FOLDER'], str(ticket_id))

    # Find error-like lines that DIDN'T match any existing pattern
    error_indicators = re.compile(
        r'(error|fail|fatal|panic|critical|exception|refused|timeout|denied|abort|crash|killed|segfault)',
        re.IGNORECASE
    )

    # Get lines that DID match (from findings)
    matched_lines = set()
    findings = Finding.query.filter_by(ticket_id=ticket_id).all()
    for f in findings:
        if f.line_content:
            matched_lines.add(f.line_content.strip()[:200])

    # Scan files for error lines that WEREN'T already caught
    unmatched_errors = []
    if os.path.isdir(ticket_folder):
        for root, dirs, files in os.walk(ticket_folder):
            for fname in files:
                fpath = os.path.join(root, fname)
                try:
                    for line_num, line in stream_file(fpath):
                        line_stripped = line.strip()[:200]
                        if (error_indicators.search(line) and
                                line_stripped not in matched_lines and
                                len(line_stripped) > 10):
                            unmatched_errors.append({
                                'file': os.path.relpath(fpath, ticket_folder),
                                'line_number': line_num,
                                'content': line_stripped,
                            })
                            if len(unmatched_errors) >= 50:
                                break
                except Exception:
                    continue
                if len(unmatched_errors) >= 50:
                    break

    # Generate pattern suggestions from unmatched error lines
    suggestions = _generate_pattern_suggestions(unmatched_errors, ticket)

    return jsonify({
        'ticket_id': ticket_id,
        'ticket_title': ticket.title,
        'resolution': ticket.resolution,
        'unmatched_error_lines': len(unmatched_errors),
        'suggestions': suggestions,
        'instruction': 'Review the suggestions below. To add one as a pattern, POST to /api/feedback/pattern with the suggested fields (edit as needed).',
        'sample_errors': unmatched_errors[:10],
    })


# ──────────────────────────────────────────────────────────────
# 4. Bulk Pattern Validation (Test patterns before going live)
# ──────────────────────────────────────────────────────────────

@feedback_bp.route('/api/feedback/test-pattern', methods=['POST'])
def test_pattern():
    """Test a regex pattern against sample log lines before adding it.

    Lets engineers validate their regex works correctly before
    submitting it as a permanent pattern.

    Required fields:
        - regex: The pattern to test
        - test_lines: List of log lines to test against

    Returns match results for each line.
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    regex_str = data.get('regex', '').strip()
    test_lines = data.get('test_lines', [])

    if not regex_str:
        return jsonify({'error': 'regex is required'}), 400
    if not test_lines:
        return jsonify({'error': 'test_lines is required (list of strings)'}), 400

    # Validate regex
    try:
        compiled = re.compile(regex_str, re.IGNORECASE)
    except re.error as e:
        return jsonify({'error': f'Invalid regex: {str(e)}'}), 400

    # Test each line
    results = []
    for i, line in enumerate(test_lines[:50]):  # Max 50 lines
        match = compiled.search(str(line))
        results.append({
            'line_number': i + 1,
            'content': str(line)[:500],
            'matched': bool(match),
            'match_text': match.group() if match else None,
            'match_span': list(match.span()) if match else None,
        })

    matched_count = sum(1 for r in results if r['matched'])

    return jsonify({
        'regex': regex_str,
        'total_lines_tested': len(results),
        'matched_count': matched_count,
        'match_rate': f'{matched_count}/{len(results)}',
        'results': results,
    })


# ──────────────────────────────────────────────────────────────
# 5. Get Feedback Statistics
# ──────────────────────────────────────────────────────────────

@feedback_bp.route('/api/feedback/stats', methods=['GET'])
def feedback_stats():
    """Get statistics about the knowledge growth over time."""
    total_patterns = Pattern.query.count()
    total_knowledge = KnowledgeEntry.query.count()

    # Patterns by category
    from sqlalchemy import func
    patterns_by_category = db.session.query(
        Pattern.category, func.count(Pattern.id)
    ).group_by(Pattern.category).all()

    # Most active patterns (most matches)
    top_patterns = Pattern.query.order_by(Pattern.times_matched.desc()).limit(10).all()

    # Recently added patterns
    recent_patterns = Pattern.query.order_by(Pattern.id.desc()).limit(5).all()

    # Knowledge entries by category
    kb_by_category = db.session.query(
        KnowledgeEntry.category, func.count(KnowledgeEntry.id)
    ).group_by(KnowledgeEntry.category).all()

    return jsonify({
        'total_patterns': total_patterns,
        'total_knowledge_entries': total_knowledge,
        'patterns_by_category': {cat: count for cat, count in patterns_by_category if cat},
        'knowledge_by_category': {cat: count for cat, count in kb_by_category if cat},
        'top_patterns': [p.to_dict() for p in top_patterns],
        'recently_added': [p.to_dict() for p in recent_patterns],
        'growth_message': f'The team has built {total_patterns} patterns and {total_knowledge} known issues. Each new addition makes future tickets faster to resolve.',
    })


# ──────────────────────────────────────────────────────────────
# Helper Functions
# ──────────────────────────────────────────────────────────────

def _generate_pattern_suggestions(unmatched_errors, ticket):
    """Generate regex pattern suggestions from unmatched error lines.

    Strategy:
        1. Group similar error lines (by common prefixes/keywords)
        2. Extract the unique error signature from each group
        3. Build a regex that would match the group
        4. Propose it with metadata from the ticket
    """
    if not unmatched_errors:
        return []

    suggestions = []
    seen_signatures = set()

    for error in unmatched_errors[:20]:
        content = error['content']

        # Extract error signature (the unique part of the error message)
        # Remove timestamps, PIDs, node names — keep the error message
        # Strip common log prefixes
        cleaned = re.sub(
            r'^\d{4}[-/]\d{2}[-/]\d{2}[\sT]\d{2}:\d{2}:\d{2}[.\d]*\s*', '', content
        )
        cleaned = re.sub(r'^\w+\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\S+\s+', '', cleaned)
        cleaned = re.sub(r'\[\s*\d+\.\d+\]\s*', '', cleaned)  # kernel timestamps
        cleaned = re.sub(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b', r'\\d+\\.\\d+\\.\\d+\\.\\d+', cleaned)
        cleaned = re.sub(r'\bsd[a-z]\d*\b', r'sd\\w+', cleaned)

        # Create a signature from key error words
        error_words = re.findall(r'[A-Z][a-z]+|[A-Z]{2,}|error|fail|timeout|refused|denied', content, re.IGNORECASE)
        signature = ' '.join(sorted(set(w.lower() for w in error_words[:5])))

        if signature in seen_signatures or len(signature) < 5:
            continue
        seen_signatures.add(signature)

        # Build a basic regex from the cleaned error
        # Escape special chars but keep the structure
        regex_parts = []
        words = cleaned.split()
        key_words = [w for w in words if len(w) > 3 and not w.isdigit()][:5]
        if key_words:
            regex_suggestion = r'.*'.join(re.escape(w) for w in key_words)
        else:
            continue

        # Determine severity from keywords
        if any(w in content.lower() for w in ['panic', 'fatal', 'crash', 'critical']):
            suggested_severity = 'CRITICAL'
        elif any(w in content.lower() for w in ['error', 'fail', 'refused', 'denied']):
            suggested_severity = 'HIGH'
        elif any(w in content.lower() for w in ['warn', 'timeout', 'retry']):
            suggested_severity = 'MEDIUM'
        else:
            suggested_severity = 'LOW'

        # Generate a name
        name_parts = [w.lower() for w in key_words[:3]]
        suggested_name = '_'.join(name_parts)
        suggested_name = re.sub(r'[^a-z0-9_]', '', suggested_name)

        suggestions.append({
            'suggested_name': suggested_name,
            'suggested_regex': regex_suggestion,
            'suggested_severity': suggested_severity,
            'suggested_category': _infer_category(content),
            'suggested_description': f'Auto-suggested from ticket #{ticket.id}: {ticket.title}',
            'suggested_solution_hint': ticket.resolution[:200] if ticket.resolution else 'See ticket resolution',
            'source_line': content,
            'source_file': error['file'],
            'confidence': 'LOW — review and edit before approving',
        })

        if len(suggestions) >= 5:
            break

    return suggestions


def _infer_category(line_content):
    """Infer the category from log line content."""
    content_lower = line_content.lower()

    category_keywords = {
        'storage': ['disk', 'scsi', 'lun', 'multipath', 'iscsi', 'sd', 'io error', 'block'],
        'filesystem': ['gfs2', 'mount', 'filesystem', 'dlm', 'ext4', 'xfs'],
        'cluster': ['pacemaker', 'corosync', 'fence', 'stonith', 'quorum', 'node'],
        'network': ['network', 'bond', 'nic', 'connection', 'tcp', 'socket', 'route'],
        'virtualization': ['qemu', 'kvm', 'libvirt', 'virsh', 'domain', 'vm'],
        'kernel': ['kernel', 'panic', 'oom', 'segfault', 'BUG:', 'oops'],
        'service': ['systemd', 'service', 'failed', 'unit', 'daemon'],
    }

    for category, keywords in category_keywords.items():
        if any(kw in content_lower for kw in keywords):
            return category

    return 'service'  # default
