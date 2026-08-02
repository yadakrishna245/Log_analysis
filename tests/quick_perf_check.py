"""Quick performance check - direct scan of 73MB tar.gz."""
import os, sys, time, tarfile
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

tar_path = r'C:\Users\krishna\Downloads\collect_custpmorphvm101_20260720_090354.tar.gz'
file_size_mb = os.path.getsize(tar_path) / (1024 * 1024)

from routes.analysis import (_get_engine, _classify_member, _scan_buffer,
                             MAX_FINDINGS, EARLY_TERM_CRITICAL_HIGH)

engine = _get_engine()
all_findings = []
files_analyzed = 0
total_lines = 0
total_bytes_read = 0
medium_count = 0
early_terminated = False
skipped = 0

print(f"{'='*60}")
print(f"  LogSherlock Pro - Performance Check")
print(f"  File: {os.path.basename(tar_path)} ({file_size_mb:.1f} MB)")
print(f"  Patterns loaded: {len(engine.patterns)}")
print(f"{'='*60}")
print(f"\n  Scanning...")

t0 = time.time()
with tarfile.open(tar_path, 'r:gz') as tf:
    for member in tf:
        if early_terminated:
            break
        if not member.isfile() or member.issym() or member.islnk():
            continue
        pr = _classify_member(member.name, member.size)
        if pr == 'skip':
            skipped += 1
            continue
        if pr == 'medium' and medium_count >= 50:
            skipped += 1
            continue
        if pr == 'low':
            skipped += 1
            continue

        fobj = tf.extractfile(member)
        if fobj is None:
            continue
        content = fobj.read()
        fobj.close()

        total_bytes_read += len(content)
        if pr == 'medium':
            medium_count += 1

        sl = 30000 if len(content) > 5*1024*1024 else (50000 if len(content) > 1024*1024 else 100000)
        findings, lines = _scan_buffer(content, member.name, engine, set(), max_lines=sl)
        files_analyzed += 1
        total_lines += lines
        all_findings.extend(findings)

        ch = sum(1 for x in all_findings if x['severity'] in ('CRITICAL', 'HIGH'))
        if ch >= EARLY_TERM_CRITICAL_HIGH or len(all_findings) >= MAX_FINDINGS:
            early_terminated = True

elapsed = time.time() - t0

# Results
sevs = Counter(f['severity'] for f in all_findings)
print(f"\n{'='*60}")
print(f"  RESULTS")
print(f"{'='*60}")
print(f"  Analysis time:    {elapsed:.1f}s")
print(f"  Files scanned:    {files_analyzed}")
print(f"  Files skipped:    {skipped}")
print(f"  Lines scanned:    {total_lines:,}")
print(f"  Data read:        {total_bytes_read/1024/1024:.0f} MB")
print(f"  Findings:         {len(all_findings)}")
print(f"  Early terminated: {early_terminated}")
print(f"  Severity:         CRITICAL={sevs.get('CRITICAL',0)} HIGH={sevs.get('HIGH',0)} MEDIUM={sevs.get('MEDIUM',0)} LOW={sevs.get('LOW',0)}")
print(f"\n  Top 10 findings:")
for i, item in enumerate(all_findings[:10]):
    fname = os.path.basename(item['file'])
    pname = item['pattern_name'][:40]
    print(f"    {i+1:2d}. [{item['severity']:8s}] {pname} ({fname}:{item['line_number']})")

print(f"\n{'='*60}")
if elapsed < 30:
    print(f"  PASS: {elapsed:.1f}s < 30s target for demo")
else:
    print(f"  NEEDS WORK: {elapsed:.1f}s > 30s target")
print(f"{'='*60}")
