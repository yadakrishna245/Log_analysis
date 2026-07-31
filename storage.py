"""Storage abstraction for LogSherlock Pro.

Auto-selects between SQLAlchemy/SQLite (local) and DynamoDB (serverless)
based on the STORAGE_BACKEND environment variable.

Usage:
    from storage import storage
    
    # Create ticket
    ticket = storage.create_ticket(title='...', description='...')
    
    # List tickets
    result = storage.list_tickets(page=1, per_page=25)
    
    # Get findings
    findings = storage.get_findings(ticket_id='123')
"""

import os

BACKEND = os.environ.get('STORAGE_BACKEND', 'sqlite').lower()


class SQLiteStorage:
    """SQLAlchemy/SQLite storage backend (local development)."""

    def create_ticket(self, title, description='', product='', severity='MEDIUM', jira_id=None):
        from models import db, Ticket
        from datetime import datetime, timezone
        ticket = Ticket(
            jira_id=jira_id,
            title=title,
            description=description,
            product=product or 'N/A',
            status='open',
            severity=severity,
        )
        db.session.add(ticket)
        db.session.commit()
        return ticket.to_dict()

    def get_ticket(self, ticket_id):
        from models import Ticket
        ticket = Ticket.query.get(int(ticket_id))
        return ticket.to_dict(include_findings=True) if ticket else None

    def list_tickets(self, status='', product='', severity='', search='', page=1, per_page=25):
        from models import db, Ticket
        query = Ticket.query
        if search:
            query = query.filter(
                db.or_(Ticket.title.ilike(f'%{search}%'), Ticket.description.ilike(f'%{search}%'))
            )
        if product:
            query = query.filter(Ticket.product == product)
        if status:
            query = query.filter(Ticket.status == status)
        if severity:
            query = query.filter(Ticket.severity == severity)
        query = query.order_by(Ticket.created_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        return {
            'tickets': [t.to_dict() for t in pagination.items],
            'total': pagination.total,
            'page': pagination.page,
            'per_page': per_page,
            'pages': pagination.pages,
            'has_next': pagination.has_next,
            'has_prev': pagination.has_prev,
        }

    def update_ticket(self, ticket_id, **kwargs):
        from models import db, Ticket
        from datetime import datetime, timezone
        ticket = Ticket.query.get(int(ticket_id))
        if not ticket:
            return None
        for key, value in kwargs.items():
            if hasattr(ticket, key):
                setattr(ticket, key, value)
        ticket.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        return ticket.to_dict()

    def delete_ticket(self, ticket_id):
        from models import db, Ticket
        ticket = Ticket.query.get(int(ticket_id))
        if ticket:
            db.session.delete(ticket)
            db.session.commit()

    def add_finding(self, ticket_id, pattern_name, severity, line_number=0,
                    line_content='', description='', solution_hint='',
                    category='', confidence=1.0, file_path=''):
        from models import db, Finding
        finding = Finding(
            ticket_id=int(ticket_id),
            pattern_name=pattern_name,
            severity=severity,
            line_number=line_number,
            line_content=line_content,
            description=description,
            solution_hint=solution_hint,
            category=category,
            confidence=confidence,
        )
        db.session.add(finding)
        db.session.commit()
        return finding.to_dict()

    def get_findings(self, ticket_id, severity='', category='', page=1, per_page=50):
        from models import Finding
        query = Finding.query.filter_by(ticket_id=int(ticket_id))
        if severity:
            query = query.filter(Finding.severity == severity)
        if category:
            query = query.filter(Finding.category == category)
        query = query.order_by(Finding.severity.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        return {
            'findings': [f.to_dict() for f in pagination.items],
            'total': pagination.total,
            'page': pagination.page,
            'per_page': per_page,
        }

    def delete_findings_for_ticket(self, ticket_id):
        from models import db, Finding
        Finding.query.filter_by(ticket_id=int(ticket_id)).delete()
        db.session.commit()

    def batch_add_findings(self, ticket_id, findings):
        from models import db, Finding
        for f in findings:
            finding = Finding(
                ticket_id=int(ticket_id),
                pattern_name=f.get('pattern_name', ''),
                severity=f.get('severity', 'INFO'),
                line_number=f.get('line_number', 0),
                line_content=f.get('line_content', ''),
                description=f.get('description', ''),
                solution_hint=f.get('solution_hint', ''),
                category=f.get('category', ''),
                confidence=f.get('confidence', 1.0),
            )
            db.session.add(finding)
        db.session.commit()

    def get_stats(self):
        from models import db, Ticket, Finding, Pattern, LogFile
        from sqlalchemy import func
        total_tickets = Ticket.query.count()
        open_tickets = Ticket.query.filter_by(status='open').count()
        analyzed_tickets = Ticket.query.filter_by(status='analyzed').count()
        total_findings = Finding.query.count()
        total_log_files = LogFile.query.count()
        return {
            'overview': {
                'total_tickets': total_tickets,
                'open_tickets': open_tickets,
                'analyzed_tickets': analyzed_tickets,
                'total_findings': total_findings,
                'total_log_files': total_log_files,
            },
            'severity_distribution': {},
            'category_distribution': {},
            'product_distribution': {},
            'top_patterns': [],
            'recent_tickets': [],
            'daily_activity': [],
        }

    def search_knowledge(self, query):
        from models import KnowledgeEntry, db
        results = KnowledgeEntry.query.filter(
            db.or_(
                KnowledgeEntry.title.ilike(f'%{query}%'),
                KnowledgeEntry.symptoms.ilike(f'%{query}%'),
                KnowledgeEntry.root_cause.ilike(f'%{query}%'),
            )
        ).limit(20).all()
        return [e.to_dict() for e in results]


class DynamoDBStorage:
    """DynamoDB storage backend (serverless/Lambda)."""

    def create_ticket(self, title, description='', product='', severity='MEDIUM', jira_id=None):
        from db_dynamo import create_ticket
        return create_ticket(title, description, product, severity, jira_id)

    def get_ticket(self, ticket_id):
        from db_dynamo import get_ticket
        return get_ticket(str(ticket_id))

    def list_tickets(self, status='', product='', severity='', search='', page=1, per_page=25):
        from db_dynamo import list_tickets
        return list_tickets(status, product, severity, search, page, per_page)

    def update_ticket(self, ticket_id, **kwargs):
        from db_dynamo import update_ticket
        return update_ticket(str(ticket_id), **kwargs)

    def delete_ticket(self, ticket_id):
        from db_dynamo import delete_ticket
        delete_ticket(str(ticket_id))

    def add_finding(self, ticket_id, pattern_name, severity, line_number=0,
                    line_content='', description='', solution_hint='',
                    category='', confidence=1.0, file_path=''):
        from db_dynamo import add_finding
        return add_finding(str(ticket_id), pattern_name, severity, line_number,
                           line_content, description, solution_hint, category,
                           confidence, file_path)

    def get_findings(self, ticket_id, severity='', category='', page=1, per_page=50):
        from db_dynamo import get_findings
        return get_findings(str(ticket_id), severity, category, page, per_page)

    def delete_findings_for_ticket(self, ticket_id):
        from db_dynamo import delete_findings_for_ticket
        delete_findings_for_ticket(str(ticket_id))

    def batch_add_findings(self, ticket_id, findings):
        from db_dynamo import batch_add_findings
        batch_add_findings(str(ticket_id), findings)

    def get_stats(self):
        from db_dynamo import get_stats
        return get_stats()

    def search_knowledge(self, query):
        from db_dynamo import search_knowledge
        return search_knowledge(query)


# Auto-select backend
if BACKEND == 'dynamodb':
    storage = DynamoDBStorage()
else:
    storage = SQLiteStorage()
