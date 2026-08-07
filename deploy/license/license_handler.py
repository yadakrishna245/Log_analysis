"""LogSherlock Pro — License Activation Service.

Per-machine license locking:
- First activation: registers machine fingerprint to license key
- Subsequent validations: only allows the SAME machine
- Admin reset: clears fingerprint to allow transfer

DynamoDB Schema (LogSherlock-Licenses):
  license_key (PK): str  — the license key
  fingerprint: str       — machine fingerprint hash
  activated_at: str      — ISO timestamp of first activation
  last_seen: str         — ISO timestamp of last validation
  user_name: str         — name entered during activation
  user_agent: str        — browser user-agent (for admin reference)
  ttl: int              — auto-expire (365 days from activation)
"""

import json
import os
import time
import hashlib
from datetime import datetime, timezone

import boto3

TABLE_NAME = os.environ.get('LICENSES_TABLE', 'LogSherlock-Licenses')
ADMIN_SECRET = os.environ.get('ADMIN_SECRET', 'LSPRO2026KRISHNA')

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)


def handler(event, context):
    """Route based on path."""
    path = event.get('rawPath', '') or event.get('path', '')
    method = event.get('requestContext', {}).get('http', {}).get('method', 'POST')
    
    # Parse body
    body = event.get('body', '{}')
    if event.get('isBase64Encoded'):
        import base64
        body = base64.b64decode(body).decode()
    
    try:
        data = json.loads(body) if body else {}
    except (json.JSONDecodeError, TypeError):
        data = {}

    # CORS headers
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }

    # OPTIONS preflight
    if method == 'OPTIONS':
        return {'statusCode': 204, 'headers': headers, 'body': ''}

    try:
        if '/activate' in path:
            result = activate(data)
        elif '/validate' in path:
            result = validate(data)
        elif '/reset' in path:
            result = reset(data)
        elif '/status' in path:
            result = status(data)
        else:
            result = {'error': 'Unknown endpoint', 'status': 404}

        status_code = result.pop('status', 200)
        return {
            'statusCode': status_code,
            'headers': headers,
            'body': json.dumps(result)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': f'Internal error: {str(e)}', 'activated': False})
        }


def activate(data):
    """Activate a license key on a machine.
    
    First time: registers fingerprint → success
    Same machine: allows → success  
    Different machine: BLOCKS → error
    """
    license_key = data.get('license_key', '').strip().upper()
    fingerprint = data.get('fingerprint', '').strip()
    user_name = data.get('user_name', '').strip()
    user_agent = data.get('user_agent', '')

    if not license_key or not fingerprint:
        return {'error': 'Missing license_key or fingerprint', 'activated': False, 'status': 400}

    if len(fingerprint) < 8:
        return {'error': 'Invalid fingerprint', 'activated': False, 'status': 400}

    # Validate the license key format (same algorithm as client-side)
    if not validate_key_format(license_key):
        return {'error': 'Invalid license key format', 'activated': False, 'status': 400}

    # Hash the fingerprint for privacy (we don't store raw hardware info)
    fp_hash = hashlib.sha256(fingerprint.encode()).hexdigest()[:32]

    # Check if already activated
    try:
        resp = table.get_item(Key={'license_key': license_key})
    except Exception:
        resp = {}

    existing = resp.get('Item')
    now = datetime.now(timezone.utc).isoformat()

    if existing:
        # Already activated — check if same machine
        if existing['fingerprint'] == fp_hash:
            # Same machine — update last_seen and allow
            table.update_item(
                Key={'license_key': license_key},
                UpdateExpression='SET last_seen = :ls',
                ExpressionAttributeValues={':ls': now}
            )
            return {
                'activated': True,
                'message': 'License validated — welcome back!',
                'activated_at': existing.get('activated_at', ''),
                'user_name': existing.get('user_name', '')
            }
        else:
            # Different machine — BLOCK
            return {
                'activated': False,
                'error': 'This license key is already activated on another device.',
                'message': 'Each license works on ONE machine only. Contact admin to transfer.',
                'activated_at': existing.get('activated_at', ''),
                'status': 403
            }
    else:
        # First activation — register this machine
        ttl = int(time.time()) + (365 * 24 * 60 * 60)  # 1 year TTL
        table.put_item(Item={
            'license_key': license_key,
            'fingerprint': fp_hash,
            'activated_at': now,
            'last_seen': now,
            'user_name': user_name,
            'user_agent': user_agent[:200],
            'ttl': ttl
        })
        return {
            'activated': True,
            'message': f'License activated successfully! Locked to this device.',
            'activated_at': now,
            'first_activation': True
        }


def validate(data):
    """Quick validation — check if key+fingerprint match (lightweight)."""
    license_key = data.get('license_key', '').strip().upper()
    fingerprint = data.get('fingerprint', '').strip()

    if not license_key or not fingerprint:
        return {'valid': False, 'error': 'Missing fields', 'status': 400}

    fp_hash = hashlib.sha256(fingerprint.encode()).hexdigest()[:32]

    try:
        resp = table.get_item(Key={'license_key': license_key})
    except Exception:
        return {'valid': False, 'error': 'Database error', 'status': 500}

    existing = resp.get('Item')
    if not existing:
        return {'valid': False, 'error': 'License not activated', 'status': 404}

    if existing['fingerprint'] == fp_hash:
        # Update last_seen
        now = datetime.now(timezone.utc).isoformat()
        table.update_item(
            Key={'license_key': license_key},
            UpdateExpression='SET last_seen = :ls',
            ExpressionAttributeValues={':ls': now}
        )
        return {'valid': True, 'user_name': existing.get('user_name', '')}
    else:
        return {'valid': False, 'error': 'License is locked to a different device', 'status': 403}


def reset(data):
    """Admin reset — clears fingerprint to allow transfer to new machine."""
    license_key = data.get('license_key', '').strip().upper()
    admin_secret = data.get('admin_secret', '').strip()

    if admin_secret != ADMIN_SECRET:
        return {'error': 'Invalid admin credentials', 'status': 401}

    if not license_key:
        return {'error': 'Missing license_key', 'status': 400}

    try:
        resp = table.get_item(Key={'license_key': license_key})
        existing = resp.get('Item')
        if not existing:
            return {'error': 'License not found', 'status': 404}

        # Delete the record — next activation will be fresh
        table.delete_item(Key={'license_key': license_key})
        return {
            'reset': True,
            'message': f'License {license_key} has been reset. It can now be activated on a new device.',
            'previous_user': existing.get('user_name', 'Unknown'),
            'was_activated_at': existing.get('activated_at', '')
        }
    except Exception as e:
        return {'error': f'Reset failed: {str(e)}', 'status': 500}


def status(data):
    """Admin status check — see activation details for a key."""
    license_key = data.get('license_key', '').strip().upper()
    admin_secret = data.get('admin_secret', '').strip()

    if admin_secret != ADMIN_SECRET:
        return {'error': 'Invalid admin credentials', 'status': 401}

    if not license_key:
        return {'error': 'Missing license_key', 'status': 400}

    try:
        resp = table.get_item(Key={'license_key': license_key})
        existing = resp.get('Item')
        if not existing:
            return {'activated': False, 'message': 'License not yet activated'}

        return {
            'activated': True,
            'license_key': license_key,
            'user_name': existing.get('user_name', ''),
            'activated_at': existing.get('activated_at', ''),
            'last_seen': existing.get('last_seen', ''),
            'user_agent': existing.get('user_agent', '')[:50]
        }
    except Exception as e:
        return {'error': str(e), 'status': 500}


def validate_key_format(key):
    """Validate license key using same algorithm as client-side.
    
    Format: XXXX-DDDD-SSSS-CCXX
    Parts[0] = random prefix (4 chars)
    Parts[1] = hex encoded days: (days * 7) + 42
    Parts[2] = MD5 signature of days + secret (4 chars)
    Parts[3] = XOR checksum (2 chars) + random suffix (2 chars)
    """
    parts = key.split('-')
    if len(parts) != 4:
        return False
    if not all(len(p) == 4 for p in parts):
        return False
    
    try:
        # Step 1: Decode days from parts[1]
        val = int(parts[1], 16)
        days = (val - 42) / 7
        if days <= 0 or days > 10000:  # Max ~27 years (9999 = lifetime)
            return False
        
        # Step 2: Verify XOR checksum (first 2 chars of parts[3])
        # XOR all chars of parts[0] + parts[1] + parts[2]
        all_chars = parts[0] + parts[1] + parts[2]
        xor_val = 0
        for ch in all_chars:
            xor_val ^= ord(ch)
        
        expected_checksum = format(xor_val, '02X').upper()
        actual_checksum = parts[3][:2].upper()
        
        if expected_checksum != actual_checksum:
            return False
        
        return True
    except (ValueError, ZeroDivisionError, IndexError):
        return False
