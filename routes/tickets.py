"""Ticket management routes for LogSherlock Pro."""

import os
import shutil
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from models import db, Ticket, LogFile, Finding, Pattern, KnowledgeEntry
from engine.analyzer import analyze_ticket, rank_findings, generate_timeline, correlate_nodes

tickets_bp = Blueprint('tickets', __name__)


def _generate_rca_sections(findings, ticket=None, knowledge_matches=None):
    """Generate the 8-section RCA report from findings, ticket info, and knowledge base.

    Works with both ticket-based findings (Finding objects/dicts) and
    quick-analyze findings (plain dicts). Returns a dict with all 8 sections.
    """
    if knowledge_matches is None:
        knowledge_matches = []

    # Normalize findings to dicts
    findings_dicts = []
    for f in findings:
        if hasattr(f, 'to_dict'):
            findings_dicts.append(f.to_dict())
        elif isinstance(f, dict):
            findings_dicts.append(f)

    # Sort by severity
    severity_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3, 'INFO': 4}
    findings_dicts.sort(key=lambda x: severity_order.get(x.get('severity', 'INFO'), 5))

    # Derive ticket metadata
    jira_id = ticket.jira_id if ticket else 'N/A'
    product = ticket.product if ticket else 'N/A'
    severity = ticket.severity if ticket else (findings_dicts[0].get('severity', 'MEDIUM') if findings_dicts else 'MEDIUM')
    description = ticket.description if ticket else ''
    date_str = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    # Derive component from most common category
    categories = [f.get('category', 'unknown') for f in findings_dicts if f.get('category')]
    component = max(set(categories), key=categories.count) if categories else 'N/A'

    # --- Section 1: Problem Statement ---
    if description:
        problem_statement = description.strip()
    elif findings_dicts:
        top = findings_dicts[0]
        problem_statement = f"Analysis detected {len(findings_dicts)} issue(s). Primary issue: {top.get('description', top.get('pattern_name', 'Unknown'))}"
    else:
        problem_statement = "No issues detected during analysis."

    if findings_dicts and description:
        problem_statement += f"\n\nAutomated analysis identified {len(findings_dicts)} finding(s) corroborating the reported issue."

    # --- Section 2: Impact ---
    affected_components = list(set(categories)) if categories else ['Unknown']
    critical_count = sum(1 for f in findings_dicts if f.get('severity') == 'CRITICAL')
    high_count = sum(1 for f in findings_dicts if f.get('severity') == 'HIGH')

    impact_lines = []
    impact_lines.append(f"Affected components: {', '.join(affected_components)}")
    if critical_count > 0:
        impact_lines.append(f"CRITICAL findings: {critical_count} — potential data loss or service outage risk")
    if high_count > 0:
        impact_lines.append(f"HIGH findings: {high_count} — degraded performance or partial outage risk")
    if not critical_count and not high_count:
        impact_lines.append("No critical or high-severity issues detected. Low risk of outage.")

    impact = '\n'.join(impact_lines)

    # --- Section 3: Timeline ---
    timeline_entries = []
    for f in findings_dicts:
        line_content = f.get('line_content', '')
        # Try to extract timestamp from the log line (first 25 chars often contain timestamp)
        timestamp_hint = line_content[:25].strip() if line_content else 'N/A'
        event = f.get('description', f.get('pattern_name', 'Unknown event'))
        file_ref = f.get('file', '')
        line_num = f.get('line_number', '')
        timeline_entries.append({
            'timestamp': timestamp_hint,
            'event': f"{event} [{file_ref}:{line_num}]" if file_ref else event,
        })

    # --- Section 4: Root Cause ---
    primary_root_cause = 'Unable to determine from available logs.'
    contributing_factors = []

    if findings_dicts:
        top_finding = findings_dicts[0]
        primary_root_cause = top_finding.get('description', top_finding.get('pattern_name', 'Unknown'))

        # Check knowledge base for deeper root cause
        if knowledge_matches:
            kb_root = knowledge_matches[0].get('root_cause', '')
            if kb_root:
                primary_root_cause = kb_root

        # Contributing factors from other high-severity findings
        seen = set()
        for f in findings_dicts[1:20]:
            desc = f.get('description', f.get('pattern_name', ''))
            if desc and desc not in seen and desc != primary_root_cause:
                contributing_factors.append(desc)
                seen.add(desc)
            if len(contributing_factors) >= 5:
                break

    # --- Section 5: Evidence ---
    evidence_lines = []
    for f in findings_dicts[:10]:
        lc = f.get('line_content', '')
        if lc:
            evidence_lines.append(lc)

    # --- Section 6: Fix ---
    fix_steps = []
    step_num = 1
    seen_solutions = set()

    # First from knowledge base
    for kb in knowledge_matches:
        sol = kb.get('solution', '')
        if sol and sol not in seen_solutions:
            fix_steps.append({
                'step': step_num,
                'action': sol[:200],
                'command': '',
            })
            seen_solutions.add(sol)
            step_num += 1
            if step_num > 5:
                break

    # Then from findings solution_hints
    for f in findings_dicts:
        hint = f.get('solution_hint', '')
        if hint and hint not in seen_solutions:
            fix_steps.append({
                'step': step_num,
                'action': hint[:200],
                'command': '',
            })
            seen_solutions.add(hint)
            step_num += 1
            if step_num > 8:
                break

    if not fix_steps:
        fix_steps.append({'step': 1, 'action': 'Investigate logs further and escalate if needed.', 'command': ''})

    # --- Section 7: Remediation Plan ---
    remediation_lines = []
    remediation_lines.append("1. Validate the root cause by reviewing the evidence log lines above.")
    remediation_lines.append("2. Apply the fix steps listed in Section 6 in order.")
    if critical_count > 0:
        remediation_lines.append("3. Monitor the system for recurrence of CRITICAL patterns for 24-48 hours.")
    else:
        remediation_lines.append("3. Monitor the system for recurrence of detected patterns.")
    remediation_lines.append("4. Confirm resolution with the customer and close the ticket.")
    if knowledge_matches:
        remediation_lines.append("5. Cross-reference with known issues in the knowledge base for similar cases.")

    remediation_plan = '\n'.join(remediation_lines)

    # --- Section 8: Prevention / Long-Term Recommendations ---
    prevention_lines = []

    # From knowledge base prevention field
    for kb in knowledge_matches:
        prev = kb.get('prevention', '')
        if prev:
            prevention_lines.append(prev)

    # Generic recommendations based on findings
    if not prevention_lines:
        if critical_count > 0:
            prevention_lines.append("Implement proactive monitoring and alerting for the detected CRITICAL patterns.")
        prevention_lines.append("Set up log rotation and archival policies to ensure logs are available for future analysis.")
        prevention_lines.append("Schedule periodic health checks on affected components.")
        if categories:
            prevention_lines.append(f"Review configuration and patching for: {', '.join(affected_components)}.")

    prevention = '\n'.join(prevention_lines)

    return {
        'jira_id': jira_id,
        'product': product,
        'component': component,
        'severity': severity,
        'date': date_str,
        'problem_statement': problem_statement,
        'impact': impact,
        'timeline': timeline_entries,
        'root_cause': {
            'primary': primary_root_cause,
            'contributing_factors': contributing_factors,
        },
        'evidence': evidence_lines,
        'fix': fix_steps,
        'remediation_plan': remediation_plan,
        'prevention': prevention,
    }


def _format_jira_rca(sections):
    """Format the 8-section RCA dict into Jira wiki markup text."""
    lines = []

    lines.append('h2. Root Cause Analysis (RCA)')
    lines.append(f"*Ticket:* {sections['jira_id']}")
    lines.append(f"*Product:* {sections['product']}")
    lines.append(f"*Component:* {sections['component']}")
    lines.append(f"*Severity:* {sections['severity']}")
    lines.append('*Assigned to:* yada-krishna.chaithanya-ext')
    lines.append(f"*Date:* {sections['date']}")
    lines.append('')

    # Section 1
    lines.append('h3. 1. Problem Statement')
    lines.append(sections['problem_statement'])
    lines.append('')

    # Section 2
    lines.append('h3. 2. Impact')
    lines.append(sections['impact'])
    lines.append('')

    # Section 3
    lines.append('h3. 3. Timeline')
    lines.append('||Date/Time||Event||')
    for entry in sections['timeline'][:20]:
        lines.append(f"|{entry['timestamp']}|{entry['event']}|")
    lines.append('')

    # Section 4
    lines.append('h3. 4. Root Cause')
    lines.append(f"*Primary Root Cause:* {sections['root_cause']['primary']}")
    if sections['root_cause']['contributing_factors']:
        factors = '; '.join(sections['root_cause']['contributing_factors'])
        lines.append(f"*Contributing Factor:* {factors}")
    lines.append('')

    # Section 5
    lines.append('h3. 5. Evidence')
    lines.append('{code}')
    for ev in sections['evidence'][:10]:
        lines.append(ev)
    lines.append('{code}')
    lines.append('')

    # Section 6
    lines.append('h3. 6. Fix')
    lines.append('||Step||Action||Command||')
    for step in sections['fix']:
        lines.append(f"|{step['step']}|{step['action']}|{step['command']}|")
    lines.append('')

    # Section 7
    lines.append('h3. 7. Remediation Plan')
    lines.append(sections['remediation_plan'])
    lines.append('')

    # Section 8
    lines.append('h3. 8. Prevention / Long-Term Recommendations')
    lines.append(sections['prevention'])

    return '\n'.join(lines)


@tickets_bp.route('/api/tickets', methods=['POST'])
def create_ticket():
    """Create a new ticket."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    title = data.get('title')
    if not title:
        return jsonify({'error': 'Title is required'}), 400

    ticket = Ticket(
        jira_id=data.get('jira_id'),
        title=title,
        description=data.get('description', ''),
        product=data.get('product'),
        status=data.get('status', 'open'),
        severity=data.get('severity', 'MEDIUM'),
    )
    db.session.add(ticket)
    db.session.commit()

    # Create upload folder for this ticket
    ticket_folder = os.path.join(current_app.config['UPLOAD_FOLDER'], str(ticket.id))
    os.makedirs(ticket_folder, exist_ok=True)

    return jsonify(ticket.to_dict()), 201


@tickets_bp.route('/api/tickets', methods=['GET'])
def list_tickets():
    """List tickets with pagination, search, and filters."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 25, type=int)
    per_page = min(per_page, current_app.config.get('MAX_PAGE_SIZE', 100))

    search = request.args.get('search', '').strip()
    product = request.args.get('product', '').strip()
    status = request.args.get('status', '').strip()
    severity = request.args.get('severity', '').strip()
    sort_by = request.args.get('sort_by', 'created_at')
    sort_order = request.args.get('sort_order', 'desc')

    query = Ticket.query

    # Apply filters
    if search:
        search_term = f'%{search}%'
        query = query.filter(
            db.or_(
                Ticket.title.ilike(search_term),
                Ticket.description.ilike(search_term),
                Ticket.jira_id.ilike(search_term),
            )
        )
    if product:
        query = query.filter(Ticket.product == product)
    if status:
        query = query.filter(Ticket.status == status)
    if severity:
        query = query.filter(Ticket.severity == severity)

    # Apply sorting
    sort_column = getattr(Ticket, sort_by, Ticket.created_at)
    if sort_order == 'asc':
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    # Paginate
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'tickets': [t.to_dict() for t in pagination.items],
        'total': pagination.total,
        'page': pagination.page,
        'per_page': per_page,
        'pages': pagination.pages,
        'has_next': pagination.has_next,
        'has_prev': pagination.has_prev,
    })


@tickets_bp.route('/api/tickets/<int:ticket_id>', methods=['GET'])
def get_ticket(ticket_id):
    """Get ticket details with findings."""
    ticket = Ticket.query.get_or_404(ticket_id)
    return jsonify(ticket.to_dict(include_findings=True))


@tickets_bp.route('/api/tickets/<int:ticket_id>', methods=['PUT'])
def update_ticket(ticket_id):
    """Update a ticket."""
    ticket = Ticket.query.get_or_404(ticket_id)
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    updatable_fields = ['title', 'description', 'product', 'status', 'severity',
                        'jira_id', 'resolution']
    for field in updatable_fields:
        if field in data:
            setattr(ticket, field, data[field])

    ticket.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(ticket.to_dict())


@tickets_bp.route('/api/tickets/<int:ticket_id>/upload', methods=['POST'])
def upload_files(ticket_id):
    """Upload log files for a ticket. Handles 7z archives and multiple files."""
    ticket = Ticket.query.get_or_404(ticket_id)
    ticket_folder = os.path.join(current_app.config['UPLOAD_FOLDER'], str(ticket_id))
    os.makedirs(ticket_folder, exist_ok=True)

    if 'files' not in request.files and 'file' not in request.files:
        return jsonify({'error': 'No files provided'}), 400

    files = request.files.getlist('files') or [request.files.get('file')]
    uploaded = []

    for file in files:
        if not file or not file.filename:
            continue

        filename = secure_filename(file.filename)
        filepath = os.path.join(ticket_folder, filename)

        # Handle duplicate filenames
        base, ext = os.path.splitext(filename)
        counter = 1
        while os.path.exists(filepath):
            filename = f"{base}_{counter}{ext}"
            filepath = os.path.join(ticket_folder, filename)
            counter += 1

        file.save(filepath)
        file_size = os.path.getsize(filepath)

        # If it's a 7z file, extract it
        if filename.endswith('.7z'):
            from engine.ingestion import extract_7z
            extract_dir = os.path.join(ticket_folder, base + '_extracted')
            try:
                extracted_files = extract_7z(filepath, extract_dir)
                uploaded.append({
                    'filename': filename,
                    'size': file_size,
                    'type': '7z_archive',
                    'extracted_files': len(extracted_files),
                })
            except Exception as e:
                uploaded.append({
                    'filename': filename,
                    'size': file_size,
                    'type': '7z_archive',
                    'error': str(e),
                })
        else:
            uploaded.append({
                'filename': filename,
                'size': file_size,
                'type': 'log_file',
            })

    ticket.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    return jsonify({
        'message': f'{len(uploaded)} file(s) uploaded',
        'ticket_id': ticket_id,
        'files': uploaded,
    })


@tickets_bp.route('/api/tickets/<int:ticket_id>/analyze', methods=['POST'])
def trigger_analysis(ticket_id):
    """Trigger analysis for a ticket."""
    ticket = Ticket.query.get_or_404(ticket_id)
    ticket_folder = os.path.join(current_app.config['UPLOAD_FOLDER'], str(ticket_id))

    if not os.path.isdir(ticket_folder):
        return jsonify({'error': 'No files uploaded for this ticket'}), 400

    # Clear previous findings
    Finding.query.filter_by(ticket_id=ticket_id).delete()
    LogFile.query.filter_by(ticket_id=ticket_id).delete()
    db.session.commit()

    # Run analysis
    result = analyze_ticket(ticket_id, ticket_folder, ticket.description or '')

    if 'error' in result:
        return jsonify({'error': result['error']}), 500

    return jsonify({
        'message': 'Analysis complete',
        'ticket_id': ticket_id,
        'files_processed': result['files_processed'],
        'total_lines': result['total_lines'],
        'findings_count': len(result['findings']),
        'summary': result['summary'],
    })


@tickets_bp.route('/api/tickets/<int:ticket_id>/findings', methods=['GET'])
def get_findings(ticket_id):
    """Get findings for a ticket with optional filters."""
    Ticket.query.get_or_404(ticket_id)

    severity = request.args.get('severity', '').strip()
    category = request.args.get('category', '').strip()
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)

    query = Finding.query.filter_by(ticket_id=ticket_id)

    if severity:
        query = query.filter(Finding.severity == severity)
    if category:
        query = query.filter(Finding.category == category)

    query = query.order_by(Finding.severity.desc(), Finding.confidence.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'findings': [f.to_dict() for f in pagination.items],
        'total': pagination.total,
        'page': pagination.page,
        'per_page': per_page,
    })


@tickets_bp.route('/api/tickets/<int:ticket_id>/report', methods=['GET'])
def get_report(ticket_id):
    """Generate RCA (Root Cause Analysis) report as structured JSON with 8 sections."""
    ticket = Ticket.query.get_or_404(ticket_id)
    findings = Finding.query.filter_by(ticket_id=ticket_id).order_by(
        Finding.severity.desc(), Finding.confidence.desc()
    ).all()
    log_files = LogFile.query.filter_by(ticket_id=ticket_id).all()

    # Find related knowledge base entries
    knowledge_matches = _find_knowledge_matches(ticket, findings)

    # Generate the 8-section RCA
    sections = _generate_rca_sections(findings, ticket=ticket, knowledge_matches=knowledge_matches)

    # Also generate the Jira-formatted text
    jira_text = _format_jira_rca(sections)

    report = {
        'ticket': ticket.to_dict(),
        'report_generated_at': datetime.now(timezone.utc).isoformat(),
        'rca': {
            'problem_statement': sections['problem_statement'],
            'impact': sections['impact'],
            'timeline': sections['timeline'],
            'root_cause': sections['root_cause'],
            'evidence': sections['evidence'],
            'fix': sections['fix'],
            'remediation_plan': sections['remediation_plan'],
            'prevention': sections['prevention'],
        },
        'metadata': {
            'jira_id': sections['jira_id'],
            'product': sections['product'],
            'component': sections['component'],
            'severity': sections['severity'],
            'assigned_to': 'yada-krishna.chaithanya-ext',
            'date': sections['date'],
            'total_findings': len(findings),
            'files_analyzed': len(log_files),
        },
        'jira_report': jira_text,
    }

    return jsonify(report)


@tickets_bp.route('/api/tickets/<int:ticket_id>/jira-comment', methods=['GET'])
def get_jira_comment(ticket_id):
    """Generate Jira-formatted RCA comment in HPE L4 8-section format."""
    ticket = Ticket.query.get_or_404(ticket_id)
    findings = Finding.query.filter_by(ticket_id=ticket_id).order_by(
        Finding.severity.desc(), Finding.confidence.desc()
    ).all()

    # Find related knowledge base entries
    knowledge_matches = _find_knowledge_matches(ticket, findings)

    # Generate the 8-section RCA
    sections = _generate_rca_sections(findings, ticket=ticket, knowledge_matches=knowledge_matches)

    # Format as Jira wiki markup
    jira_text = _format_jira_rca(sections)

    return jsonify({
        'ticket_id': ticket_id,
        'jira_comment': jira_text,
        'format': 'jira_wiki_markup',
        'sections': sections,
    })


def _find_knowledge_matches(ticket, findings):
    """Find knowledge base entries related to the ticket and findings."""
    knowledge_matches = []
    try:
        entries = KnowledgeEntry.query.all()
        if not entries:
            return []

        # Build search terms from ticket and findings
        search_terms = set()
        if ticket:
            if ticket.description:
                search_terms.update(w.lower() for w in ticket.description.split() if len(w) > 3)
            if ticket.product:
                search_terms.add(ticket.product.lower())

        for f in findings[:20]:
            if hasattr(f, 'category') and f.category:
                search_terms.add(f.category.lower())
            elif isinstance(f, dict) and f.get('category'):
                search_terms.add(f['category'].lower())
            if hasattr(f, 'pattern_name') and f.pattern_name:
                search_terms.update(w.lower() for w in f.pattern_name.split('_') if len(w) > 3)
            elif isinstance(f, dict) and f.get('pattern_name'):
                search_terms.update(w.lower() for w in f['pattern_name'].split('_') if len(w) > 3)

        for entry in entries:
            entry_text = f"{entry.title} {entry.symptoms or ''} {entry.root_cause or ''} {entry.category or ''}".lower()
            matches = sum(1 for term in search_terms if term in entry_text)
            if matches >= 1:
                knowledge_matches.append({
                    'title': entry.title,
                    'product': entry.product,
                    'root_cause': entry.root_cause,
                    'solution': entry.solution,
                    'prevention': entry.prevention,
                    'score': matches,
                })

        # Sort by relevance score
        knowledge_matches.sort(key=lambda x: x['score'], reverse=True)
    except Exception:
        pass

    return knowledge_matches[:5]
