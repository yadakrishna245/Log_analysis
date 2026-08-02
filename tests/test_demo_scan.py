"""Test the demo tar.gz file against LogSherlock scanner."""
import sys, os, time, json
sys.path.insert(0, r'C:\Gemini-Krishna-Data-june-2026\Gemini-Krishna-Data-june-2026\Videos\HPE-Log_analysis')
os.environ['LOGSHERLOCK_DEV_MODE'] = 'true'

from app import app

demo_file = r'C:\Gemini-Krishna-Data-june-2026\Gemini-Krishna-Data-june-2026\Videos\HPE-Log_analysis\demo\collect_demovmehost01_20260802_100000.tar.gz'

with open(demo_file, 'rb') as f:
    data = f.read()

print(f"File size: {len(data):,} bytes")
print()

with app.test_client() as c:
    start = time.time()
    resp = c.post('/api/analyze/quick', 
                  content_type='multipart/form-data',
                  data={'file': (open(demo_file, 'rb'), 'collect_demovmehost01_20260802_100000.tar.gz')})
    elapsed = time.time() - start
    
    result = resp.get_json()
    print(f"Status: {resp.status_code}")
    print(f"Time: {elapsed:.2f}s")
    print()
    
    if resp.status_code == 200:
        findings = result.get('findings', [])
        summary = result.get('summary', {})
        
        print(f"=== SUMMARY ===")
        print(f"Total findings: {len(findings)}")
        print(f"Severity breakdown:")
        sev_counts = {}
        cat_counts = {}
        for f in findings:
            sev = f.get('severity', 'UNKNOWN')
            cat = f.get('category', 'unknown')
            sev_counts[sev] = sev_counts.get(sev, 0) + 1
            cat_counts[cat] = cat_counts.get(cat, 0) + 1
        
        for sev in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']:
            if sev in sev_counts:
                print(f"  {sev}: {sev_counts[sev]}")
        
        print(f"\nCategory breakdown:")
        for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1]):
            print(f"  {cat}: {count}")
        
        print(f"\n=== UNIQUE PATTERNS DETECTED ===")
        unique_patterns = set()
        for f in findings:
            unique_patterns.add(f.get('pattern_name', f.get('name', 'unknown')))
        
        for p in sorted(unique_patterns):
            print(f"  - {p}")
        
        print(f"\nTotal unique patterns: {len(unique_patterns)}")
        print(f"\n=== SAMPLE FINDINGS (first 5) ===")
        for f in findings[:5]:
            print(f"  [{f.get('severity')}] {f.get('pattern_name', f.get('name', ''))}")
            print(f"    File: {f.get('file', '')}")
            print(f"    Line: {f.get('line', f.get('matched_text', ''))[:100]}")
            print()
    else:
        print(f"Error: {result}")
