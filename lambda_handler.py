"""AWS Lambda handler for LogSherlock Pro.

Uses Mangum to adapt Flask/WSGI to AWS Lambda + API Gateway.
Configures DynamoDB as the storage backend for serverless mode.
"""

import os
import sys

# Configure environment for Lambda
os.environ.setdefault('FLASK_ENV', 'production')
os.environ.setdefault('STORAGE_BACKEND', 'dynamodb')
os.environ.setdefault('UPLOAD_FOLDER', '/tmp/uploads')
os.environ.setdefault('LOG_DIR', '/tmp/logs')
os.environ.setdefault('LOGSHERLOCK_DEV_MODE', 'false')

# For SQLite fallback (quick analysis still uses /tmp)
os.environ.setdefault('DATABASE_URL', 'sqlite:////tmp/logsherlock.db')

# Ensure /tmp directories exist
os.makedirs('/tmp/uploads', exist_ok=True)
os.makedirs('/tmp/logs', exist_ok=True)

from mangum import Mangum
from app import create_app

# Create Flask app
flask_app = create_app()

# Initialize database tables for SQLite (used as local cache for quick analysis)
with flask_app.app_context():
    from models import db
    db.create_all()

# Seed DynamoDB with patterns and knowledge on first cold start
_seeded = False


def _seed_dynamodb():
    """Seed DynamoDB tables with patterns and known issues (idempotent)."""
    global _seeded
    if _seeded:
        return
    try:
        from db_dynamo import seed_patterns, seed_knowledge
        from engine.patterns import BUILT_IN_PATTERNS
        from knowledge.known_issues import KNOWN_ISSUES

        seed_patterns(BUILT_IN_PATTERNS)
        seed_knowledge(KNOWN_ISSUES)
        _seeded = True
    except Exception as e:
        print(f"[WARN] DynamoDB seed failed (tables may not exist yet): {e}")
        _seeded = True  # Don't retry on every request


def handler(event, context):
    """Lambda entry point."""
    _seed_dynamodb()
    mangum_handler = Mangum(flask_app, lifespan='off')
    return mangum_handler(event, context)
