"""End-to-end test: Upload 73MB tar.gz through Flask test client."""
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ['LOGSHERLOCK_DEV_MODE'] = 'true'

from app import app
from collections import Counter

tar_path = r'demo/collect_demovmehost01_20260802_100000.tar.gz'
file_size_mb = os.path.getsize(tar_path) / (1024 * 1024)

print(f"{'='*60}")
print(f"  END-TO-END TEST: Flask test client")
print(f"  File: {file_size_mb:.1f} MB")
print(f"{'='*60}")

with app.test_client() as client:
    # Health check
    r = client.get('/api/health')
    data = r.get_json()
    print(f"\n  Health: {r.status_code} - {data['status']}")

    # Upload + analyze the 73MB file
    print(f"\n  Uploading + analyzing {file_size_mb:.0f}MB tar.gz...")
    t0 = time.time()
    with open(tar_path, 'rb') as f:
        resp = client.post(
            '/api/analyze/quick',
            data={'file': (f, 'collect_demovmehost01_20260802_100000.tar.gz')},
            content_type='multipart/form-data'
        )
    elapsed = time.time() - t0

    result = resp.get_json()
    print(f"\n  Status: HTTP {resp.status_code}")
    print(f"  Total time (upload+analysis): {elapsed:.1f}s")
    print(f"  Server analysis_time:         {result.get('analysis_time_seconds')}s")
    print(f"  Files analyzed:               {result.get('files_analyzed')}")
    print(f"  Lines scanned:                {result.get('total_lines'):,}")
    print(f"  Findings:                     {result.get('findings_count')}")
    print(f"  Early terminated:             {result.get('early_terminated')}")
    print(f"  Has Jira report:              {bool(result.get('jira_report'))}")

    findings = result.get('findings', [])
    sevs = Counter(f['severity'] for f in findings)
    print(f"\n  Severity breakdown:")
    for sev in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']:
        if sevs.get(sev, 0) > 0:
            print(f"    {sev:10s}: {sevs[sev]}")

    print(f"\n{'='*60}")
    if elapsed < 30:
        print(f"  DEMO READY: {elapsed:.1f}s for {file_size_mb:.0f}MB file")
    elif elapsed < 60:
        print(f"  ACCEPTABLE: {elapsed:.1f}s (target was <30s)")
    else:
        print(f"  TOO SLOW: {elapsed:.1f}s - needs more optimization")
    print(f"{'='*60}")

