"""Analytics routes for LogSherlock Pro — usage tracking dashboard."""

import json
import os
import requests as http_requests
from datetime import datetime, timezone, timedelta
from flask import Blueprint, jsonify, request
from sqlalchemy import func, distinct
from models import db, AnalyticsEvent

analytics_bp = Blueprint('analytics', __name__)


@analytics_bp.route('/api/access-ping', methods=['POST'])
def access_ping():
    """Deployment integrity check — logs access to private GitHub repo."""
    try:
        data = request.get_json() or {}
        gh_token = os.environ.get('GH_MONITOR_TOKEN', '')
        if not gh_token:
            return jsonify({'ok': True}), 200  # Silent fail if not configured

        payload = {
            'event_type': 'access_ping',
            'client_payload': {
                'domain': data.get('domain', 'unknown'),
                'user_name': data.get('user_name', 'unknown'),
                'timestamp': data.get('timestamp', ''),
                'user_agent': data.get('user_agent', '')[:120],
                'page_url': data.get('page_url', '')
            }
        }
        http_requests.post(
            'https://api.github.com/repos/yadakrishna245/HPE-log_analysis_app-monitor/dispatches',
            headers={
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': f'token {gh_token}'
            },
            json=payload,
            timeout=3
        )
    except Exception:
        pass  # Never fail the user experience
    return jsonify({'ok': True}), 200


@analytics_bp.route('/api/license/validate', methods=['POST'])
def validate_license():
    """Validate a license key against the private monitor repo."""
    try:
        data = request.get_json() or {}
        license_key = data.get('key', '').strip()
        domain = data.get('domain', '').strip()

        if not license_key:
            return jsonify({'valid': False, 'reason': 'No key provided'}), 200

        gh_token = os.environ.get('GH_MONITOR_TOKEN', '')
        if not gh_token:
            # If no token configured, allow (graceful degradation)
            return jsonify({'valid': True, 'reason': 'License server not configured'}), 200

        # Fetch licenses.json from private repo
        resp = http_requests.get(
            'https://api.github.com/repos/yadakrishna245/HPE-log_analysis_app-monitor/contents/licenses.json',
            headers={
                'Accept': 'application/vnd.github.v3.raw',
                'Authorization': f'token {gh_token}'
            },
            timeout=5
        )

        if resp.status_code != 200:
            # Can't reach license server — allow with warning
            return jsonify({'valid': True, 'reason': 'License server unreachable', 'grace': True}), 200

        licenses_data = resp.json()
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')

        for lic in licenses_data.get('licenses', []):
            if lic['key'] == license_key and lic.get('active', False):
                # Check domain match (master keys work on any domain)
                if lic.get('type') == 'master' or lic.get('domain', '') == domain or lic.get('domain', '') == '*':
                    # Check expiry
                    if lic.get('expires_at', '2099-12-31') >= today:
                        return jsonify({
                            'valid': True,
                            'issued_to': lic.get('issued_to', ''),
                            'expires_at': lic.get('expires_at', ''),
                            'type': lic.get('type', 'standard')
                        }), 200
                    else:
                        return jsonify({'valid': False, 'reason': 'License expired'}), 200
                else:
                    return jsonify({'valid': False, 'reason': 'License not valid for this domain'}), 200

        return jsonify({'valid': False, 'reason': 'Invalid license key'}), 200

    except Exception as e:
        # On error, allow with grace period
        return jsonify({'valid': True, 'reason': 'Validation error', 'grace': True}), 200


@analytics_bp.route('/api/analytics/track', methods=['POST'])
def track_event():
    """Track a usage event. Called from frontend on user actions."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data'}), 400

    user_id = data.get('user_id', 'anonymous')
    event_type = data.get('event_type', 'unknown')

    if not event_type or event_type == 'unknown':
        return jsonify({'error': 'event_type required'}), 400

    event = AnalyticsEvent(
        user_id=user_id[:64],
        username=data.get('username', '')[:100] if data.get('username') else None,
        event_type=event_type[:50],
        event_data=json.dumps(data.get('event_data', {}))[:2000] if data.get('event_data') else None,
        duration_seconds=data.get('duration_seconds'),
    )
    db.session.add(event)
    db.session.commit()

    return jsonify({'ok': True}), 201


@analytics_bp.route('/api/analytics/dashboard', methods=['GET'])
def analytics_dashboard():
    """Get aggregated analytics data for the admin dashboard."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    # Total unique users (all time)
    total_users = db.session.query(distinct(AnalyticsEvent.user_id)).count()

    # Active users today
    active_today = db.session.query(distinct(AnalyticsEvent.user_id)).filter(
        AnalyticsEvent.created_at >= today_start
    ).count()

    # Active users this week
    active_week = db.session.query(distinct(AnalyticsEvent.user_id)).filter(
        AnalyticsEvent.created_at >= week_ago
    ).count()

    # Total events by type
    event_counts = db.session.query(
        AnalyticsEvent.event_type,
        func.count(AnalyticsEvent.id)
    ).group_by(AnalyticsEvent.event_type).all()

    # Total scans
    total_scans = sum(c for t, c in event_counts if t in ('scan_started', 'scan_completed'))

    # Average session duration
    avg_duration = db.session.query(
        func.avg(AnalyticsEvent.duration_seconds)
    ).filter(
        AnalyticsEvent.event_type == 'session_end',
        AnalyticsEvent.duration_seconds.isnot(None)
    ).scalar() or 0

    # Per-user stats (top 50 users)
    user_stats = db.session.query(
        AnalyticsEvent.user_id,
        AnalyticsEvent.username,
        func.count(AnalyticsEvent.id).label('events'),
        func.max(AnalyticsEvent.created_at).label('last_seen'),
    ).group_by(AnalyticsEvent.user_id, AnalyticsEvent.username).order_by(
        func.max(AnalyticsEvent.created_at).desc()
    ).limit(50).all()

    # Daily activity (last 7 days)
    daily_activity = []
    for i in range(7):
        day = today_start - timedelta(days=i)
        day_end = day + timedelta(days=1)
        count = db.session.query(func.count(AnalyticsEvent.id)).filter(
            AnalyticsEvent.created_at >= day,
            AnalyticsEvent.created_at < day_end
        ).scalar() or 0
        users = db.session.query(distinct(AnalyticsEvent.user_id)).filter(
            AnalyticsEvent.created_at >= day,
            AnalyticsEvent.created_at < day_end
        ).count()
        daily_activity.append({
            'date': day.strftime('%Y-%m-%d'),
            'day': day.strftime('%a'),
            'events': count,
            'users': users,
        })

    # Recent events (last 50)
    recent = AnalyticsEvent.query.order_by(
        AnalyticsEvent.created_at.desc()
    ).limit(50).all()

    return jsonify({
        'total_users': total_users,
        'active_today': active_today,
        'active_week': active_week,
        'total_scans': total_scans,
        'avg_session_minutes': round(avg_duration / 60, 1) if avg_duration else 0,
        'event_breakdown': {t: c for t, c in event_counts},
        'daily_activity': daily_activity,
        'top_users': [{
            'user_id': u[0][:8] + '...',
            'username': u[1] or 'Anonymous',
            'events': u[2],
            'last_seen': u[3].isoformat() if u[3] else None,
        } for u in user_stats],
        'recent_events': [e.to_dict() for e in recent[:20]],
    })
