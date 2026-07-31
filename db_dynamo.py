"""DynamoDB data layer for LogSherlock Pro (serverless mode).

Provides the same interface as SQLAlchemy models but uses DynamoDB.
Used when STORAGE_BACKEND=dynamodb (Lambda deployment).
"""

import os
import uuid
import time
from datetime import datetime, timezone
from typing import List, Dict, Optional

import boto3
from boto3.dynamodb.conditions import Key, Attr

# Table name prefix (from env or default)
TABLE_PREFIX = os.environ.get('DYNAMODB_TABLE_PREFIX', 'LogSherlock')

# DynamoDB resource
_dynamodb = None


def get_dynamodb():
    """Get DynamoDB resource (lazy init)."""
    global _dynamodb
    if _dynamodb is None:
        region = os.environ.get('AWS_REGION', 'us-east-1')
        _dynamodb = boto3.resource('dynamodb', region_name=region)
    return _dynamodb


def get_table(name: str):
    """Get a DynamoDB table by short name."""
    return get_dynamodb().Table(f'{TABLE_PREFIX}-{name}')


# ─── Tickets ───────────────────────────────────────────────────────────────

def create_ticket(title: str, description: str = '', product: str = '',
                  severity: str = 'MEDIUM', jira_id: str = None) -> Dict:
    """Create a new ticket."""
    table = get_table('Tickets')
    ticket_id = str(int(time.time() * 1000))  # Millisecond timestamp as ID
    now = datetime.now(timezone.utc).isoformat()

    item = {
        'id': ticket_id,
        'title': title,
        'description': description,
        'product': product or 'N/A',
        'severity': severity,
        'status': 'open',
        'jira_id': jira_id or '',
        'findings_count': 0,
        'resolution': '',
        'created_at': now,
        'updated_at': now,
    }
    table.put_item(Item=item)
    return item


def get_ticket(ticket_id: str) -> Optional[Dict]:
    """Get a ticket by ID."""
    table = get_table('Tickets')
    response = table.get_item(Key={'id': str(ticket_id)})
    return response.get('Item')


def list_tickets(status: str = '', product: str = '', severity: str = '',
                 search: str = '', page: int = 1, per_page: int = 25) -> Dict:
    """List tickets with optional filters."""
    table = get_table('Tickets')

    # Scan with filters (for small datasets this is fine)
    filter_expr = None
    if status:
        filter_expr = Attr('status').eq(status)
    if product:
        expr = Attr('product').eq(product)
        filter_expr = filter_expr & expr if filter_expr else expr
    if severity:
        expr = Attr('severity').eq(severity)
        filter_expr = filter_expr & expr if filter_expr else expr
    if search:
        expr = Attr('title').contains(search) | Attr('description').contains(search)
        filter_expr = filter_expr & expr if filter_expr else expr

    scan_kwargs = {}
    if filter_expr:
        scan_kwargs['FilterExpression'] = filter_expr

    response = table.scan(**scan_kwargs)
    items = response.get('Items', [])

    # Sort by created_at desc
    items.sort(key=lambda x: x.get('created_at', ''), reverse=True)

    # Paginate
    total = len(items)
    start = (page - 1) * per_page
    end = start + per_page

    return {
        'tickets': items[start:end],
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page,
        'has_next': end < total,
        'has_prev': page > 1,
    }


def update_ticket(ticket_id: str, **kwargs) -> Optional[Dict]:
    """Update a ticket."""
    table = get_table('Tickets')
    kwargs['updated_at'] = datetime.now(timezone.utc).isoformat()

    update_parts = []
    expr_values = {}
    expr_names = {}
    for i, (key, value) in enumerate(kwargs.items()):
        alias = f'#k{i}'
        val_alias = f':v{i}'
        update_parts.append(f'{alias} = {val_alias}')
        expr_names[alias] = key
        expr_values[val_alias] = value

    response = table.update_item(
        Key={'id': str(ticket_id)},
        UpdateExpression='SET ' + ', '.join(update_parts),
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values,
        ReturnValues='ALL_NEW',
    )
    return response.get('Attributes')


def delete_ticket(ticket_id: str):
    """Delete a ticket and its findings."""
    table = get_table('Tickets')
    table.delete_item(Key={'id': str(ticket_id)})
    # Also delete findings for this ticket
    delete_findings_for_ticket(ticket_id)


# ─── Findings ──────────────────────────────────────────────────────────────

def add_finding(ticket_id: str, pattern_name: str, severity: str,
                line_number: int = 0, line_content: str = '',
                description: str = '', solution_hint: str = '',
                category: str = '', confidence: float = 1.0,
                file_path: str = '') -> Dict:
    """Add a finding for a ticket."""
    table = get_table('Findings')
    finding_id = str(uuid.uuid4())[:12]

    item = {
        'ticket_id': str(ticket_id),
        'id': finding_id,
        'pattern_name': pattern_name,
        'severity': severity,
        'line_number': int(line_number),
        'line_content': line_content[:2000],  # DynamoDB 400KB item limit
        'description': description,
        'solution_hint': solution_hint,
        'category': category,
        'confidence': str(confidence),
        'file': file_path,
        'created_at': datetime.now(timezone.utc).isoformat(),
    }
    table.put_item(Item=item)
    return item


def get_findings(ticket_id: str, severity: str = '', category: str = '',
                 page: int = 1, per_page: int = 50) -> Dict:
    """Get findings for a ticket."""
    table = get_table('Findings')

    response = table.query(
        KeyConditionExpression=Key('ticket_id').eq(str(ticket_id))
    )
    items = response.get('Items', [])

    # Apply filters
    if severity:
        items = [i for i in items if i.get('severity') == severity]
    if category:
        items = [i for i in items if i.get('category') == category]

    # Sort by severity
    sev_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3, 'INFO': 4}
    items.sort(key=lambda x: sev_order.get(x.get('severity', 'INFO'), 5))

    total = len(items)
    start = (page - 1) * per_page
    end = start + per_page

    return {
        'findings': items[start:end],
        'total': total,
        'page': page,
        'per_page': per_page,
    }


def delete_findings_for_ticket(ticket_id: str):
    """Delete all findings for a ticket."""
    table = get_table('Findings')
    response = table.query(
        KeyConditionExpression=Key('ticket_id').eq(str(ticket_id))
    )
    with table.batch_writer() as batch:
        for item in response.get('Items', []):
            batch.delete_item(Key={
                'ticket_id': item['ticket_id'],
                'id': item['id'],
            })


def batch_add_findings(ticket_id: str, findings: List[Dict]):
    """Batch write findings for a ticket."""
    table = get_table('Findings')
    with table.batch_writer() as batch:
        for f in findings:
            item = {
                'ticket_id': str(ticket_id),
                'id': str(uuid.uuid4())[:12],
                'pattern_name': f.get('pattern_name', ''),
                'severity': f.get('severity', 'INFO'),
                'line_number': int(f.get('line_number', 0)),
                'line_content': f.get('line_content', '')[:2000],
                'description': f.get('description', ''),
                'solution_hint': f.get('solution_hint', ''),
                'category': f.get('category', ''),
                'confidence': str(f.get('confidence', 1.0)),
                'file': f.get('file', ''),
                'created_at': datetime.now(timezone.utc).isoformat(),
            }
            batch.put_item(Item=item)


# ─── Patterns ──────────────────────────────────────────────────────────────

def get_patterns() -> List[Dict]:
    """Get all patterns from DynamoDB."""
    table = get_table('Patterns')
    response = table.scan()
    return response.get('Items', [])


def seed_patterns(patterns: list):
    """Seed patterns into DynamoDB (idempotent)."""
    table = get_table('Patterns')

    # Check if already seeded
    response = table.scan(Limit=1)
    if response.get('Items'):
        return  # Already seeded

    with table.batch_writer() as batch:
        for p in patterns:
            batch.put_item(Item={
                'name': p.name,
                'regex': p.regex,
                'severity': p.severity,
                'category': p.category,
                'description': p.description,
                'solution_hint': p.solution_hint,
                'product': p.product,
                'times_matched': 0,
            })


# ─── Knowledge Entries ─────────────────────────────────────────────────────

def seed_knowledge(issues: list):
    """Seed known issues into DynamoDB (idempotent)."""
    table = get_table('Knowledge')

    response = table.scan(Limit=1)
    if response.get('Items'):
        return  # Already seeded

    with table.batch_writer() as batch:
        for issue in issues:
            batch.put_item(Item={
                'id': str(uuid.uuid4())[:12],
                'title': issue.get('title', ''),
                'category': 'known_issue',
                'product': ', '.join(issue.get('products', [])),
                'symptoms': issue.get('symptoms', ''),
                'root_cause': issue.get('root_cause', ''),
                'solution': issue.get('solution', ''),
                'prevention': issue.get('prevention', ''),
                'related_tickets': issue.get('affected_versions', ''),
            })


def search_knowledge(query: str) -> List[Dict]:
    """Search knowledge base entries."""
    table = get_table('Knowledge')
    response = table.scan()
    items = response.get('Items', [])

    if not query:
        return items[:20]

    # Simple text search
    query_lower = query.lower()
    terms = [t for t in query_lower.split() if len(t) > 3]
    scored = []
    for item in items:
        text = f"{item.get('title', '')} {item.get('symptoms', '')} {item.get('root_cause', '')} {item.get('solution', '')}".lower()
        score = sum(1 for t in terms if t in text)
        if score > 0:
            item['_score'] = score
            scored.append(item)

    scored.sort(key=lambda x: x.get('_score', 0), reverse=True)
    return scored[:20]


# ─── Stats ─────────────────────────────────────────────────────────────────

def get_stats() -> Dict:
    """Get dashboard statistics."""
    tickets_table = get_table('Tickets')
    findings_table = get_table('Findings')

    tickets_resp = tickets_table.scan(Select='COUNT')
    total_tickets = tickets_resp.get('Count', 0)

    # Count by status
    open_resp = tickets_table.scan(
        FilterExpression=Attr('status').eq('open'),
        Select='COUNT'
    )
    analyzed_resp = tickets_table.scan(
        FilterExpression=Attr('status').eq('analyzed'),
        Select='COUNT'
    )

    findings_resp = findings_table.scan(Select='COUNT')
    total_findings = findings_resp.get('Count', 0)

    return {
        'overview': {
            'total_tickets': total_tickets,
            'open_tickets': open_resp.get('Count', 0),
            'analyzed_tickets': analyzed_resp.get('Count', 0),
            'total_findings': total_findings,
            'total_log_files': 0,
        },
        'severity_distribution': {},
        'category_distribution': {},
        'product_distribution': {},
        'top_patterns': [],
        'recent_tickets': [],
        'daily_activity': [],
    }


# ─── S3 Upload Helpers ─────────────────────────────────────────────────────

_s3_client = None


def get_s3():
    """Get S3 client."""
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client('s3')
    return _s3_client


def upload_to_s3(local_path: str, ticket_id: str, filename: str) -> str:
    """Upload a file to S3 and return the S3 key."""
    bucket = os.environ.get('S3_BUCKET', '')
    if not bucket:
        return local_path  # Fallback to local

    s3_key = f'uploads/{ticket_id}/{filename}'
    get_s3().upload_file(local_path, bucket, s3_key)
    return s3_key


def download_from_s3(s3_key: str, local_path: str):
    """Download a file from S3."""
    bucket = os.environ.get('S3_BUCKET', '')
    if not bucket:
        return
    get_s3().download_file(bucket, s3_key, local_path)
