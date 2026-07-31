"""AWS Lambda handler for LogSherlock Pro.

Uses a lightweight WSGI-to-Lambda adapter for Flask on AWS Lambda + API Gateway v2.
Configures DynamoDB as the storage backend for serverless mode.
"""

import os
import sys
import json
import base64
from io import BytesIO
from urllib.parse import urlencode, unquote

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

from app import create_app

# Create Flask app
flask_app = create_app()

# Initialize database tables for SQLite
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


def _make_environ(event):
    """Convert API Gateway v2 event to WSGI environ dict."""
    request_context = event.get('requestContext', {})
    http_context = request_context.get('http', {})
    
    method = http_context.get('method', 'GET')
    path = event.get('rawPath', '/')
    query_string = event.get('rawQueryString', '')
    headers = event.get('headers', {})
    
    # Handle body
    body = event.get('body', '') or ''
    is_base64 = event.get('isBase64Encoded', False)
    if is_base64 and body:
        body = base64.b64decode(body)
    elif isinstance(body, str):
        body = body.encode('utf-8')
    
    environ = {
        'REQUEST_METHOD': method,
        'SCRIPT_NAME': '',
        'PATH_INFO': unquote(path),
        'QUERY_STRING': query_string,
        'SERVER_NAME': headers.get('host', 'localhost'),
        'SERVER_PORT': headers.get('x-forwarded-port', '443'),
        'SERVER_PROTOCOL': 'HTTP/1.1',
        'wsgi.version': (1, 0),
        'wsgi.url_scheme': headers.get('x-forwarded-proto', 'https'),
        'wsgi.input': BytesIO(body),
        'wsgi.errors': sys.stderr,
        'wsgi.multithread': False,
        'wsgi.multiprocess': False,
        'wsgi.run_once': False,
        'CONTENT_LENGTH': str(len(body)),
        'REMOTE_ADDR': http_context.get('sourceIp', '127.0.0.1'),
    }
    
    # Content-Type
    content_type = headers.get('content-type', '')
    if content_type:
        environ['CONTENT_TYPE'] = content_type
    
    # Add HTTP headers
    for key, value in headers.items():
        wsgi_key = 'HTTP_' + key.upper().replace('-', '_')
        environ[wsgi_key] = value
    
    return environ


def handler(event, context):
    """Lambda entry point — routes API Gateway v2 events to Flask."""
    _seed_dynamodb()
    
    environ = _make_environ(event)
    
    # Collect response
    response_started = []
    response_body = []
    
    def start_response(status, response_headers, exc_info=None):
        response_started.append((status, response_headers))
    
    # Call Flask WSGI app
    result = flask_app(environ, start_response)
    
    # Collect body
    try:
        for chunk in result:
            if chunk:
                response_body.append(chunk)
    finally:
        if hasattr(result, 'close'):
            result.close()
    
    # Build Lambda response
    status_code = int(response_started[0][0].split(' ')[0])
    headers_dict = dict(response_started[0][1])
    
    body = b''.join(response_body)
    
    # Check if response should be base64 encoded
    content_type = headers_dict.get('Content-Type', '')
    is_binary = not content_type.startswith(('text/', 'application/json', 'application/xml'))
    
    response = {
        'statusCode': status_code,
        'headers': headers_dict,
        'body': base64.b64encode(body).decode('utf-8') if is_binary else body.decode('utf-8'),
        'isBase64Encoded': is_binary,
    }
    
    return response
