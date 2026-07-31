<div align="center">

# 🔍 LogSherlock Pro

### Intelligent Log Analysis for HPE VME Support Engineering

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![AWS](https://img.shields.io/badge/AWS-Serverless-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)](https://aws.amazon.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

**Turn hours of manual log investigation into minutes.**  
Upload customer logs → Get instant root cause analysis with actionable solutions.

[Getting Started](#-getting-started) • [Architecture](#-architecture) • [API Docs](#-api-endpoints) • [Deployment](#-deployment-options) • [Security](#-security--compliance)

---

</div>

## 📊 Impact at a Glance

<table>
<tr>
<td width="50%">

### ❌ Without LogSherlock
- 2-4 hours manually grepping through logs
- Tribal knowledge locked in senior engineers' heads
- Missed correlations across multi-node clusters
- Inconsistent RCA reports across the team
- No log tools approved for on-prem use

</td>
<td width="50%">

### ✅ With LogSherlock
- **< 2 minutes** automated analysis
- **101 detection patterns** available to all engineers
- **Automatic cross-node timeline** reconstruction
- **One-click Jira-ready RCA** in standard format
- **100% on-premises** — zero data leaves the network

</td>
</tr>
</table>

---

## 🧠 How It Works

> **"Is this AI? Will it hallucinate?"**  
> **NO.** Pure regex pattern matching + structured knowledge lookup. Zero AI. Zero hallucination. Fully deterministic.

```mermaid
flowchart LR
    A[📁 Upload Logs<br/>7z/zip/tar/raw] --> B[🔍 Pattern Engine<br/>101 Regex Signatures]
    B --> C[🧩 Knowledge Matcher<br/>63 Known Issues]
    C --> D[📋 Runbook Selector<br/>12 Investigation Guides]
    D --> E[📄 RCA Generator<br/>Jira-Ready Report]
    
    style A fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    style B fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style C fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style D fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px
    style E fill:#fce4ec,stroke:#b71c1c,stroke-width:2px
```

### Analysis Pipeline — Detailed Flow

```mermaid
flowchart TD
    subgraph INPUT["📥 Input Layer"]
        A1[Web UI Upload] --> B1[File Extraction]
        A2[REST API Call] --> B1
        A3[CLI Upload] --> B1
        B1 --> B2{Archive Type?}
        B2 -->|7z| C1[7z Extraction]
        B2 -->|ZIP| C2[ZIP Extraction]
        B2 -->|TAR/GZ| C3[TAR Extraction]
        B2 -->|Raw Text| C4[Direct Read]
    end

    subgraph ENGINE["⚙️ Analysis Engine"]
        C1 & C2 & C3 & C4 --> D1[Line-by-Line Scanner]
        D1 --> D2[Pattern Matching<br/>101 Regex Rules]
        D2 --> D3[Severity Classification<br/>CRITICAL / HIGH / MEDIUM / LOW]
        D3 --> D4[Cross-Node Correlator<br/>Timeline Reconstruction]
    end

    subgraph KNOWLEDGE["📚 Knowledge Base"]
        D4 --> E1[Known Issues Lookup<br/>63 Catalogued Problems]
        E1 --> E2[Runbook Matching<br/>12 Step-by-Step Guides]
        E2 --> E3[Similar Ticket Search<br/>Historical Pattern Match]
    end

    subgraph OUTPUT["📤 Output Layer"]
        E3 --> F1[Findings Report<br/>Categorized by Severity]
        F1 --> F2[RCA Document<br/>8-Section Jira Format]
        F2 --> F3[Solution Steps<br/>Actionable Remediation]
    end

    style INPUT fill:#e3f2fd,stroke:#1565c0
    style ENGINE fill:#fff3e0,stroke:#e65100
    style KNOWLEDGE fill:#e8f5e9,stroke:#2e7d32
    style OUTPUT fill:#f3e5f5,stroke:#6a1b9a
```

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph CLIENT["🖥️ Client Layer"]
        UI[Web Dashboard<br/>Jinja2 + CSS]
        API_CLIENT[REST API Client<br/>curl / Postman]
    end

    subgraph APP["🐍 Application Layer — Flask"]
        ROUTES[Route Handlers<br/>analysis · tickets · knowledge · reports]
        AUTH[Authentication<br/>API Key + Session]
    end

    subgraph CORE["🔬 Core Engine"]
        PATTERNS[Pattern Engine<br/>101 Regex Signatures]
        ANALYZER[Analyzer<br/>Orchestrator]
        INGESTION[Ingestion<br/>File Parser]
        CORRELATOR[Correlator<br/>Cross-Node Timeline]
    end

    subgraph KB["📖 Knowledge Base"]
        ISSUES[Known Issues<br/>63 Entries]
        RUNBOOKS[Runbooks<br/>12 Guides]
        SIMILAR[Similar Tickets<br/>History Matcher]
    end

    subgraph STORAGE["💾 Storage Layer"]
        SQLITE[(SQLite<br/>Local Mode)]
        DYNAMO[(DynamoDB<br/>AWS Mode)]
        S3[(S3 Bucket<br/>Log Files)]
        LOCAL_FS[(Local FS<br/>Uploads)]
    end

    UI --> ROUTES
    API_CLIENT --> ROUTES
    ROUTES --> AUTH
    AUTH --> ANALYZER
    ANALYZER --> INGESTION
    ANALYZER --> PATTERNS
    ANALYZER --> CORRELATOR
    PATTERNS --> ISSUES
    PATTERNS --> RUNBOOKS
    PATTERNS --> SIMILAR
    ROUTES --> SQLITE
    ROUTES --> DYNAMO
    INGESTION --> S3
    INGESTION --> LOCAL_FS

    style CLIENT fill:#e1f5fe,stroke:#0277bd
    style APP fill:#fff8e1,stroke:#f9a825
    style CORE fill:#fbe9e7,stroke:#d84315
    style KB fill:#e8f5e9,stroke:#388e3c
    style STORAGE fill:#f3e5f5,stroke:#7b1fa2
```

---

## 🚀 Deployment Options

```mermaid
flowchart LR
    subgraph LOCAL["🏠 Option 1: Local"]
        L1[pip install] --> L2[python app.py]
        L2 --> L3[localhost:5000]
    end

    subgraph DOCKER["🐳 Option 2: Docker"]
        D1[docker build] --> D2[docker run]
        D2 --> D3[Container:5000]
    end

    subgraph AWS["☁️ Option 3: AWS Serverless"]
        A1[SAM Deploy] --> A2[API Gateway]
        A2 --> A3[Lambda]
        A3 --> A4[DynamoDB + S3]
    end

    style LOCAL fill:#e8f5e9,stroke:#2e7d32
    style DOCKER fill:#e3f2fd,stroke:#1565c0
    style AWS fill:#fff3e0,stroke:#e65100
```

### Option 1: Local (On-Premises)

```bash
# Install & run in 30 seconds
git clone https://github.com/yadakrishna245/Log_analysis.git
cd Log_analysis
pip install -r requirements.txt
flask init-db
python app.py
# → Open http://localhost:5000
```

### Option 2: Docker

```bash
docker build -t logsherlock-pro .
docker run -p 5000:5000 logsherlock-pro
```

### Option 3: AWS Serverless (Single-Click)

```bash
cd deploy
./deploy.sh          # Linux/Mac
.\deploy.ps1        # Windows
```

> **AWS Cost:** ~$1.50/month (DynamoDB + S3 + Lambda free tier)

---

## 🔄 CI/CD Pipeline

```mermaid
flowchart LR
    A[Git Push to main] --> B[GitHub Actions Trigger]
    B --> C[Install Dependencies]
    C --> D[Run Test Suite]
    D --> E{Tests Pass?}
    E -->|Yes| F[SAM Build]
    E -->|No| G[❌ Fail & Notify]
    F --> H[SAM Deploy to AWS]
    H --> I[✅ Live on Lambda]

    style A fill:#e3f2fd,stroke:#1565c0
    style I fill:#e8f5e9,stroke:#2e7d32
    style G fill:#ffebee,stroke:#c62828
```

---

## 📈 Knowledge Base Statistics

<div align="center">

| 🎯 Metric | 📊 Count |
|:---------:|:--------:|
| Detection Patterns | **101** |
| Known Issues | **63** |
| Guided Runbooks | **12** |
| Products Covered | **7** |
| Log Formats Supported | **15+** |
| Severity Levels | **4** |

</div>

---

## 🎯 Supported Products & Components

```mermaid
mindmap
  root((LogSherlock Pro))
    HPE VME 8.x / 9.x
      Morpheus Platform
      VM Management
    Cluster Stack
      Corosync
      Pacemaker
      STONITH / Fencing
    Storage
      GFS2
      DLM
      iSCSI / Multipath
      SCSI Persistent Reservations
    Virtualization
      QEMU-KVM
      Libvirt
    HPE Storage
      Alletra
      Nimble
```

---

## 🌐 API Endpoints

| Endpoint | Method | Description |
|:---------|:------:|:------------|
| `/api/health` | `GET` | Health check & status |
| `/api/analyze/quick` | `POST` | Upload & analyze files instantly |
| `/api/tickets` | `GET` `POST` | Manage support tickets |
| `/api/tickets/{id}/analyze` | `POST` | Run analysis on ticket logs |
| `/api/tickets/{id}/report` | `GET` | Generate RCA report |
| `/api/knowledge/search?q=` | `GET` | Search knowledge base |
| `/api/knowledge/issues` | `GET` | List all known issues |
| `/api/knowledge/runbooks` | `GET` | List all runbooks |
| `/api/stats` | `GET` | Dashboard statistics |

### Quick Example

```bash
# Upload & analyze
curl -X POST http://localhost:5000/api/analyze/quick \
  -F "files=@customer_logs.7z" \
  -F "description=GFS2 mount failures after node reboot"
```

<details>
<summary>📋 <strong>Response Example</strong> (click to expand)</summary>

```json
{
  "findings_count": 12,
  "findings": [
    {
      "pattern_name": "dlm_quorum_lost",
      "severity": "CRITICAL",
      "description": "DLM lost quorum - GFS2 mounts will fail",
      "solution_hint": "Check corosync membership, verify network connectivity"
    }
  ],
  "related_issues": [
    {
      "title": "GFS2 mount failure due to DLM quorum loss after node reboot",
      "solution": "Restart corosync, verify all nodes rejoin cluster"
    }
  ],
  "suggested_runbook": "gfs2_mount_failure_investigation",
  "jira_report": "h2. Root Cause Analysis (RCA)\n..."
}
```

</details>

---

## 🔒 Security & Compliance

```mermaid
flowchart TD
    subgraph BOUNDARY["🛡️ Security Boundary — Your Infrastructure"]
        A[Customer Log File] --> B[LogSherlock Pro]
        B --> C[Pattern Match Results]
        C --> D[RCA Report]
    end

    E[❌ External AI Services] -.-x B
    F[❌ Cloud APIs] -.-x B
    G[❌ Third-Party Storage] -.-x B
    H[❌ Telemetry/Analytics] -.-x B

    style BOUNDARY fill:#e8f5e9,stroke:#2e7d32,stroke-width:3px
    style E fill:#ffebee,stroke:#c62828
    style F fill:#ffebee,stroke:#c62828
    style G fill:#ffebee,stroke:#c62828
    style H fill:#ffebee,stroke:#c62828
```

### Data Privacy Guarantees

| Concern | How We Address It |
|:--------|:------------------|
| **Data residency** | 100% on-premises OR your own private AWS account |
| **No external AI calls** | Zero calls to OpenAI, Google, or any third-party AI |
| **No telemetry** | No usage tracking, no analytics, no phone-home |
| **No internet required** | Works fully offline — air-gapped capable |
| **Customer data isolation** | Single-tenant. No shared databases |
| **Log retention** | Auto-deleted after 7 days (configurable) |
| **Source code clean** | Zero customer names, IPs, or ticket IDs in codebase |

### Security Controls

| Control | Implementation |
|:--------|:---------------|
| Authentication | API key (`X-API-Key`) + session-based login |
| Authorization | All `/api/*` endpoints require valid credentials |
| Encryption at rest | S3 AES-256, DynamoDB encryption by default |
| Encryption in transit | HTTPS/TLS via API Gateway or reverse proxy |
| Input validation | `secure_filename()`, zip-slip prevention |
| Security headers | CSP, X-Frame-Options, X-Content-Type-Options |
| Rate limiting | Configurable request throttling |
| File size limits | Configurable (default 4GB) |

### Compliance Alignment

| Standard | Relevant Controls |
|:---------|:------------------|
| **SOC 2** | Encryption at rest & transit, access controls, audit logging |
| **GDPR** | No personal data processed, data retention policies |
| **ISO 27001** | Access management, cryptographic controls |
| **HPE Internal** | No customer data in code, single-tenant, no external APIs |

<details>
<summary>📝 <strong>Copy-Paste Statement for Compliance Review</strong></summary>

> *"LogSherlock Pro performs pattern matching using pre-built regex signatures against uploaded log files. It does NOT use any AI/ML model, does NOT send data to any external service, and runs entirely within our own infrastructure (either on-premises or in our dedicated AWS account). Customer log data is never exposed to the internet, shared with third parties, or stored beyond the configured retention period."*

</details>

---

## 🧩 How the Pattern Engine Works

```mermaid
sequenceDiagram
    participant U as 👤 Engineer
    participant W as 🌐 Web UI
    participant A as ⚙️ Analyzer
    participant P as 🔍 Pattern Engine
    participant K as 📚 Knowledge Base
    participant R as 📄 RCA Generator

    U->>W: Upload log files
    W->>A: POST /api/analyze/quick
    A->>A: Extract archives (7z/zip/tar)
    A->>P: Scan each log line
    
    loop For each of 101 patterns
        P->>P: Regex match against line
    end
    
    P->>A: Return findings + severity
    A->>K: Lookup matched patterns
    K->>K: Find known issues (keyword match)
    K->>K: Select relevant runbooks
    K->>A: Return solutions + steps
    A->>R: Compile results
    R->>R: Format 8-section Jira report
    R->>W: Return complete analysis
    W->>U: Display findings + RCA + solutions
```

---

## 📂 Project Structure

```
LogSherlock-Pro/
│
├── 🐍 app.py                    # Flask application factory
├── ⚙️ config.py                  # Configuration management
├── 🗃️ models.py                  # Database models (SQLAlchemy)
├── 💾 storage.py                 # Storage abstraction (SQLite ↔ DynamoDB)
├── ☁️ db_dynamo.py               # DynamoDB data layer
├── 📦 requirements.txt           # Python dependencies
├── 🐳 Dockerfile                 # Container deployment
│
├── engine/                       # 🔬 Core Analysis Engine
│   ├── patterns.py               #    101 detection patterns (regex)
│   ├── analyzer.py               #    Analysis orchestrator
│   ├── ingestion.py              #    File parsing & extraction
│   └── correlator.py             #    Cross-node correlation
│
├── knowledge/                    # 📖 Knowledge Base
│   ├── known_issues.py           #    63 catalogued known issues
│   ├── runbooks.py               #    12 investigation runbooks
│   ├── similar_tickets.py        #    Similar ticket matching
│   └── kb_manager.py             #    Knowledge base CRUD manager
│
├── routes/                       # 🌐 API Endpoints
│   ├── analysis.py               #    Upload & analyze
│   ├── tickets.py                #    Ticket CRUD + RCA generation
│   ├── knowledge.py              #    KB search & browse
│   ├── reports.py                #    Report generation & export
│   ├── logs.py                   #    Log file management
│   └── ui.py                     #    Web UI page routes
│
├── services/                     # 🛠️ Business Services
│   └── pattern_seeder.py         #    Database seeding utilities
│
├── deploy/                       # ☁️ AWS Serverless Deployment
│   ├── template.yaml             #    SAM/CloudFormation template
│   ├── lambda_handler.py         #    Lambda entry point
│   ├── deploy.ps1                #    One-click deploy (Windows)
│   ├── deploy.sh                 #    One-click deploy (Linux/Mac)
│   └── samconfig.toml            #    SAM CLI configuration
│
├── docs/                         # 📚 Documentation
│   ├── DEPLOYMENT.md             #    Deployment guide
│   ├── USER_GUIDE.md             #    User guide
│   ├── COMPLIANCE.md             #    Security & compliance
│   └── SALES_PITCH.md            #    Business value summary
│
├── templates/                    # 🎨 Web UI (Jinja2 HTML)
├── static/                       # 🎨 CSS/JS assets
├── tests/                        # ✅ Test suite + sample logs
└── .github/workflows/            # 🔄 CI/CD automation
```

---

## 👥 Who Benefits

```mermaid
flowchart TD
    subgraph L4["🔧 L4 Engineers"]
        A1[Instant pattern matching<br/>vs manual grep]
        A2[Step-by-step runbooks<br/>for complex issues]
        A3[Never miss a known issue<br/>tool remembers all cases]
    end

    subgraph MGR["📊 Managers"]
        B1[Consistent RCA quality<br/>across all engineers]
        B2[Measurable MTTR reduction<br/>track time saved]
        B3[Knowledge retention<br/>when engineers leave]
    end

    subgraph CUST["🤝 Customers"]
        C1[Faster response<br/>on P1/P2 cases]
        C2[More accurate<br/>root cause identification]
        C3[Proactive prevention<br/>recommendations]
    end

    style L4 fill:#e3f2fd,stroke:#1565c0
    style MGR fill:#fff3e0,stroke:#e65100
    style CUST fill:#e8f5e9,stroke:#2e7d32
```

---

## ⚡ Getting Started

### Prerequisites

- Python 3.10+
- (Optional) AWS CLI + SAM CLI for cloud deployment
- (Optional) Docker for containerized deployment

### Quick Start

```bash
# 1. Clone
git clone https://github.com/yadakrishna245/Log_analysis.git
cd Log_analysis

# 2. Install dependencies
pip install -r requirements.txt

# 3. Initialize database
flask init-db

# 4. Run
python app.py
```

> 🌐 Open **http://localhost:5000** in your browser

### Environment Variables

| Variable | Default | Description |
|:---------|:--------|:------------|
| `SECRET_KEY` | auto-generated | Flask session secret |
| `STORAGE_BACKEND` | `sqlite` | `sqlite` or `dynamodb` |
| `LOGSHERLOCK_API_KEY` | — | API authentication key |
| `LOGSHERLOCK_DEV_MODE` | `false` | Skip auth in development |
| `UPLOAD_FOLDER` | `./uploads` | File upload directory |
| `S3_BUCKET` | — | S3 bucket (AWS mode) |
| `DYNAMODB_TABLE_PREFIX` | `LogSherlock` | DynamoDB table prefix |

---

## 🧪 Testing

```bash
# Run full test suite
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=engine --cov=knowledge --cov=routes
```

---

## 📊 Technology Comparison

| Aspect | LogSherlock Pro | AI/LLM Tools | Manual Grep |
|:-------|:---------------:|:------------:|:-----------:|
| Speed | ⚡ < 2 min | ⚡ < 1 min | 🐌 2-4 hours |
| Accuracy | ✅ 100% deterministic | ⚠️ Can hallucinate | ✅ Depends on skill |
| Compliance | ✅ On-prem, no data leaks | ❌ Sends data to cloud | ✅ Local |
| Consistency | ✅ Same output every time | ⚠️ Varies per query | ❌ Varies per engineer |
| Knowledge | ✅ 63 issues + 12 runbooks | ⚠️ Generic knowledge | ❌ Tribal knowledge |
| Audit trail | ✅ Full traceability | ❌ Black box | ❌ None |

---

## 🗺️ Roadmap

- [x] 101 detection patterns for VME/GFS2/DLM/Corosync/Pacemaker
- [x] 63 known issues with root cause + solution
- [x] 12 guided investigation runbooks
- [x] AWS serverless deployment (Lambda + DynamoDB + S3)
- [x] Docker containerization
- [x] CI/CD pipeline with GitHub Actions
- [x] Multi-format archive support (7z, ZIP, TAR, GZ)
- [x] Jira-ready RCA report generation
- [ ] Pattern contribution workflow (team can add new patterns)
- [ ] Grafana dashboard integration
- [ ] Slack/Teams notification on critical findings
- [ ] Bulk historical log re-analysis

---

## 📄 License

MIT License — Free for internal enterprise use.

---

<div align="center">

## 📬 Contact

**Maintainer:** Yada Krishna Chaithanya  
**Team:** HPE VME L4 Support Engineering  
**Repository:** [github.com/yadakrishna245/Log_analysis](https://github.com/yadakrishna245/Log_analysis)

---

*Built with ❤️ to make L4 support engineering faster and more reliable.*

<sub>LogSherlock Pro v1.0 • No AI • No Cloud Dependencies • 100% On-Premises Capable</sub>

</div>
