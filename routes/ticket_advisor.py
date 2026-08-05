"""Ticket Advisor API route for LogSherlock Pro.

Provides a fast, NO-AI-REQUIRED endpoint that analyzes Jira ticket descriptions
and returns structured L4 troubleshooting responses ready to paste as comments.

Endpoint:
    POST /api/ticket/advisor
    Body: { "description": "...", "ticket_key": "MORPHL4-77", "summary": "..." }
    Returns: Structured response with root_cause, action_plan, safety_notes,
             next_steps, matched_issues, and formatted_reply text.
"""

from flask import Blueprint, request, jsonify
from engine.ticket_advisor import get_advisor

ticket_advisor_bp = Blueprint('ticket_advisor', __name__)


@ticket_advisor_bp.route('/api/ticket/advisor', methods=['POST'])
def analyze_ticket():
    """Analyze a ticket description and generate a structured L4 response.

    No Ollama needed — uses pattern matching + known issues + runbooks.
    Response time: <100ms for most tickets.
    """
    data = request.get_json() or {}
    description = data.get('description', '').strip()
    ticket_key = data.get('ticket_key', '').strip()
    summary = data.get('summary', '').strip()

    if not description:
        return jsonify({'error': 'description is required'}), 400

    advisor = get_advisor()
    result = advisor.analyze(
        description=description,
        ticket_key=ticket_key,
        summary=summary,
    )

    return jsonify(result)


@ticket_advisor_bp.route('/api/ticket/advisor/health', methods=['GET'])
def advisor_health():
    """Quick health check for the ticket advisor engine."""
    advisor = get_advisor()
    return jsonify({
        'status': 'ready',
        'known_issues_loaded': len(advisor.known_issues),
        'patterns_loaded': len(advisor.patterns),
        'runbooks_loaded': len(advisor.runbooks),
    })
