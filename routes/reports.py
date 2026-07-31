"""
LogSherlock Pro - Report Generation API
Blueprint: /api/reports
Generates RCA reports and Jira-formatted comments.
"""

from datetime import datetime
from flask import Blueprint, request, jsonify

reports_bp = Blueprint('reports', __name__)


@reports_bp.route('/api/reports/<ticket_id>/rca', methods=['GET'])
def generate_rca_report(ticket_id):
    """
    Generate a full Root Cause Analysis report.
    Query params: include_timeline (bool), include_recommendations (bool)
    """
    try:
        from .tickets import _tickets, _findings_cache
    except ImportError:
        return jsonify({'error': 'Tickets module not available'}), 500

    ticket = _tickets.get(ticket_id)
    if not ticket:
        return jsonify({'error': 'Ticket not found'}), 404

    findings = _findings_cache.get(ticket_id, ticket.get('findings', []))
    include_timeline = request.args.get('include_timeline', 'true').lower() == 'true'
    include_recs = request.args.get('include_recommendations', 'true').lower() == 'true'

    # Severity breakdown
    severity_counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'info': 0}
    for f in findings:
        sev = f.get('severity', 'info').lower()
        if sev in severity_counts:
            severity_counts[sev] += 1

    # Category breakdown
    categories = {}
    for f in findings:
        cat = f.get('category', 'other')
        categories[cat] = categories.get(cat, 0) + 1

    # Build timeline
    timeline = []
    if include_timeline:
        for f in findings:
            if f.get('timestamp'):
                timeline.append({
                    'timestamp': f['timestamp'],
                    'event': f.get('name', f.get('pattern', 'Unknown')),
                    'severity': f.get('severity', 'INFO'),
                    'node': f.get('node', ''),
                    'category': f.get('category', ''),
                    'description': f.get('description', ''),
                })
        timeline.sort(key=lambda x: x['timestamp'])

    # Root cause determination
    root_cause = ticket.get('root_cause', '')
    if not root_cause:
        critical_findings = [f for f in findings if f.get('severity', '').upper() == 'CRITICAL']
        if critical_findings:
            root_cause = critical_findings[0].get('description', 'Multiple critical issues detected')
        elif findings:
            root_cause = findings[0].get('description', 'See findings for details')
        else:
            root_cause = 'No findings to determine root cause. Upload and analyze log files.'

    # Recommendations
    recommendations = []
    if include_recs:
        recommendations = ticket.get('recommendations', [])
        if not recommendations:
            seen = set()
            for f in sorted(findings, key=lambda x: {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2}.get(x.get('severity', '').upper(), 3)):
                hint = f.get('solution_hint', f.get('solution', ''))
                if hint and hint not in seen:
                    recommendations.append({
                        'action': hint,
                        'priority': f.get('severity', 'medium'),
                        'category': f.get('category', ''),
                        'finding': f.get('name', ''),
                    })
                    seen.add(hint)
                if len(recommendations) >= 10:
                    break

    # Impact assessment
    impact = 'low'
    if severity_counts['critical'] > 0:
        impact = 'critical'
    elif severity_counts['high'] > 0:
        impact = 'high'
    elif severity_counts['medium'] > 0:
        impact = 'medium'

    report = {
        'report_type': 'rca',
        'ticket_id': ticket_id,
        'title': ticket.get('title', ''),
        'jira_id': ticket.get('jira_id', ''),
        'generated_at': datetime.utcnow().isoformat() + 'Z',
        'status': ticket.get('status', 'open'),
        'summary': ticket.get('analysis_summary', f"Analysis of {len(findings)} findings across {len(categories)} categories."),
        'impact': impact,
        'root_cause': root_cause,
        'severity_breakdown': severity_counts,
        'category_breakdown': categories,
        'findings_count': len(findings),
        'findings': findings,
        'timeline': timeline,
        'recommendations': recommendations,
        'nodes_affected': list(set(f.get('node', '') for f in findings if f.get('node'))),
        'files_analyzed': [f.get('name', '') for f in ticket.get('files', [])],
    }

    return jsonify(report)


@reports_bp.route('/api/reports/<ticket_id>/jira', methods=['GET'])
def generate_jira_comment(ticket_id):
    """
    Generate a Jira-formatted wiki markup comment.
    Ready to paste into Jira ticket comments.
    """
    try:
        from .tickets import _tickets, _findings_cache
    except ImportError:
        return jsonify({'error': 'Tickets module not available'}), 500

    ticket = _tickets.get(ticket_id)
    if not ticket:
        return jsonify({'error': 'Ticket not found'}), 404

    findings = _findings_cache.get(ticket_id, ticket.get('findings', []))

    # Build Jira wiki markup
    lines = []
    lines.append(f"h2. 🔍 LogSherlock Pro - RCA Report")
    lines.append(f"h3. Ticket: {ticket.get('title', 'Untitled')}")
    if ticket.get('jira_id'):
        lines.append(f"JIRA: {ticket['jira_id']}")
    lines.append(f"_Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}_")
    lines.append("")

    # Summary
    summary = ticket.get('analysis_summary', '')
    if not summary and findings:
        critical = len([f for f in findings if f.get('severity', '').upper() == 'CRITICAL'])
        high = len([f for f in findings if f.get('severity', '').upper() == 'HIGH'])
        summary = f"Automated analysis detected {len(findings)} issues ({critical} critical, {high} high priority)."
    lines.append("h3. Summary")
    lines.append(summary or "No analysis results available.")
    lines.append("")

    # Severity table
    severity_counts = {'CRITICAL': 0, 'HIGH': 0, 'MEDIUM': 0, 'LOW': 0}
    for f in findings:
        sev = f.get('severity', 'LOW').upper()
        if sev in severity_counts:
            severity_counts[sev] += 1

    lines.append("h3. Severity Breakdown")
    lines.append("||Severity||Count||")
    for sev in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']:
        icon = {'CRITICAL': '🔴', 'HIGH': '🟠', 'MEDIUM': '🟡', 'LOW': '🟢'}[sev]
        lines.append(f"|{icon} {sev}|{severity_counts[sev]}|")
    lines.append("")

    # Root Cause
    root_cause = ticket.get('root_cause', '')
    if not root_cause and findings:
        critical_findings = [f for f in findings if f.get('severity', '').upper() == 'CRITICAL']
        if critical_findings:
            root_cause = critical_findings[0].get('description', '')
    lines.append("h3. Root Cause")
    lines.append(root_cause or "Further investigation needed.")
    lines.append("")

    # Key Findings
    if findings:
        lines.append("h3. Key Findings")
        for i, f in enumerate(findings[:15], 1):
            severity = f.get('severity', 'INFO').upper()
            icon = {'CRITICAL': '(x)', 'HIGH': '(!)', 'MEDIUM': '(?)', 'LOW': '(i)', 'INFO': '(i)'}.get(severity, '(i)')
            name = f.get('name', f.get('pattern', 'Finding'))
            desc = f.get('description', '')
            lines.append(f"# {icon} *{name}* \\[{severity}\\]")
            if desc:
                lines.append(f"** _{desc}_")
            hint = f.get('solution_hint', f.get('solution', ''))
            if hint:
                lines.append(f"** *Action:* {hint}")
            node = f.get('node', '')
            if node:
                lines.append(f"** Node: {{monospace}}{node}{{monospace}}")
        lines.append("")

    # Recommendations
    recommendations = ticket.get('recommendations', [])
    if not recommendations:
        for f in findings[:5]:
            hint = f.get('solution_hint', f.get('solution', ''))
            if hint:
                recommendations.append(hint)

    if recommendations:
        lines.append("h3. Recommended Actions")
        for i, rec in enumerate(recommendations[:8], 1):
            if isinstance(rec, dict):
                lines.append(f"# {rec.get('action', str(rec))}")
            else:
                lines.append(f"# {rec}")
        lines.append("")

    # Timeline (condensed)
    timeline_entries = [f for f in findings if f.get('timestamp')]
    if timeline_entries:
        timeline_entries.sort(key=lambda x: x.get('timestamp', ''))
        lines.append("h3. Event Timeline (condensed)")
        lines.append("||Time||Event||Severity||Node||")
        for evt in timeline_entries[:10]:
            ts = evt.get('timestamp', '-')
            name = evt.get('name', evt.get('pattern', '-'))
            sev = evt.get('severity', '-')
            node = evt.get('node', '-')
            lines.append(f"|{ts}|{name}|{sev}|{node}|")
        if len(timeline_entries) > 10:
            lines.append(f"_... and {len(timeline_entries) - 10} more events_")
        lines.append("")

    # Footer
    lines.append("----")
    lines.append("_Report generated by LogSherlock Pro v1.0_")
    lines.append(f"_Analysis time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}_")

    jira_text = '\n'.join(lines)

    return jsonify({
        'ticket_id': ticket_id,
        'jira_id': ticket.get('jira_id', ''),
        'format': 'jira_wiki',
        'generated_at': datetime.utcnow().isoformat() + 'Z',
        'content': jira_text,
        'findings_count': len(findings),
        'char_count': len(jira_text),
    })


@reports_bp.route('/api/reports/<ticket_id>/markdown', methods=['GET'])
def generate_markdown_report(ticket_id):
    """Generate a Markdown-formatted report."""
    try:
        from .tickets import _tickets, _findings_cache
    except ImportError:
        return jsonify({'error': 'Tickets module not available'}), 500

    ticket = _tickets.get(ticket_id)
    if not ticket:
        return jsonify({'error': 'Ticket not found'}), 404

    findings = _findings_cache.get(ticket_id, ticket.get('findings', []))

    lines = []
    lines.append(f"# RCA Report: {ticket.get('title', 'Untitled')}")
    lines.append(f"")
    lines.append(f"**Ticket ID:** {ticket_id}")
    if ticket.get('jira_id'):
        lines.append(f"**JIRA:** {ticket['jira_id']}")
    lines.append(f"**Generated:** {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
    lines.append(f"**Status:** {ticket.get('status', 'open')}")
    lines.append(f"")

    # Summary
    lines.append(f"## Summary")
    summary = ticket.get('analysis_summary', f"Found {len(findings)} issues in uploaded logs.")
    lines.append(summary)
    lines.append(f"")

    # Root Cause
    lines.append(f"## Root Cause")
    root_cause = ticket.get('root_cause', 'See findings below.')
    lines.append(root_cause)
    lines.append(f"")

    # Findings table
    if findings:
        lines.append(f"## Findings ({len(findings)})")
        lines.append(f"")
        lines.append(f"| # | Severity | Name | Description | Action |")
        lines.append(f"|---|----------|------|-------------|--------|")
        for i, f in enumerate(findings[:20], 1):
            sev = f.get('severity', 'INFO')
            name = f.get('name', '-')
            desc = f.get('description', '-')[:60]
            action = f.get('solution_hint', f.get('solution', '-'))[:60]
            lines.append(f"| {i} | {sev} | {name} | {desc} | {action} |")
        lines.append(f"")

    # Recommendations
    recommendations = ticket.get('recommendations', [])
    if recommendations:
        lines.append(f"## Recommendations")
        for i, rec in enumerate(recommendations[:8], 1):
            if isinstance(rec, dict):
                lines.append(f"{i}. {rec.get('action', str(rec))}")
            else:
                lines.append(f"{i}. {rec}")
        lines.append(f"")

    lines.append(f"---")
    lines.append(f"*Generated by LogSherlock Pro v1.0*")

    md_text = '\n'.join(lines)

    return jsonify({
        'ticket_id': ticket_id,
        'format': 'markdown',
        'generated_at': datetime.utcnow().isoformat() + 'Z',
        'content': md_text,
        'char_count': len(md_text),
    })
