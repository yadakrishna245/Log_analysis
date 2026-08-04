"""SQLAlchemy models for LogSherlock Pro."""

from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Ticket(db.Model):
    """Support ticket tracking model."""
    __tablename__ = 'tickets'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    jira_id = db.Column(db.String(50), unique=True, nullable=True, index=True)
    title = db.Column(db.String(500), nullable=False)
    description = db.Column(db.Text, nullable=True)
    product = db.Column(db.String(100), nullable=True, index=True)
    status = db.Column(db.String(50), default='open', index=True)
    severity = db.Column(db.String(20), default='MEDIUM', index=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))
    findings_count = db.Column(db.Integer, default=0)
    resolution = db.Column(db.Text, nullable=True)

    # Relationships
    log_files = db.relationship('LogFile', backref='ticket', lazy='dynamic', cascade='all, delete-orphan')
    findings = db.relationship('Finding', backref='ticket', lazy='dynamic', cascade='all, delete-orphan')

    __table_args__ = (
        db.Index('idx_ticket_product_status', 'product', 'status'),
        db.Index('idx_ticket_severity_created', 'severity', 'created_at'),
        db.Index('idx_ticket_status_created', 'status', 'created_at'),
    )

    def to_dict(self, include_findings=False):
        result = {
            'id': self.id,
            'jira_id': self.jira_id,
            'title': self.title,
            'description': self.description,
            'product': self.product,
            'status': self.status,
            'severity': self.severity,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'findings_count': self.findings_count,
            'resolution': self.resolution,
            'log_files_count': self.log_files.count(),
        }
        if include_findings:
            result['findings'] = [f.to_dict() for f in self.findings.order_by(Finding.severity.desc()).all()]
            result['log_files'] = [lf.to_dict() for lf in self.log_files.all()]
        return result


class LogFile(db.Model):
    """Tracked log file for a ticket."""
    __tablename__ = 'log_files'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id', ondelete='CASCADE'), nullable=False, index=True)
    filename = db.Column(db.String(500), nullable=False)
    filepath = db.Column(db.String(1000), nullable=False)
    file_type = db.Column(db.String(50), nullable=True, index=True)
    file_size = db.Column(db.BigInteger, default=0)
    node_name = db.Column(db.String(200), nullable=True, index=True)
    parsed = db.Column(db.Boolean, default=False)
    line_count = db.Column(db.Integer, default=0)

    # Relationships
    findings = db.relationship('Finding', backref='log_file', lazy='dynamic', cascade='all, delete-orphan')

    __table_args__ = (
        db.Index('idx_logfile_ticket_type', 'ticket_id', 'file_type'),
        db.Index('idx_logfile_ticket_node', 'ticket_id', 'node_name'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'ticket_id': self.ticket_id,
            'filename': self.filename,
            'filepath': self.filepath,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'node_name': self.node_name,
            'parsed': self.parsed,
            'line_count': self.line_count,
            'findings_count': self.findings.count(),
        }


class Finding(db.Model):
    """An issue/pattern match found in a log file."""
    __tablename__ = 'findings'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id', ondelete='CASCADE'), nullable=False, index=True)
    logfile_id = db.Column(db.Integer, db.ForeignKey('log_files.id', ondelete='CASCADE'), nullable=True, index=True)
    pattern_name = db.Column(db.String(200), nullable=False, index=True)
    severity = db.Column(db.String(20), nullable=False, index=True)
    line_number = db.Column(db.Integer, nullable=True)
    line_content = db.Column(db.Text, nullable=True)
    context_before = db.Column(db.Text, nullable=True)
    context_after = db.Column(db.Text, nullable=True)
    description = db.Column(db.Text, nullable=True)
    solution_hint = db.Column(db.Text, nullable=True)
    category = db.Column(db.String(100), nullable=True, index=True)
    confidence = db.Column(db.Float, default=1.0)

    __table_args__ = (
        db.Index('idx_finding_ticket_severity', 'ticket_id', 'severity'),
        db.Index('idx_finding_ticket_category', 'ticket_id', 'category'),
        db.Index('idx_finding_pattern_severity', 'pattern_name', 'severity'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'ticket_id': self.ticket_id,
            'logfile_id': self.logfile_id,
            'pattern_name': self.pattern_name,
            'severity': self.severity,
            'line_number': self.line_number,
            'line_content': self.line_content,
            'context_before': self.context_before,
            'context_after': self.context_after,
            'description': self.description,
            'solution_hint': self.solution_hint,
            'category': self.category,
            'confidence': self.confidence,
        }


class Pattern(db.Model):
    """Reusable detection pattern stored in the database."""
    __tablename__ = 'patterns'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(200), unique=True, nullable=False, index=True)
    regex = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(20), nullable=False, index=True)
    category = db.Column(db.String(100), nullable=True, index=True)
    description = db.Column(db.Text, nullable=True)
    solution_hint = db.Column(db.Text, nullable=True)
    product = db.Column(db.String(100), nullable=True, index=True)
    times_matched = db.Column(db.Integer, default=0)

    __table_args__ = (
        db.Index('idx_pattern_category_product', 'category', 'product'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'regex': self.regex,
            'severity': self.severity,
            'category': self.category,
            'description': self.description,
            'solution_hint': self.solution_hint,
            'product': self.product,
            'times_matched': self.times_matched,
        }


class KnowledgeEntry(db.Model):
    """Knowledge base entry for known issues and solutions."""
    __tablename__ = 'knowledge_entries'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(500), nullable=False, index=True)
    category = db.Column(db.String(100), nullable=True, index=True)
    product = db.Column(db.String(100), nullable=True, index=True)
    symptoms = db.Column(db.Text, nullable=True)
    root_cause = db.Column(db.Text, nullable=True)
    solution = db.Column(db.Text, nullable=True)
    prevention = db.Column(db.Text, nullable=True)
    related_tickets = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.Index('idx_knowledge_category_product', 'category', 'product'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'category': self.category,
            'product': self.product,
            'symptoms': self.symptoms,
            'root_cause': self.root_cause,
            'solution': self.solution,
            'prevention': self.prevention,
            'related_tickets': self.related_tickets,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Suppression(db.Model):
    """Pattern suppression / false positive mute.

    When engineers identify a false positive, they can suppress a pattern
    globally or per-ticket so it doesn't fire again.
    """
    __tablename__ = 'suppressions'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    pattern_name = db.Column(db.String(200), nullable=False, index=True)
    scope = db.Column(db.String(50), default='global', index=True)  # 'global' or 'ticket'
    ticket_id = db.Column(db.Integer, nullable=True, index=True)  # If scope='ticket'
    reason = db.Column(db.Text, nullable=True)
    suppressed_by = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = db.Column(db.DateTime, nullable=True)  # Optional expiry
    active = db.Column(db.Boolean, default=True, index=True)

    __table_args__ = (
        db.Index('idx_suppression_pattern_scope', 'pattern_name', 'scope', 'active'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'pattern_name': self.pattern_name,
            'scope': self.scope,
            'ticket_id': self.ticket_id,
            'reason': self.reason,
            'suppressed_by': self.suppressed_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'active': self.active,
        }



class AnalyticsEvent(db.Model):
    """Usage analytics tracking — who's using what features and for how long."""
    __tablename__ = 'analytics_events'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.String(64), nullable=False, index=True)  # Browser fingerprint hash
    username = db.Column(db.String(100), nullable=True)  # Optional display name
    event_type = db.Column(db.String(50), nullable=False, index=True)  # page_view, scan, ai_chat, comment_reply, jira_fetch
    event_data = db.Column(db.Text, nullable=True)  # JSON extra data
    duration_seconds = db.Column(db.Integer, nullable=True)  # Time spent (for sessions)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    __table_args__ = (
        db.Index('idx_analytics_user_date', 'user_id', 'created_at'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'username': self.username,
            'event_type': self.event_type,
            'event_data': self.event_data,
            'duration_seconds': self.duration_seconds,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
