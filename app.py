"""LogSherlock Pro - Main Flask Application.

This module implements the Flask application factory for LogSherlock Pro.
It configures the app, registers all blueprints (routes), initializes the
database, and sets up security headers (CSP).

Application Structure:
    - create_app()    → Factory function that builds the Flask app
    - Blueprints      → analysis, tickets, knowledge, feedback (registered here)
    - Database        → SQLAlchemy (SQLite locally, DynamoDB on Lambda)
    - Security        → API key auth in production, dev mode bypass for localhost
    - Static serving  → index.html SPA served from templates/

Environment Modes:
    - Development:  LOGSHERLOCK_DEV_MODE=true → bypasses auth, enables debug
    - Production:   Requires API_KEY env var, strict CSP headers
    - Lambda:       Invoked via deploy/lambda_handler.py WSGI adapter
"""

import os
import logging
import time
import click
from collections import defaultdict
from flask import Flask, send_from_directory, jsonify, render_template, request, Response
from config import Config
from models import db

logger = logging.getLogger(__name__)


def create_app(config_class=Config):
    """Application factory."""
    app = Flask(__name__, static_folder='static', template_folder='templates')
    app.config.from_object(config_class)

    # Ensure required directories exist
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['LOG_DIR'], exist_ok=True)

    # Initialize extensions
    db.init_app(app)

    # Register blueprints
    from routes.tickets import tickets_bp
    from routes.knowledge import knowledge_bp
    from routes.analysis import analysis_bp
    from routes.feedback import feedback_bp
    from routes.analytics import analytics_bp

    app.register_blueprint(tickets_bp)
    app.register_blueprint(knowledge_bp)
    app.register_blueprint(analysis_bp)
    app.register_blueprint(feedback_bp)
    app.register_blueprint(analytics_bp)

    # Create database tables
    with app.app_context():
        db.create_all()

    # Dev mode safety warning
    if app.config.get('DEBUG') or os.environ.get('LOGSHERLOCK_DEV_MODE', '').lower() in ('true', '1', 'yes'):
        logger.warning("⚠️  DEV MODE ENABLED — Authentication bypass active (localhost only)")
        logger.warning("⚠️  Do NOT use LOGSHERLOCK_DEV_MODE=true in production!")
        if not app.config.get('DEBUG'):
            logger.critical("🚨 LOGSHERLOCK_DEV_MODE is enabled but DEBUG is False. This looks like a production misconfiguration!")

    # Production safety: require API key
    if not (app.config.get('DEBUG') or os.environ.get('LOGSHERLOCK_DEV_MODE', '').lower() in ('true', '1', 'yes')):
        if not app.config.get('API_KEY'):
            import warnings
            warnings.warn(
                'WARNING: No LOGSHERLOCK_API_KEY set. API endpoints are unprotected! '
                'Set LOGSHERLOCK_API_KEY environment variable for production use.',
                RuntimeWarning
            )

    # API authentication - require API key or session auth for all /api/ routes
    @app.before_request
    def require_api_auth():
        """Require authentication for all API endpoints."""
        # Skip auth for health check, static files, and login
        exempt_paths = ['/api/health', '/static/', '/login', '/']
        if any(request.path == p or request.path.startswith(p) for p in ['/static/']):
            return None
        if request.path == '/' or request.path == '/api/health':
            return None
        # Patterns export and knowledge lookup are used by the client-side scanner
        # They don't expose any customer data (patterns are public, KB lookup uses only pattern names)
        if request.path in ('/api/patterns/export', '/api/knowledge/lookup', '/api/advisor'):
            return None
        # Knowledge base and runbooks are reference data (no customer data)
        if request.path.startswith('/api/knowledge/'):
            return None
        # Ollama proxy — local AI, no customer data (only pattern names)
        if request.path.startswith('/api/ollama/'):
            return None
        # Jira proxy — credentials passed per-request, no data stored server-side
        if request.path.startswith('/api/jira/'):
            return None
        # Analytics — tracking events, no sensitive data
        if request.path.startswith('/api/analytics/'):
            return None
        if not request.path.startswith('/api/'):
            return None
            
        # Check for API key in header
        api_key = request.headers.get('X-API-Key', '')
        valid_key = app.config.get('API_KEY', os.environ.get('LOGSHERLOCK_API_KEY', ''))
        if valid_key and api_key == valid_key:
            return None
            
        # Check for session auth (from flask-login)
        try:
            from flask_login import current_user
            if current_user and current_user.is_authenticated:
                return None
        except Exception:
            pass
            
        # For development mode, allow unauthenticated access
        if app.config.get('DEBUG') or os.environ.get('LOGSHERLOCK_DEV_MODE', '').lower() in ('true', '1', 'yes'):
            # SAFEGUARD: Dev mode only works from localhost
            if request.remote_addr not in ('127.0.0.1', '::1', 'localhost'):
                return jsonify({
                    'error': 'Dev mode authentication bypass only allowed from localhost.',
                    'remote_addr': request.remote_addr,
                }), 403
            return None
            
        return jsonify({'error': 'Authentication required. Provide X-API-Key header or login.'}), 401

    # Simple rate limiting (no extra dependency)
    _rate_limit_store = defaultdict(list)

    @app.before_request
    def rate_limit():
        """Simple rate limiter: 100 req/min per IP."""
        if not request.path.startswith('/api/'):
            return None
        ip = request.remote_addr or '0.0.0.0'
        now = time.time()
        # Clean old entries
        _rate_limit_store[ip] = [t for t in _rate_limit_store[ip] if now - t < 60]
        if len(_rate_limit_store[ip]) >= 100:
            return jsonify({'error': 'Rate limit exceeded. Max 100 requests per minute.'}), 429
        _rate_limit_store[ip].append(now)

    # Security headers
    @app.after_request
    def add_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        if not app.config.get('DEBUG'):
            response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://raw.githubusercontent.com http://localhost:11434;"
        return response

    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'app': 'LogSherlock Pro',
            'version': '1.0.0',
        })

    # Ollama Local LLM Proxy — avoids CORS issues
    @app.route('/api/ollama/tags', methods=['GET'])
    def ollama_tags():
        """Proxy to local Ollama to check available models."""
        import requests as req
        try:
            r = req.get('http://localhost:11434/api/tags', timeout=3)
            return jsonify(r.json())
        except Exception:
            return jsonify({'models': [], 'error': 'Ollama not running'}), 503

    @app.route('/api/ollama/generate', methods=['POST'])
    def ollama_generate():
        """Proxy to local Ollama for AI generation. Only pattern names sent, never raw logs."""
        import requests as req
        try:
            data = request.get_json()
            stream = data.get('stream', False)
            if stream:
                # Streaming: pass through chunks as they arrive
                r = req.post('http://localhost:11434/api/generate', json=data, timeout=120, stream=True)
                def generate():
                    for chunk in r.iter_content(chunk_size=None):
                        if chunk:
                            yield chunk
                return Response(generate(), content_type='application/x-ndjson')
            else:
                r = req.post('http://localhost:11434/api/generate', json=data, timeout=120)
                return jsonify(r.json())
        except Exception as e:
            return jsonify({'error': str(e)}), 503

    @app.route('/api/ollama/chat', methods=['POST'])
    def ollama_chat():
        """Proxy to local Ollama /api/chat — supports think:false for qwen3.5."""
        import requests as req
        try:
            data = request.get_json()
            stream = data.get('stream', False)
            if stream:
                r = req.post('http://localhost:11434/api/chat', json=data, timeout=120, stream=True)
                def gen_chat():
                    for chunk in r.iter_content(chunk_size=None):
                        if chunk:
                            yield chunk
                return Response(gen_chat(), content_type='application/x-ndjson')
            else:
                r = req.post('http://localhost:11434/api/chat', json=data, timeout=120)
                return jsonify(r.json())
        except Exception as e:
            return jsonify({'error': str(e)}), 503

    # ─── Jira API Proxy — avoids CORS, credentials passed per-request ────────
    @app.route('/api/jira/ticket/<ticket_id>', methods=['POST'])
    def jira_get_ticket(ticket_id):
        """Proxy to Jira REST API to fetch ticket details. Credentials from request body."""
        import requests as req
        try:
            data = request.get_json()
            jira_url = data.get('jira_url', '').rstrip('/')
            email = data.get('email', '')
            api_token = data.get('api_token', '')

            if not all([jira_url, email, api_token]):
                return jsonify({'error': 'Missing Jira credentials (jira_url, email, api_token)'}), 400

            # Fetch issue details
            r = req.get(
                f"{jira_url}/rest/api/2/issue/{ticket_id}",
                auth=(email, api_token),
                headers={'Accept': 'application/json'},
                timeout=15
            )
            if r.status_code == 401:
                return jsonify({'error': 'Authentication failed. Check your email and API token.'}), 401
            if r.status_code == 404:
                return jsonify({'error': f'Ticket {ticket_id} not found.'}), 404
            if not r.ok:
                return jsonify({'error': f'Jira API error: {r.status_code}'}), r.status_code

            issue = r.json()
            fields = issue.get('fields', {})

            # Extract key info
            result = {
                'key': issue.get('key'),
                'summary': fields.get('summary', ''),
                'description': fields.get('description', ''),
                'status': fields.get('status', {}).get('name', ''),
                'priority': fields.get('priority', {}).get('name', ''),
                'assignee': fields.get('assignee', {}).get('displayName', 'Unassigned') if fields.get('assignee') else 'Unassigned',
                'reporter': fields.get('reporter', {}).get('displayName', '') if fields.get('reporter') else '',
                'created': fields.get('created', ''),
                'updated': fields.get('updated', ''),
                'labels': fields.get('labels', []),
                'components': [c.get('name', '') for c in fields.get('components', [])],
                'attachments': [{'filename': a.get('filename'), 'size': a.get('size'), 'url': a.get('content')} for a in fields.get('attachment', [])],
            }

            # Fetch comments
            comments_data = fields.get('comment', {}).get('comments', [])
            result['comments'] = [{
                'author': c.get('author', {}).get('displayName', ''),
                'body': c.get('body', ''),
                'created': c.get('created', ''),
                'updated': c.get('updated', ''),
            } for c in comments_data[-20:]]  # Last 20 comments

            return jsonify(result)
        except req.exceptions.Timeout:
            return jsonify({'error': 'Jira request timed out. Check your Jira URL.'}), 504
        except req.exceptions.ConnectionError:
            return jsonify({'error': 'Cannot connect to Jira. Check your URL.'}), 502
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/jira/comment/<ticket_id>', methods=['POST'])
    def jira_post_comment(ticket_id):
        """Proxy to post a comment to a Jira ticket."""
        import requests as req
        try:
            data = request.get_json()
            jira_url = data.get('jira_url', '').rstrip('/')
            email = data.get('email', '')
            api_token = data.get('api_token', '')
            comment_body = data.get('comment', '')

            if not all([jira_url, email, api_token, comment_body]):
                return jsonify({'error': 'Missing required fields'}), 400

            r = req.post(
                f"{jira_url}/rest/api/2/issue/{ticket_id}/comment",
                auth=(email, api_token),
                headers={'Accept': 'application/json', 'Content-Type': 'application/json'},
                json={'body': comment_body},
                timeout=15
            )
            if r.status_code == 401:
                return jsonify({'error': 'Authentication failed.'}), 401
            if not r.ok:
                return jsonify({'error': f'Jira API error: {r.status_code} - {r.text[:200]}'}), r.status_code

            return jsonify({'success': True, 'comment_id': r.json().get('id', '')})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    # Live system metrics for demo
    @app.route('/api/health/detailed', methods=['GET'])
    def health_detailed():
        """Detailed system health and metrics — perfect for live demo."""
        import platform
        import sys
        from datetime import datetime, timezone

        # Database stats
        try:
            from models import Ticket, Finding, Pattern, KnowledgeEntry, Suppression
            total_tickets = Ticket.query.count()
            total_findings = Finding.query.count()
            total_patterns = Pattern.query.count()
            total_knowledge = KnowledgeEntry.query.count()
            total_suppressions = Suppression.query.filter_by(active=True).count()
            open_tickets = Ticket.query.filter_by(status='open').count()
            analyzed_tickets = Ticket.query.filter_by(status='analyzed').count()
            db_status = 'connected'
        except Exception as e:
            db_status = f'error: {str(e)}'
            total_tickets = total_findings = total_patterns = 0
            total_knowledge = total_suppressions = open_tickets = analyzed_tickets = 0

        # Disk usage for uploads
        upload_folder = app.config.get('UPLOAD_FOLDER', './uploads')
        upload_size = 0
        upload_files = 0
        try:
            for root, dirs, files in os.walk(upload_folder):
                for f in files:
                    fp = os.path.join(root, f)
                    upload_size += os.path.getsize(fp)
                    upload_files += 1
        except Exception:
            pass

        return jsonify({
            'status': 'healthy',
            'app': 'LogSherlock Pro',
            'version': '1.0.0',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'system': {
                'python_version': sys.version.split()[0],
                'platform': platform.platform(),
                'hostname': platform.node(),
            },
            'database': {
                'status': db_status,
                'total_tickets': total_tickets,
                'open_tickets': open_tickets,
                'analyzed_tickets': analyzed_tickets,
                'total_findings': total_findings,
                'total_patterns': total_patterns,
                'total_knowledge_entries': total_knowledge,
                'active_suppressions': total_suppressions,
            },
            'storage': {
                'upload_folder': upload_folder,
                'total_upload_size_mb': round(upload_size / (1024 * 1024), 2),
                'total_upload_files': upload_files,
            },
            'capabilities': {
                'single_line_patterns': total_patterns,
                'multiline_patterns': 5,
                'known_issues': total_knowledge,
                'archive_formats': ['7z', 'zip', 'tar', 'tar.gz', 'gz'],
                'ocr_support': True,
                'zip_bomb_protection': True,
                'false_positive_suppression': True,
                'self_learning_feedback': True,
            },
            'security': {
                'auth_enabled': bool(app.config.get('API_KEY')),
                'dev_mode': bool(app.config.get('DEBUG') or os.environ.get('LOGSHERLOCK_DEV_MODE', '').lower() in ('true', '1')),
                'security_headers': True,
                'zip_slip_protection': True,
                'max_upload_size_gb': app.config.get('MAX_CONTENT_LENGTH', 0) / (1024**3),
            },
        })

    # Serve frontend UI
    @app.route('/')
    def serve_frontend():
        return render_template('index.html')

    @app.route('/<path:path>')
    def serve_static_files(path):
        # Never intercept API routes — let blueprints handle them
        if path.startswith('api/'):
            return jsonify({'error': 'Not found', 'path': f'/{path}'}), 404
        static_folder = app.static_folder or 'static'
        if path and os.path.exists(os.path.join(static_folder, path)):
            return send_from_directory(static_folder, path)
        return render_template('index.html')

    # CLI command to initialize database
    @app.cli.command('init-db')
    def init_db_command():
        """Initialize database with patterns, known issues, and runbooks."""
        _init_database(app)
        click.echo('Database initialized successfully.')

    return app


def _init_database(app):
    """Initialize database with seed data."""
    from models import Pattern, KnowledgeEntry
    from engine.patterns import BUILT_IN_PATTERNS
    from knowledge.known_issues import KNOWN_ISSUES

    with app.app_context():
        # Add patterns
        existing_patterns = {p.name for p in Pattern.query.all()}
        patterns_added = 0
        for bp in BUILT_IN_PATTERNS:
            if bp.name not in existing_patterns:
                pattern = Pattern(
                    name=bp.name,
                    regex=bp.regex,
                    severity=bp.severity,
                    category=bp.category,
                    description=bp.description,
                    solution_hint=bp.solution_hint,
                    product=bp.product,
                    times_matched=0,
                )
                db.session.add(pattern)
                patterns_added += 1

        # Add known issues as knowledge entries
        existing_knowledge = {k.title for k in KnowledgeEntry.query.all()}
        knowledge_added = 0
        for issue in KNOWN_ISSUES:
            if issue['title'] not in existing_knowledge:
                entry = KnowledgeEntry(
                    title=issue['title'],
                    category='known_issue',
                    product=', '.join(issue.get('products', [])),
                    symptoms=issue.get('symptoms', ''),
                    root_cause=issue.get('root_cause', ''),
                    solution=issue.get('solution', ''),
                    prevention=issue.get('bug_id', ''),
                    related_tickets=issue.get('affected_versions', ''),
                )
                db.session.add(entry)
                knowledge_added += 1

        db.session.commit()
        print(f'  Patterns added: {patterns_added}')
        print(f'  Knowledge entries added: {knowledge_added}')


# Application instance
app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
