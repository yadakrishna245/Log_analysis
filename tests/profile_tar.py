"""Profile the tar.gz file structure and identify performance bottlenecks."""
import os, time, tarfile
from collections import Counter, defaultdict

tar_path = r'demo/collect_demovmehost01_20260802_100000.tar.gz'
file_size_mb = os.path.getsize(tar_path) / (1024 * 1024)

print(f"{'='*60}")
print(f"  TAR.GZ STRUCTURE PROFILER")
print(f"{'='*60}")
print(f"  File: {os.path.basename(tar_path)}")
print(f"  Compressed size: {file_size_mb:.1f} MB")
print(f"{'='*60}\n")

# --- PHASE 1: Enumerate all members (this requires full gzip decompress) ---
print("--- Phase 1: Enumerate members (timing gzip decode of index) ---")
t0 = time.time()
with tarfile.open(tar_path, 'r:gz') as tf:
    members = tf.getmembers()
enum_time = time.time() - t0
print(f"  Time to enumerate: {enum_time:.2f}s")
print(f"  Total members: {len(members):,}")

# --- PHASE 2: Classify members ---
print(f"\n--- Phase 2: Member classification ---")
type_counts = Counter()
ext_counts = Counter()
dir_counts = Counter()
size_buckets = Counter()
total_uncompressed = 0
file_sizes = []

for m in members:
    if m.isdir():
        type_counts['directory'] += 1
    elif m.issym():
        type_counts['symlink'] += 1
    elif m.islnk():
        type_counts['hardlink'] += 1
    elif m.isfile():
        type_counts['file'] += 1
        total_uncompressed += m.size
        file_sizes.append((m.name, m.size))
        
        # Extension
        base = os.path.basename(m.name)
        if '.' in base:
            ext = '.' + base.rsplit('.', 1)[1].lower()
        else:
            ext = '(no extension)'
        ext_counts[ext] += 1
        
        # Top-level directory
        parts = m.name.replace('\\', '/').split('/')
        if len(parts) > 1:
            dir_counts[parts[1] if parts[0] == '.' else parts[0]] += 1
        
        # Size bucket
        if m.size == 0:
            size_buckets['0 bytes'] += 1
        elif m.size < 1024:
            size_buckets['< 1 KB'] += 1
        elif m.size < 100 * 1024:
            size_buckets['1-100 KB'] += 1
        elif m.size < 1024 * 1024:
            size_buckets['100KB-1MB'] += 1
        elif m.size < 10 * 1024 * 1024:
            size_buckets['1-10 MB'] += 1
        else:
            size_buckets['> 10 MB'] += 1
    else:
        type_counts['other'] += 1

print(f"  Total uncompressed: {total_uncompressed / (1024*1024):.1f} MB")
print(f"  Compression ratio: {file_size_mb / (total_uncompressed / (1024*1024)) * 100:.1f}%")
print(f"\n  Type breakdown:")
for t, c in type_counts.most_common():
    print(f"    {t:15s}: {c:,}")

print(f"\n  Size distribution (files only):")
for bucket in ['0 bytes', '< 1 KB', '1-100 KB', '100KB-1MB', '1-10 MB', '> 10 MB']:
    if bucket in size_buckets:
        print(f"    {bucket:15s}: {size_buckets[bucket]:,}")

print(f"\n  Top 15 file extensions:")
for ext, c in ext_counts.most_common(15):
    print(f"    {ext:15s}: {c:,}")

print(f"\n  Top 15 directories (by file count):")
for d, c in dir_counts.most_common(15):
    print(f"    {d:30s}: {c:,}")

# --- PHASE 3: Largest files ---
print(f"\n--- Phase 3: Top 20 largest files ---")
file_sizes.sort(key=lambda x: -x[1])
for name, size in file_sizes[:20]:
    print(f"    {size/1024/1024:8.2f} MB  {name}")

# --- PHASE 4: Time to read a few large files (decompress from stream) ---
print(f"\n--- Phase 4: Read+decompress timing for large log files ---")
# Pick top 5 largest files
targets = [name for name, size in file_sizes[:5]]

t1 = time.time()
with tarfile.open(tar_path, 'r:gz') as tf:
    for target_name in targets:
        t_start = time.time()
        try:
            member = tf.getmember(target_name)
            f = tf.extractfile(member)
            if f:
                data = f.read()
                elapsed = time.time() - t_start
                print(f"    {elapsed:6.2f}s | {len(data)/1024/1024:6.2f} MB | {os.path.basename(target_name)}")
                f.close()
        except Exception as e:
            print(f"    ERROR reading {target_name}: {e}")
total_read_time = time.time() - t1
print(f"  Total read time (5 files): {total_read_time:.2f}s")

# --- PHASE 5: Measure second full enumeration (test caching) ---
print(f"\n--- Phase 5: Second enumeration (compare to first) ---")
t2 = time.time()
with tarfile.open(tar_path, 'r:gz') as tf:
    members2 = tf.getmembers()
enum2_time = time.time() - t2
print(f"  Time: {enum2_time:.2f}s (first was {enum_time:.2f}s)")
print(f"  NOTE: tar.gz has no index - must decompress ENTIRE stream to enumerate")

# --- PHASE 6: Bottleneck Analysis ---
print(f"\n{'='*60}")
print(f"  BOTTLENECK ANALYSIS")
print(f"{'='*60}")
print(f"""
  1. GZIP DECOMPRESSION (CRITICAL BOTTLENECK)
     - tar.gz format has NO random access - must decompress sequentially
     - Enumeration alone requires {enum_time:.1f}s (full gzip decode)
     - Each open() re-decompresses from the start
     - Extract phase re-decompresses AGAIN: adds ~{enum_time:.0f}s overhead

  2. DOUBLE DECOMPRESSION IN BENCHMARK
     - Phase 1 (count): decompresses entire stream -> {enum_time:.1f}s
     - Phase 2 (extract): decompresses entire stream AGAIN -> dominates at 738s
     - That's 2x full gzip decode just for setup

  3. DISK I/O DURING EXTRACTION
     - Writing {total_uncompressed/1024/1024:.0f} MB to disk takes significant time
     - Many small files ({size_buckets.get('< 1 KB', 0) + size_buckets.get('0 bytes', 0):,} files < 1KB)
       cause high filesystem overhead

  4. SCAN PHASE IS FAST (not the bottleneck)
     - Pattern matching with pre-filter is efficient
     - Only 46s for scanning vs 738s for extraction

  RECOMMENDATIONS:
     - Stream-process the tar.gz in a SINGLE PASS (don't extract to disk)
     - Read file contents directly from the tar stream
     - Apply pattern matching in-memory during streaming
     - Avoid extracting 50K+ files to disk
     - Consider parallel gzip decompression (pigz) or indexed gzip
""")
print(f"{'='*60}")

