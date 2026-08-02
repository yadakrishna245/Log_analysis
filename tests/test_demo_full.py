"""Full pattern match test for demo tar.gz - no early termination."""
import sys, os, re, tarfile
sys.path.insert(0, r'C:\Gemini-Krishna-Data-june-2026\Gemini-Krishna-Data-june-2026\Videos\HPE-Log_analysis')
from engine.patterns import BUILT_IN_PATTERNS

demo = r'C:\Gemini-Krishna-Data-june-2026\Gemini-Krishna-Data-june-2026\Videos\HPE-Log_analysis\demo\collect_demovmehost01_20260802_100000.tar.gz'

# Extract all text
lines_all = []
with tarfile.open(demo, 'r:gz') as tf:
    for m in tf.getmembers():
        if m.isfile():
            f = tf.extractfile(m)
            if f:
                content = f.read().decode('utf-8', errors='ignore')
                for line in content.splitlines():
                    lines_all.append((m.name, line))

print(f"Total lines in archive: {len(lines_all)}")

# Match all patterns
matched_patterns = {}
for fname, line in lines_all:
    for p in BUILT_IN_PATTERNS:
        if re.search(p.regex, line, re.IGNORECASE):
            if p.name not in matched_patterns:
                matched_patterns[p.name] = {'severity': p.severity, 'category': p.category, 'count': 0}
            matched_patterns[p.name]['count'] += 1

# Summary
sev_summary = {}
cat_summary = {}
for name, info in matched_patterns.items():
    sev = info['severity']
    cat = info['category']
    sev_summary[sev] = sev_summary.get(sev, 0) + 1
    cat_summary[cat] = cat_summary.get(cat, 0) + 1

print(f"\nTotal unique patterns matched: {len(matched_patterns)}")
print(f"\nSeverity breakdown (unique patterns):")
for s in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']:
    print(f"  {s}: {sev_summary.get(s, 0)}")

print(f"\nCategory breakdown (unique patterns):")
for cat, count in sorted(cat_summary.items(), key=lambda x: -x[1]):
    print(f"  {cat}: {count}")

print(f"\nAll matched patterns:")
for name in sorted(matched_patterns.keys()):
    info = matched_patterns[name]
    sev = info['severity']
    cat = info['category']
    cnt = info['count']
    print(f"  [{sev:8s}] [{cat:14s}] {name} ({cnt} hits)")
