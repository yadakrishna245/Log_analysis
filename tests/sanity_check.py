"""Quick sanity check - verify all endpoints still work after optimization."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ['LOGSHERLOCK_DEV_MODE'] = 'true'
from app import app

with app.test_client() as c:
    # 1. Health
    r = c.get('/api/health')
    assert r.status_code == 200
    print('1. Health check: OK')

    # 2. Stats
    r = c.get('/api/stats')
    assert r.status_code == 200
    print('2. Stats endpoint: OK')

    # 3. Small file upload
    import io
    log_content = b'Jan 15 10:30:45 node1 kernel: Out of memory: Kill process 1234 (java)\nJan 15 10:30:46 node1 kernel: GFS2 forcing withdraw\nJan 15 10:31:00 node1 nothing here\n'
    r = c.post('/api/analyze/quick',
               data={'file': (io.BytesIO(log_content), 'test.log')},
               content_type='multipart/form-data')
    assert r.status_code == 200
    result = r.get_json()
    fc = result.get('findings_count', 0)
    at = result.get('analysis_time_seconds', 'N/A')
    print(f'3. Small file analysis: OK ({fc} findings in {at}s)')

    # 4. Knowledge search
    r = c.get('/api/knowledge/search?q=gfs2')
    assert r.status_code == 200
    print('4. Knowledge search: OK')

    # 5. Frontend loads
    r = c.get('/')
    assert r.status_code == 200
    print('5. Frontend (index.html): OK')

    print('\nAll 5 checks PASSED - app works correctly!')
