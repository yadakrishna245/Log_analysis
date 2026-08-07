"""Ticket Advisor API route for LogSherlock Pro.

Provides fast, NO-AI-REQUIRED endpoints that analyze Jira ticket descriptions
and return structured L4 troubleshooting responses ready to paste as comments.

Endpoints:
    POST /api/ticket/advisor
    Body: { "description": "...", "ticket_key": "MORPHL4-77", "summary": "..." }
    Returns: Structured response with root_cause, action_plan, safety_notes,
             next_steps, matched_issues, and formatted_reply text.

    POST /api/ticket/advisor/chat
    Body: { "messages": [{"role": "user", "content": "..."}, ...] }
    Returns: Structured response from iterative conversation analysis.

    GET /api/ticket/advisor/health
    Returns: Engine readiness status and loaded resource counts.
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


@ticket_advisor_bp.route('/api/ticket/advisor/chat', methods=['POST'])
def chat_ticket():
    """Iterative conversation endpoint for multi-turn troubleshooting.

    Accepts conversation history and returns context-aware analysis.
    Uses pure pattern matching — no external AI calls.
    Response time: <100ms (typically <1ms).

    Body:
        {
            "messages": [
                {"role": "user", "content": "GFS2 withdraw on node2..."},
                {"role": "assistant", "content": "...previous response..."},
                {"role": "user", "content": "I ran the command, got this output..."}
            ]
        }

    Returns:
        Structured response with response_type, root_cause, action_plan
        (with risk_level per command), safety_notes, next_steps,
        formatted_reply, categories, matched_issues, and metadata.
    """
    data = request.get_json() or {}
    messages = data.get('messages')

    # Validate messages array exists and is a non-empty list
    if not messages or not isinstance(messages, list):
        return jsonify({'error': 'messages array is required and must not be empty'}), 400

    # Validate each message has required fields
    for i, msg in enumerate(messages):
        if not isinstance(msg, dict):
            return jsonify({'error': f'messages[{i}] must be an object'}), 400
        if 'role' not in msg or 'content' not in msg:
            return jsonify({'error': f'messages[{i}] must have "role" and "content" fields'}), 400
        if msg['role'] not in ('user', 'assistant'):
            return jsonify({'error': f'messages[{i}].role must be "user" or "assistant"'}), 400
        if not isinstance(msg['content'], str) or not msg['content'].strip():
            return jsonify({'error': f'messages[{i}].content must be a non-empty string'}), 400

    advisor = get_advisor()
    result = advisor.analyze_conversation(messages)

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
