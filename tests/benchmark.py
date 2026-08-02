"""Benchmark v2 - test faster scanning approach."""
import os, sys, time, tarfile, tempfile, shutil, re
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

tar_path = r'C:\Users\krishna\Downloads\collect_custpmorphvm101_20260720_090354.tar.gz'
file_size_mb = os.path.getsize(tar_path) / (1024 * 1024)

print(f"{'='*55}")
print(f"  BENCHMARK v2 - FAST SCAN")
print(f"{'='*55}")
print(f"  File: {os.path.basename(tar_path)}")
print(f"  Size: {file_size_mb:.1f} MB")
print(f"{'='*55}\n")

work_dir = tempfile.mkdtemp(prefix='lsherlock_v2_')

try:
    # Build a SINGLE combined mega-regex for fast pre-filter
    # Only scan lines that match this quick check first
    FAST_PREFILTER = re.compile(
        r'error|fail|panic|critical|warn|timeout|denied|refused|abort|'
        r'crash|oom|killed|segfault|gfs2|dlm|corosync|pacemaker|fence|'
        r'scsi|multipath|iscsi|mpath|stonith|quorum',
        re.IGNORECASE
    )

    from engine.patterns import PatternEngine, BUILT_IN_PATTERNS
    from engine.ingestion import stream_file

    engine = PatternEngine(BUILT_IN_PATTERNS)

    # ── PHASE 1: COUNT ───────────────────────────────────────────
    print("Phase 1: Counting members...")
    t0 = time.time()
    with tarfile.open(tar_path, 'r:gz') as tf:
        all_members = tf.getmembers()
    count_time = time.time() - t0
    print(f"  {len(all_members):,} members | {count_time:.1f}s\n")

    # ── PHASE 2: SMART EXTRACT (fewer, bigger log files only) ────
    print("Phase 2: Extracting key log files only...")
    # Priority files: only the most important ones
    priority_names = {'messages', 'syslog', 'dmesg', 'kern.log', 'auth.log',
                      'corosync.log', 'pacemaker.log', 'cluster.log',
                      'multipathd.conf', 'multipath.log', 'journal',
                      'iscsi.log', 'boot.log', 'system.log', 'vmware.log',
                      'libvirtd.log', 'qemu.log'}
    priority_dirs = {'var/log', 'var/spool', 'proc', 'sos_commands'}
    max_file_mb = 20  # Max 20MB per file
    max_total_mb = 150  # Max 150MB total
    extracted_mb = 0
    extracted_count = 0
    noise_files = {'kallsyms', 'modules', 'cpuinfo', 'meminfo', 'mounts',
                   'partitions', 'ksyms', 'config', 'version'}

    t1 = time.time()
    with tarfile.open(tar_path, 'r:gz') as tf:
        # Sort by relevance: named log files first, then by size
        file_members = [m for m in all_members
                        if m.isfile() and not m.issym() and not m.islnk()
                        and 100 < m.size < max_file_mb * 1024 * 1024]

        def priority_score(m):
            bname = os.path.basename(m.name).lower()
            # Direct name match = highest priority
            if bname in priority_names:
                return 0
            # In a log directory = high priority
            if any(d in m.name.lower() for d in priority_dirs):
                return 1
            # Has log extension
            ext = os.path.splitext(bname)[1].lower()
            if ext in {'.log', '.err', '.out'}:
                return 2
            return 3

        file_members.sort(key=lambda m: (priority_score(m), -m.size))

        for member in file_members:
            bname = os.path.basename(member.name).lower()
            if bname in noise_files:
                continue
            if extracted_mb + member.size / (1024*1024) > max_total_mb:
                break
            # Path safety
            member_path = os.path.join(work_dir, member.name)
            if not os.path.abspath(member_path).startswith(os.path.abspath(work_dir)):
                continue
            try:
                tf.extract(member, work_dir)
                extracted_mb += member.size / (1024*1024)
                extracted_count += 1
            except Exception:
                pass
    extract_time = time.time() - t1
    print(f"  Extracted: {extracted_count} files ({extracted_mb:.0f} MB) | {extract_time:.1f}s\n")

    # ── PHASE 3: FAST SCAN WITH PRE-FILTER ───────────────────────
    print("Phase 3: Fast scan with pre-filter...")
    MAX_FINDINGS = 200
    MAX_LINES_PER_FILE = 50000

    all_findings = []
    files_scanned = 0
    total_lines = 0
    lines_prefiltered = 0

    # Collect and sort files
    scan_files = []
    for root, dirs, filenames in os.walk(work_dir):
        for fname in filenames:
            if fname.lower() in noise_files:
                continue
            fpath = os.path.join(root, fname)
            try:
                sz = os.path.getsize(fpath)
                if 100 <= sz <= max_file_mb * 1024 * 1024:
                    ext = os.path.splitext(fname)[1].lower()
                    scan_files.append((fpath, sz, ext, fname.lower()))
            except OSError:
                pass

    # Sort: known log files first
    log_exts = {'.log', '.err', '.out', ''}
    scan_files.sort(key=lambda x: (0 if x[2] in log_exts else 1, -x[1]))

    t2 = time.time()
    for fpath, fsz, ext, bname in scan_files:
        if len(all_findings) >= MAX_FINDINGS:
            break
        lines_in_file = 0
        try:
            files_scanned += 1
            for line_num, line in stream_file(fpath):
                total_lines += 1
                lines_in_file += 1
                if lines_in_file > MAX_LINES_PER_FILE:
                    break

                # PRE-FILTER: skip lines that can't possibly match
                if not FAST_PREFILTER.search(line):
                    continue
                lines_prefiltered += 1

                for pattern, m in engine.match_line(line):
                    all_findings.append({
                        'severity': pattern.severity,
                        'pattern': pattern.name,
                        'file': os.path.relpath(fpath, work_dir),
                        'line': line_num,
                        'content': line.strip()[:120],
                    })
                    if len(all_findings) >= MAX_FINDINGS:
                        break
                if len(all_findings) >= MAX_FINDINGS:
                    break
        except Exception:
            pass

    scan_time = time.time() - t2
    filter_ratio = (1 - lines_prefiltered / max(total_lines, 1)) * 100

    print(f"  Files scanned:     {files_scanned}")
    print(f"  Lines scanned:     {total_lines:,}")
    print(f"  Pre-filter skip:   {filter_ratio:.0f}% of lines skipped early")
    print(f"  Lines checked:     {lines_prefiltered:,}")
    print(f"  Findings:          {len(all_findings)}")
    print(f"  Speed:             {total_lines/max(scan_time,0.01):,.0f} lines/sec")
    print(f"  Time:              {scan_time:.1f}s\n")

    # ── FINAL SUMMARY ────────────────────────────────────────────
    total = count_time + extract_time + scan_time
    print(f"{'='*55}")
    print(f"  TIMING SUMMARY")
    print(f"{'='*55}")
    print(f"  Count archive:  {count_time:.0f}s")
    print(f"  Extract logs:   {extract_time:.0f}s")
    print(f"  Scan patterns:  {scan_time:.0f}s")
    print(f"  TOTAL:          {total:.0f}s ({total/60:.1f} min)")
    print(f"\n  ESTIMATES (based on {file_size_mb:.0f}MB = {total:.0f}s):")
    for size_mb in [200, 500, 1024, 2048, 3072]:
        est = (size_mb / file_size_mb) * total
        print(f"    {size_mb:4d} MB -> ~{est:.0f}s (~{est/60:.1f} min)")
    print()

    # Show top findings
    sevs = Counter(f['severity'] for f in all_findings)
    print(f"  SEVERITY BREAKDOWN: {dict(sevs)}")
    print(f"\n  TOP 5 REAL FINDINGS:")
    shown = 0
    for f in all_findings:
        if 'apt-cache' not in f['content']:
            print(f"    [{f['severity']}] {f['pattern']}")
            print(f"      {os.path.basename(f['file'])}:{f['line']}")
            print(f"      {f['content'][:90]}")
            shown += 1
            if shown >= 5:
                break
    print(f"{'='*55}")

finally:
    shutil.rmtree(work_dir, ignore_errors=True)
    print("Cleanup done.")
