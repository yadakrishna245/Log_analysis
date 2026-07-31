"""Analysis routes for LogSherlock Pro."""

import os
import tempfile
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from models import db, Ticket, LogFile, Finding, Pattern, KnowledgeEntry
from engine.analyzer import analyze_ticket

analysis_bp = Blueprint('analysis', __name__)

# ── Zip Bomb Protection ──────────────────────────────────────────────────
# Maximum total decompressed size allowed (default 10GB)
MAX_DECOMPRESSED_SIZE = int(os.environ.get('MAX_DECOMPRESSED_SIZE_GB', '10')) * 1024 * 1024 * 1024
# Maximum compression ratio allowed (100:1 is suspicious, 1000:1 is definitely a bomb)
MAX_COMPRESSION_RATIO = int(os.environ.get('MAX_COMPRESSION_RATIO', '100'))


def _check_zip_bomb(archive_path, archive_size):
    """Check if an archive is a potential zip bomb before extraction.

    Detection methods:
    1. Check declared uncompressed size vs compressed size (ratio check)
    2. Monitor total extracted bytes during extraction (streaming check)

    Returns (is_safe, reason) tuple.
    """
    import zipfile
    if not zipfile.is_zipfile(archive_path):
        return True, 'Not a zip file'

    try:
        with zipfile.ZipFile(archive_path, 'r') as zf:
            total_uncompressed = sum(info.file_size for info in zf.infolist())

            # Check total size
            if total_uncompressed > MAX_DECOMPRESSED_SIZE:
                return False, f'Declared uncompressed size ({total_uncompressed / 1e9:.1f}GB) exceeds limit ({MAX_DECOMPRESSED_SIZE / 1e9:.0f}GB)'

            # Check compression ratio
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


@analysis_bp.route('/api/analyze/quick', methods=['POST'])
def quick_analyze():
    """Upload files (any format: 7z, zip, tar.gz, raw logs) and analyze instantly."""
    description = request.form.get('description', '')

    # Create temp folder for this analysis
    import uuid
    analysis_id = str(uuid.uuid4())[:8]
    analysis_folder = os.path.join(current_app.config['UPLOAD_FOLDER'], analysis_id)
    os.makedirs(analysis_folder, exist_ok=True)

    # Handle file upload
    files = request.files.getlist('files') or []
    if 'file' in request.files:
        files.append(request.files['file'])

    if not files:
        return jsonify({'error': 'No files provided'}), 400

    for file in files:
        if not file or not file.filename:
            continue
        filename = secure_filename(file.filename)
        filepath = os.path.join(analysis_folder, filename)
        file.save(filepath)

        # Auto-extract archives OR OCR images
        try:
            if filename.endswith('.7z'):
                from engine.ingestion import extract_7z
                extract_dir = os.path.join(analysis_folder, os.path.splitext(filename)[0])
                extract_7z(filepath, extract_dir)
                os.remove(filepath)  # Remove archive after extraction
            elif filename.endswith('.zip'):
                import zipfile
                # Zip bomb protection
                archive_size = os.path.getsize(filepath)
                is_safe, reason = _check_zip_bomb(filepath, archive_size)
                if not is_safe:
                    current_app.logger.warning(f"ZIP BOMB DETECTED: {filename} - {reason}")
                    os.remove(filepath)
                    return jsonify({'error': f'Archive rejected: {reason}'}), 400
                extract_dir = os.path.join(analysis_folder, os.path.splitext(filename)[0])
                os.makedirs(extract_dir, exist_ok=True)
                with zipfile.ZipFile(filepath, 'r') as zf:
                    # Validate paths to prevent zip-slip
                    for info in zf.infolist():
                        member_path = os.path.join(extract_dir, info.filename)
                        if not os.path.abspath(member_path).startswith(os.path.abspath(extract_dir)):
                            raise ValueError(f'Path traversal detected in archive: {info.filename}')
                    zf.extractall(extract_dir)
                os.remove(filepath)
            elif filename.endswith('.tar.gz') or filename.endswith('.tgz'):
                import tarfile
                # Tar bomb protection
                archive_size = os.path.getsize(filepath)
                is_safe, reason = _check_tar_bomb(filepath, archive_size)
                if not is_safe:
                    current_app.logger.warning(f"TAR BOMB DETECTED: {filename} - {reason}")
                    os.remove(filepath)
                    return jsonify({'error': f'Archive rejected: {reason}'}), 400
                extract_dir = os.path.join(analysis_folder, filename.replace('.tar.gz', '').replace('.tgz', ''))
                os.makedirs(extract_dir, exist_ok=True)
                with tarfile.open(filepath, 'r:gz') as tf:
                    # Validate paths to prevent zip-slip
                    for member in tf.getmembers():
                        member_path = os.path.join(extract_dir, member.name)
                        if not os.path.abspath(member_path).startswith(os.path.abspath(extract_dir)):
                            raise ValueError(f'Path traversal detected in archive: {member.name}')
                    tf.extractall(extract_dir)
                os.remove(filepath)
            elif filename.endswith('.tar'):
                import tarfile
                extract_dir = os.path.join(analysis_folder, filename.replace('.tar', ''))
                os.makedirs(extract_dir, exist_ok=True)
                with tarfile.open(filepath, 'r:') as tf:
                    # Validate paths to prevent zip-slip
                    for member in tf.getmembers():
                        member_path = os.path.join(extract_dir, member.name)
                        if not os.path.abspath(member_path).startswith(os.path.abspath(extract_dir)):
                            raise ValueError(f'Path traversal detected in archive: {member.name}')
                    tf.extractall(extract_dir)
                os.remove(filepath)
            elif filename.endswith('.gz') and not filename.endswith('.tar.gz'):
                import gzip
                out_path = os.path.join(analysis_folder, filename[:-3])
                with gzip.open(filepath, 'rb') as f_in:
                    with open(out_path, 'wb') as f_out:
                        while True:
                            chunk = f_in.read(8192)
                            if not chunk:
                                break
                            f_out.write(chunk)
                os.remove(filepath)
            elif filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.gif', '.tiff', '.webp')):
                # OCR: Extract text from screenshot/image
                try:
                    from PIL import Image
                    import pytesseract
                    img = Image.open(filepath)
                    text = pytesseract.image_to_string(img)
                    if text.strip():
                        txt_path = os.path.join(analysis_folder, os.path.splitext(filename)[0] + '_ocr.txt')
                        with open(txt_path, 'w', encoding='utf-8') as f:
                            f.write(f"# OCR extracted from: {filename}\n\n")
                            f.write(text)
                    os.remove(filepath)  # Remove image after OCR
                except Exception as ocr_err:
                    current_app.logger.error(f"OCR failed for {filename}: {ocr_err}")
        except Exception as e:
            current_app.logger.error(f"Failed to extract {filename}: {e}")

    # Now analyze the folder (same as folder analysis)
    from engine.ingestion import stream_file
    from engine.patterns import PatternEngine

    engine = PatternEngine()
    all_findings = []
    files_analyzed = 0
    total_lines = 0

    # Accept ALL text-readable files - any extension (.txt, .log, .ps, .cfg, .conf, .xml, .json, .yaml, .md, etc.)
    # Only skip known binary formats (images already OCR'd above)
    binary_extensions = {'.7z', '.zip', '.gz', '.tar', '.tgz', '.rar', '.bz2', '.xz',
                         '.exe', '.dll', '.so', '.bin', '.o', '.obj', '.pyc', '.class',
                         '.mp3', '.mp4', '.avi', '.mkv', '.wav', '.flac', '.ogg',
                         '.db', '.sqlite', '.mdb', '.woff', '.woff2', '.ttf', '.eot',
                         '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
                         '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp'}

    for root, dirs, filenames in os.walk(analysis_folder):
        for fname in filenames:
            fpath = os.path.join(root, fname)
            try:
                file_size = os.path.getsize(fpath)
                if file_size > 4 * 1024 * 1024 * 1024 or file_size == 0:
                    continue
            except OSError:
                continue

            # Skip known binary extensions
            ext = os.path.splitext(fname)[1].lower()
            if ext in binary_extensions:
                continue

            # For everything else, check if readable as text
            is_text = False
            try:
                with open(fpath, 'rb') as f:
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
                rel_path = os.path.relpath(fpath, analysis_folder)
                for line_num, line in stream_file(fpath):
                    total_lines += 1
                    matches = engine.match_line(line)
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
                current_app.logger.error(f"Error analyzing {fpath}: {e}")
                continue

    # Sort by severity
    severity_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3, 'INFO': 4}
    all_findings.sort(key=lambda f: severity_order.get(f['severity'], 5))

    # Find related known issues
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
                    })
                    if len(related_issues) >= 5:
                        break
        except Exception:
            pass

    return jsonify({
        'message': 'Analysis complete',
        'files_analyzed': files_analyzed,
        'total_lines': total_lines,
        'findings_count': len(all_findings),
        'findings': all_findings[:100],
        'related_issues': related_issues,
        'jira_report': _generate_quick_jira_report(all_findings[:100], related_issues, description),
    })


def _generate_quick_jira_report(findings, knowledge_matches, description=''):
    """Generate a Jira-formatted RCA report from quick-analyze findings (no ticket)."""
    from routes.tickets import _generate_rca_sections, _format_jira_rca

    # Convert knowledge_matches to the format expected by _generate_rca_sections
    kb_matches = []
    for ki in knowledge_matches:
        kb_matches.append({
            'title': ki.get('title', ''),
            'product': ki.get('product', ''),
            'root_cause': ki.get('root_cause', ''),
            'solution': ki.get('solution', ''),
            'prevention': ki.get('prevention', ''),
        })

    # Create a minimal mock-ticket-like object for description
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

    # Run analysis directly on the folder
    from engine.ingestion import detect_log_type, stream_file
    from engine.patterns import PatternEngine

    engine = PatternEngine()
    all_findings = []
    files_analyzed = 0
    total_lines = 0

    # Accept ALL text-readable files - any extension
    binary_extensions = {'.7z', '.zip', '.gz', '.tar', '.tgz', '.rar', '.bz2', '.xz',
                         '.exe', '.dll', '.so', '.bin', '.o', '.obj', '.pyc', '.class',
                         '.mp3', '.mp4', '.avi', '.mkv', '.wav', '.flac', '.ogg',
                         '.db', '.sqlite', '.mdb', '.woff', '.woff2', '.ttf', '.eot',
                         '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'}
    image_extensions = {'.png', '.jpg', '.jpeg', '.bmp', '.gif', '.tiff', '.webp'}

    for root, dirs, files in os.walk(folder_path):
        for filename in files:
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
                            matches = engine.match_line(line)
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

            # Check if text file
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

            # Analyze this file
            try:
                files_analyzed += 1
                rel_path = os.path.relpath(filepath, folder_path)

                for line_num, line in stream_file(filepath):
                    total_lines += 1
                    matches = engine.match_line(line)
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

    # Sort findings by severity
    severity_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3, 'INFO': 4}
    all_findings.sort(key=lambda f: severity_order.get(f['severity'], 5))

    # Search for related known issues
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

    return jsonify({
        'message': 'Folder analysis complete',
        'folder': folder_path,
        'files_analyzed': files_analyzed,
        'total_lines': total_lines,
        'findings_count': len(all_findings),
        'findings': all_findings[:100],  # Top 100 findings
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

    # Severity distribution
    severity_stats = db.session.query(
        Finding.severity, db.func.count(Finding.id)
    ).group_by(Finding.severity).all()

    # Category distribution
    category_stats = db.session.query(
        Finding.category, db.func.count(Finding.id)
    ).group_by(Finding.category).all()

    # Product distribution
    product_stats = db.session.query(
        Ticket.product, db.func.count(Ticket.id)
    ).filter(Ticket.product.isnot(None)).group_by(Ticket.product).all()

    # Top patterns
    top_patterns = Pattern.query.order_by(Pattern.times_matched.desc()).limit(10).all()

    # Recent tickets
    recent_tickets = Ticket.query.order_by(Ticket.created_at.desc()).limit(5).all()

    # Findings over time (by day for last 30 days)
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
