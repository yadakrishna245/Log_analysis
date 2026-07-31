"""Knowledge base routes for LogSherlock Pro."""

from flask import Blueprint, request, jsonify
from models import db, KnowledgeEntry
from knowledge.known_issues import KNOWN_ISSUES
from knowledge.runbooks import RUNBOOKS

knowledge_bp = Blueprint('knowledge', __name__)


@knowledge_bp.route('/api/knowledge/search', methods=['GET'])
def search_knowledge():
    """Search the knowledge base by query string."""
    query = request.args.get('q', '').strip().lower()
    if not query:
        return jsonify({'error': 'Query parameter "q" is required'}), 400

    # Search database entries
    db_results = KnowledgeEntry.query.filter(
        db.or_(
            KnowledgeEntry.title.ilike(f'%{query}%'),
            KnowledgeEntry.symptoms.ilike(f'%{query}%'),
            KnowledgeEntry.root_cause.ilike(f'%{query}%'),
            KnowledgeEntry.solution.ilike(f'%{query}%'),
            KnowledgeEntry.category.ilike(f'%{query}%'),
            KnowledgeEntry.product.ilike(f'%{query}%'),
        )
    ).limit(20).all()

    # Also search in-memory known issues
    in_memory_results = []
    query_terms = query.split()
    for issue in KNOWN_ISSUES:
        score = 0
        searchable = ' '.join([
            issue.get('title', ''),
            issue.get('symptoms', ''),
            issue.get('root_cause', ''),
            issue.get('solution', ''),
            ' '.join(issue.get('products', [])),
        ]).lower()

        for term in query_terms:
            if term in searchable:
                score += 1

        if score > 0:
            in_memory_results.append({
                'source': 'known_issues',
                'score': score,
                'data': issue,
            })

    # Sort in-memory results by score
    in_memory_results.sort(key=lambda x: x['score'], reverse=True)

    # Search runbooks
    runbook_results = []
    for rb_key, rb_data in RUNBOOKS.items():
        searchable = ' '.join([
            rb_data.get('title', ''),
            rb_data.get('category', ''),
            ' '.join([step.get('description', '') + ' ' + step.get('pattern_to_find', '')
                      for step in rb_data.get('steps', [])]),
        ]).lower()

        score = sum(1 for term in query_terms if term in searchable)
        if score > 0:
            runbook_results.append({
                'source': 'runbooks',
                'score': score,
                'key': rb_key,
                'title': rb_data['title'],
                'category': rb_data['category'],
            })

    runbook_results.sort(key=lambda x: x['score'], reverse=True)

    return jsonify({
        'query': query,
        'results': {
            'knowledge_entries': [e.to_dict() for e in db_results],
            'known_issues': [r['data'] for r in in_memory_results[:10]],
            'runbooks': runbook_results[:5],
        },
        'total_results': len(db_results) + len(in_memory_results) + len(runbook_results),
    })


@knowledge_bp.route('/api/knowledge/issues', methods=['GET'])
def get_known_issues():
    """Get all known issues, optionally filtered by product."""
    product = request.args.get('product', '').strip().lower()

    if product:
        filtered = [
            issue for issue in KNOWN_ISSUES
            if product in [p.lower() for p in issue.get('products', [])]
        ]
    else:
        filtered = KNOWN_ISSUES

    return jsonify({
        'issues': filtered,
        'total': len(filtered),
    })


@knowledge_bp.route('/api/knowledge/runbooks', methods=['GET'])
def get_runbooks():
    """Get all available runbooks."""
    runbook_list = []
    for key, rb in RUNBOOKS.items():
        runbook_list.append({
            'key': key,
            'title': rb['title'],
            'category': rb['category'],
            'steps_count': len(rb['steps']),
        })

    return jsonify({
        'runbooks': runbook_list,
        'total': len(runbook_list),
    })


@knowledge_bp.route('/api/knowledge/runbooks/<category>', methods=['GET'])
def get_runbook(category):
    """Get a specific runbook by category/key."""
    if category in RUNBOOKS:
        return jsonify(RUNBOOKS[category])

    # Try to find by category field
    for key, rb in RUNBOOKS.items():
        if rb.get('category') == category:
            return jsonify(rb)

    return jsonify({'error': f'Runbook "{category}" not found'}), 404
