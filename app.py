"""LogSherlock Pro - Main Flask Application."""

import os
import click
from flask import Flask, send_from_directory, jsonify, render_template, request
from config import Config
from models import db


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

    app.register_blueprint(tickets_bp)
    app.register_blueprint(knowledge_bp)
    app.register_blueprint(analysis_bp)

    # Create database tables
    with app.app_context():
        db.create_all()

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
            response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;"
        return response

    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'app': 'LogSherlock Pro',
            'version': '1.0.0',
        })

    # Serve frontend UI
    @app.route('/')
    def serve_frontend():
        return render_template('index.html')

    @app.route('/<path:path>')
    def serve_static_files(path):
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
