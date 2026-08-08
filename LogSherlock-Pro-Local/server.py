"""LogSherlock Pro — Local Server with Copilot OAuth Proxy.

Double-click LogSherlock.bat to start. Opens http://localhost:8888
Handles GitHub Copilot OAuth device flow server-side (no CORS issues).
"""

import http.server
import json
import os
import urllib.request
import urllib.parse
import threading

PORT = 8888
COPILOT_CLIENT_ID = 'Iv1.b507a08c87ecfe98'  # VS Code Copilot official client ID
DIR = os.path.dirname(os.path.abspath(__file__))


class LogSherlockHandler(http.server.SimpleHTTPRequestHandler):
    """Serves static files + Copilot OAuth proxy endpoints."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def do_POST(self):
        # Limit request body size to 1MB for API proxy calls
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 1 * 1024 * 1024:  # 1MB max
            self._json_response({'error': 'Request body too large (max 1MB)'}, 413)
            return

        if self.path == '/api/copilot/device-code':
            self._proxy_device_code()
        elif self.path == '/api/copilot/poll-token':
            self._proxy_poll_token()
        elif self.path == '/api/copilot/exchange':
            self._proxy_exchange_token()
        elif self.path == '/api/copilot/chat':
            self._proxy_copilot_chat()
        else:
            self.send_error(404)

    def do_GET(self):
        if self.path == '/api/health':
            self._json_response({'status': 'ok', 'server': 'LogSherlock Pro Local'})
        elif self.path == '/admin' or self.path == '/admin/':
            # Serve admin dashboard
            admin_path = os.path.join(DIR, 'Administration', 'admin-dashboard.html')
            if os.path.exists(admin_path):
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                with open(admin_path, 'rb') as f:
                    content = f.read()
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            else:
                self.send_error(404, 'Admin dashboard not found')
        else:
            super().do_GET()

    def end_headers(self):
        # Security headers
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        self.send_header('X-XSS-Protection', '1; mode=block')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        self.send_header('Content-Security-Policy',
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: blob:; "
            "connect-src 'self' https://api.github.com https://api.githubcopilot.com "
            "https://github.com https://5bruz4e6hj.execute-api.us-east-1.amazonaws.com;"
        )
        super().end_headers()

    def _proxy_device_code(self):
        """Step 1: Request device code from GitHub."""
        data = json.dumps({'client_id': COPILOT_CLIENT_ID, 'scope': 'read:user'}).encode()
        req = urllib.request.Request(
            'https://github.com/login/device/code',
            data=data,
            headers={'Content-Type': 'application/json', 'Accept': 'application/json'}
        )
        try:
            resp = urllib.request.urlopen(req, timeout=10)
            result = json.loads(resp.read().decode())
            self._json_response(result)
        except Exception as e:
            self._json_response({'error': str(e)}, 500)

    def _proxy_poll_token(self):
        """Step 2: Poll for OAuth token after user authorizes."""
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        device_code = body.get('device_code', '')

        data = json.dumps({
            'client_id': COPILOT_CLIENT_ID,
            'device_code': device_code,
            'grant_type': 'urn:ietf:params:oauth:grant-type:device_code'
        }).encode()
        req = urllib.request.Request(
            'https://github.com/login/oauth/access_token',
            data=data,
            headers={'Content-Type': 'application/json', 'Accept': 'application/json'}
        )
        try:
            resp = urllib.request.urlopen(req, timeout=10)
            result = json.loads(resp.read().decode())
            self._json_response(result)
        except Exception as e:
            self._json_response({'error': str(e)}, 500)

    def _proxy_exchange_token(self):
        """Step 3: Exchange OAuth token for Copilot API token."""
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        oauth_token = body.get('oauth_token', '')

        req = urllib.request.Request(
            'https://api.github.com/copilot_internal/v2/token',
            headers={
                'Authorization': f'token {oauth_token}',
                'Accept': 'application/json',
                'User-Agent': 'LogSherlock-Pro/1.0'
            }
        )
        try:
            resp = urllib.request.urlopen(req, timeout=10)
            result = json.loads(resp.read().decode())
            self._json_response(result)
        except urllib.error.HTTPError as e:
            error_body = e.read().decode() if e.fp else ''
            self._json_response({'error': f'HTTP {e.code}: {error_body}'}, e.code)
        except Exception as e:
            self._json_response({'error': str(e)}, 500)

    def _proxy_copilot_chat(self):
        """Proxy chat completions to GitHub Copilot API (handles CORS + auth headers)."""
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length else b'{}'
        copilot_token = self.headers.get('X-Copilot-Token', '')

        if not copilot_token:
            self._json_response({'error': 'Missing X-Copilot-Token header'}, 401)
            return

        # Parse request to check if streaming
        request_data = json.loads(body)
        is_stream = request_data.get('stream', False)

        req = urllib.request.Request(
            'https://api.githubcopilot.com/chat/completions',
            data=body,
            headers={
                'Authorization': f'Bearer {copilot_token}',
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Editor-Version': 'vscode/1.92.0',
                'Editor-Plugin-Version': 'copilot/1.200.0',
                'Openai-Intent': 'conversation-panel',
                'User-Agent': 'LogSherlock-Pro/1.0'
            }
        )
        try:
            resp = urllib.request.urlopen(req, timeout=60)
            if is_stream:
                # Stream response back to client
                self.send_response(200)
                self.send_header('Content-Type', 'text/event-stream')
                self.send_header('Access-Control-Allow-Origin', 'http://localhost:8888')
                self.send_header('Cache-Control', 'no-cache')
                self.end_headers()
                while True:
                    chunk = resp.read(4096)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    self.wfile.flush()
            else:
                result = json.loads(resp.read().decode())
                self._json_response(result)
        except urllib.error.HTTPError as e:
            error_body = e.read().decode() if e.fp else ''
            self._json_response({'error': f'Copilot API error {e.code}: {error_body}'}, e.code)
        except Exception as e:
            self._json_response({'error': str(e)}, 500)

    def _json_response(self, data, code=200):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', 'http://localhost:8888')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', 'http://localhost:8888')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Copilot-Token')
        self.end_headers()

    def log_message(self, format, *args):
        """Suppress default logging noise."""
        pass


def main():
    server = http.server.HTTPServer(('127.0.0.1', PORT), LogSherlockHandler)
    print(f"""
╔══════════════════════════════════════════════════════════╗
║  LogSherlock Pro — Local Server                         ║
║  URL: http://localhost:{PORT}                             ║
║  Press Ctrl+C to stop                                   ║
╚══════════════════════════════════════════════════════════╝
""")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.shutdown()


if __name__ == '__main__':
    main()
