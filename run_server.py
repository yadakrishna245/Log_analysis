import os
os.environ['LOGSHERLOCK_API_KEY'] = 'dev-key-123'
from app import app
app.run(host='127.0.0.1', port=5000, debug=False)
