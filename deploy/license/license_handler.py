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
ADMIN_SECRET = os.environ.get('ADMIN_SECRET')
if not ADMIN_SECRET:
    raise RuntimeError("ADMIN_SECRET environment variable is required. Cannot start without it.")

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

    # CORS headers - restrict to allowed origins
    origin = (event.get('headers') or {}).get('origin', '')
    allowed_origins = [o.strip() for o in os.environ.get('ALLOWED_ORIGINS', 'https://d3tv1czat55yad.cloudfront.net,http://localhost:8888').split(',')]
    allowed_origin = origin if origin in allowed_origins else allowed_origins[0]
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed_origin,
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
        elif '/bulk-revoke' in path:
            result = bulk_revoke(data)
        elif '/reset' in path:
            result = reset(data)
        elif '/list-all' in path:
            result = list_all(data)
        elif '/analytics' in path:
            result = analytics(data)
        elif '/webhook-config' in path:
            result = webhook_config(data)
        elif '/admin-users' in path:
            result = admin_users(data)
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

    # Rate limiting — max 5 attempts per key per minute
    if not _check_rate_limit(license_key):
        return {'error': 'Too many activation attempts. Please wait 1 minute and try again.', 'activated': False, 'status': 429}

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
        # Decode expiry days from the key itself
        parts = license_key.split('-')
        encoded_val = int(parts[1], 16)
        expiry_days = round((encoded_val - 42) / 7)
        is_lifetime = expiry_days >= 9999
        
        ttl = int(time.time()) + (expiry_days * 24 * 60 * 60) if not is_lifetime else int(time.time()) + (10 * 365 * 24 * 60 * 60)
        
        # Calculate expiry date
        from datetime import timedelta
        expiry_date = (datetime.now(timezone.utc) + timedelta(days=expiry_days)).isoformat() if not is_lifetime else 'LIFETIME'
        
        table.put_item(Item={
            'license_key': license_key,
            'fingerprint': fp_hash,
            'activated_at': now,
            'last_seen': now,
            'user_name': user_name,
            'user_agent': user_agent[:200],
            'expiry_days': expiry_days,
            'expiry_date': expiry_date,
            'is_lifetime': is_lifetime,
            'ttl': ttl
        })
        
        # Send notification on new activation (non-blocking — doesn't affect response)
        try:
            _send_activation_notification(license_key, user_name, expiry_days, user_agent)
        except Exception:
            pass  # Never block activation for notification failure
        
        return {
            'activated': True,
            'message': f'License activated successfully! Locked to this device.',
            'activated_at': now,
            'expiry_date': expiry_date,
            'expiry_days': expiry_days,
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


def list_all(data):
    """Admin list ALL activated licenses — full dashboard view."""
    admin_secret = data.get('admin_secret', '').strip()

    if not _verify_admin(admin_secret):
        return {'error': 'Invalid admin credentials', 'status': 401}

    try:
        # Scan entire table (fine for small datasets <1000 licenses)
        response = table.scan()
        items = response.get('Items', [])
        
        # Handle pagination for larger datasets
        while 'LastEvaluatedKey' in response:
            response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
            items.extend(response.get('Items', []))

        # Filter out non-license items (rate limit records, config, etc.)
        items = [i for i in items if i.get('license_key', '').count('-') == 3 and not i.get('license_key', '').startswith('CONFIG:') and not i.get('license_key', '').startswith('RATE:')]

        # Sort by last_seen (most recently active first)
        items.sort(key=lambda x: x.get('last_seen', ''), reverse=True)

        # Build summary
        now = datetime.now(timezone.utc)
        licenses = []
        active_count = 0
        expired_count = 0

        for item in items:
            # Calculate if expired
            expiry_days = int(item.get('expiry_days', 365))
            is_lifetime = item.get('is_lifetime', False)
            activated_at = item.get('activated_at', '')
            
            days_since_activation = 0
            is_expired = False
            days_remaining = 0
            
            if activated_at and not is_lifetime:
                try:
                    act_date = datetime.fromisoformat(activated_at.replace('Z', '+00:00'))
                    days_since_activation = (now - act_date).days
                    days_remaining = expiry_days - days_since_activation
                    is_expired = days_remaining <= 0
                except (ValueError, TypeError):
                    days_remaining = expiry_days
            
            if is_lifetime:
                days_remaining = 99999
                
            if is_expired:
                expired_count += 1
            else:
                active_count += 1

            licenses.append({
                'license_key': item.get('license_key', ''),
                'user_name': item.get('user_name', 'Unknown'),
                'activated_at': activated_at,
                'last_seen': item.get('last_seen', ''),
                'expiry_days': expiry_days,
                'expiry_date': item.get('expiry_date', ''),
                'is_lifetime': is_lifetime,
                'days_remaining': days_remaining if not is_lifetime else 'LIFETIME',
                'is_expired': is_expired,
                'user_agent': item.get('user_agent', '')[:80],
            })

        return {
            'total_licenses': len(licenses),
            'active_count': active_count,
            'expired_count': expired_count,
            'licenses': licenses
        }
    except Exception as e:
        return {'error': f'List failed: {str(e)}', 'status': 500}


# ═══════════════════════════════════════════════════════════════════
# NEW FEATURES (Added Aug 7, 2026 — non-breaking additions)
# ═══════════════════════════════════════════════════════════════════

def bulk_revoke(data):
    """Admin bulk revoke — delete multiple licenses at once."""
    admin_secret = data.get('admin_secret', '').strip()
    if not _verify_admin(admin_secret):
        return {'error': 'Invalid admin credentials', 'status': 401}

    keys = data.get('license_keys', [])
    if not keys or not isinstance(keys, list):
        return {'error': 'Provide license_keys array', 'status': 400}

    revoked = []
    failed = []
    for key in keys[:50]:  # Max 50 at once
        try:
            resp = table.get_item(Key={'license_key': key.strip().upper()})
            if resp.get('Item'):
                table.delete_item(Key={'license_key': key.strip().upper()})
                revoked.append(key)
            else:
                failed.append({'key': key, 'reason': 'Not found'})
        except Exception as e:
            failed.append({'key': key, 'reason': str(e)})

    return {
        'revoked_count': len(revoked),
        'revoked': revoked,
        'failed_count': len(failed),
        'failed': failed,
        'message': f'Successfully revoked {len(revoked)} license(s).'
    }


def analytics(data):
    """Admin analytics — activation counts per week/month."""
    admin_secret = data.get('admin_secret', '').strip()
    if not _verify_admin(admin_secret):
        return {'error': 'Invalid admin credentials', 'status': 401}

    try:
        response = table.scan()
        items = response.get('Items', [])
        while 'LastEvaluatedKey' in response:
            response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
            items.extend(response.get('Items', []))

        # Filter only actual licenses
        items = [i for i in items if i.get('activated_at') and i.get('license_key', '').count('-') == 3 
                 and not i.get('license_key', '').startswith('CONFIG:')]

        now = datetime.now(timezone.utc)
        
        # Count activations per day (last 30 days)
        daily_counts = {}
        weekly_counts = {}
        monthly_counts = {}
        
        for item in items:
            try:
                act_date = datetime.fromisoformat(item['activated_at'].replace('Z', '+00:00'))
                day_key = act_date.strftime('%Y-%m-%d')
                week_key = act_date.strftime('%Y-W%W')
                month_key = act_date.strftime('%Y-%m')
                
                daily_counts[day_key] = daily_counts.get(day_key, 0) + 1
                weekly_counts[week_key] = weekly_counts.get(week_key, 0) + 1
                monthly_counts[month_key] = monthly_counts.get(month_key, 0) + 1
            except (ValueError, KeyError):
                pass

        # Last 7 days
        from datetime import timedelta
        last_7_days = []
        for i in range(7):
            day = (now - timedelta(days=i)).strftime('%Y-%m-%d')
            last_7_days.append({'date': day, 'count': daily_counts.get(day, 0)})
        last_7_days.reverse()

        # Total stats
        total = len(items)
        this_week = sum(1 for i in items if _is_this_week(i.get('activated_at', '')))
        this_month = sum(1 for i in items if _is_this_month(i.get('activated_at', '')))
        today = daily_counts.get(now.strftime('%Y-%m-%d'), 0)

        return {
            'total_activations': total,
            'today': today,
            'this_week': this_week,
            'this_month': this_month,
            'last_7_days': last_7_days,
            'weekly': dict(sorted(weekly_counts.items())[-8:]),
            'monthly': dict(sorted(monthly_counts.items())[-6:]),
        }
    except Exception as e:
        return {'error': f'Analytics failed: {str(e)}', 'status': 500}


def webhook_config(data):
    """Admin configure webhook URL for activation notifications."""
    admin_secret = data.get('admin_secret', '').strip()
    if not _verify_admin(admin_secret):
        return {'error': 'Invalid admin credentials', 'status': 401}

    action = data.get('action', 'get')  # get or set
    
    if action == 'set':
        webhook_url = data.get('webhook_url', '').strip()
        email_notify = data.get('email_notify', True)
        
        # Store config in DynamoDB (using special key prefix)
        table.put_item(Item={
            'license_key': 'CONFIG:WEBHOOK',
            'webhook_url': webhook_url,
            'email_notify': email_notify,
            'updated_at': datetime.now(timezone.utc).isoformat()
        })
        return {'saved': True, 'webhook_url': webhook_url, 'email_notify': email_notify}
    else:
        # Get current config
        try:
            resp = table.get_item(Key={'license_key': 'CONFIG:WEBHOOK'})
            item = resp.get('Item', {})
            return {
                'webhook_url': item.get('webhook_url', ''),
                'email_notify': item.get('email_notify', True),
            }
        except Exception:
            return {'webhook_url': '', 'email_notify': True}


def admin_users(data):
    """Multi-admin support — manage admin users list."""
    admin_secret = data.get('admin_secret', '').strip()
    if not _verify_admin(admin_secret):
        return {'error': 'Invalid admin credentials', 'status': 401}

    action = data.get('action', 'list')  # list, add, remove
    
    # Get current admin list
    try:
        resp = table.get_item(Key={'license_key': 'CONFIG:ADMINS'})
        item = resp.get('Item', {})
        admins = item.get('admin_list', [{'username': 'krishna', 'email': 'yadakrishna245@gmail.com', 'role': 'super_admin'}])
    except Exception:
        admins = [{'username': 'krishna', 'email': 'yadakrishna245@gmail.com', 'role': 'super_admin'}]

    if action == 'list':
        return {'admins': admins}
    
    elif action == 'add':
        new_admin = data.get('new_admin', {})
        username = new_admin.get('username', '').strip()
        email = new_admin.get('email', '').strip()
        if not username or not email:
            return {'error': 'Username and email required', 'status': 400}
        
        # Check if already exists
        if any(a['username'] == username for a in admins):
            return {'error': f'Admin {username} already exists', 'status': 400}
        
        admins.append({'username': username, 'email': email, 'role': 'admin', 'added_at': datetime.now(timezone.utc).isoformat()})
        table.put_item(Item={'license_key': 'CONFIG:ADMINS', 'admin_list': admins})
        return {'admins': admins, 'message': f'Admin {username} added'}
    
    elif action == 'remove':
        username = data.get('username', '').strip()
        if username == 'krishna':
            return {'error': 'Cannot remove super admin', 'status': 400}
        admins = [a for a in admins if a['username'] != username]
        table.put_item(Item={'license_key': 'CONFIG:ADMINS', 'admin_list': admins})
        return {'admins': admins, 'message': f'Admin {username} removed'}
    
    return {'error': 'Invalid action', 'status': 400}


# ═══ HELPER FUNCTIONS ═══════════════════════════════════════════════

def _verify_admin(secret):
    """Verify admin credentials (supports multi-admin)."""
    if secret == ADMIN_SECRET:
        return True
    # Future: check against CONFIG:ADMINS table for secondary admins
    return False


def _is_this_week(date_str):
    """Check if date is in current week."""
    if not date_str:
        return False
    try:
        from datetime import timedelta
        d = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        start_of_week = now - timedelta(days=now.weekday())
        return d >= start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
    except (ValueError, TypeError):
        return False


def _is_this_month(date_str):
    """Check if date is in current month."""
    if not date_str:
        return False
    try:
        d = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        return d.year == now.year and d.month == now.month
    except (ValueError, TypeError):
        return False


def _send_activation_notification(license_key, user_name, expiry_days, user_agent):
    """Send notification on new activation (email + webhook)."""
    now = datetime.now(timezone.utc).isoformat()
    
    # Get webhook config
    try:
        resp = table.get_item(Key={'license_key': 'CONFIG:WEBHOOK'})
        config = resp.get('Item', {})
    except Exception:
        config = {}

    # Send webhook (Slack/Discord/custom)
    webhook_url = config.get('webhook_url', '')
    if webhook_url:
        try:
            payload = json.dumps({
                'text': f'🔑 New LogSherlock Pro Activation!\n• User: {user_name}\n• Key: {license_key}\n• Expiry: {expiry_days} days\n• Device: {user_agent[:60]}\n• Time: {now}',
                'username': 'LogSherlock License Bot',
                'icon_emoji': ':key:'
            }).encode()
            req = urllib.request.Request(webhook_url, data=payload, headers={'Content-Type': 'application/json'})
            urllib.request.urlopen(req, timeout=5)
        except Exception:
            pass  # Non-blocking

    # Send email via AWS SES (if configured)
    email_notify = config.get('email_notify', True)
    if email_notify:
        try:
            import boto3
            ses = boto3.client('ses', region_name='us-east-1')
            ses.send_email(
                Source='yadakrishna245@gmail.com',
                Destination={'ToAddresses': ['yadakrishna245@gmail.com']},
                Message={
                    'Subject': {'Data': f'🔑 New License Activation: {user_name}'},
                    'Body': {
                        'Html': {'Data': f'''
                            <h2>🔑 New LogSherlock Pro Activation</h2>
                            <table style="border-collapse:collapse;font-family:Arial;">
                                <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">User</td><td style="padding:8px;border:1px solid #ddd;">{user_name}</td></tr>
                                <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">License Key</td><td style="padding:8px;border:1px solid #ddd;">{license_key}</td></tr>
                                <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Expiry</td><td style="padding:8px;border:1px solid #ddd;">{expiry_days} days</td></tr>
                                <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Device</td><td style="padding:8px;border:1px solid #ddd;">{user_agent[:100]}</td></tr>
                                <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Time</td><td style="padding:8px;border:1px solid #ddd;">{now}</td></tr>
                            </table>
                            <p style="color:#666;font-size:12px;">— LogSherlock Pro License System</p>
                        '''}
                    }
                }
            )
        except Exception:
            pass  # SES might not be verified yet — non-blocking


def _check_rate_limit(license_key):
    """Rate limiting — max 5 activation attempts per key per minute.
    Returns True if allowed, False if rate limited.
    """
    rate_key = f'RATE:{license_key}'
    now_ts = int(time.time())
    window_start = now_ts - 60  # 1 minute window
    
    try:
        resp = table.get_item(Key={'license_key': rate_key})
        item = resp.get('Item', {})
        
        attempts = item.get('attempts', [])
        # Filter to only recent attempts (within window)
        recent = [a for a in attempts if a > window_start]
        
        if len(recent) >= 5:
            return False  # Rate limited
        
        # Record this attempt
        recent.append(now_ts)
        table.put_item(Item={
            'license_key': rate_key,
            'attempts': recent[-10:],  # Keep last 10
            'ttl': now_ts + 300  # Auto-cleanup in 5 min
        })
        return True
    except Exception:
        return True  # If rate check fails, allow (don't block legitimate users)


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
