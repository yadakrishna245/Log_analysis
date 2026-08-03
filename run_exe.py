"""LogSherlock Pro - Standalone EXE entry point.

Double-click this .exe to start LogSherlock Pro locally.
Opens browser automatically at http://localhost:5000
"""
import os
import sys
import webbrowser
import threading

# Set environment
os.environ['LOGSHERLOCK_DEV_MODE'] = 'true'

# Handle PyInstaller frozen app paths
if getattr(sys, 'frozen', False):
    # Running as compiled .exe
    base_dir = sys._MEIPASS
    os.chdir(base_dir)
else:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(base_dir)

# Import and run
from app import app

def open_browser():
    """Open browser after short delay."""
    import time
    time.sleep(2)
    webbrowser.open('http://localhost:5000')

print()
print("  ========================================")
print("   LogSherlock Pro v1.0.0")
print("   HPE VME Log Analysis Suite")
print("   (c) 2026 Krishna Yada")
print("  ========================================")
print()
print("  Server: http://localhost:5000")
print("  Press Ctrl+C to stop")
print()

# Open browser in background
threading.Thread(target=open_browser, daemon=True).start()

# Run Flask
app.run(host='127.0.0.1', port=5000, debug=False)
