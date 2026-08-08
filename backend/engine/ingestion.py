"""Streaming log ingestion module for LogSherlock Pro.

Handles file reading, archive extraction, log type detection,
and folder scanning for ticket analysis.
"""

import os
import re
from datetime import datetime
from typing import Generator, Optional, Tuple, List, Dict

import py7zr

# Timestamp patterns for various log formats
TIMESTAMP_PATTERNS = [
    # ISO 8601: 2024-01-15T10:30:45.123+05:30
    (re.compile(r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)?)'), '%Y-%m-%dT%H:%M:%S'),
    # Syslog: Jan 15 10:30:45
    (re.compile(r'([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})'), '%b %d %H:%M:%S'),
    # Dmesg style: [12345.678901]
    (re.compile(r'\[\s*(\d+\.\d+)\]'), 'dmesg'),
    # Standard datetime: 2024-01-15 10:30:45
    (re.compile(r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})'), '%Y-%m-%d %H:%M:%S'),
    # US date format: 01/15/2024 10:30:45
    (re.compile(r'(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2})'), '%m/%d/%Y %H:%M:%S'),
    # Epoch seconds
    (re.compile(r'^(\d{10}(?:\.\d+)?)'), 'epoch'),
    # systemd journal: Mon 2024-01-15 10:30:45 UTC
    (re.compile(r'[A-Z][a-z]{2}\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+\w+'), '%Y-%m-%d %H:%M:%S'),
    # Corosync/Pacemaker: Jan 15 10:30:45.123
    (re.compile(r'([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\.\d+)'), '%b %d %H:%M:%S.%f'),
]

# Log type detection patterns
LOG_TYPE_SIGNATURES = {
    'dmesg': [
        re.compile(r'^\[\s*\d+\.\d+\]'),
        re.compile(r'Linux version \d+\.\d+'),
        re.compile(r'Command line:'),
    ],
    'syslog': [
        re.compile(r'^[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\S+\s+\S+(\[\d+\])?:'),
    ],
    'messages': [
        re.compile(r'^[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\S+\s+(kernel|systemd|NetworkManager)'),
    ],
    'mount': [
        re.compile(r'^/dev/\S+\s+on\s+/\S*\s+type\s+\S+'),
        re.compile(r'^\S+\s+/\S*\s+\S+\s+\S+\s+\d+\s+\d+'),
    ],
    'fstab': [
        re.compile(r'^(UUID=|/dev/|LABEL=)\S+\s+/\S*\s+\S+\s+\S+\s+\d+\s+\d+'),
        re.compile(r'^#.*fstab'),
    ],
    'lsblk': [
        re.compile(r'^NAME\s+MAJ:MIN'),
        re.compile(r'^(sd[a-z]|nvme|dm-|loop)\S*\s+\d+:\d+'),
    ],
    'multipath': [
        re.compile(r'^(mpath[a-z]|mpatha)\s+'),
        re.compile(r'^\S+\s+dm-\d+\s+\S+'),
        re.compile(r'\bsize=\d+.*\bfeatures='),
        re.compile(r'\\_ \S+\s+\d+:\d+:\d+:\d+'),
    ],
    'pcs': [
        re.compile(r'^Cluster name:'),
        re.compile(r'^\s*(Online|Offline|OFFLINE):\s*\['),
        re.compile(r'^\s*(Clone|Resource|Group)\s+'),
        re.compile(r'^(Full |Current )?[Ll]ist of resources'),
    ],
    'smad': [
        re.compile(r'smad', re.IGNORECASE),
        re.compile(r'SMAD'),
        re.compile(r'service.*monitor', re.IGNORECASE),
    ],
    'libvirt': [
        re.compile(r'libvirt', re.IGNORECASE),
        re.compile(r'qemu-kvm|qemu-system', re.IGNORECASE),
        re.compile(r'<domain\s+type='),
        re.compile(r'virsh'),
    ],
}

# Filename-based type detection
FILENAME_TYPE_MAP = {
    'dmesg': 'dmesg',
    'syslog': 'syslog',
    'messages': 'messages',
    'mount': 'mount',
    'fstab': 'fstab',
    'lsblk': 'lsblk',
    'multipath': 'multipath',
    'pcs': 'pcs',
    'smad': 'smad',
    'libvirt': 'libvirt',
    'qemu': 'libvirt',
    'corosync': 'pcs',
    'pacemaker': 'pcs',
    'journal': 'messages',
    'kern.log': 'dmesg',
    'daemon.log': 'syslog',
}


def stream_file(filepath: str, encoding: str = 'utf-8') -> Generator[Tuple[int, str], None, None]:
    """Stream lines from a file without loading the entire file into memory.

    Yields (line_number, line_content) tuples.
    Handles encoding errors gracefully.
    """
    line_number = 0
    try:
        with open(filepath, 'r', encoding=encoding, errors='replace') as f:
            for line in f:
                line_number += 1
                yield line_number, line.rstrip('\n\r')
    except (IOError, OSError) as e:
        # Log error but don't crash - yield nothing more
        print(f"[WARN] Could not read file {filepath}: {e}")
    except UnicodeDecodeError:
        # Try latin-1 as fallback
        try:
            with open(filepath, 'r', encoding='latin-1', errors='replace') as f:
                for line in f:
                    line_number += 1
                    yield line_number, line.rstrip('\n\r')
        except (IOError, OSError):
            pass


def extract_7z(archive_path: str, dest_path: str) -> List[str]:
    """Extract a 7z archive to dest_path.

    Returns list of extracted file paths.
    """
    extracted_files = []
    os.makedirs(dest_path, exist_ok=True)

    try:
        with py7zr.SevenZipFile(archive_path, mode='r') as z:
            z.extractall(path=dest_path)

        # Walk the extracted directory to get all files
        for root, dirs, files in os.walk(dest_path):
            for fname in files:
                full_path = os.path.join(root, fname)
                extracted_files.append(full_path)
    except Exception as e:
        print(f"[ERROR] Failed to extract 7z archive {archive_path}: {e}")
        raise

    return extracted_files


def detect_log_type(filepath: str, first_lines: Optional[List[str]] = None) -> str:
    """Auto-detect log file type based on filename and content.

    Checks filename first, then content patterns.
    Returns one of: dmesg, syslog, mount, fstab, lsblk, multipath, pcs, smad, messages, libvirt, unknown
    """
    basename = os.path.basename(filepath).lower()

    # Check filename first
    for key, log_type in FILENAME_TYPE_MAP.items():
        if key in basename:
            return log_type

    # Check file extension hints
    if basename.endswith('.xml') and ('domain' in basename or 'libvirt' in basename):
        return 'libvirt'

    # Content-based detection
    if first_lines is None:
        first_lines = []
        try:
            with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
                for i, line in enumerate(f):
                    if i >= 20:
                        break
                    first_lines.append(line.strip())
        except (IOError, OSError):
            return 'unknown'

    if not first_lines:
        return 'unknown'

    # Score each type
    scores = {}
    for log_type, patterns in LOG_TYPE_SIGNATURES.items():
        score = 0
        for pattern in patterns:
            for line in first_lines:
                if pattern.search(line):
                    score += 1
                    break
        if score > 0:
            scores[log_type] = score

    if scores:
        return max(scores, key=scores.get)

    return 'unknown'


def parse_timestamp(line: str) -> Optional[datetime]:
    """Parse timestamp from a log line. Handles multiple formats.

    Returns datetime object or None if no timestamp found.
    """
    for pattern, fmt in TIMESTAMP_PATTERNS:
        match = pattern.search(line)
        if match:
            ts_str = match.group(1)
            try:
                if fmt == 'dmesg':
                    # Dmesg timestamps are seconds since boot - return relative
                    seconds = float(ts_str)
                    return datetime(2000, 1, 1, 0, 0, 0).replace(
                        second=int(seconds % 60),
                        minute=int((seconds // 60) % 60),
                        hour=int((seconds // 3600) % 24)
                    )
                elif fmt == 'epoch':
                    return datetime.fromtimestamp(float(ts_str))
                elif 'T' in ts_str:
                    # ISO format with timezone - strip timezone for simplicity
                    clean = re.sub(r'[+-]\d{2}:\d{2}$', '', ts_str).replace('Z', '')
                    if '.' in clean:
                        return datetime.strptime(clean[:26], '%Y-%m-%dT%H:%M:%S.%f')
                    return datetime.strptime(clean, '%Y-%m-%dT%H:%M:%S')
                else:
                    parsed = datetime.strptime(ts_str.strip(), fmt)
                    # Syslog timestamps lack year - use current year
                    if parsed.year == 1900:
                        parsed = parsed.replace(year=datetime.now().year)
                    return parsed
            except (ValueError, OSError, OverflowError):
                continue
    return None


def detect_node_name(folder_path: str) -> Dict[str, str]:
    """Detect node names from folder structure.

    Common patterns:
    - ticket_folder/node1/logs/...
    - ticket_folder/hostname/var/log/...

    Returns dict mapping filepath -> node_name
    """
    node_map = {}
    base_items = []

    try:
        base_items = os.listdir(folder_path)
    except OSError:
        return node_map

    # Check if direct children are node directories
    node_dirs = []
    for item in base_items:
        item_path = os.path.join(folder_path, item)
        if os.path.isdir(item_path):
            # Heuristic: if subdir contains log-like files or var/log, it's a node
            has_logs = False
            for root, dirs, files in os.walk(item_path):
                for f in files:
                    lower_f = f.lower()
                    if any(x in lower_f for x in ['log', 'messages', 'dmesg', 'syslog', 'journal']):
                        has_logs = True
                        break
                if has_logs:
                    break
            if has_logs:
                node_dirs.append(item)

    # If we found node directories, map all files under them
    if node_dirs:
        for node_dir in node_dirs:
            node_path = os.path.join(folder_path, node_dir)
            # HPE VME: tag node_name with role prefix
            tagged_name = _tag_hpe_node_name(node_dir)
            for root, dirs, files in os.walk(node_path):
                for f in files:
                    filepath = os.path.join(root, f)
                    node_map[filepath] = tagged_name

    return node_map


def _tag_hpe_node_name(dir_name: str) -> str:
    """Tag directory name with HPE VME role prefix if it matches known patterns."""
    lower = dir_name.lower()
    manager_keywords = ('manager', 'morpheus', 'appliance')
    node_keywords = ('node', 'host', 'server', 'hvm')

    if any(kw in lower for kw in manager_keywords):
        return f"manager:{dir_name}"
    if any(kw in lower for kw in node_keywords):
        return f"node:{dir_name}"
    return dir_name


def ingest_ticket_folder(folder_path: str, ticket_id: int) -> List[Dict]:
    """Scan a ticket folder, detect nodes, and catalog all log files.

    Returns list of dicts with file info:
    {filepath, filename, file_type, file_size, node_name, line_count}
    """
    if not os.path.isdir(folder_path):
        raise ValueError(f"Folder not found: {folder_path}")

    # Detect node structure
    node_map = detect_node_name(folder_path)

    # Scan all files
    file_info_list = []
    skip_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.pdf',
                       '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
                       '.zip', '.tar', '.gz', '.bz2', '.exe', '.dll', '.so',
                       '.pyc', '.class', '.o', '.obj'}

    for root, dirs, files in os.walk(folder_path):
        # Skip hidden directories
        dirs[:] = [d for d in dirs if not d.startswith('.')]

        for filename in files:
            if filename.startswith('.'):
                continue

            filepath = os.path.join(root, filename)
            ext = os.path.splitext(filename)[1].lower()

            # Handle 7z archives
            if ext == '.7z':
                extract_dir = filepath + '_extracted'
                try:
                    extracted = extract_7z(filepath, extract_dir)
                    for ef in extracted:
                        ef_ext = os.path.splitext(ef)[1].lower()
                        if ef_ext in skip_extensions:
                            continue
                        ef_size = os.path.getsize(ef) if os.path.isfile(ef) else 0
                        first_lines = _read_first_lines(ef, 20)
                        file_type = detect_log_type(ef, first_lines)
                        node_name = node_map.get(ef, node_map.get(filepath, _infer_node(ef, folder_path)))
                        line_count = _count_lines(ef)

                        file_info_list.append({
                            'filepath': ef,
                            'filename': os.path.basename(ef),
                            'file_type': file_type,
                            'file_size': ef_size,
                            'node_name': node_name,
                            'line_count': line_count,
                        })
                except Exception as e:
                    print(f"[WARN] Could not extract {filepath}: {e}")
                continue

            if ext in skip_extensions:
                continue

            file_size = os.path.getsize(filepath) if os.path.isfile(filepath) else 0
            first_lines = _read_first_lines(filepath, 20)
            file_type = detect_log_type(filepath, first_lines)
            node_name = node_map.get(filepath, _infer_node(filepath, folder_path))
            line_count = _count_lines(filepath)

            file_info_list.append({
                'filepath': filepath,
                'filename': filename,
                'file_type': file_type,
                'file_size': file_size,
                'node_name': node_name,
                'line_count': line_count,
            })

    # HPE VME priority sorting: manager logs first, then node logs, then others
    file_info_list.sort(key=lambda f: _hpe_vme_priority(f.get('filepath', ''), f.get('node_name', '')))

    return file_info_list


def _hpe_vme_priority(filepath: str, node_name: str) -> int:
    """Assign priority order for HPE VME folder structure.

    Lower number = higher priority (processed first).
    Priority:
        0 - Manager/Morpheus/Appliance logs (control plane)
        1 - Node/Host/Server/HVM logs (compute nodes)
        2 - Everything else
    """
    path_lower = filepath.lower()
    node_lower = (node_name or '').lower()

    # Highest priority: manager/control-plane logs
    manager_keywords = ('manager', 'morpheus', 'appliance')
    if any(kw in path_lower for kw in manager_keywords) or node_lower.startswith('manager:'):
        return 0

    # Second priority: compute node logs
    node_keywords = ('node', 'host', 'server', 'hvm')
    if any(kw in path_lower for kw in node_keywords) or node_lower.startswith('node:'):
        return 1

    # Default priority
    return 2


def _read_first_lines(filepath: str, count: int = 20) -> List[str]:
    """Read first N lines of a file."""
    lines = []
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            for i, line in enumerate(f):
                if i >= count:
                    break
                lines.append(line.strip())
    except (IOError, OSError):
        pass
    return lines


def _count_lines(filepath: str) -> int:
    """Count lines in a file efficiently."""
    count = 0
    try:
        with open(filepath, 'rb') as f:
            buf_size = 1024 * 1024  # 1MB buffer
            while True:
                buf = f.read(buf_size)
                if not buf:
                    break
                count += buf.count(b'\n')
    except (IOError, OSError):
        pass
    return count


def _infer_node(filepath: str, base_folder: str) -> Optional[str]:
    """Infer node name from filepath relative to base folder.

    Recognizes HPE VME folder structures:
    - Folders with 'manager', 'morpheus', 'appliance' → manager node
    - Folders with 'node', 'host', 'server', 'hvm' → compute/host node
    """
    rel_path = os.path.relpath(filepath, base_folder)
    parts = rel_path.split(os.sep)

    # HPE VME folder pattern detection across all path components
    manager_keywords = {'manager', 'morpheus', 'appliance'}
    node_keywords = {'node', 'host', 'server', 'hvm'}

    for part in parts[:-1]:  # Exclude the filename itself
        part_lower = part.lower()
        # Check for manager-type folders
        if any(kw in part_lower for kw in manager_keywords):
            return f"manager:{part}"
        # Check for compute/host node folders
        if any(kw in part_lower for kw in node_keywords):
            return f"node:{part}"

    # Fallback: first directory component as node name
    if len(parts) > 1:
        candidate = parts[0]
        # Filter out common non-node directory names
        non_node_names = {'var', 'log', 'etc', 'tmp', 'opt', 'usr', 'home',
                          'root', 'extracted', 'logs', 'data', 'output'}
        if candidate.lower() not in non_node_names and not candidate.startswith('.'):
            return candidate
    return None
