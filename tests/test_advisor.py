"""Test the ticket advisor endpoint."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ['LOGSHERLOCK_DEV_MODE'] = 'true'
from app import app

TICKET_DESC = """
Customer reports GFS2 filesystem went read-only on node demovmehost01 after 
a storage path failure. VMs on this node are paused with I/O error. 
The cluster attempted to fence the node but fencing timed out.
Customer is asking for urgent RCA as this is a P1 production outage.
iSCSI sessions to Alletra array dropped at 10:30 AM.
"""

with app.test_client() as c:
    r = c.post('/api/advisor', json={'description': TICKET_DESC})
    d = r.get_json()
    
    print(f"Status: {r.status_code}")
    print(f"\nCategories: {d['categories_detected']}")
    print(f"\nSummary: {d['summary']}")
    
    print(f"\nInvestigation Steps:")
    for step in d['investigation_steps']:
        print(f"  {step}")
    
    print(f"\nFiles to Check ({len(d['files_to_check'])}):")
    for f in d['files_to_check'][:8]:
        print(f"  {f['file']:40s} → {f['reason']}")
    
    print(f"\nPredicted Patterns ({len(d['predicted_patterns'])}):")
    for p in d['predicted_patterns'][:5]:
        print(f"  [{p['severity']:8s}] {p['name']}")
    
    print(f"\nKnown Issues ({len(d['related_known_issues'])}):")
    for ki in d['related_known_issues'][:3]:
        print(f"  - {ki['title'][:70]}")

