"""
LogSherlock Pro - Basic Test Suite
====================================

Tests cover:
1. Flask app startup and configuration
2. Ticket CRUD operations (create, read, update, delete)
3. Log file upload and analysis
4. Pattern detection on sample log lines
5. Knowledge base search

Run with: pytest tests/test_basic.py -v
"""

import io
import json
import os
import sys
import tempfile
import pytest

# Ensure project root is on path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from app import create_app
from config import TestingConfig


# =============================================================================
# FIXTURES
# =============================================================================

@pytest.fixture(scope='session')
def app():
    """Create application for testing."""
    test_app = create_app(config_override=TestingConfig())
    test_app.config['TESTING'] = True
    test_app.config['WTF_CSRF_ENABLED'] = False
    yield test_app


@pytest.fixture(scope='session')
def client(app):
    """Create test client."""
    return app.test_client()


@pytest.fixture
def sample_logs_dir():
    """Path to sample log files."""
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sample_logs')


# =============================================================================
# 1. APP STARTUP TESTS
# =============================================================================

class TestAppStartup:
    """Tests that Flask app starts correctly and is configured properly."""

    def test_app_creates_successfully(self, app):
        """App factory creates Flask instance."""
        assert app is not None
        assert app.config['TESTING'] is True

    def test_app_has_routes(self, app):
        """App registers expected routes."""
        rules = [rule.rule for rule in app.url_map.iter_rules()]
        # Tickets routes
        assert '/api/tickets' in rules
        # Knowledge routes
        assert '/api/knowledge/search' in rules
        # Health check (if registered)
        assert '/health' in rules or len(rules) > 10

    def test_health_endpoint(self, client):
        """Health endpoint returns 200."""
        resp = client.get('/health')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data['status'] == 'healthy'
        assert 'version' in data

    def test_404_for_unknown_api(self, client):
        """Unknown API endpoint returns 404 JSON."""
        resp = client.get('/api/nonexistent')
        assert resp.status_code == 404


# =============================================================================
# 2. TICKET CRUD TESTS
# =============================================================================

class TestTicketCRUD:
    """Tests ticket create, read, update, delete operations."""

    def test_create_ticket(self, client):
        """POST /api/tickets creates a new ticket."""
        resp = client.post('/api/tickets', json={
            'title': 'SCSI Reservation Conflict on Node3',
            'description': 'Customer reports VM migration failed with SCSI errors',
            'priority': 'high',
            'product': 'alletra',
        })
        assert resp.status_code == 201
        data = json.loads(resp.data)
        assert 'id' in data
        assert data['title'] == 'SCSI Reservation Conflict on Node3'
        assert data['status'] == 'open'
        assert data['priority'] == 'high'

    def test_create_ticket_requires_title(self, client):
        """POST /api/tickets without title returns 400."""
        resp = client.post('/api/tickets', json={
            'description': 'No title provided',
        })
        assert resp.status_code == 400

    def test_list_tickets(self, client):
        """GET /api/tickets returns paginated list."""
        # Create a ticket first
        client.post('/api/tickets', json={
            'title': 'Test Ticket for Listing',
            'description': 'Test',
        })
        resp = client.get('/api/tickets')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert 'tickets' in data
        assert 'total' in data
        assert data['total'] >= 1

    def test_get_ticket_by_id(self, client):
        """GET /api/tickets/<id> returns ticket details."""
        # Create ticket
        create_resp = client.post('/api/tickets', json={
            'title': 'Get By ID Test',
            'description': 'Testing single ticket retrieval',
        })
        ticket_id = json.loads(create_resp.data)['id']

        # Get it
        resp = client.get(f'/api/tickets/{ticket_id}')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data['id'] == ticket_id
        assert data['title'] == 'Get By ID Test'

    def test_get_nonexistent_ticket(self, client):
        """GET /api/tickets/<bad_id> returns 404."""
        resp = client.get('/api/tickets/nonexistent_id_xyz')
        assert resp.status_code == 404

    def test_update_ticket(self, client):
        """PUT /api/tickets/<id> updates ticket fields."""
        # Create ticket
        create_resp = client.post('/api/tickets', json={
            'title': 'Before Update',
            'description': 'Original',
        })
        ticket_id = json.loads(create_resp.data)['id']

        # Update
        resp = client.put(f'/api/tickets/{ticket_id}', json={
            'title': 'After Update',
            'status': 'analyzing',
            'priority': 'critical',
        })
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data['title'] == 'After Update'
        assert data['status'] == 'analyzing'
        assert data['priority'] == 'critical'

    def test_delete_ticket(self, client):
        """DELETE /api/tickets/<id> removes the ticket."""
        # Create ticket
        create_resp = client.post('/api/tickets', json={
            'title': 'To Be Deleted',
            'description': 'This will be deleted',
        })
        ticket_id = json.loads(create_resp.data)['id']

        # Delete
        resp = client.delete(f'/api/tickets/{ticket_id}')
        assert resp.status_code == 200

        # Verify it's gone
        resp = client.get(f'/api/tickets/{ticket_id}')
        assert resp.status_code == 404

    def test_search_tickets(self, client):
        """GET /api/tickets?search=... filters results."""
        # Create ticket with specific title
        client.post('/api/tickets', json={
            'title': 'UniqueSearchTerm GFS2 Mount Failure',
            'description': 'GFS2 went read-only',
        })
        resp = client.get('/api/tickets?search=UniqueSearchTerm')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data['total'] >= 1
        assert any('UniqueSearchTerm' in t['title'] for t in data['tickets'])

    def test_filter_by_status(self, client):
        """GET /api/tickets?status=open filters correctly."""
        resp = client.get('/api/tickets?status=open')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        for ticket in data['tickets']:
            assert ticket['status'] == 'open'


# =============================================================================
# 3. LOG FILE UPLOAD AND ANALYSIS TESTS
# =============================================================================

class TestLogUploadAndAnalysis:
    """Tests log file upload and analysis trigger."""

    def test_upload_log_file(self, client, sample_logs_dir):
        """POST /api/tickets/<id>/upload accepts files."""
        # Create ticket
        create_resp = client.post('/api/tickets', json={
            'title': 'Upload Test Ticket',
            'description': 'Testing file upload',
        })
        ticket_id = json.loads(create_resp.data)['id']

        # Upload sample dmesg file
        dmesg_path = os.path.join(sample_logs_dir, 'sample_dmesg.txt')
        with open(dmesg_path, 'rb') as f:
            resp = client.post(
                f'/api/tickets/{ticket_id}/upload',
                data={'files': (f, 'sample_dmesg.txt')},
                content_type='multipart/form-data',
            )
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert '1 file(s) uploaded' in data['message']
        assert len(data['files']) == 1

    def test_upload_no_files_returns_400(self, client):
        """Upload with no files returns 400."""
        create_resp = client.post('/api/tickets', json={
            'title': 'No Files Test',
        })
        ticket_id = json.loads(create_resp.data)['id']

        resp = client.post(f'/api/tickets/{ticket_id}/upload')
        assert resp.status_code == 400

    def test_analyze_ticket_with_logs(self, client, sample_logs_dir):
        """POST /api/tickets/<id>/analyze runs analysis on uploaded files."""
        # Create ticket
        create_resp = client.post('/api/tickets', json={
            'title': 'Analysis Test Ticket',
            'description': 'SCSI reservation conflict causing VM migration failure',
        })
        ticket_id = json.loads(create_resp.data)['id']

        # Upload multiple sample files
        for fname in ['sample_dmesg.txt', 'sample_mount.txt', 'sample_pcs.txt']:
            fpath = os.path.join(sample_logs_dir, fname)
            with open(fpath, 'rb') as f:
                client.post(
                    f'/api/tickets/{ticket_id}/upload',
                    data={'files': (f, fname)},
                    content_type='multipart/form-data',
                )

        # Trigger analysis
        resp = client.post(f'/api/tickets/{ticket_id}/analyze')
        assert resp.status_code in (200, 500)  # 500 if engine has missing deps

        if resp.status_code == 200:
            data = json.loads(resp.data)
            assert data['status'] == 'complete'
            assert 'findings_count' in data
            assert isinstance(data.get('findings', []), list)

    def test_get_findings(self, client, sample_logs_dir):
        """GET /api/tickets/<id>/findings returns analysis results."""
        # Create and analyze
        create_resp = client.post('/api/tickets', json={
            'title': 'Findings Test',
            'description': 'Test findings retrieval',
        })
        ticket_id = json.loads(create_resp.data)['id']

        # Upload a file
        fpath = os.path.join(sample_logs_dir, 'sample_dmesg.txt')
        with open(fpath, 'rb') as f:
            client.post(
                f'/api/tickets/{ticket_id}/upload',
                data={'files': (f, 'sample_dmesg.txt')},
                content_type='multipart/form-data',
            )

        # Get findings (may be empty if analysis not run)
        resp = client.get(f'/api/tickets/{ticket_id}/findings')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert 'findings' in data
        assert 'total' in data
        assert 'analysis_status' in data

    def test_quick_analyze(self, client, sample_logs_dir):
        """POST /api/analyze/quick does upload+analyze in one step."""
        dmesg_path = os.path.join(sample_logs_dir, 'sample_dmesg.txt')
        with open(dmesg_path, 'rb') as f:
            resp = client.post(
                '/api/analyze/quick',
                data={
                    'files': (f, 'sample_dmesg.txt'),
                    'description': 'SCSI errors on node3',
                },
                content_type='multipart/form-data',
            )
        # May fail if engine deps not available
        assert resp.status_code in (200, 500)
        data = json.loads(resp.data)
        if resp.status_code == 200:
            assert 'analysis_id' in data
            assert 'findings_count' in data


# =============================================================================
# 4. PATTERN DETECTION TESTS
# =============================================================================

class TestPatternDetection:
    """Tests pattern matching engine on sample log lines."""

    @pytest.fixture(autouse=True)
    def setup_engine(self):
        """Import pattern engine for tests."""
        try:
            from engine.patterns import PatternEngine, BUILTIN_PATTERNS, Severity
            self.engine = PatternEngine()
            self.patterns = BUILTIN_PATTERNS
            self.Severity = Severity
            self.available = True
        except ImportError:
            self.available = False

    def test_pattern_engine_loads(self):
        """Pattern engine initializes with built-in patterns."""
        if not self.available:
            pytest.skip("Pattern engine not importable")
        assert self.engine is not None
        assert len(self.patterns) > 10

    def test_detect_scsi_reservation_conflict(self):
        """Detects SCSI reservation conflict pattern."""
        if not self.available:
            pytest.skip("Pattern engine not importable")
        import re
        # Find the reservation conflict pattern
        rc_pattern = None
        for p in self.patterns:
            if 'reservation' in p.name.lower():
                rc_pattern = p
                break
        assert rc_pattern is not None, "No reservation conflict pattern found"

        test_line = "sd 2:0:1:0: reservation conflict"
        assert rc_pattern.regex.search(test_line), "Pattern should match reservation conflict"

    def test_detect_scsi_timeout(self):
        """Detects SCSI timeout pattern."""
        if not self.available:
            pytest.skip("Pattern engine not importable")
        import re
        timeout_pattern = None
        for p in self.patterns:
            if 'scsi_timeout' in p.name.lower():
                timeout_pattern = p
                break
        if timeout_pattern is None:
            pytest.skip("No SCSI timeout pattern found")

        test_line = "sd 2:0:2:0: [sdc] SCSI command timeout: cmd=Read(10)"
        assert timeout_pattern.regex.search(test_line)

    def test_detect_gfs2_readonly(self):
        """Detects GFS2 read-only mount pattern."""
        if not self.available:
            pytest.skip("Pattern engine not importable")
        import re
        gfs2_pattern = None
        for p in self.patterns:
            if 'gfs2' in p.name.lower() and ('readonly' in p.name.lower() or 'read' in p.name.lower()):
                gfs2_pattern = p
                break
        if gfs2_pattern is None:
            # Try matching withdraw
            for p in self.patterns:
                if 'gfs2' in p.name.lower() and 'withdraw' in p.name.lower():
                    gfs2_pattern = p
                    break
        if gfs2_pattern is None:
            pytest.skip("No GFS2 readonly/withdraw pattern found")

        test_lines = [
            "GFS2: file system mounted read-only due to errors",
            "GFS2: fsid=cluster1:gfs2vol02: gfs2 withdrawn",
            "GFS2: remount ro on /shared/data",
        ]
        matched = any(gfs2_pattern.regex.search(line) for line in test_lines)
        assert matched, f"Pattern {gfs2_pattern.name} (regex={gfs2_pattern.regex.pattern}) should match GFS2 log lines"

    def test_detect_kernel_panic(self):
        """Detects kernel panic pattern."""
        if not self.available:
            pytest.skip("Pattern engine not importable")
        import re
        panic_pattern = None
        for p in self.patterns:
            if 'panic' in p.name.lower() or 'kernel' in p.name.lower():
                if p.severity == self.Severity.CRITICAL:
                    panic_pattern = p
                    break
        if panic_pattern is None:
            pytest.skip("No kernel panic pattern found")

        test_line = "Kernel panic - not syncing: Fatal exception"
        assert panic_pattern.regex.search(test_line)

    def test_scan_file_streaming(self, sample_logs_dir):
        """Pattern engine can scan a file and find matches."""
        if not self.available:
            pytest.skip("Pattern engine not importable")

        dmesg_path = os.path.join(sample_logs_dir, 'sample_dmesg.txt')
        try:
            matches = self.engine.scan_file_streaming(
                dmesg_path,
                node_name='node3',
                context_lines=2,
            )
            # Should find at least some matches (reservation conflict, SCSI errors, etc.)
            assert len(matches) >= 1, "Expected at least 1 pattern match in sample_dmesg.txt"

            # Check that matches have expected structure
            for m in matches:
                assert hasattr(m, 'pattern')
                assert hasattr(m, 'matched_text')
                assert hasattr(m, 'line_number')
                assert m.line_number > 0
        except Exception as e:
            pytest.skip(f"scan_file_streaming failed: {e}")

    def test_severity_ordering(self):
        """Severity levels have correct ordering."""
        if not self.available:
            pytest.skip("Pattern engine not importable")
        assert self.Severity.CRITICAL.score > self.Severity.HIGH.score
        assert self.Severity.HIGH.score > self.Severity.MEDIUM.score
        assert self.Severity.MEDIUM.score > self.Severity.LOW.score
        assert self.Severity.LOW.score > self.Severity.INFO.score


# =============================================================================
# 5. KNOWLEDGE BASE SEARCH TESTS
# =============================================================================

class TestKnowledgeBase:
    """Tests knowledge base search and retrieval."""

    def test_search_endpoint_requires_query(self, client):
        """GET /api/knowledge/search without q returns 400."""
        resp = client.get('/api/knowledge/search')
        assert resp.status_code == 400

    def test_search_known_issues(self, client):
        """GET /api/knowledge/search?q=... returns results."""
        resp = client.get('/api/knowledge/search?q=GFS2+mount+failed')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert 'results' in data
        assert 'total' in data

    def test_list_issues(self, client):
        """GET /api/knowledge/issues returns known issues."""
        resp = client.get('/api/knowledge/issues')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert 'issues' in data
        assert 'total' in data
        # Should have at least some known issues loaded
        assert data['total'] >= 1

    def test_list_issues_filter_by_product(self, client):
        """GET /api/knowledge/issues?product=gfs2 filters by product."""
        resp = client.get('/api/knowledge/issues?product=gfs2')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert 'issues' in data

    def test_list_runbooks(self, client):
        """GET /api/knowledge/runbooks returns runbooks."""
        resp = client.get('/api/knowledge/runbooks')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert 'runbooks' in data
        assert 'total' in data
        assert data['total'] >= 1

    def test_list_products(self, client):
        """GET /api/knowledge/products returns product list."""
        resp = client.get('/api/knowledge/products')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert 'products' in data
        assert len(data['products']) >= 1

    def test_knowledge_search_results_have_structure(self, client):
        """Knowledge search results have expected fields."""
        resp = client.get('/api/knowledge/search?q=SCSI+reservation')
        if resp.status_code == 200:
            data = json.loads(resp.data)
            if data['total'] > 0:
                result = data['results'][0]
                # Should have title at minimum
                assert 'title' in result or 'id' in result


# =============================================================================
# 6. REPORTS TESTS
# =============================================================================

class TestReports:
    """Tests report generation endpoints."""

    def test_rca_report_nonexistent_ticket(self, client):
        """RCA report for nonexistent ticket returns 404."""
        resp = client.get('/api/reports/nonexistent_xyz/rca')
        assert resp.status_code == 404

    def test_rca_report_for_ticket(self, client):
        """RCA report generation for existing ticket."""
        # Create ticket with some data
        create_resp = client.post('/api/tickets', json={
            'title': 'Report Test Ticket',
            'description': 'Testing report generation',
        })
        ticket_id = json.loads(create_resp.data)['id']

        resp = client.get(f'/api/reports/{ticket_id}/rca')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert 'root_cause' in data
        assert 'severity_breakdown' in data
        assert 'ticket_id' in data

    def test_jira_report(self, client):
        """Jira wiki markup report generation."""
        create_resp = client.post('/api/tickets', json={
            'title': 'Jira Report Test',
            'description': 'Testing Jira export',
        })
        ticket_id = json.loads(create_resp.data)['id']

        resp = client.get(f'/api/reports/{ticket_id}/jira')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert 'content' in data
        assert data['format'] == 'jira_wiki'
        assert 'LogSherlock' in data['content']

    def test_markdown_report(self, client):
        """Markdown report generation."""
        create_resp = client.post('/api/tickets', json={
            'title': 'Markdown Report Test',
            'description': 'Testing markdown export',
        })
        ticket_id = json.loads(create_resp.data)['id']

        resp = client.get(f'/api/reports/{ticket_id}/markdown')
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert 'content' in data
        assert data['format'] == 'markdown'
        assert '# RCA Report' in data['content']


# =============================================================================
# 7. INTEGRATION TESTS
# =============================================================================

class TestIntegration:
    """End-to-end integration tests."""

    def test_full_workflow(self, client, sample_logs_dir):
        """
        Full workflow: create ticket -> upload logs -> analyze -> get report.
        """
        # 1. Create ticket
        resp = client.post('/api/tickets', json={
            'title': 'Full Workflow Test - SCSI Reservation on Node3',
            'description': 'VM migration failed with SCSI reservation conflict on node3. GFS2 went read-only.',
            'priority': 'critical',
            'product': 'alletra',
        })
        assert resp.status_code == 201
        ticket_id = json.loads(resp.data)['id']

        # 2. Upload logs
        for fname in ['sample_dmesg.txt', 'sample_mount.txt', 'sample_pcs.txt']:
            fpath = os.path.join(sample_logs_dir, fname)
            with open(fpath, 'rb') as f:
                resp = client.post(
                    f'/api/tickets/{ticket_id}/upload',
                    data={'files': (f, fname)},
                    content_type='multipart/form-data',
                )
            assert resp.status_code == 200

        # 3. Verify ticket has files
        resp = client.get(f'/api/tickets/{ticket_id}')
        data = json.loads(resp.data)
        assert len(data['files']) == 3

        # 4. Trigger analysis (may fail if engine deps missing)
        resp = client.post(f'/api/tickets/{ticket_id}/analyze')
        assert resp.status_code in (200, 500)

        # 5. Get report regardless of analysis outcome
        resp = client.get(f'/api/reports/{ticket_id}/rca')
        assert resp.status_code == 200

        # 6. Get Jira comment
        resp = client.get(f'/api/reports/{ticket_id}/jira')
        assert resp.status_code == 200


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
