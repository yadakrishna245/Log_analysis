# LogSherlock Pro — Local Edition 🔍

**HPE VME L4 Support Engineering Tool** — Fully offline log analysis with AI-powered root cause detection.

> Zero install. Zero data upload. Just double-click and analyze.

---

## 🚀 Quick Start (30 seconds)

```
1. Clone this folder (or copy it to your machine)
2. Double-click `index.html`
3. Browser opens → Paste ticket → Drop logs → Get results
```

**That's it.** No server, no cloud, no dependencies.

---

## 📋 System Requirements

| Requirement | Minimum | Notes |
|-------------|---------|-------|
| **OS** | Windows 10/11, macOS, Linux | Any OS with a modern browser |
| **Browser** | Chrome 80+, Edge 80+, Firefox 90+ | Web Worker + DecompressionStream support |
| **RAM** | 4 GB (8 GB recommended) | Browser needs memory to parse log bundles |
| **Disk Space** | 5 MB | Just the HTML + JS files |
| **Python** | ❌ Not needed | |
| **Node.js** | ❌ Not needed | |
| **Internet** | ❌ Not needed | Works 100% offline |
| **Install** | ❌ Nothing to install | |

---

## 📂 Project Structure

```
LogSherlock-Pro-Local/
├── index.html              ← Main app (double-click to open)
├── scan-worker.js          ← Web Worker (background scanning engine)
├── copilot-integration.js  ← GitHub Copilot AI module (optional)
├── LICENSE                 ← Proprietary license
├── README.md               ← This file
└── CONFIGURATION.md        ← Copilot API setup guide
```

---

## 🎯 Features

### Core (Works Offline)
- **100+ HPE VME-specific patterns** — GFS2, Corosync, Pacemaker, DLM, SCSI, Multipath, Morpheus, KVM
- **Streaming tar.gz parsing** — Handles 3GB+ bundles without memory overflow
- **Web Worker scanning** — No UI freeze, background processing
- **Ticket Pre-Analysis** — Detects SFTP/HTTPS links, suggests which bundles to download
- **Root Cause Summary** — Automatic cascade chain detection
- **Professional RCA Report** — Copy-paste ready for Jira (h2/h3 Jira markup)
- **Severity Heatmap** — Visual file × severity grid
- **CSV Export** — Export findings to spreadsheet
- **PDF Report** — Print-ready formatted report
- **Scan History** — Last 5 scans stored in localStorage

### AI-Powered (Requires Copilot License)
- **🤖 AI Analysis** — Root cause analysis using GitHub Copilot
- **💬 Comment Reply** — Generate professional Jira replies
- **🧭 Investigation Guide** — AI-powered where-to-look suggestions
- **💬 AI Chat** — Ask HPE VME questions with scan context

---

## 🔒 Security & Compliance

| Concern | Answer |
|---------|--------|
| Where does data go? | **Nowhere.** Everything runs in your browser's memory |
| Are logs uploaded? | **No.** Zero network requests during scanning |
| What about AI features? | Only pattern names sent (NOT raw logs). See CONFIGURATION.md |
| Is data stored on disk? | Only scan history metadata in localStorage (clearable) |
| Can IT audit this? | Yes — single HTML file, fully inspectable source code |
| Works on airgapped systems? | **Yes** — no internet needed for core features |

---

## 🔧 How It Works

```
┌─────────────────────────────────────────────────────────┐
│  Your Browser (Chrome/Edge/Firefox)                      │
│                                                          │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────┐ │
│  │ index.html│───▶│ scan-worker  │───▶│  Results/RCA  │ │
│  │  (UI)     │    │ (Web Worker) │    │  (displayed)  │ │
│  └──────────┘    └──────────────┘    └───────────────┘ │
│       │                                       │         │
│       ▼                                       ▼         │
│  ┌──────────┐                         ┌─────────────┐  │
│  │ Copilot  │ (optional, only sends   │ localStorage │  │
│  │  API     │  pattern metadata)      │ (history)    │  │
│  └──────────┘                         └─────────────┘  │
└─────────────────────────────────────────────────────────┘
                    ⬆️ NO DATA LEAVES THIS BOX
```

---

## 📖 Usage Guide

### 1. Paste Ticket Context (Optional but Recommended)
- Copy the full Jira ticket description into the "TICKET CONTEXT" box
- The tool will detect SFTP/HTTPS links and suggest which bundles to download
- Pre-analysis shows issue type and relevant log areas

### 2. Drop Log Files
- Drag & drop `.tar.gz` / `.tgz` bundles from HPRC onto the drop zone
- Supports multiple files simultaneously
- Also accepts plain `.log`, `.txt`, `.conf`, `.sh`, or any text file

### 3. Click ▶ Run Scan
- Button text changes based on state:
  - **▶ Run Scan** — files staged, ready to analyze
  - **▶ Run Scan + Ticket Analysis** — files + ticket context present
  - **▶ Analyze Ticket** — only ticket context, no files

### 4. Review Results
- **Root Cause Summary** — One-sentence cascade explanation
- **Severity Metrics** — Click any metric to filter
- **Heatmap** — Click any cell to see specific findings
- **Findings Tab** — All findings sorted by severity
- **Jira Report Tab** — Copy-paste ready RCA for Jira
- **Comment Reply Tab** — Generate professional replies

### 5. Export
- 📋 Copy findings to clipboard
- 📊 Export CSV for spreadsheet analysis
- 📄 Download PDF report (Ctrl+P)

---

## 🤖 GitHub Copilot Integration

See [CONFIGURATION.md](CONFIGURATION.md) for detailed setup instructions.

**Quick summary:**
1. Get Copilot API access from your org admin
2. Open LogSherlock Pro → Settings icon (⚙️)
3. Paste your API key
4. AI features light up automatically

**What Copilot adds:**
- Smarter root cause correlation
- Natural language investigation guides
- Context-aware Jira reply generation
- Free-form Q&A about HPE VME issues

---

## 🏗️ Architecture

- **Frontend:** Pure HTML/CSS/JS — no framework, no build step
- **Scanning:** Web Worker with streaming DecompressionStream API
- **Patterns:** 100+ regex patterns covering HPE VME ecosystem
- **AI:** Optional GitHub Copilot integration (sends only metadata)
- **Storage:** Browser localStorage for preferences and history
- **Deployment:** Static file hosting — works from file://, localhost, or any web server

---

## 📊 Supported Log Formats

| Format | Support |
|--------|---------|
| `.tar.gz` / `.tgz` | ✅ Streaming (any size) |
| `.tar` | ✅ Direct parse |
| `.gz` | ✅ Streaming decompress |
| `.log`, `.txt`, `.out`, `.err` | ✅ Plain text |
| `.conf`, `.sh`, `.yaml`, `.xml`, `.json` | ✅ Text-based |
| `.zip` / `.7z` | ⚠️ Extract first, then use .tar.gz |
| Binary files | ❌ Auto-skipped |

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Blank page on open | Use Chrome/Edge (not IE11). Check file isn't blocked by antivirus |
| "Worker error" | Ensure `scan-worker.js` is in the same folder as `index.html` |
| Large file slow | Normal for 3GB+. Web Worker prevents UI freeze. Wait for completion |
| AI features grayed out | Configure Copilot API key in Settings (see CONFIGURATION.md) |
| Fonts look wrong offline | Google Fonts need internet. Falls back to system fonts (still works) |

---

## 👨‍💻 Author

**Krishna Yada**  
Senior Tech Lead | Wipro | HPE VME L4 Support  
📧 yadakrishna245@gmail.com

---

## 📜 License

Proprietary Software — see [LICENSE](LICENSE) file.  
Unauthorized distribution prohibited.

© 2026 Krishna Yada. All Rights Reserved.
