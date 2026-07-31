# LogSherlock Pro — Deployment Guide

## Production Deployment & Operations

**Version:** 1.0
**Last Updated:** July 2026
**Audience:** System administrators and DevOps engineers

---

## System Requirements

### Minimum Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8-16 GB |
| Disk | 20 GB | 100+ GB (depends on log volume) |
| OS | Windows 10+ / RHEL 8+ / Ubuntu 20.04+ | RHEL 9 / Ubuntu 22.04 |
| Python | 3.10 | 3.11 or 3.12 |
| Network | Internal LAN access | Same subnet as engineering team |

### Recommended for Team Deployment (10+ users)

| Resource | Specification |
|----------|--------------|
| CPU | 8 cores |
| RAM | 16 GB |
| Disk | 500 GB SSD |
| Database | PostgreSQL 15+ |
| OS | RHEL 9 or Ubuntu 22.04 LTS |
| Network | 1 Gbps internal |

### Software Dependencies

- Python 3.10+ with pip
- PostgreSQL 15+ (production, multi-user)
- Redis 7+ (optional, for background tasks)
- nginx (optional, reverse proxy)

---

## Windows Installation

### Step 1: Install Python

1. Download Python 3.11+ from https://python.org/downloads
2. Run installer — **check "Add Python to PATH"**
3. Verify: `python --version`

### Step 2: Clone or Copy the Application

```batch
cd C:\Apps
git clone https://github.hpe.com/support-tools/logsherlock-pro.git
cd logsherlock-pro
```

Or copy the project folder to `C:\Apps\logsherlock-pro`.

### Step 3: Run the Startup Script

```batch
run.bat
```

This will:
- Create a virtual environment
- Install all dependencies
- Initialize the database
- Start the development server on port 5000

### Step 4: Configure for Production (Windows)

Create a `.env` file:

```ini
FLASK_ENV=production
SECRET_KEY=generate-a-random-64-char-string-here
HOST=0.0.0.0
PORT=8000
MAX_UPLOAD_SIZE_MB=500
LOG_LEVEL=INFO
```

### Step 5: Run with Waitress (Production WSGI)

```batch
pip install waitress
waitress-serve --host=0.0.0.0 --port=8000 --threads=8 app:app
```

### Running as a Windows Service

Use **NSSM** (Non-Sucking Service Manager):

```batch
:: Download NSSM from https://nssm.cc
nssm install LogSherlockPro "C:\Apps\logsherlock-pro\venv\Scripts\python.exe"
nssm set LogSherlockPro AppDirectory "C:\Apps\logsherlock-pro"
nssm set LogSherlockPro AppParameters "-m waitress --host=0.0.0.0 --port=8000 --threads=8 app:app"
nssm set LogSherlockPro DisplayName "LogSherlock Pro"
nssm set LogSherlockPro Description "Enterprise Log Analysis Platform"
nssm set LogSherlockPro Start SERVICE_AUTO_START
nssm set LogSherlockPro ObjectName ".\ServiceAccount" "password"

:: Start the service
nssm start LogSherlockPro
```

Or use **Task Scheduler** for a simpler approach:
1. Open Task Scheduler → Create Task
2. Name: "LogSherlock Pro"
3. Trigger: "At startup"
4. Action: Start a program
   - Program: `C:\Apps\logsherlock-pro\venv\Scripts\python.exe`
   - Arguments: `-m waitress --host=0.0.0.0 --port=8000 --threads=8 app:app`
   - Start in: `C:\Apps\logsherlock-pro`
5. Check "Run whether user is logged on or not"

---

## Linux Installation

### Step 1: Install System Dependencies

**RHEL/CentOS/Rocky:**

```bash
sudo dnf install python3.11 python3.11-pip python3.11-devel \
    gcc libffi-devel openssl-devel \
    postgresql postgresql-devel \
    git
```

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install python3.11 python3.11-venv python3.11-dev \
    gcc libffi-dev libssl-dev \
    postgresql postgresql-client libpq-dev \
    git
```

### Step 2: Create Application User

```bash
sudo useradd -r -m -d /opt/logsherlock -s /bin/bash logsherlock
sudo su - logsherlock
```

### Step 3: Clone and Setup

```bash
cd /opt/logsherlock
git clone https://github.hpe.com/support-tools/logsherlock-pro.git app
cd app

python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 4: Configure Environment

```bash
cp .env.example .env
vim .env
```

Set production values:

```ini
FLASK_ENV=production
SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_hex(32))">
DATABASE_URL=postgresql://logsherlock:password@localhost:5432/logsherlock
HOST=127.0.0.1
PORT=8000
MAX_UPLOAD_SIZE_MB=500
LOG_LEVEL=INFO
```

### Step 5: Setup PostgreSQL (Production)

```bash
sudo -u postgres psql
```

```sql
CREATE USER logsherlock WITH PASSWORD 'your-secure-password';
CREATE DATABASE logsherlock OWNER logsherlock;
GRANT ALL PRIVILEGES ON DATABASE logsherlock TO logsherlock;
\q
```

### Step 6: Initialize Application

```bash
source venv/bin/activate
flask --app app init-db
flask --app app create-admin
flask --app app seed-patterns
```

### Step 7: Create Directories with Proper Permissions

```bash
mkdir -p data uploads extracted logs reports knowledge_base
chmod 750 uploads extracted logs reports knowledge_base
```

---

## Running as a Service (systemd)

### Create the Service File

```bash
sudo vim /etc/systemd/system/logsherlock.service
```

```ini
[Unit]
Description=LogSherlock Pro - Enterprise Log Analysis Platform
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=exec
User=logsherlock
Group=logsherlock
WorkingDirectory=/opt/logsherlock/app
Environment="PATH=/opt/logsherlock/app/venv/bin:/usr/bin"
Environment="FLASK_ENV=production"
ExecStart=/opt/logsherlock/app/venv/bin/gunicorn \
    --bind 127.0.0.1:8000 \
    --workers 4 \
    --threads 2 \
    --timeout 120 \
    --max-requests 1000 \
    --max-requests-jitter 50 \
    --access-logfile /opt/logsherlock/app/logs/access.log \
    --error-logfile /opt/logsherlock/app/logs/error.log \
    --capture-output \
    app:app
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/logsherlock/app/data
ReadWritePaths=/opt/logsherlock/app/uploads
ReadWritePaths=/opt/logsherlock/app/extracted
ReadWritePaths=/opt/logsherlock/app/logs
ReadWritePaths=/opt/logsherlock/app/reports
ReadWritePaths=/opt/logsherlock/app/knowledge_base
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### Enable and Start

```bash
sudo systemctl daemon-reload
sudo systemctl enable logsherlock
sudo systemctl start logsherlock

# Check status
sudo systemctl status logsherlock

# View logs
sudo journalctl -u logsherlock -f
```

### Optional: Celery Worker Service

If using background tasks with Redis:

```bash
sudo vim /etc/systemd/system/logsherlock-worker.service
```

```ini
[Unit]
Description=LogSherlock Pro - Celery Worker
After=network.target redis.service
Wants=redis.service

[Service]
Type=exec
User=logsherlock
Group=logsherlock
WorkingDirectory=/opt/logsherlock/app
Environment="PATH=/opt/logsherlock/app/venv/bin:/usr/bin"
ExecStart=/opt/logsherlock/app/venv/bin/celery \
    -A app.celery worker \
    --loglevel=info \
    --concurrency=4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## Running Behind nginx

### Install nginx

```bash
# RHEL
sudo dnf install nginx

# Ubuntu
sudo apt install nginx
```

### Configure nginx Reverse Proxy

```bash
sudo vim /etc/nginx/conf.d/logsherlock.conf
```

```nginx
upstream logsherlock_app {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name logsherlock.internal.hpe.com;

    # Redirect HTTP to HTTPS (if using TLS)
    # return 301 https://$server_name$request_uri;

    client_max_body_size 500M;

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Static files (served directly by nginx for performance)
    location /static/ {
        alias /opt/logsherlock/app/static/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # Application proxy
    location / {
        proxy_pass http://logsherlock_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (if needed)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts for large file uploads
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Health check endpoint (no auth)
    location /health {
        proxy_pass http://logsherlock_app/health;
        access_log off;
    }
}
```

### With TLS/SSL

```nginx
server {
    listen 443 ssl http2;
    server_name logsherlock.internal.hpe.com;

    ssl_certificate /etc/pki/tls/certs/logsherlock.crt;
    ssl_certificate_key /etc/pki/tls/private/logsherlock.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # ... rest same as above ...
}
```

### Enable and Test

```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

---

## Backup Strategy

### What to Back Up

| Component | Location | Priority | Frequency |
|-----------|----------|----------|-----------|
| Database | `data/logsherlock.db` or PostgreSQL | **CRITICAL** | Daily |
| Knowledge Base | `knowledge_base/` | HIGH | Daily |
| Reports | `reports/` | MEDIUM | Weekly |
| Configuration | `.env`, `config.py` | HIGH | On change |
| Uploaded Logs | `uploads/` | LOW | Optional (large) |

### SQLite Backup Script

```bash
#!/bin/bash
# /opt/logsherlock/backup.sh

BACKUP_DIR="/opt/backups/logsherlock"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="/opt/logsherlock/app"

mkdir -p "$BACKUP_DIR"

# Backup SQLite database (safe copy)
sqlite3 "$APP_DIR/data/logsherlock.db" ".backup '$BACKUP_DIR/logsherlock_$DATE.db'"

# Backup knowledge base
tar czf "$BACKUP_DIR/knowledge_base_$DATE.tar.gz" -C "$APP_DIR" knowledge_base/

# Backup config
cp "$APP_DIR/.env" "$BACKUP_DIR/env_$DATE"

# Retention: keep 30 days
find "$BACKUP_DIR" -name "*.db" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete

echo "[$(date)] Backup complete: $BACKUP_DIR"
```

### PostgreSQL Backup Script

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/logsherlock"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

pg_dump -U logsherlock -h localhost logsherlock | \
    gzip > "$BACKUP_DIR/pg_logsherlock_$DATE.sql.gz"

# Retention: keep 30 days
find "$BACKUP_DIR" -name "pg_*.sql.gz" -mtime +30 -delete
```

### Schedule with cron

```bash
# Run daily at 2 AM
echo "0 2 * * * /opt/logsherlock/backup.sh >> /opt/logsherlock/app/logs/backup.log 2>&1" | \
    sudo crontab -u logsherlock -
```

---

## Updating the Application

### Standard Update Process

```bash
# 1. Stop the service
sudo systemctl stop logsherlock

# 2. Backup first
/opt/logsherlock/backup.sh

# 3. Pull latest code
cd /opt/logsherlock/app
git pull origin main

# 4. Update dependencies
source venv/bin/activate
pip install -r requirements.txt

# 5. Run database migrations (if any)
flask --app app db upgrade

# 6. Seed any new patterns
flask --app app seed-patterns

# 7. Restart service
sudo systemctl start logsherlock

# 8. Verify
curl http://localhost:8000/health
```

### Zero-Downtime Update (Blue-Green)

For critical deployments where downtime is unacceptable:

```bash
# Deploy to new directory
cd /opt/logsherlock
git clone https://github.hpe.com/support-tools/logsherlock-pro.git app-new
cd app-new
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Test new version
FLASK_ENV=production flask --app app run --port 8001 &
curl http://localhost:8001/health  # Verify it works
kill %1

# Swap directories
cd /opt/logsherlock
mv app app-old
mv app-new app

# Restart
sudo systemctl restart logsherlock
```

---

## Multi-User Setup

### PostgreSQL Configuration

For teams of 5+ users, switch from SQLite to PostgreSQL:

```bash
# Install PostgreSQL
sudo dnf install postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create database
sudo -u postgres createuser logsherlock -P
sudo -u postgres createdb logsherlock -O logsherlock

# Update .env
DATABASE_URL=postgresql://logsherlock:password@localhost:5432/logsherlock
```

### User Management

```bash
# Create admin user
flask --app app create-admin

# Users can be created via API:
curl -X POST http://localhost:8000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "username": "john.doe",
    "email": "john.doe@hpe.com",
    "role": "analyst",
    "password": "secure-password"
  }'
```

### Role Definitions

| Role | Permissions |
|------|------------|
| **admin** | Full access: user management, system config, all CRUD |
| **analyst** | Create/edit tickets, run analysis, manage KB, generate reports |
| **viewer** | Read-only access to tickets, findings, and reports |

---

## Security Considerations

### Network Security

- **Internal only** — Bind to internal network interface, never expose to internet
- **Firewall** — Allow only port 80/443 from internal subnets
- **TLS** — Use HTTPS with internal CA certificates for production
- **No outbound connections** — LogSherlock makes zero external network calls

### Application Security

- **SECRET_KEY** — Generate a strong random key for production: `python -c "import secrets; print(secrets.token_hex(32))"`
- **Password hashing** — Uses bcrypt with automatic salt
- **Session management** — 8-hour session lifetime, secure cookies
- **CSRF protection** — Enabled via Flask-WTF
- **Security headers** — X-Content-Type-Options, X-Frame-Options, X-XSS-Protection set automatically
- **Input validation** — File type restrictions, size limits, path sanitization
- **SQL injection** — Prevented by SQLAlchemy ORM (parameterized queries)

### Filesystem Security

```bash
# Set restrictive permissions
chmod 750 /opt/logsherlock/app
chmod 640 /opt/logsherlock/app/.env
chown -R logsherlock:logsherlock /opt/logsherlock/app

# Ensure upload directories can't execute
chmod -x uploads/ extracted/
```

### Logging & Audit

- All API requests are logged with timestamp, user, and action
- Failed login attempts are recorded
- File uploads include SHA-256 checksums
- Log rotation prevents disk exhaustion (50MB × 10 files)

### Firewall Rules (example with firewalld)

```bash
# Allow only from internal engineering subnet
sudo firewall-cmd --permanent --add-rich-rule='
  rule family="ipv4"
  source address="10.0.50.0/24"
  port protocol="tcp" port="443"
  accept'
sudo firewall-cmd --reload
```

---

## Monitoring

### Health Check Endpoint

```bash
# Simple health check
curl http://localhost:8000/health
# Returns: {"status": "healthy", "version": "1.0.0"}
```

### systemd Watchdog

The service file includes `Restart=always` — systemd will automatically restart the application if it crashes.

### Log Monitoring

```bash
# Application logs
tail -f /opt/logsherlock/app/logs/logsherlock.log

# Access logs (if using Gunicorn)
tail -f /opt/logsherlock/app/logs/access.log

# System service logs
journalctl -u logsherlock -f
```

### Disk Space Monitoring

```bash
# Check disk usage
du -sh /opt/logsherlock/app/uploads/
du -sh /opt/logsherlock/app/extracted/
du -sh /opt/logsherlock/app/data/

# Alert if uploads exceed threshold
if [ $(du -s /opt/logsherlock/app/uploads | awk '{print $1}') -gt 50000000 ]; then
    echo "WARNING: Uploads directory exceeding 50GB"
fi
```

---

## Troubleshooting Deployment Issues

### Service won't start

```bash
# Check logs
journalctl -u logsherlock -n 50 --no-pager

# Common issues:
# - Missing .env file → cp .env.example .env
# - Wrong permissions → chown -R logsherlock:logsherlock /opt/logsherlock/app
# - Port in use → change PORT in .env
# - Missing dependencies → source venv/bin/activate && pip install -r requirements.txt
```

### Database connection refused

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection
psql -U logsherlock -h localhost -d logsherlock

# Check pg_hba.conf allows local connections
sudo vim /var/lib/pgsql/data/pg_hba.conf
# Ensure: local logsherlock logsherlock md5
```

### nginx 502 Bad Gateway

```bash
# Check if app is running
curl http://127.0.0.1:8000/health

# Check nginx can reach upstream
sudo nginx -t
sudo systemctl restart nginx
```

### File upload fails

```bash
# Check nginx client_max_body_size
grep client_max_body_size /etc/nginx/conf.d/logsherlock.conf

# Check disk space
df -h /opt/logsherlock/app/uploads/

# Check permissions
ls -la /opt/logsherlock/app/uploads/
```

---

*For additional support, contact the Support Engineering Tools Team.*
