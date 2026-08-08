# 🔍 LogSherlock Pro — Offline Bundle

> **Enterprise-grade HPE VMware log analysis tool that runs 100% offline in your browser.**  
> No server. No cloud. No data leaves your machine.

---

## 📦 What's Inside

```
LogSherlock-Pro.zip
├── index.html      ← The full application (open in browser)
├── app.min.js      ← Obfuscated engine (87+ modules bundled)
└── README.txt      ← Quick start instructions
```

---

## 🚀 How to Run (3 Steps)

```mermaid
flowchart LR
    A[📥 Download ZIP] --> B[📂 Extract]
    B --> C[🌐 Open in Browser]
    C --> D[🔑 Enter License Key]
    D --> E[✅ Start Analyzing!]
```

### Option 1: Direct Open
1. Extract the ZIP
2. Double-click `index.html`
3. Enter your license key → Done!

### Option 2: Local Server (Recommended for large logs)
```bash
cd LogSherlock-Pro
python -m http.server 8888
# Open http://localhost:8888
```

---

## 🏗️ Architecture — How the Offline Bundle Works

```mermaid
flowchart TD
    subgraph ZIP["📦 LogSherlock-Pro.zip (3 files)"]
        HTML["index.html<br/>━━━━━━━━━━━<br/>• Full UI/HTML/CSS<br/>• 1185 embedded patterns<br/>• Core scanner engine<br/>• License auth gate"]
        BUNDLE["app.min.js<br/>━━━━━━━━━━━<br/>• 87 feature modules<br/>• Base64 obfuscated<br/>• Self-executing bundle"]
        README["README.txt<br/>━━━━━━━━━━━<br/>• Quick start guide"]
    end

    subgraph BROWSER["🌐 Browser Runtime"]
        LOAD["Page Load"] --> AUTH["🔑 License Validation"]
        AUTH -->|Valid Key| DECODE["Decode app.min.js<br/>(base64 → JavaScript)"]
        DECODE --> MODULES["Feature Modules Activate"]
        MODULES --> READY["✅ App Ready"]
        AUTH -->|Invalid| BLOCK["🚫 Access Denied"]
    end

    HTML --> LOAD
    BUNDLE --> DECODE
```

---

## 🔐 Security & License Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant IndexHTML as index.html
    participant AppJS as app.min.js
    participant GitHub as License Server (GitHub)

    User->>Browser: Open index.html
    Browser->>IndexHTML: Load UI + Auth Gate
    IndexHTML->>User: 🔑 Show License Prompt
    User->>IndexHTML: Enter Username + Key
    IndexHTML->>GitHub: Validate against licenses.json
    GitHub-->>IndexHTML: ✅ Valid / ❌ Invalid
    
    alt License Valid
        IndexHTML->>AppJS: Load obfuscated bundle
        AppJS->>Browser: Decode base64 → Execute modules
        Browser->>User: 🎉 Full app unlocked
    else License Invalid
        IndexHTML->>User: 🚫 Access blocked
    end
```

---

## ⚙️ Module Architecture

```mermaid
flowchart TB
    subgraph CORE["🧠 Core Engine (in index.html)"]
        SCANNER["Log Scanner<br/>1185 patterns"]
        PATTERNS["Pattern Database<br/>HPE/VME/GFS2/NFS"]
        VME["VME Migration Guide"]
    end

    subgraph FEATURES["🔧 Feature Modules (in app.min.js)"]
        direction TB
        subgraph ANALYSIS["Analysis"]
            V["Verdict Engine"]
            HS["Health Score"]
            PE["Predictive Engine"]
            AI["Advanced Insights"]
            TC["Temporal Clustering"]
        end
        subgraph REPORTING["Reporting"]
            ES["Executive Summary"]
            CE["Customer Email"]
            ROI["ROI Calculator"]
            KPI["KPI Dashboard"]
            IR["Incident Reports"]
        end
        subgraph COLLABORATION["Collaboration"]
            TD["Team Dashboard"]
            SH["Shift Handoff"]
            CT["Collab Threads"]
            MT["Multi-Tenant"]
            AU["Audit Trail"]
        end
        subgraph TOOLS["Power Tools"]
            CP["Command Palette"]
            NL["Natural Language Query"]
            BR["Blast Radius"]
            RB["Runbook Executor"]
            SD["Scan Diff"]
        end
    end

    CORE --> FEATURES
    SCANNER --> V
    V --> HS
    HS --> ES
```

---

## 🔒 Code Protection

```mermaid
flowchart LR
    subgraph BUILD["Build Process (Developer Only)"]
        SRC["87 Source .js Files"] --> CONCAT["Concatenate in Order"]
        CONCAT --> MINIFY["Remove Comments<br/>Minify Whitespace"]
        MINIFY --> ENCODE["Base64 Encode<br/>Entire Bundle"]
        ENCODE --> WRAP["Wrap in Self-Executing<br/>Anonymous Function"]
        WRAP --> OUTPUT["app.min.js<br/>(Unreadable)"]
    end

    subgraph RUNTIME["Runtime (User's Browser)"]
        OUTPUT --> ATOB["atob() Decode"]
        ATOB --> INJECT["Inject as Script"]
        INJECT --> EXEC["Execute All Modules"]
    end
```

**What developers see if they try to read the code:**
```javascript
(function(){var _0x=["TG9nU2hlcmxvY2sgUHJvI...3 million chars...YWxs"];
var _s=atob(_0x[0]);var _e=document.createElement('script');
_e.textContent=_s;document.head.appendChild(_e);})();
```
> ❌ No function names visible  
> ❌ No variable names readable  
> ❌ No business logic exposed  
> ❌ Cannot simply copy individual features  

---

## 📊 Feature List (87 Modules)

| Category | Modules |
|----------|---------|
| 🔍 **Analysis** | Verdict Engine, Health Score, Predictive Engine, Advanced Insights, Temporal Clustering, Anomaly Heatmap, Root Cause Chain, Failure Fingerprint |
| 📋 **Reporting** | Executive Summary, Customer Email Generator, ROI Calculator, KPI Dashboard, Incident Report Generator, Compliance Export |
| 🤝 **Collaboration** | Team Dashboard, Shift Handoff, Collab Threads, Multi-Tenant, Audit Trail, Finding Comments |
| 🛠️ **Tools** | Command Palette, Natural Language Query, Blast Radius, Runbook Executor, Scan Diff, Log Diff Analyzer, Smart Search |
| 🎯 **HPE Patterns** | VME Migration, GFS2 Deep, NFS Deep, Alletra Deep, Cluster Patterns, Lifecycle, Confirmed Patterns |
| 📈 **Intelligence** | Predictive Alerts, Trend Over Time, Baseline Subtraction, Noise Suppression, Alert Fatigue Scorer, Pattern Confidence |
| 🎨 **UX** | Live Demo Mode, Guided Mode, Training Mode, Onboarding Flow, Custom Themes, Split View, Bookmark Manager |

---

## 🖥️ System Requirements

| Requirement | Minimum |
|-------------|---------|
| Browser | Chrome 90+, Firefox 88+, Edge 90+, Safari 14+ |
| RAM | 4 GB (8 GB recommended for large logs) |
| Disk | 50 MB free space |
| Network | **Not required** (offline-first) |
| Server | None — runs entirely in browser |

---

## 🔑 License Types

| Type | Format | Use Case |
|------|--------|----------|
| Standard | `LS-XXXX-XXXX-XXXX-XXXX` | Individual user |
| Master | `LS-MASTER-XXXX-XXXX` | Enterprise / Admin |

> License validates once online, then works offline for the session.

---

## ❓ FAQ

**Q: Does my log data go to any server?**  
A: No. Everything runs locally in your browser. Zero data transmitted.

**Q: Can I use it without internet?**  
A: Yes! After initial license activation, the app works fully offline.

**Q: Why only 3 files?**  
A: We bundle 87+ modules into one obfuscated file for simplicity and IP protection.

**Q: Can I host this on my internal network?**  
A: Yes! Just put the 3 files on any HTTP server (Apache, Nginx, IIS, Python).

---

## 📞 Support

- **Developer:** Krishna Yada
- **Issues:** [GitHub Issues](https://github.com/yadakrishna245/Log_analysis/issues)
- **License:** Proprietary — All Rights Reserved © 2026

---

<p align="center">
  <b>LogSherlock Pro v4.0</b> — Enterprise Log Intelligence, Zero Cloud Dependency
</p>
