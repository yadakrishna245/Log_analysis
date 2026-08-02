"""Test new client-side scanning endpoints."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ['LOGSHERLOCK_DEV_MODE'] = 'true'
from app import app

with app.test_client() as c:
    # Test patterns export
    r = c.get('/api/patterns/export')
    d = r.get_json()
    print(f"Patterns export: {r.status_code}")
    count = d['pattern_count']
    kw_count = len(d['prefilter_keywords'])
    first = d['patterns'][0]
    print(f"  Patterns: {count}")
    print(f"  Prefilter keywords: {kw_count}")
    print(f"  Sample: {first['name']} ({first['severity']}) - regex length: {len(first['regex'])}")

    # Test knowledge lookup
    r = c.post('/api/knowledge/lookup', json={
        'pattern_names': ['gfs2_withdraw', 'oom_kill', 'pacemaker_resource_failed'],
        'description': 'GFS2 mount failure after node reboot'
    })
    d = r.get_json()
    print(f"\nKnowledge lookup: {r.status_code}")
    print(f"  Related issues: {d['count']}")
    for issue in d['related_issues'][:3]:
        title = issue['title'][:60]
        print(f"    - {title}")

    print("\nAll client-side scanning endpoints working!")
