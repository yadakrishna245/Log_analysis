"""
LogSherlock Pro - UI Blueprint
Serves the web interface pages.
"""

from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_user, logout_user, login_required, current_user

ui_bp = Blueprint('ui', __name__, template_folder='../templates')


@ui_bp.route('/')
def index():
    """Dashboard home page."""
    if not current_user.is_authenticated:
        return redirect(url_for('ui.login'))
    return render_template('dashboard.html')


@ui_bp.route('/login', methods=['GET', 'POST'])
def login():
    """Login page."""
    if current_user.is_authenticated:
        return redirect(url_for('ui.index'))

    if request.method == 'POST':
        from models import User
        import bcrypt

        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        user = User.query.filter_by(username=username, is_active=True).first()
        if user and bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
            login_user(user, remember=request.form.get('remember'))
            from datetime import datetime, timezone
            user.last_login = datetime.now(timezone.utc)
            from models import db
            db.session.commit()
            next_page = request.args.get('next')
            return redirect(next_page or url_for('ui.index'))
        else:
            flash('Invalid username or password', 'danger')

    return render_template('login.html')


@ui_bp.route('/logout')
@login_required
def logout():
    """Logout and redirect to login."""
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('ui.login'))


@ui_bp.route('/tickets')
@login_required
def tickets_page():
    """Tickets listing page."""
    return render_template('tickets.html')


@ui_bp.route('/tickets/<int:ticket_id>')
@login_required
def ticket_detail(ticket_id):
    """Single ticket detail page."""
    from models import Ticket
    ticket = Ticket.query.get_or_404(ticket_id)
    return render_template('ticket_detail.html', ticket=ticket)


@ui_bp.route('/analysis/<int:ticket_id>')
@login_required
def analysis_page(ticket_id):
    """Analysis results page for a ticket."""
    from models import Ticket
    ticket = Ticket.query.get_or_404(ticket_id)
    return render_template('analysis.html', ticket=ticket)


@ui_bp.route('/knowledge')
@login_required
def knowledge_page():
    """Knowledge base browsing page."""
    return render_template('knowledge.html')


@ui_bp.route('/patterns')
@login_required
def patterns_page():
    """Pattern management page."""
    return render_template('patterns.html')


@ui_bp.route('/reports')
@login_required
def reports_page():
    """Reports page."""
    return render_template('reports.html')


@ui_bp.route('/settings')
@login_required
def settings_page():
    """Application settings page."""
    return render_template('settings.html')
