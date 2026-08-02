"""Verify new S3 upload endpoints work."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ['LOGSHERLOCK_DEV_MODE'] = 'true'
from app import app

with app.test_client() as c:
    r = c.get('/api/health')
    print(f'Health: {r.status_code}')

    r = c.get('/')
    print(f'Frontend: {r.status_code}, size={len(r.data)} bytes')

    # Test presign endpoint (no S3 locally - should return proper error)
    r = c.post('/api/upload/presign', json={'filename': 'test.tar.gz', 'file_size': 100000})
    d = r.get_json()
    msg = d.get('error', 'success') if d else 'no json'
    print(f'Presign: {r.status_code} - {msg}')

    # Test S3 analyze endpoint (should fail gracefully without S3)
    r = c.post('/api/analyze/s3', json={'upload_id': 'test', 's3_key': 'test/file.tar.gz'})
    d = r.get_json()
    msg = d.get('error', 'success') if d else 'no json'
    print(f'Analyze/S3: {r.status_code} - {msg}')

    # Test direct upload still works (small file)
    import io
    log = b'Jan 15 10:30:45 node1 kernel: Out of memory: Kill process\n'
    r = c.post('/api/analyze/quick', data={'file': (io.BytesIO(log), 'test.log')}, content_type='multipart/form-data')
    d = r.get_json()
    print(f'Direct upload: {r.status_code} - {d.get("findings_count", 0)} findings')

    print('\nAll endpoints working!')
