"""Test script - analyze the customer tar.gz file locally."""
import os
import sys
import json

os.environ['LOGSHERLOCK_DEV_MODE'] = 'true'
os.environ['DATABASE_URL'] = 'sqlite:///test_run.db'

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
app = create_app()

with app.app_context():
    from models import db
    db.create_all()
    
    client = app.test_client()
    
    tar_path = r'demo/collect_demovmehost01_20260802_100000.tar.gz'
    print(f'File: {os.path.basename(tar_path)}')
    print(f'Size: {os.path.getsize(tar_path) / (1024*1024):.1f} MB')
    print('Analyzing... (this may take a minute for 73MB)')
    
    with open(tar_path, 'rb') as f:
        response = client.post('/api/analyze/quick',
            data={
                'files': (f, 'collect_demovmehost01_20260802_100000.tar.gz'),
                'description': 'VME morpheus node troubleshooting'
            },
            content_type='multipart/form-data'
        )
    
    result = json.loads(response.data)
    print(f'\nStatus: {response.status_code}')
    
    if result.get('error'):
        print(f'ERROR: {result["error"]}')
        sys.exit(1)
    
    print(f'Files analyzed: {result.get("files_analyzed", 0)}')
    print(f'Total lines scanned: {result.get("total_lines", 0)}')
    print(f'Findings count: {result.get("findings_count", 0)}')
    
    if result.get('findings'):
        print('\n=== TOP 10 FINDINGS ===')
        for i, f in enumerate(result['findings'][:10], 1):
            print(f'  {i}. [{f["severity"]}] {f["pattern_name"]}')
            print(f'     File: {f["file"]}:{f["line_number"]}')
            print(f'     Line: {f["line_content"][:100]}')
            print()
    
    if result.get('related_issues'):
        print('\n=== RELATED KNOWN ISSUES ===')
        for ki in result['related_issues']:
            print(f'  - {ki["title"]}')
    
    if result.get('jira_report'):
        print(f'\n=== JIRA REPORT (first 500 chars) ===')
        print(result['jira_report'][:500])
    
    print('\nDone!')

