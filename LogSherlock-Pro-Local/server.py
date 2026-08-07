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
        if self.path == '/api/copilot/device-code':
            self._proxy_device_code()
        elif self.path == '/api/copilot/poll-token':
            self._proxy_poll_token()
        elif self.path == '/api/copilot/exchange':
            self._proxy_exchange_token()
        else:
            self.send_error(404)

    def do_GET(self):
        if self.path == '/api/health':
            self._json_response({'status': 'ok', 'server': 'LogSherlock Pro Local'})
        else:
            super().do_GET()

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

    def _json_response(self, data, code=200):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def log_message(self, format, *args):
        """Suppress default logging noise."""
        pass


def main():
    server = http.server.HTTPServer(('0.0.0.0', PORT), LogSherlockHandler)
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
