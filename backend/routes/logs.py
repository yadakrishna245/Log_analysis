"""
LogSherlock Pro - Logs Blueprint
File upload, extraction, and log file management.
"""

import os
import hashlib
from pathlib import Path
from flask import Blueprint, request, jsonify, abort, current_app
from werkzeug.utils import secure_filename
from models import db, LogFile, Ticket

logs_bp = Blueprint('logs', __name__)


@logs_bp.route('/upload/<int:ticket_id>', methods=['POST'])
def upload_log(ticket_id):
    """Upload log files or archives for a ticket."""
    ticket = Ticket.query.get_or_404(ticket_id)

    if 'file' not in request.files:
        abort(400, description='No file provided')

    file = request.files['file']
    if file.filename == '':
        abort(400, description='No file selected')

    filename = secure_filename(file.filename)
    ext = Path(filename).suffix.lower()

    allowed = current_app.config.get('ALLOWED_EXTENSIONS', set())
    if ext not in allowed:
        abort(400, description=f'File type {ext} not allowed. Allowed: {", ".join(sorted(allowed))}')

    # Create ticket-specific upload directory
    upload_dir = Path(current_app.config['UPLOAD_FOLDER']) / str(ticket_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Save with unique name
    import uuid
    stored_name = f"{uuid.uuid4().hex}_{filename}"
    file_path = upload_dir / stored_name
    file.save(str(file_path))

    # Compute checksum
    sha256 = _compute_sha256(str(file_path))
    file_size = file_path.stat().st_size

    is_archive = ext in {'.7z', '.zip', '.rar', '.tar', '.gz', '.bz2'}

    log_file = LogFile(
        ticket_id=ticket_id,
        original_filename=filename,
        stored_filename=stored_name,
        file_path=str(file_path),
        file_size_bytes=file_size,
        file_type='archive' if is_archive else 'log',
        checksum_sha256=sha256,
        is_archive=is_archive,
        analysis_status='pending',
    )
    db.session.add(log_file)
    db.session.commit()

    # If archive, trigger extraction
    if is_archive:
        _extract_archive(log_file, ticket_id)

    return jsonify({
        'id': log_file.id,
        'filename': filename,
        'size_bytes': file_size,
        'is_archive': is_archive,
        'status': log_file.analysis_status,
        'message': 'File uploaded successfully',
    }), 201


@logs_bp.route('/ticket/<int:ticket_id>', methods=['GET'])
def list_logs_for_ticket(ticket_id):
    """List all log files for a ticket."""
    Ticket.query.get_or_404(ticket_id)
    log_files = LogFile.query.filter_by(ticket_id=ticket_id).order_by(LogFile.uploaded_at.desc()).all()

    return jsonify({
        'ticket_id': ticket_id,
        'files': [{
            'id': lf.id,
            'filename': lf.original_filename,
            'size_bytes': lf.file_size_bytes,
            'file_type': lf.file_type,
            'is_archive': lf.is_archive,
            'is_extracted': lf.is_extracted,
            'analysis_status': lf.analysis_status,
            'line_count': lf.line_count,
            'uploaded_at': lf.uploaded_at.isoformat() if lf.uploaded_at else None,
            'analyzed_at': lf.analyzed_at.isoformat() if lf.analyzed_at else None,
        } for lf in log_files],
        'total': len(log_files),
    })


@logs_bp.route('/<int:log_file_id>', methods=['GET'])
def get_log_file(log_file_id):
    """Get details of a specific log file."""
    lf = LogFile.query.get_or_404(log_file_id)
    return jsonify({
        'id': lf.id,
        'ticket_id': lf.ticket_id,
        'filename': lf.original_filename,
        'stored_filename': lf.stored_filename,
        'size_bytes': lf.file_size_bytes,
        'file_type': lf.file_type,
        'mime_type': lf.mime_type,
        'checksum_sha256': lf.checksum_sha256,
        'is_archive': lf.is_archive,
        'is_extracted': lf.is_extracted,
        'line_count': lf.line_count,
        'analysis_status': lf.analysis_status,
        'uploaded_at': lf.uploaded_at.isoformat() if lf.uploaded_at else None,
        'analyzed_at': lf.analyzed_at.isoformat() if lf.analyzed_at else None,
        'children_count': lf.children.count() if lf.is_archive else 0,
    })


@logs_bp.route('/<int:log_file_id>', methods=['DELETE'])
def delete_log_file(log_file_id):
    """Delete a log file and its extracted contents."""
    lf = LogFile.query.get_or_404(log_file_id)

    # Remove physical files
    if os.path.exists(lf.file_path):
        os.remove(lf.file_path)
    if lf.extraction_path and os.path.isdir(lf.extraction_path):
        import shutil
        shutil.rmtree(lf.extraction_path, ignore_errors=True)

    db.session.delete(lf)
    db.session.commit()
    return jsonify({'message': 'Log file deleted'}), 200


@logs_bp.route('/<int:log_file_id>/content', methods=['GET'])
def get_log_content(log_file_id):
    """Get content of a log file with pagination by line numbers."""
    lf = LogFile.query.get_or_404(log_file_id)

    if lf.is_archive and not lf.is_extracted:
        abort(400, description='Archive not yet extracted')

    file_path = lf.extraction_path or lf.file_path
    if not os.path.exists(file_path):
        abort(404, description='File not found on disk')

    start_line = request.args.get('start', 0, type=int)
    num_lines = request.args.get('lines', 200, type=int)
    num_lines = min(num_lines, 5000)

    lines = []
    with open(file_path, 'r', errors='replace') as f:
        for i, line in enumerate(f):
            if i < start_line:
                continue
            if i >= start_line + num_lines:
                break
            lines.append({'line_num': i + 1, 'content': line.rstrip('\n\r')})

    return jsonify({
        'file_id': log_file_id,
        'start_line': start_line,
        'lines_returned': len(lines),
        'lines': lines,
    })


def _compute_sha256(filepath):
    """Compute SHA-256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            sha256.update(chunk)
    return sha256.hexdigest()


def _extract_archive(log_file, ticket_id):
    """Extract an archive file and register contents (with path traversal protection)."""
    extract_base = Path(current_app.config['EXTRACTION_FOLDER']) / str(ticket_id) / str(log_file.id)
    extract_base.mkdir(parents=True, exist_ok=True)

    ext = Path(log_file.original_filename).suffix.lower()
    extract_base_str = str(extract_base.resolve())

    def _is_safe_path(member_path):
        """Check if extracted path stays within extract_base (prevents zip-slip/tar-slip)."""
        abs_path = os.path.abspath(os.path.join(extract_base_str, member_path))
        return abs_path.startswith(extract_base_str)

    try:
        if ext == '.7z':
            import py7zr
            with py7zr.SevenZipFile(log_file.file_path, mode='r') as z:
                # Validate all paths before extraction
                for name in z.getnames():
                    if not _is_safe_path(name):
                        current_app.logger.warning(f"Path traversal attempt in 7z: {name}")
                        raise ValueError(f"Unsafe path in archive: {name}")
                z.extractall(path=str(extract_base))
        elif ext == '.zip':
            import zipfile
            with zipfile.ZipFile(log_file.file_path, 'r') as z:
                for member in z.namelist():
                    if not _is_safe_path(member):
                        current_app.logger.warning(f"Path traversal attempt in zip: {member}")
                        continue  # Skip unsafe paths
                    z.extract(member, str(extract_base))
        elif ext == '.rar':
            import rarfile
            with rarfile.RarFile(log_file.file_path, 'r') as z:
                for member in z.namelist():
                    if not _is_safe_path(member):
                        current_app.logger.warning(f"Path traversal attempt in rar: {member}")
                        continue
                    z.extract(member, str(extract_base))
        elif ext in {'.tar', '.gz', '.bz2'}:
            import tarfile
            with tarfile.open(log_file.file_path, 'r:*') as z:
                # Safe extraction: validate each member before extracting
                for member in z.getmembers():
                    # Block symlinks, hardlinks, and path traversal
                    if member.issym() or member.islnk():
                        current_app.logger.warning(f"Skipping symlink/hardlink in tar: {member.name}")
                        continue
                    if not _is_safe_path(member.name):
                        current_app.logger.warning(f"Path traversal attempt in tar: {member.name}")
                        continue
                    z.extract(member, str(extract_base))

        log_file.is_extracted = True
        log_file.extraction_path = str(extract_base)

        # Register extracted files
        for root, dirs, files in os.walk(extract_base):
            for fname in files:
                fpath = os.path.join(root, fname)
                child = LogFile(
                    ticket_id=ticket_id,
                    original_filename=fname,
                    stored_filename=fname,
                    file_path=fpath,
                    file_size_bytes=os.path.getsize(fpath),
                    file_type='log',
                    is_archive=False,
                    parent_archive_id=log_file.id,
                    analysis_status='pending',
                )
                db.session.add(child)

        db.session.commit()

    except Exception as e:
        current_app.logger.error(f"Extraction failed for {log_file.original_filename}: {e}")
        log_file.analysis_status = 'failed'
        db.session.commit()
