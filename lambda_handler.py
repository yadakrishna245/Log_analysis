"""AWS Lambda handler for LogSherlock Pro.

Uses Mangum to adapt Flask/WSGI to AWS Lambda + API Gateway.
"""

import os
import sys

# Configure environment for Lambda
os.environ.setdefault('FLASK_ENV', 'production')
os.environ.setdefault('DATABASE_URL', 'sqlite:////tmp/logsherlock.db')
os.environ.setdefault('UPLOAD_FOLDER', '/tmp/uploads')
os.environ.setdefault('LOG_DIR', '/tmp/logs')
os.environ.setdefault('LOGSHERLOCK_DEV_MODE', 'false')

# Ensure /tmp directories exist
os.makedirs('/tmp/uploads', exist_ok=True)
os.makedirs('/tmp/logs', exist_ok=True)

from mangum import Mangum
from app import create_app

# Create Flask app
flask_app = create_app()

# Initialize database on cold start
with flask_app.app_context():
    from models import db
    db.create_all()
    
    # Seed patterns and knowledge base on first run
    from models import Pattern
    if Pattern.query.count() == 0:
        from app import _init_database
        _init_database(flask_app)

# Create Mangum handler
handler = Mangum(flask_app, lifespan='off')
