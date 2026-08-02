"""Test advisor with real Jira ticket."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ['LOGSHERLOCK_DEV_MODE'] = 'true'
from app import app

desc = """After an HVM host in an HPE VM Essentials cluster is shut down, the virtual servers 
do not perform the HA process and remain on the powered-off host instead of migrating to 
available nodes. Cluster failover not working. VMs are not migrating automatically. 
Pacemaker shows resources as stopped. Customer expects HA to kick in when a node goes down."""

with app.test_client() as c:
    r = c.post('/api/advisor', json={'description': desc})
    d = r.get_json()
    print(f"Status: {r.status_code}")
    print(f"Categories: {d['categories_detected']}")
    print()
    print("=== INVESTIGATION STEPS ===")
    for s in d['investigation_steps']:
        print(f"  {s}")
    print()
    print("=== FILES TO CHECK ===")
    for f in d['files_to_check']:
        print(f"  {f['file']:42s} | {f['reason']}")
    print()
    print(f"=== PREDICTED PATTERNS ({len(d['predicted_patterns'])}) ===")
    for p in d['predicted_patterns'][:5]:
        print(f"  [{p['severity']}] {p['name']} - {p['description'][:80]}")
    print()
    print(f"=== KNOWN ISSUES ({len(d['related_known_issues'])}) ===")
    for ki in d['related_known_issues'][:3]:
        print(f"  - {ki['title']}")
        if ki.get('solution'):
            print(f"    Solution: {ki['solution'][:100]}")
