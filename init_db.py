"""Initialize LogSherlock Pro database with patterns, known issues, and runbooks."""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import db, Pattern, KnowledgeEntry
from engine.patterns import BUILT_IN_PATTERNS
from knowledge.known_issues import KNOWN_ISSUES
from knowledge.runbooks import RUNBOOKS


def init_database():
    """Initialize database with all seed data."""
    app = create_app()

    with app.app_context():
        # Create all tables
        db.create_all()
        print('[+] Database tables created.')

        # Insert patterns
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

        db.session.commit()
        print(f'[+] Patterns loaded: {patterns_added} new (total: {Pattern.query.count()})')

        # Insert known issues as knowledge entries
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
        print(f'[+] Known issues loaded: {knowledge_added} new (total: {KnowledgeEntry.query.count()})')

        # Store runbook metadata as knowledge entries
        runbook_added = 0
        for rb_key, rb_data in RUNBOOKS.items():
            rb_title = f"Runbook: {rb_data['title']}"
            if rb_title not in existing_knowledge:
                steps_summary = '\n'.join([
                    f"Step {i+1}: {step['description']}"
                    for i, step in enumerate(rb_data.get('steps', []))
                ])
                entry = KnowledgeEntry(
                    title=rb_title,
                    category='runbook',
                    product=rb_data.get('category', ''),
                    symptoms=steps_summary,
                    root_cause=f"Investigation runbook for {rb_data['category']} issues",
                    solution=f"Follow the {len(rb_data.get('steps', []))}-step investigation procedure",
                    prevention='Proactive monitoring and regular health checks',
                    related_tickets=rb_key,
                )
                db.session.add(entry)
                runbook_added += 1

        db.session.commit()
        print(f'[+] Runbooks loaded: {runbook_added} new')

        # Print summary
        print('\n' + '=' * 50)
        print('LogSherlock Pro - Database Initialization Complete')
        print('=' * 50)
        print(f'  Total Patterns:          {Pattern.query.count()}')
        print(f'  Total Knowledge Entries:  {KnowledgeEntry.query.count()}')
        print(f'  Runbooks Available:       {len(RUNBOOKS)}')
        print(f'  Database:                 {app.config["SQLALCHEMY_DATABASE_URI"]}')
        print('=' * 50)


if __name__ == '__main__':
    init_database()
