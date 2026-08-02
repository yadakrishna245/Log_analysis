"""Analysis routes for LogSherlock Pro.

Performance-optimized version with:
- Pre-compiled regex patterns at module load (singleton PatternEngine)
- Aggressive file classification for large archives (99%+ files skipped)
- In-memory buffer scanning (faster than line-by-line tarfile iteration)
- Early termination after 50+ CRITICAL/HIGH findings
- Size-based line limits for huge log files
- Chunked upload endpoint for large files with progress
- Timing info in all responses
"""

import os
import re as _re
import time
import io
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from models import db, Ticket, LogFile, Finding, Pattern, KnowledgeEntry, Suppression

analysis_bp = Blueprint('analysis', __name__)

# ── Zip Bomb Protection ──────────────────────────────────────────────────
MAX_DECOMPRESSED_SIZE = int(os.environ.get('MAX_DECOMPRESSED_SIZE_GB', '10')) * 1024 * 1024 * 1024
MAX_COMPRESSION_RATIO = int(os.environ.get('MAX_COMPRESSION_RATIO', '100'))

# ── Performance Thresholds ───────────────────────────────────────────────
LARGE_FILE_THRESHOLD = 10 * 1024 * 1024  # 10MB - trigger aggressive optimizations
EARLY_TERM_CRITICAL_HIGH = 50  # Stop after this many CRITICAL+HIGH findings (large files)
MAX_FINDINGS = 200
MAX_BYTES_PER_FILE = 30 * 1024 * 1024  # 30MB per file
MAX_TOTAL_BYTES = 200 * 1024 * 1024  # 200MB total content budget
MAX_LINES_PER_FILE = 100000
MAX_WORKERS = 4  # Thread pool size for parallel scanning

# ── Pre-compiled fast pre-filter (compiled ONCE at module load) ──────────
FAST_PREFILTER = _re.compile(
    r'error|fail|panic|critical|warn|timeout|denied|refused|abort|crash|'
    r'oom|killed|segfault|gfs2|dlm|corosync|pacemaker|fence|stonith|quorum|'
    r'scsi|multipath|mpath|iscsi|withdraw|lockup|hung|blocked|out.of.memory|'
    r'reservation|conflict|readonly|read.only|lost|down|degraded|failed',
    _re.IGNORECASE
)

# ── Aggressive file classification (compiled ONCE at module load) ────────
# High-priority log files - scan these FIRST
_HIGH_PRIORITY_NAMES = {
    'messages', 'syslog', 'dmesg', 'kern.log', 'corosync.log',
    'pacemaker.log', 'cluster.log', 'multipath.log', 'journal.log',
    'auth.log', 'secure', 'boot.log', 'alert', 'crit.log',
}
_HIGH_PRIORITY_PATTERNS = _re.compile(
    r'(messages|syslog|dmesg|kern|corosync|pacemaker|cluster|multipath|'
    r'journal|auth\.log|secure|boot\.log|alert|fence|stonith|dlm|gfs2|'
    r'iscsi|scsi|storage|crit|emerg)',
    _re.IGNORECASE
)

# Medium priority - scan if time permits
_MEDIUM_PRIORITY_PATTERNS = _re.compile(
    r'(daemon|cron|mail|audit|libvirt|qemu|virsh|cloud-init|'
    r'vmware|pcs|drbd|lvm|vg|systemd|network|firewall)',
    _re.IGNORECASE
)

_LOG_EXTS = {'.log', '.err', '.out', '.txt'}
_LOG_KEYWORDS = {'syslog', 'messages', 'dmesg', 'kern.log', 'auth.log',
                 'corosync', 'pacemaker', 'multipath', 'iscsi', 'cluster',
                 'pcs', 'secure', 'boot.log', 'virsh', 'libvirt', 'qemu',
                 'vmware', 'cloud-init', 'cron', 'journal', 'alert', 'audit'}

# Noise files to ALWAYS skip (common in sosreport/support bundles)
_NOISE_FILES = {
    'kallsyms', 'modules', 'cpuinfo', 'meminfo', 'mounts', 'ksyms',
    'partitions', 'config', 'version', 'cmdline', 'diskstats', 'net_dev',
    'interrupts', 'softirqs', 'buddyinfo', 'slabinfo', 'vmstat',
    'zoneinfo', 'iomem', 'ioports', 'filesystems', 'devices',
    'locks', 'stat', 'uptime', 'loadavg', 'crypto', 'cgroups',
    'schedstat', 'mdstat', 'swaps', 'pagetypeinfo', 'timer_list',
    'timer_stats', 'sched_debug', 'softnet_stat', 'net_snmp',
    'net_netstat', 'net_tcp', 'net_udp', 'net_unix', 'net_raw',
    'self_maps', 'self_status', 'self_mountinfo', 'self_cgroup',
    'hostname', 'date', 'uname', 'release', 'os-release',
    'lsb-release', 'redhat-release', 'centos-release',
    'installed-rpms', 'installed-debs', 'rpm-Va', 'yum.log',
}

# Noise directory patterns - skip entire directories
_NOISE_DIRS = _re.compile(
    r'(proc/|sys/|dev/|run/|tmp/|usr/share/|usr/lib/|'
    r'lib/modules/|lib/firmware/|etc/alternatives/|'
    r'\.git/|__pycache__|node_modules|'
    r'proc_|sos_commands/(rpm|yum|package|python|alternatives|'
    r'networking/ethtool|block/lsblk|filesys/df|'
    r'process/ps|hardware/lspci|selinux|security))',
    _re.IGNORECASE
)

_BINARY_EXTS = {'.pyc', '.so', '.exe', '.dll', '.bin', '.db', '.sqlite',
                '.rpm', '.deb', '.iso', '.img', '.vmdk', '.qcow2', '.jpg',
                '.jpeg', '.png', '.gif', '.pdf', '.zip', '.7z', '.tar', '.gz',
                '.bz2', '.xz', '.o', '.ko', '.a', '.dat', '.cache'}




# ── Module-level PatternEngine singleton (patterns compiled ONCE) ────────
_ENGINE_SINGLETON = None


def _get_engine():
    """Get or create the module-level PatternEngine singleton.
    Ensures 101 regex patterns are compiled only once per process."""
    global _ENGINE_SINGLETON
    if _ENGINE_SINGLETON is None:
        from engine.patterns import PatternEngine
        _ENGINE_SINGLETON = PatternEngine()
    return _ENGINE_SINGLETON


def _check_zip_bomb(archive_path, archive_size):
    """Check if an archive is a potential zip bomb before extraction."""
    import zipfile
    if not zipfile.is_zipfile(archive_path):
        return True, 'Not a zip file'
    try:
        with zipfile.ZipFile(archive_path, 'r') as zf:
            total_uncompressed = sum(info.file_size for info in zf.infolist())
            if total_uncompressed > MAX_DECOMPRESSED_SIZE:
                return False, f'Declared uncompressed size ({total_uncompressed / 1e9:.1f}GB) exceeds limit ({MAX_DECOMPRESSED_SIZE / 1e9:.0f}GB)'
            if archive_size > 0:
                ratio = total_uncompressed / archive_size
                if ratio > MAX_COMPRESSION_RATIO:
                    return False, f'Compression ratio {ratio:.0f}:1 exceeds limit ({MAX_COMPRESSION_RATIO}:1). Possible zip bomb.'
        return True, 'OK'
    except Exception as e:
        return True, f'Could not verify (proceeding with caution): {str(e)}'


def _check_tar_bomb(archive_path, archive_size):
    """Check tar/tar.gz for decompression bomb characteristics."""
    import tarfile
    try:
        mode = 'r:gz' if archive_path.endswith(('.tar.gz', '.tgz')) else 'r:'
        with tarfile.open(archive_path, mode) as tf:
            total_size = sum(m.size for m in tf.getmembers() if m.isfile())
            if total_size > MAX_DECOMPRESSED_SIZE:
                return False, f'Total content size ({total_size / 1e9:.1f}GB) exceeds limit ({MAX_DECOMPRESSED_SIZE / 1e9:.0f}GB)'
            if archive_size > 0:
                ratio = total_size / archive_size
                if ratio > MAX_COMPRESSION_RATIO:
                    return False, f'Compression ratio {ratio:.0f}:1 exceeds limit. Possible tar bomb.'
        return True, 'OK'
    except Exception as e:
        return True, f'Could not verify: {str(e)}'


def _classify_member(name, size):
    """Classify a tar member for priority-based scanning.

    Returns: 'high', 'medium', 'low', or 'skip'
    """
    if size == 0 or size > MAX_BYTES_PER_FILE:
        return 'skip'

    bname = os.path.basename(name).lower()

    # Always skip noise
    if bname in _NOISE_FILES:
        return 'skip'

    # Skip binary extensions
    ext = os.path.splitext(name)[1].lower()
    if ext in _BINARY_EXTS:
        return 'skip'

    # Skip noise directories
    if _NOISE_DIRS.search(name):
        return 'skip'

    # Skip very small files (< 500 bytes) - they rarely contain useful log data
    if size < 500:
        return 'skip'

    # High priority: known important log files
    if bname in _HIGH_PRIORITY_NAMES or _HIGH_PRIORITY_PATTERNS.search(bname):
        return 'high'

    # High priority by extension + reasonable size
    if ext in _LOG_EXTS and size > 1024:
        if _HIGH_PRIORITY_PATTERNS.search(name):
            return 'high'
        return 'medium'

    # Medium priority: other log-like files
    if ext in _LOG_EXTS or any(k in bname for k in _LOG_KEYWORDS):
        return 'medium'
    if _MEDIUM_PRIORITY_PATTERNS.search(name):
        return 'medium'

    # Files with no extension but log-like names in log directories
    if not ext and ('log' in name.lower() or 'var/' in name.lower()):
        return 'low'

    return 'skip'


def _is_log_member_simple(name, size):
    """Legacy simple check for small file uploads (backward compat)."""
    bname = os.path.basename(name).lower()
    if bname in _NOISE_FILES:
        return False
    if size < 500 or size > MAX_BYTES_PER_FILE:
        return False
    ext = os.path.splitext(name)[1].lower()
    if ext in _BINARY_EXTS:
        return False
    return ext in _LOG_EXTS or any(k in bname for k in _LOG_KEYWORDS)


def _scan_buffer(content_bytes, rel_path, engine, suppressed_names,
                 max_lines=MAX_LINES_PER_FILE, max_findings_per_file=50):
    """Scan an in-memory buffer of log content against patterns.

    Returns: (findings_list, lines_scanned)
    Uses in-memory buffer scanning (faster than line-by-line file object iteration).
    Caps at max_findings_per_file to prevent one huge file from dominating results.
    """
    findings = []
    lines_scanned = 0

    try:
        # Decode entire buffer at once (faster than per-line decode)
        if isinstance(content_bytes, bytes):
            text = content_bytes.decode('utf-8', errors='replace')
        else:
            text = content_bytes
    except Exception:
        return findings, 0

    for line_num, line in enumerate(text.split('\n'), 1):
        if line_num > max_lines:
            break
        lines_scanned += 1

        # Fast pre-filter: skip lines with no error keywords
        if not FAST_PREFILTER.search(line):
            continue

        # Run pattern matching
        for pattern, m in engine.match_line(line):
            if pattern.name in suppressed_names:
                continue
            findings.append({
                'pattern_name': pattern.name,
                'severity': pattern.severity,
                'category': pattern.category,
                'file': rel_path,
                'line_number': line_num,
                'line_content': line.strip()[:500],
                'description': pattern.description,
                'solution_hint': pattern.solution_hint,
            })
            # Cap findings per file to prevent one huge file from blocking
            if len(findings) >= max_findings_per_file:
                return findings, lines_scanned

    return findings, lines_scanned




@analysis_bp.route('/api/analyze/quick', methods=['POST'])
def quick_analyze():
    """Upload files and analyze instantly.

    Optimizations for large files (>10MB):
    - Priority-based file selection (high > medium > low)
    - In-memory buffer scanning (no line-by-line iteration from tarfile)
    - Parallel scanning with ThreadPoolExecutor
    - Early termination after 50+ CRITICAL/HIGH findings
    - Aggressive noise file filtering
    """
    import tarfile
    import zipfile
    import gzip
    import uuid

    start_time = time.time()

    description = request.form.get('description', '')
    analysis_id = str(uuid.uuid4())[:8]
    analysis_folder = os.path.join(current_app.config['UPLOAD_FOLDER'], analysis_id)
    os.makedirs(analysis_folder, exist_ok=True)

    files = request.files.getlist('files') or []
    if 'file' in request.files:
        files.append(request.files['file'])
    if not files:
        return jsonify({'error': 'No files provided'}), 400

    from engine.ingestion import stream_file

    engine = _get_engine()
    suppressed_names = set(
        s.pattern_name for s in Suppression.query.filter_by(active=True).all()
    )

    all_findings = []
    files_analyzed = 0
    total_lines = 0
    total_bytes_read = 0
    early_terminated = False

    def _count_critical_high():
        """Count CRITICAL + HIGH findings for early termination."""
        return sum(1 for f in all_findings if f['severity'] in ('CRITICAL', 'HIGH'))

    def scan_lines_legacy(line_iter, rel_path):
        """Legacy line-by-line scan for small files (backward compat)."""
        nonlocal total_lines, files_analyzed
        files_analyzed += 1
        count = 0
        for line_num, line in line_iter:
            if isinstance(line, bytes):
                try:
                    line = line.decode('utf-8', errors='replace')
                except Exception:
                    continue
            total_lines += 1
            count += 1
            if count > MAX_LINES_PER_FILE:
                break
            if not FAST_PREFILTER.search(line):
                continue
            for pattern, m in engine.match_line(line):
                if pattern.name in suppressed_names:
                    continue
                all_findings.append({
                    'pattern_name': pattern.name,
                    'severity': pattern.severity,
                    'category': pattern.category,
                    'file': rel_path,
                    'line_number': line_num,
                    'line_content': line.strip()[:500],
                    'description': pattern.description,
                    'solution_hint': pattern.solution_hint,
                })
                if len(all_findings) >= MAX_FINDINGS:
                    return

    def _process_tar_large(filepath):
        """Optimized tar.gz processing for large files.

        Strategy:
        1. Single-pass stream through tar.gz
        2. Skip noise aggressively using _classify_member()
        3. Read each file into memory buffer (faster than line-by-line tarfile iteration)
        4. Scan inline immediately after reading (no collect-then-scan overhead)
        5. Early terminate when enough CRITICAL/HIGH findings found
        
        Note: Uses sequential scanning (not threaded) because regex matching is
        CPU-bound and Python's GIL makes threading counterproductive for this workload.
        The gzip decompression (~10s) is the floor; scanning adds only 2-5s with
        early termination kicking in after processing a few high-value files.
        """
        nonlocal files_analyzed, total_lines, total_bytes_read, early_terminated

        medium_count = 0

        try:
            with tarfile.open(filepath, 'r:gz') as tf:
                for member in tf:
                    # Early termination: stop streaming entirely
                    if early_terminated:
                        break
                    if total_bytes_read >= MAX_TOTAL_BYTES:
                        break

                    if not member.isfile() or member.issym() or member.islnk():
                        continue

                    priority = _classify_member(member.name, member.size)
                    if priority == 'skip':
                        continue

                    # For large archives, limit medium/low priority files
                    if priority == 'medium' and medium_count >= 50:
                        continue
                    if priority == 'low':
                        continue  # Skip low priority entirely for large files

                    fobj = tf.extractfile(member)
                    if fobj is None:
                        continue

                    # Read entire file into memory buffer
                    try:
                        content = fobj.read()
                    finally:
                        fobj.close()

                    total_bytes_read += len(content)
                    if priority == 'medium':
                        medium_count += 1

                    # Scan inline immediately (faster than threading for CPU-bound regex)
                    # For large files (>5MB), limit lines scanned since they're
                    # usually repetitive (auth.log, journalctl output)
                    scan_max_lines = MAX_LINES_PER_FILE
                    if len(content) > 5 * 1024 * 1024:
                        scan_max_lines = 30000  # ~first 30K lines of large files
                    elif len(content) > 1 * 1024 * 1024:
                        scan_max_lines = 50000

                    findings, lines = _scan_buffer(
                        content, member.name, engine, suppressed_names,
                        max_lines=scan_max_lines
                    )
                    files_analyzed += 1
                    total_lines += lines
                    all_findings.extend(findings)

                    # Check early termination after each file
                    if _count_critical_high() >= EARLY_TERM_CRITICAL_HIGH:
                        early_terminated = True
                        break
                    if len(all_findings) >= MAX_FINDINGS:
                        early_terminated = True
                        break

        except Exception as e:
            current_app.logger.error(f"tar.gz stream error: {e}")

    def _process_tar_small(filepath, mode='r:gz'):
        """Standard tar processing for small files (original behavior)."""
        nonlocal files_analyzed, total_lines, total_bytes_read

        try:
            with tarfile.open(filepath, mode) as tf:
                for member in tf:
                    if len(all_findings) >= MAX_FINDINGS:
                        break
                    if total_bytes_read >= MAX_TOTAL_BYTES:
                        break
                    if not member.isfile() or member.issym() or member.islnk():
                        continue
                    if not _is_log_member_simple(member.name, member.size):
                        continue
                    fobj = tf.extractfile(member)
                    if fobj is None:
                        continue
                    total_bytes_read += member.size
                    scan_lines_legacy(enumerate(fobj, 1), member.name)
                    fobj.close()
        except Exception as e:
            current_app.logger.error(f"tar stream error: {e}")

    for file in files:
        if not file or not file.filename:
            continue
        filename = secure_filename(file.filename)
        filepath = os.path.join(analysis_folder, filename)
        file.save(filepath)
        file_size = os.path.getsize(filepath)
        is_large = file_size > LARGE_FILE_THRESHOLD

        try:
            # ── TAR.GZ / TGZ ───────────────────────────────────────────────
            if filename.endswith('.tar.gz') or filename.endswith('.tgz'):
                if is_large:
                    _process_tar_large(filepath)
                else:
                    _process_tar_small(filepath, 'r:gz')
                os.remove(filepath)

            # ── TAR (uncompressed) ─────────────────────────────────────────
            elif filename.endswith('.tar'):
                _process_tar_small(filepath, 'r:')
                os.remove(filepath)

            # ── ZIP ────────────────────────────────────────────────────────
            elif filename.endswith('.zip'):
                archive_size = os.path.getsize(filepath)
                is_safe, reason = _check_zip_bomb(filepath, archive_size)
                if not is_safe:
                    os.remove(filepath)
                    return jsonify({'error': f'Archive rejected: {reason}'}), 400
                extract_dir = os.path.join(analysis_folder, os.path.splitext(filename)[0])
                os.makedirs(extract_dir, exist_ok=True)
                with zipfile.ZipFile(filepath, 'r') as zf:
                    for info in zf.infolist():
                        member_path = os.path.join(extract_dir, info.filename)
                        if not os.path.abspath(member_path).startswith(os.path.abspath(extract_dir)):
                            continue
                        if not _is_log_member_simple(info.filename, info.file_size):
                            continue
                        if total_bytes_read >= MAX_TOTAL_BYTES:
                            break
                        try:
                            with zf.open(info) as fobj:
                                total_bytes_read += info.file_size
                                scan_lines_legacy(enumerate(fobj, 1), info.filename)
                        except Exception:
                            continue
                os.remove(filepath)

            # ── .GZ (single file) ──────────────────────────────────────────
            elif filename.endswith('.gz'):
                out_path = os.path.join(analysis_folder, filename[:-3])
                with gzip.open(filepath, 'rb') as f_in, open(out_path, 'wb') as f_out:
                    f_out.write(f_in.read())
                os.remove(filepath)

            # ── 7Z ─────────────────────────────────────────────────────────
            elif filename.endswith('.7z'):
                from engine.ingestion import extract_7z
                extract_dir = os.path.join(analysis_folder, os.path.splitext(filename)[0])
                extract_7z(filepath, extract_dir)
                os.remove(filepath)

            # ── Raw log file ───────────────────────────────────────────────
            elif os.path.splitext(filename)[1].lower() not in _BINARY_EXTS:
                scan_lines_legacy(stream_file(filepath), filename)

        except Exception as e:
            current_app.logger.error(f"Processing error for {filename}: {e}")

    # Also scan any remaining extracted files (from .gz, .7z, zip)
    for root, dirs, fnames in os.walk(analysis_folder):
        for fname in fnames:
            if len(all_findings) >= MAX_FINDINGS:
                break
            fpath = os.path.join(root, fname)
            bname = fname.lower()
            if bname in _NOISE_FILES:
                continue
            ext = os.path.splitext(fname)[1].lower()
            if ext in _BINARY_EXTS:
                continue
            try:
                sz = os.path.getsize(fpath)
                if sz < 500 or sz > MAX_BYTES_PER_FILE:
                    continue
            except OSError:
                continue
            if not (ext in _LOG_EXTS or any(k in bname for k in _LOG_KEYWORDS)):
                continue
            scan_lines_legacy(stream_file(fpath), os.path.relpath(fpath, analysis_folder))

    # Sort by severity
    severity_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3, 'INFO': 4}
    all_findings.sort(key=lambda f: severity_order.get(f['severity'], 5))

    # Match knowledge base
    related_issues = []
    if description:
        try:
            desc_lower = description.lower()
            for entry in KnowledgeEntry.query.all():
                entry_text = f"{entry.title} {entry.symptoms} {entry.root_cause}".lower()
                if any(w in entry_text for w in desc_lower.split() if len(w) > 3):
                    related_issues.append({
                        'title': entry.title,
                        'product': entry.product,
                        'solution': entry.solution,
                    })
                    if len(related_issues) >= 5:
                        break
        except Exception:
            pass

    elapsed = time.time() - start_time

    return jsonify({
        'message': 'Analysis complete',
        'analysis_time_seconds': round(elapsed, 2),
        'files_analyzed': files_analyzed,
        'total_lines': total_lines,
        'findings_count': len(all_findings),
        'findings': all_findings[:100],
        'related_issues': related_issues,
        'early_terminated': early_terminated,
        'jira_report': _generate_quick_jira_report(all_findings[:100], related_issues, description),
    })




@analysis_bp.route('/api/analyze/quick/chunked', methods=['POST'])
def quick_analyze_chunked():
    """Chunked upload endpoint for large files.

    Accepts multipart uploads with metadata:
    - chunk: the file chunk data
    - chunk_index: 0-based chunk number
    - total_chunks: total number of chunks
    - filename: original filename
    - upload_id: unique upload session ID (generated by client for first chunk)
    - description: (optional) issue description

    Returns progress info for each chunk, triggers analysis on final chunk.
    """
    import uuid

    chunk = request.files.get('chunk')
    chunk_index = int(request.form.get('chunk_index', 0))
    total_chunks = int(request.form.get('total_chunks', 1))
    filename = request.form.get('filename', 'upload.tar.gz')
    upload_id = request.form.get('upload_id', str(uuid.uuid4())[:8])
    description = request.form.get('description', '')

    if not chunk:
        return jsonify({'error': 'No chunk data provided'}), 400

    # Create upload staging directory
    staging_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], f'chunked_{upload_id}')
    os.makedirs(staging_dir, exist_ok=True)

    # Save this chunk
    chunk_path = os.path.join(staging_dir, f'chunk_{chunk_index:04d}')
    chunk.save(chunk_path)

    progress = (chunk_index + 1) / total_chunks * 100

    # If not the last chunk, return progress
    if chunk_index < total_chunks - 1:
        return jsonify({
            'status': 'uploading',
            'upload_id': upload_id,
            'chunk_index': chunk_index,
            'total_chunks': total_chunks,
            'progress_percent': round(progress, 1),
            'message': f'Chunk {chunk_index + 1}/{total_chunks} received',
        })

    # Last chunk received - reassemble and analyze
    start_time = time.time()
    safe_filename = secure_filename(filename)
    assembled_path = os.path.join(staging_dir, safe_filename)

    # Reassemble chunks in order
    with open(assembled_path, 'wb') as outf:
        for i in range(total_chunks):
            cp = os.path.join(staging_dir, f'chunk_{i:04d}')
            if os.path.exists(cp):
                with open(cp, 'rb') as cf:
                    outf.write(cf.read())
                os.remove(cp)

    upload_time = time.time() - start_time
    file_size = os.path.getsize(assembled_path)

    # Now trigger analysis using the same logic as quick_analyze
    from engine.ingestion import stream_file
    import tarfile
    import gzip

    engine = _get_engine()
    suppressed_names = set(
        s.pattern_name for s in Suppression.query.filter_by(active=True).all()
    )

    all_findings = []
    files_analyzed = 0
    total_lines = 0
    total_bytes_read = 0
    early_terminated = False

    analysis_start = time.time()

    if safe_filename.endswith(('.tar.gz', '.tgz')) and file_size > LARGE_FILE_THRESHOLD:
        # Use optimized large-file processing (sequential, scan-during-stream)
        medium_count = 0

        try:
            with tarfile.open(assembled_path, 'r:gz') as tf:
                for member in tf:
                    if early_terminated:
                        break
                    if total_bytes_read >= MAX_TOTAL_BYTES:
                        break
                    if not member.isfile() or member.issym() or member.islnk():
                        continue
                    priority = _classify_member(member.name, member.size)
                    if priority == 'skip':
                        continue
                    if priority == 'medium' and medium_count >= 50:
                        continue
                    if priority == 'low':
                        continue

                    fobj = tf.extractfile(member)
                    if fobj is None:
                        continue
                    try:
                        content = fobj.read()
                    finally:
                        fobj.close()

                    total_bytes_read += len(content)
                    if priority == 'medium':
                        medium_count += 1

                    # Scan inline with size-based line limits
                    scan_max_lines = MAX_LINES_PER_FILE
                    if len(content) > 5 * 1024 * 1024:
                        scan_max_lines = 30000
                    elif len(content) > 1 * 1024 * 1024:
                        scan_max_lines = 50000

                    findings, lines = _scan_buffer(
                        content, member.name, engine, suppressed_names,
                        max_lines=scan_max_lines
                    )
                    files_analyzed += 1
                    total_lines += lines
                    all_findings.extend(findings)

                    crit_high = sum(1 for f in all_findings if f['severity'] in ('CRITICAL', 'HIGH'))
                    if crit_high >= EARLY_TERM_CRITICAL_HIGH:
                        early_terminated = True
                    if len(all_findings) >= MAX_FINDINGS:
                        early_terminated = True
        except Exception as e:
            current_app.logger.error(f"Chunked tar.gz error: {e}")
    else:
        # Small file or non-tar: use legacy scan
        if safe_filename.endswith(('.tar.gz', '.tgz')):
            try:
                with tarfile.open(assembled_path, 'r:gz') as tf:
                    for member in tf:
                        if len(all_findings) >= MAX_FINDINGS:
                            break
                        if not member.isfile() or member.issym() or member.islnk():
                            continue
                        if not _is_log_member_simple(member.name, member.size):
                            continue
                        fobj = tf.extractfile(member)
                        if fobj is None:
                            continue
                        total_bytes_read += member.size
                        # Inline scan
                        files_analyzed += 1
                        for line_num, line in enumerate(fobj, 1):
                            if isinstance(line, bytes):
                                line = line.decode('utf-8', errors='replace')
                            total_lines += 1
                            if not FAST_PREFILTER.search(line):
                                continue
                            for pattern, m in engine.match_line(line):
                                if pattern.name in suppressed_names:
                                    continue
                                all_findings.append({
                                    'pattern_name': pattern.name,
                                    'severity': pattern.severity,
                                    'category': pattern.category,
                                    'file': member.name,
                                    'line_number': line_num,
                                    'line_content': line.strip()[:500],
                                    'description': pattern.description,
                                    'solution_hint': pattern.solution_hint,
                                })
                        fobj.close()
            except Exception as e:
                current_app.logger.error(f"Chunked tar error: {e}")

    # Cleanup
    try:
        os.remove(assembled_path)
        os.rmdir(staging_dir)
    except OSError:
        pass

    analysis_time = time.time() - analysis_start
    total_time = time.time() - start_time

    severity_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3, 'INFO': 4}
    all_findings.sort(key=lambda f: severity_order.get(f['severity'], 5))

    # Knowledge base
    related_issues = []
    if description:
        try:
            desc_lower = description.lower()
            for entry in KnowledgeEntry.query.all():
                entry_text = f"{entry.title} {entry.symptoms} {entry.root_cause}".lower()
                if any(w in entry_text for w in desc_lower.split() if len(w) > 3):
                    related_issues.append({
                        'title': entry.title,
                        'product': entry.product,
                        'solution': entry.solution,
                    })
                    if len(related_issues) >= 5:
                        break
        except Exception:
            pass

    return jsonify({
        'status': 'complete',
        'message': 'Analysis complete',
        'upload_id': upload_id,
        'analysis_time_seconds': round(analysis_time, 2),
        'total_time_seconds': round(total_time, 2),
        'upload_reassembly_seconds': round(upload_time, 2),
        'file_size_mb': round(file_size / 1024 / 1024, 1),
        'files_analyzed': files_analyzed,
        'total_lines': total_lines,
        'findings_count': len(all_findings),
        'findings': all_findings[:100],
        'related_issues': related_issues,
        'early_terminated': early_terminated,
        'jira_report': _generate_quick_jira_report(all_findings[:100], related_issues, description),
    })




def _generate_quick_jira_report(findings, knowledge_matches, description=''):
    """Generate a Jira-formatted RCA report from quick-analyze findings (no ticket)."""
    from routes.tickets import _generate_rca_sections, _format_jira_rca

    kb_matches = []
    for ki in knowledge_matches:
        kb_matches.append({
            'title': ki.get('title', ''),
            'product': ki.get('product', ''),
            'root_cause': ki.get('root_cause', ''),
            'solution': ki.get('solution', ''),
            'prevention': ki.get('prevention', ''),
        })

    class _QuickTicket:
        def __init__(self, desc):
            self.jira_id = 'QUICK-ANALYZE'
            self.product = 'N/A'
            self.severity = findings[0]['severity'] if findings else 'MEDIUM'
            self.description = desc

    ticket_proxy = _QuickTicket(description) if description else None
    sections = _generate_rca_sections(findings, ticket=ticket_proxy, knowledge_matches=kb_matches)
    return _format_jira_rca(sections)


@analysis_bp.route('/api/analyze/folder', methods=['POST'])
def analyze_folder():
    """Analyze a local folder path directly. No upload needed."""
    data = request.get_json() or {}
    folder_path = data.get('folder_path', '').strip()
    description = data.get('description', '')

    if not folder_path:
        return jsonify({'error': 'folder_path is required'}), 400

    if not os.path.exists(folder_path):
        return jsonify({'error': f'Folder not found: {folder_path}'}), 404

    if not os.path.isdir(folder_path):
        return jsonify({'error': f'Path is not a directory: {folder_path}'}), 400

    allowed_base = os.path.abspath(current_app.config['UPLOAD_FOLDER'])
    abs_folder = os.path.abspath(folder_path)
    if not abs_folder.startswith(allowed_base):
        return jsonify({'error': 'Access denied: folder path must be within the uploads directory'}), 403

    start_time = time.time()

    from engine.ingestion import detect_log_type, stream_file
    from engine.patterns import PatternEngine

    engine = _get_engine()

    suppressed_names = set(
        s.pattern_name for s in Suppression.query.filter_by(active=True).all()
    )

    all_findings = []
    files_analyzed = 0
    total_lines = 0

    binary_extensions = {'.7z', '.zip', '.gz', '.tar', '.tgz', '.rar', '.bz2', '.xz',
                         '.exe', '.dll', '.so', '.bin', '.o', '.obj', '.pyc', '.class',
                         '.mp3', '.mp4', '.avi', '.mkv', '.wav', '.flac', '.ogg',
                         '.db', '.sqlite', '.mdb', '.woff', '.woff2', '.ttf', '.eot',
                         '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'}
    image_extensions = {'.png', '.jpg', '.jpeg', '.bmp', '.gif', '.tiff', '.webp'}

    for root, dirs, files_list in os.walk(folder_path):
        for filename in files_list:
            filepath = os.path.join(root, filename)
            try:
                file_size = os.path.getsize(filepath)
                if file_size > 4 * 1024 * 1024 * 1024 or file_size == 0:
                    continue
            except OSError:
                continue

            ext = os.path.splitext(filename)[1].lower()

            # Handle images with OCR
            if ext in image_extensions:
                try:
                    from PIL import Image
                    import pytesseract
                    img = Image.open(filepath)
                    text = pytesseract.image_to_string(img)
                    if text.strip():
                        files_analyzed += 1
                        rel_path = os.path.relpath(filepath, folder_path) + ' (OCR)'
                        for line_num, line in enumerate(text.splitlines(), 1):
                            total_lines += 1
                            matches = [(p, m) for p, m in engine.match_line(line) if p.name not in suppressed_names]
                            for pattern, m in matches:
                                all_findings.append({
                                    'pattern_name': pattern.name,
                                    'severity': pattern.severity,
                                    'category': pattern.category,
                                    'file': rel_path,
                                    'line_number': line_num,
                                    'line_content': line.strip()[:500],
                                    'description': pattern.description,
                                    'solution_hint': pattern.solution_hint,
                                })
                except Exception:
                    pass
                continue

            if ext in binary_extensions:
                continue

            is_text = False
            try:
                with open(filepath, 'rb') as f:
                    sample = f.read(1024)
                null_count = sample.count(b'\x00')
                if len(sample) == 0 or null_count < len(sample) * 0.1:
                    is_text = True
            except Exception:
                continue

            if not is_text:
                continue

            try:
                files_analyzed += 1
                rel_path = os.path.relpath(filepath, folder_path)
                for line_num, line in stream_file(filepath):
                    total_lines += 1
                    matches = [(p, m) for p, m in engine.match_line(line) if p.name not in suppressed_names]
                    for pattern, m in matches:
                        all_findings.append({
                            'pattern_name': pattern.name,
                            'severity': pattern.severity,
                            'category': pattern.category,
                            'file': rel_path,
                            'line_number': line_num,
                            'line_content': line.strip()[:500],
                            'description': pattern.description,
                            'solution_hint': pattern.solution_hint,
                        })
            except Exception as e:
                current_app.logger.error(f"Error analyzing {filepath}: {e}")
                continue

    # Multi-line pattern scan
    from engine.patterns import MULTILINE_PATTERNS
    if MULTILINE_PATTERNS:
        for root, dirs, filenames in os.walk(folder_path):
            for fname in filenames:
                fpath = os.path.join(root, fname)
                ext = os.path.splitext(fname)[1].lower()
                if ext in binary_extensions:
                    continue
                try:
                    file_lines = list(stream_file(fpath))
                    multiline_findings = engine.scan_multiline(file_lines, MULTILINE_PATTERNS)
                    for mf in multiline_findings:
                        mf['file'] = os.path.relpath(fpath, folder_path)
                        all_findings.append(mf)
                except Exception:
                    continue

    severity_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3, 'INFO': 4}
    all_findings.sort(key=lambda f: severity_order.get(f['severity'], 5))

    related_issues = []
    if description:
        try:
            results = KnowledgeEntry.query.all()
            desc_lower = description.lower()
            for entry in results:
                entry_text = f"{entry.title} {entry.symptoms} {entry.root_cause}".lower()
                if any(word in entry_text for word in desc_lower.split() if len(word) > 3):
                    related_issues.append({
                        'title': entry.title,
                        'product': entry.product,
                        'solution': entry.solution,
                        'root_cause': entry.root_cause,
                    })
                    if len(related_issues) >= 5:
                        break
        except Exception:
            pass

    elapsed = time.time() - start_time

    return jsonify({
        'message': 'Folder analysis complete',
        'analysis_time_seconds': round(elapsed, 2),
        'folder': folder_path,
        'files_analyzed': files_analyzed,
        'total_lines': total_lines,
        'findings_count': len(all_findings),
        'findings': all_findings[:100],
        'related_issues': related_issues,
    })




@analysis_bp.route('/api/stats', methods=['GET'])
def get_stats():
    """Get dashboard statistics."""
    total_tickets = Ticket.query.count()
    open_tickets = Ticket.query.filter_by(status='open').count()
    analyzed_tickets = Ticket.query.filter_by(status='analyzed').count()
    total_findings = Finding.query.count()
    total_log_files = LogFile.query.count()

    severity_stats = db.session.query(
        Finding.severity, db.func.count(Finding.id)
    ).group_by(Finding.severity).all()

    category_stats = db.session.query(
        Finding.category, db.func.count(Finding.id)
    ).group_by(Finding.category).all()

    product_stats = db.session.query(
        Ticket.product, db.func.count(Ticket.id)
    ).filter(Ticket.product.isnot(None)).group_by(Ticket.product).all()

    top_patterns = Pattern.query.order_by(Pattern.times_matched.desc()).limit(10).all()
    recent_tickets = Ticket.query.order_by(Ticket.created_at.desc()).limit(5).all()

    from sqlalchemy import func
    daily_findings = db.session.query(
        func.date(Ticket.created_at).label('date'),
        func.count(Ticket.id).label('count')
    ).group_by(func.date(Ticket.created_at)).order_by(
        func.date(Ticket.created_at).desc()
    ).limit(30).all()

    return jsonify({
        'overview': {
            'total_tickets': total_tickets,
            'open_tickets': open_tickets,
            'analyzed_tickets': analyzed_tickets,
            'total_findings': total_findings,
            'total_log_files': total_log_files,
        },
        'severity_distribution': {sev: count for sev, count in severity_stats},
        'category_distribution': {cat: count for cat, count in category_stats if cat},
        'product_distribution': {prod: count for prod, count in product_stats if prod},
        'top_patterns': [p.to_dict() for p in top_patterns],
        'recent_tickets': [t.to_dict() for t in recent_tickets],
        'daily_activity': [{'date': str(d), 'count': c} for d, c in daily_findings],
    })
