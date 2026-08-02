"""LogSherlock Pro - Main Flask Application."""

import os
import logging
import click
from flask import Flask, send_from_directory, jsonify, render_template, request
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

    app.register_blueprint(tickets_bp)
    app.register_blueprint(knowledge_bp)
    app.register_blueprint(analysis_bp)
    app.register_blueprint(feedback_bp)

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

    # Security headers
    @app.after_request
    def add_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        if not app.config.get('DEBUG'):
            response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;"
        return response

    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'app': 'LogSherlock Pro',
            'version': '1.0.0',
        })

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
