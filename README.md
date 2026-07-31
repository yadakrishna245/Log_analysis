# LogSherlock Pro - Enterprise Log Intelligence Platform

> Intelligent log analysis for HPE Support Engineering. Resolve tickets faster with automated pattern detection, cross-node correlation, and knowledge-driven investigation.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)]()
[![Python](https://img.shields.io/badge/python-3.10+-green.svg)]()
[![License](https://img.shields.io/badge/license-MIT-orange.svg)]()

---

## Overview

LogSherlock Pro is an enterprise-grade log analysis platform purpose-built for HPE support engineers. It transforms hours of manual log trawling into minutes of automated, intelligent analysis. Upload customer log bundles, and LogSherlock Pro will:

- **Parse** logs from 15+ formats (dmesg, syslog, pacemaker, corosync, multipath, GFS2, etc.)
- **Detect** known error patterns using 100+ built-in regex rules
- **Correlate** events across multiple cluster nodes with timeline reconstruction
- **Recommend** solutions from an integrated knowledge base of known issues and runbooks
- **Report** findings in Jira-ready RCA format

**100% on-premises. Zero data leaves your network.**

---

## Features

| Feature | Description |
|---------|-------------|
| **Ticket Management** | Full lifecycle tracking with Jira ID linking, priority, status, and assignee |
| **Archive Extraction** | Supports 7z, ZIP, RAR, TAR, GZ, BZ2 — handles nested archives |
| **Pattern Engine** | 100+ pre-built patterns for SCSI, GFS2, DLM, kernel panics, OOM, fencing failures |
| **Cross-Node Correlation** | Timeline reconstruction across multi-node cluster log bundles |
| **Severity Scoring** | Confidence-weighted severity ranking (CRITICAL → INFO) |
| **Knowledge Base** | Searchable repository of known issues, runbooks, and similar tickets |
| **RCA Reports** | One-click Root Cause Analysis reports in JSON, HTML, and Excel |
| **Investigation Guides** | Step-by-step troubleshooting guides matched to findings |
| **Multi-User Auth** | Role-based access control (admin, analyst, viewer) |
| **REST API** | Complete API for CI/CD integration and automation |
| **Streaming Ingestion** | Handles 2GB+ log files without memory issues |
| **Full-Text Search** | SQLite FTS5-powered search across all ingested logs |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LogSherlock Pro v1.0.0                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────┐   ┌──────────────┐   ┌──────────────────────────┐  │
│  │  Web UI   │   │   REST API   │   │     CLI Commands         │  │
│  │ (Jinja2)  │   │  (Flask BP)  │   │  (flask --app app ...)   │  │
│  └─────┬─────┘   └──────┬───────┘   └────────────┬─────────────┘  │
│        │                 │                        │                  │
│  ┌─────▼─────────────────▼────────────────────────▼─────────────┐  │
│  │                    Application Layer                           │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │  │
│  │  │ Tickets  │  │   Logs   │  │ Analysis │  │  Knowledge  │  │  │
│  │  │  Route   │  │  Route   │  │  Route   │  │    Route    │  │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘  │  │
│  └───────┼──────────────┼─────────────┼────────────────┼─────────┘  │
│          │              │             │                │             │
│  ┌───────▼──────────────▼─────────────▼────────────────▼─────────┐  │
│  │                     Engine Layer                               │  │
│  │  ┌───────────┐  ┌────────────┐  ┌────────────┐  ┌─────────┐  │  │
│  │  │ Ingestion │  │  Pattern   │  │ Correlator │  │Analyzer │  │  │
│  │  │  Engine   │  │  Engine    │  │            │  │(Orch.)  │  │  │
│  │  └───────────┘  └────────────┘  └────────────┘  └─────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Storage Layer                               │  │
│  │  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐  │  │
│  │  │ SQLite / │  │  File Store  │  │  Knowledge Base Store  │  │  │
│  │  │ Postgres │  │  (uploads/)  │  │   (knowledge_base/)    │  │  │
│  │  └──────────┘  └──────────────┘  └────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Python 3.10+, Flask 3.0 |
| Database | SQLite (dev) / PostgreSQL (prod) |
| ORM | SQLAlchemy 2.0 + Alembic |
| Archive Handling | py7zr, zipfile, rarfile, tarfile |
| Analysis | regex, rapidfuzz, custom pattern engine |
| Authentication | Flask-Login, bcrypt, JWT |
| Reports | openpyxl, reportlab, Jinja2 |
| WSGI Server | Gunicorn (Linux) / Waitress (Windows) |
| Task Queue | Celery + Redis (optional) |
| Search | SQLite FTS5, Whoosh |

---

## Installation

### Prerequisites

- Python 3.10 or higher
- pip (Python package manager)
- 4GB RAM minimum (8GB recommended)
- 10GB disk space for uploads/extracted files
- Redis (optional — for background task processing)
- PostgreSQL (optional — for production deployments)

### Windows Quick Start

```batch
git clone https://github.hpe.com/support-tools/logsherlock-pro.git
cd logsherlock-pro
run.bat
```

### Linux/macOS Quick Start

```bash
git clone https://github.hpe.com/support-tools/logsherlock-pro.git
cd logsherlock-pro
chmod +x run.sh
./run.sh
```

### Manual Installation

```bash
# 1. Create virtual environment
python -m venv venv
source venv/bin/activate      # Linux/macOS
# venv\Scripts\activate       # Windows

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create required directories
mkdir -p data uploads extracted logs reports knowledge_base

# 4. Initialize database
flask --app app init-db

# 5. Create admin user
flask --app app create-admin

# 6. Seed built-in analysis patterns
flask --app app seed-patterns

# 7. Run development server
flask --app app run --port 5000
```

### Production Deployment

```bash
export FLASK_ENV=production
export SECRET_KEY="your-secure-random-key-here"
export DATABASE_URL="postgresql://user:pass@localhost:5432/logsherlock"

gunicorn --bind 0.0.0.0:8000 --workers 4 --threads 2 --timeout 120 app:app
```

---

## Quick Start Guide

### Step 1: Access the Dashboard

Open your browser to `http://localhost:5000`. Log in with the admin credentials you created during setup.

### Step 2: Create a Ticket

Click **"New Ticket"** and fill in:
- **Title**: Brief description (e.g., "GFS2 mount hang on node3")
- **Jira ID**: Link to existing Jira ticket (optional)
- **Product**: Select the HPE product
- **Priority**: Set severity level

### Step 3: Upload Logs

On the ticket detail page, click **"Upload Logs"**. You can upload:
- Individual log files (.log, .txt)
- Compressed archives (.7z, .zip, .tar.gz)
- Multiple files at once

LogSherlock automatically extracts archives and identifies log types.

### Step 4: Run Analysis

Click **"Analyze"** to start pattern detection. The engine will:
1. Parse all uploaded log files
2. Run 100+ pattern rules against each file
3. Correlate events across nodes
4. Score and rank findings by severity

### Step 5: Review Findings

Findings appear ranked by severity with:
- Pattern name and description
- Matched log lines with context
- Confidence score
- Suggested remediation steps
- Links to related knowledge base articles

### Step 6: Generate Report

Click **"Generate RCA Report"** to produce a structured Root Cause Analysis document suitable for Jira comments or customer communication.

---

## Usage Guide

### Creating Tickets

```bash
# API
curl -X POST http://localhost:5000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Cluster node fencing loop",
    "description": "Node2 keeps getting fenced every 30 minutes",
    "jira_id": "SUPPORT-12345",
    "product": "HPE Serviceguard",
    "priority": "high"
  }'
```

### Uploading Logs

```bash
# Upload a single file
curl -X POST http://localhost:5000/api/logs/upload/1 \
  -F "file=@/path/to/sosreport.tar.gz"

# Upload multiple files
curl -X POST http://localhost:5000/api/tickets/abc123/upload \
  -F "files=@messages.log" \
  -F "files=@dmesg.txt" \
  -F "files=@pcs_status.txt"
```

### Running Analysis

```bash
# Analyze all files for a ticket
curl -X POST http://localhost:5000/api/analysis/run/1

# Quick analysis (upload + analyze in one step)
curl -X POST http://localhost:5000/api/analyze/quick \
  -F "files=@dmesg.log" \
  -F "description=SCSI reservation conflict on shared LUN"
```

### Reading Findings

Findings are returned with the following structure:

```json
{
  "findings": [
    {
      "severity": "CRITICAL",
      "category": "storage",
      "pattern_name": "SCSI Reservation Conflict",
      "description": "SCSI reservation conflict detected on shared storage",
      "matched_line": "sd 0:0:1:0: reservation conflict",
      "context_before": ["..."],
      "context_after": ["..."],
      "confidence": 0.95,
      "node": "node2",
      "timestamp": "2026-07-15T10:30:45",
      "solution_hint": "Check multipath configuration and fence agent settings"
    }
  ]
}
```

### Using Investigation Guides

When findings match known issues, LogSherlock provides step-by-step investigation guides:

```bash
# Search knowledge base for guides
curl "http://localhost:5000/api/knowledge/search?q=GFS2+withdraw"
```

### Generating RCA Reports

```bash
# Generate full RCA report
curl http://localhost:5000/api/reports/abc123/rca

# With options
curl "http://localhost:5000/api/reports/abc123/rca?include_timeline=true&include_recommendations=true"

# Generate Jira-formatted comment
curl -X POST http://localhost:5000/api/reports/generate/1 \
  -H "Content-Type: application/json" \
  -d '{"format": "jira"}'
```

### Knowledge Base Management

```bash
# Add a new KB article
curl -X POST http://localhost:5000/api/knowledge \
  -H "Content-Type: application/json" \
  -d '{
    "title": "GFS2 withdraw recovery procedure",
    "content": "Step 1: Check dlm_controld status...",
    "category": "filesystem",
    "product": "RHEL HA",
    "tags": ["gfs2", "dlm", "withdraw"]
  }'

# Search KB
curl "http://localhost:5000/api/knowledge/search?q=multipath+failover&product=HPE+3PAR"
```

---

## API Reference

**Base URL:** `http://localhost:5000/api`

### Tickets

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/tickets` | Create new ticket |
| `GET` | `/api/tickets` | List tickets (paginated) |
| `GET` | `/api/tickets/:id` | Get ticket details |
| `PUT` | `/api/tickets/:id` | Update ticket |
| `DELETE` | `/api/tickets/:id` | Delete ticket |

**Query Parameters (GET /api/tickets):**
- `page` — Page number (default: 1)
- `per_page` — Items per page (default: 25, max: 200)
- `status` — Filter: open, analyzing, resolved, closed
- `priority` — Filter: critical, high, medium, low
- `product` — Filter by product name
- `q` — Full-text search in title and description
- `sort` — Sort field (default: created_at)
- `dir` — Sort direction: asc, desc

### Log Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/logs/upload/:ticket_id` | Upload log file or archive |
| `GET` | `/api/logs/ticket/:ticket_id` | List files for a ticket |
| `GET` | `/api/logs/:id` | Get file metadata |
| `GET` | `/api/logs/:id/content` | Get file content (paginated) |
| `DELETE` | `/api/logs/:id` | Delete log file |

### Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/analyze/quick` | Upload + analyze in one step |
| `POST` | `/api/analysis/run/:ticket_id` | Run analysis on all ticket files |
| `POST` | `/api/analysis/run/file/:id` | Analyze a single file |
| `GET` | `/api/analysis/findings/:ticket_id` | Get findings for a ticket |
| `GET` | `/api/analysis/summary/:ticket_id` | Get analysis summary |
| `POST` | `/api/analysis/findings/:id/acknowledge` | Acknowledge a finding |
| `POST` | `/api/analysis/findings/:id/false-positive` | Mark as false positive |

### Knowledge Base

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/knowledge` | List KB articles |
| `GET` | `/api/knowledge/:id` | Get article details |
| `POST` | `/api/knowledge` | Create article |
| `PUT` | `/api/knowledge/:id` | Update article |
| `DELETE` | `/api/knowledge/:id` | Delete article |
| `GET` | `/api/knowledge/search?q=` | Search knowledge base |
| `GET` | `/api/knowledge/known-issues` | List all known issues |
| `GET` | `/api/knowledge/runbooks` | List all runbooks |

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/reports/:ticket_id/rca` | Generate RCA report |
| `POST` | `/api/reports/generate/:ticket_id` | Generate report (JSON/HTML/Excel) |
| `GET` | `/api/reports/list/:ticket_id` | List saved reports |
| `GET` | `/api/reports/download/:ticket_id/:file` | Download report file |
| `GET` | `/api/reports/dashboard` | Dashboard statistics |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Application health check |

---

## Configuration

All configuration via environment variables or `.env` file:

| Variable | Default | Description |
|----------|---------|-------------|
| `FLASK_ENV` | development | Environment mode |
| `SECRET_KEY` | auto-generated | Flask secret (MUST change in production) |
| `DATABASE_URL` | sqlite:///data/logsherlock.db | Database URI |
| `HOST` | 127.0.0.1 | Server bind address |
| `PORT` | 5000 | Server port |
| `MAX_UPLOAD_SIZE_MB` | 500 | Max upload size in MB |
| `ANALYSIS_TIMEOUT_SECONDS` | 300 | Max analysis duration per file |
| `PATTERN_MATCH_THRESHOLD` | 0.75 | Minimum confidence threshold |
| `MAX_FINDINGS_PER_FILE` | 1000 | Finding cap per file |
| `LOG_LEVEL` | INFO | Logging verbosity |
| `LOG_MAX_SIZE_MB` | 50 | Max log file size before rotation |
| `LOG_BACKUP_COUNT` | 10 | Number of rotated log files to keep |
| `SESSION_LIFETIME_HOURS` | 8 | User session duration |
| `CELERY_BROKER_URL` | redis://localhost:6379/0 | Celery broker (optional) |
| `CELERY_RESULT_BACKEND` | redis://localhost:6379/1 | Celery results (optional) |

---

## Supported Log Types

LogSherlock Pro auto-detects and parses these log formats:

| Log Type | Source | Patterns Covered |
|----------|--------|-----------------|
| dmesg | Kernel ring buffer | SCSI errors, device failures, OOM kills |
| syslog/messages | System logs | Service failures, auth events |
| pcs status | Pacemaker CLI | Cluster resource states, failures |
| corosync.log | Corosync daemon | Quorum changes, ring errors, token timeouts |
| pacemaker.log | Pacemaker daemon | Fencing events, resource migrations |
| GFS2 traces | GFS2 filesystem | Withdraws, DLM lock issues, journal recovery |
| multipath | Device mapper | Path failures, failover events |
| libvirt/qemu | Virtualization | VM migration failures, disk errors |
| kdump/vmcore | Crash dumps | Kernel panic analysis |
| systemd journal | journalctl | Service start/stop, dependency failures |
| network | NetworkManager/ip | Bond failures, interface flaps |
| fstab/mount | Filesystem config | Mount misconfigurations |
| lsblk | Block devices | Device topology |

---

## Troubleshooting

### Application won't start

```
Error: ModuleNotFoundError: No module named 'flask'
```
→ Activate your virtual environment: `source venv/bin/activate`

### Upload fails with 413

→ Increase `MAX_UPLOAD_SIZE_MB` in `.env` or set nginx `client_max_body_size`

### Analysis hangs

→ Check `ANALYSIS_TIMEOUT_SECONDS` (default 300s). Large archives may need more time.

### Database locked (SQLite)

→ SQLite doesn't support concurrent writes. Switch to PostgreSQL for multi-user production use.

### Pattern not matching expected logs

→ Check pattern confidence threshold: `PATTERN_MATCH_THRESHOLD=0.75`. Lower for more results.

### Permission denied on uploads/

→ Ensure the application user has write access: `chmod 755 uploads/ extracted/ reports/`

---

## FAQ

**Q: Does LogSherlock send data to the cloud?**
A: No. LogSherlock Pro is 100% on-premises. There are zero external API calls, no telemetry, no cloud dependencies. All processing happens on your server.

**Q: What size log files can it handle?**
A: The streaming ingestion engine handles files up to 2GB+ without loading them entirely into memory. Archives up to 500MB (configurable) are supported.

**Q: Can I add custom patterns?**
A: Yes. Use the API or web UI to create custom regex/keyword patterns with severity, category, and solution hints.

**Q: Does it support PostgreSQL?**
A: Yes. Set `DATABASE_URL=postgresql://user:pass@host:5432/logsherlock` for production deployments.

**Q: How do I integrate with Jira?**
A: Link tickets by setting the `jira_id` field. RCA reports can be generated in Jira-compatible markdown format for direct pasting into comments.

**Q: Can multiple engineers use it simultaneously?**
A: Yes. With PostgreSQL backend, multiple users can work concurrently with role-based access control.

**Q: What Python version is required?**
A: Python 3.10 or higher. Tested on 3.10, 3.11, and 3.12.

---

## Project Structure

```
logsherlock-pro/
├── app.py                 # Flask application factory
├── config.py              # Configuration (dev/test/prod)
├── models.py              # SQLAlchemy models
├── requirements.txt       # Pinned dependencies
├── run.bat / run.sh       # Startup scripts
├── engine/
│   ├── analyzer.py        # Main analysis orchestrator
│   ├── patterns.py        # Pattern definitions & matching
│   ├── ingestion.py       # Log file parsing & indexing
│   └── correlator.py      # Cross-node event correlation
├── knowledge/
│   ├── kb_manager.py      # Knowledge base search & CRUD
│   ├── known_issues.py    # Built-in known issues database
│   ├── runbooks.py        # Investigation runbooks
│   └── similar_tickets.py # Similar ticket matching
├── routes/
│   ├── tickets.py         # Ticket CRUD API
│   ├── logs.py            # File upload & extraction
│   ├── analysis.py        # Analysis trigger & results
│   ├── knowledge.py       # Knowledge base API
│   ├── reports.py         # Report generation
│   └── ui.py              # Web UI routes
├── services/
│   └── pattern_seeder.py  # Built-in pattern loader
├── templates/             # Jinja2 HTML templates
├── static/                # CSS, JS assets
├── data/                  # SQLite database
├── uploads/               # Uploaded files
├── extracted/             # Extracted archives
├── logs/                  # Application logs
├── reports/               # Generated reports
└── knowledge_base/        # KB file storage
```

---

## CLI Commands

```bash
flask --app app init-db          # Initialize database tables
flask --app app create-admin     # Create admin user (interactive)
flask --app app seed-patterns    # Load built-in analysis patterns
flask --app app db migrate       # Create migration (after model changes)
flask --app app db upgrade       # Apply pending migrations
```

---

## License

MIT License — Copyright (c) 2026 HPE Support Engineering
