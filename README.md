# LogSherlock Pro 🔍

**Intelligent Log Analysis for HPE VME Support Engineering**

> Turn hours of manual log investigation into minutes. Upload customer logs → get instant root cause analysis with actionable solutions.

---

## The Problem We Solve

| Without LogSherlock | With LogSherlock |
|---------------------|------------------|
| 2-4 hours manually grepping through logs | **< 2 minutes** automated analysis |
| Tribal knowledge locked in senior engineers' heads | **101 detection patterns** available to all L4 engineers |
| Missed correlations across multi-node clusters | **Automatic cross-node timeline** reconstruction |
| Inconsistent RCA reports across team | **One-click Jira-ready RCA** in standard 8-section format |
| No log tools approved for on-prem use | **100% on-premises** — zero data leaves the network |

---

## What It Does

```
Upload Logs → Pattern Detection → Root Cause → Solution → Jira Report
   (7z/zip/     (101 regex        (63 known     (12 step-by-step    (copy-paste
    tar/raw)     signatures)       issues)       runbooks)           ready)
```

### Core Capabilities

| Capability | Details |
|-----------|---------|
| **Pattern Detection** | 101 built-in signatures for GFS2, DLM, iSCSI, SCSI, fencing, kernel, Corosync, Pacemaker, QEMU, libvirt errors |
| **Known Issues Database** | 63 catalogued issues with root cause, solution, and prevention steps |
| **Guided Runbooks** | 12 step-by-step investigation guides for complex multi-component failures |
| **Auto RCA Reports** | Generates 8-section Root Cause Analysis in Jira wiki markup format |
| **Multi-Format Support** | Handles 7z, ZIP, TAR, GZ, raw logs, screenshots (OCR), any text file |
| **Streaming Analysis** | Processes multi-GB log bundles without memory issues |
| **Knowledge Search** | Search across all known issues, patterns, and runbooks instantly |

---

## Supported Products & Components

- HPE Morpheus VM Essentials (VME) 8.x / 9.x
- GFS2 clustered filesystems
- DLM (Distributed Lock Manager)
- Corosync / Pacemaker / STONITH
- iSCSI / Multipath / SCSI Persistent Reservations
- QEMU-KVM / Libvirt
- HPE Alletra / Nimble Storage integration

---

## Deployment Options

### Option 1: Local (On-Premises)

```bash
# Install & run in 30 seconds
pip install -r requirements.txt
python app.py
# Open http://localhost:5000
```

### Option 2: AWS Serverless (Single-Click)

```bash
# Requires: AWS CLI + SAM CLI configured
./deploy.sh                    # Linux/Mac
.\deploy.ps1                   # Windows
```

**AWS Cost:** ~$1.50/month (DynamoDB + S3 + Lambda free tier)

### Option 3: Docker

```bash
docker build -t logsherlock-pro .
docker run -p 5000:5000 logsherlock-pro
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     LogSherlock Pro v1.0                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   Web UI ──→ REST API ──→ Pattern Engine (101 signatures)    │
│                  │              │                             │
│                  ▼              ▼                             │
│         Ticket Manager    Knowledge Base                     │
│              │            (63 issues + 12 runbooks)          │
│              ▼                                               │
│         RCA Report Generator (Jira format)                   │
│                                                              │
├──────────────── Storage ─────────────────────────────────────┤
│   Local: SQLite          AWS: DynamoDB + S3                  │
└──────────────────────────────────────────────────────────────┘
```

---

## Quick Demo

### 1. Upload & Analyze
```bash
curl -X POST http://localhost:5000/api/analyze/quick \
  -F "files=@customer_logs.7z" \
  -F "description=GFS2 mount failures after node reboot"
```

### 2. Get Instant Results
```json
{
  "findings_count": 12,
  "findings": [
    {
      "pattern_name": "dlm_quorum_lost",
      "severity": "CRITICAL",
      "description": "DLM lost quorum - GFS2 mounts will fail",
      "solution_hint": "Check corosync membership, verify network..."
    }
  ],
  "related_issues": [
    {
      "title": "GFS2 mount failure due to DLM quorum loss after node reboot",
      "solution": "Restart corosync, verify all nodes rejoin..."
    }
  ],
  "jira_report": "h2. Root Cause Analysis (RCA)..."
}
```

### 3. Copy-Paste to Jira
The `jira_report` field contains ready-to-paste wiki markup for your ticket.

---

## Knowledge Base Statistics

| Metric | Count |
|--------|-------|
| Detection Patterns | **101** |
| Known Issues | **63** |
| Guided Runbooks | **12** |
| Products Covered | **7** |
| Log Formats Supported | **15+** |

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/analyze/quick` | POST | Upload & analyze files instantly |
| `/api/tickets` | GET/POST | Manage support tickets |
| `/api/tickets/{id}/analyze` | POST | Run analysis on ticket logs |
| `/api/tickets/{id}/report` | GET | Generate RCA report |
| `/api/knowledge/search?q=` | GET | Search knowledge base |
| `/api/knowledge/issues` | GET | List all known issues |
| `/api/knowledge/runbooks` | GET | List all runbooks |
| `/api/stats` | GET | Dashboard statistics |

---

## Security

- ✅ API key authentication (`X-API-Key` header)
- ✅ Session-based auth for web UI
- ✅ Archive path traversal protection (zip-slip prevention)
- ✅ Security headers (CSP, X-Frame-Options, X-Content-Type-Options)
- ✅ No hardcoded secrets (auto-generated on first run)
- ✅ Input validation on all endpoints
- ✅ Rate limiting support
- ✅ 100% on-premises — no data sent to external services

---

## Project Structure

```
LogSherlock-Pro/
├── app.py                    # Flask application factory
├── config.py                 # Configuration management
├── models.py                 # Database models (SQLAlchemy)
├── storage.py                # Storage abstraction (SQLite ↔ DynamoDB)
├── db_dynamo.py              # DynamoDB data layer
├── lambda_handler.py         # AWS Lambda entry point
├── engine/
│   ├── patterns.py           # 101 detection patterns (regex engine)
│   ├── analyzer.py           # Orchestrates analysis pipeline
│   ├── ingestion.py          # File parsing, archive extraction
│   └── correlator.py         # Cross-node event correlation
├── knowledge/
│   ├── known_issues.py       # 63 catalogued known issues
│   ├── runbooks.py           # 12 step-by-step investigation guides
│   └── similar_tickets.py    # Similar ticket matching
├── routes/
│   ├── analysis.py           # Upload & analyze endpoints
│   ├── tickets.py            # Ticket CRUD + RCA generation
│   ├── knowledge.py          # Knowledge base search
│   └── reports.py            # Report generation
├── templates/                # Web UI (single-page app)
├── static/                   # CSS/JS assets
├── template.yaml             # AWS SAM deployment template
├── deploy.ps1 / deploy.sh    # Single-click deploy scripts
├── Dockerfile                # Container deployment
└── .github/workflows/        # CI/CD automation
```

---

## How It Helps the Team

### For L4 Engineers
- Instant pattern matching instead of manual grep
- Step-by-step runbooks for complex issues
- Never miss a known issue — the tool remembers all past cases

### For Managers
- Consistent RCA quality across all engineers
- Faster ticket resolution (MTTR reduction)
- Knowledge retention when engineers leave
- Measurable: track patterns detected, time saved

### For Customers
- Faster response on P1/P2 cases
- More accurate root cause identification
- Proactive prevention recommendations

---

## Getting Started

### Prerequisites
- Python 3.10+
- (Optional) AWS CLI + SAM CLI for cloud deployment

### Install
```bash
git clone https://github.com/yadakrishna245/Log_analysis.git
cd Log_analysis
pip install -r requirements.txt
python -c "from app import app; app.app_context().push(); from models import db; db.create_all()"
flask init-db
python app.py
```

### Access
Open http://localhost:5000 in your browser.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | auto-generated | Flask session secret |
| `STORAGE_BACKEND` | `sqlite` | `sqlite` (local) or `dynamodb` (AWS) |
| `LOGSHERLOCK_API_KEY` | empty | API authentication key |
| `LOGSHERLOCK_DEV_MODE` | `false` | Skip auth in development |
| `UPLOAD_FOLDER` | `./uploads` | File upload directory |
| `S3_BUCKET` | — | S3 bucket for AWS mode |
| `DYNAMODB_TABLE_PREFIX` | `LogSherlock` | DynamoDB table prefix |

---

## License

MIT License — Free for internal enterprise use.

---

## Contact

**Maintainer:** Yada Krishna Chaithanya  
**Team:** HPE VME L4 Support Engineering  
**Repository:** https://github.com/yadakrishna245/Log_analysis

---

*Built with ❤️ to make L4 support engineering faster and more reliable.*
