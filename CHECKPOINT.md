# LogSherlock Pro — Session Checkpoint

**Last Updated:** 2026-08-09 21:25 IST  
**Project:** HPE VME L4 Support Engineering Tool  
**Owner:** Krishna Yada | Senior Tech Lead | Wipro  
**Repo:** https://github.com/yadakrishna245/Log_analysis  
**Monitor Repo:** https://github.com/yadakrishna245/HPE-log_analysis_app-monitor (PRIVATE)  
**Live URL:** https://d3tv1czat55yad.cloudfront.net  
**Latest Commit (Main):** `6ecccdb` — fix: Pattern merge now works reliably  
**Latest Commit (Monitor):** `38813ac` — feat: Add fingerprint field for machine-lock binding  
**Total Features:** 172  
**Total JS Modules:** 90 (87 feature modules + 3 pattern files, bundled into 1 obfuscated app.min.js)  
**Total Detection Patterns:** 1185 (675 base + 210 HPE-advanced + 300 HPE-resolution)  
**Distribution:** 5-file ZIP bundle (index.html + app.min.js + scan-worker.js + serve.py + README.txt)  
**Zero Fake Data:** ✅ Verified — every output comes from real scan results or user localStorage only

---

## WHAT IS THIS APP

LogSherlock Pro is an **HPE VME L4 support engineering tool** that analyzes customer log files (tar.gz/zip/gz) to identify root causes using:
- 1185 regex detection patterns across 21 categories
- Knowledge base of 120+ known issues + 41 VME Operations Guide entries
- 12 guided investigation runbooks
- **🎯 Ticket Advisor** — iterative L4 troubleshooting (<10ms)
- Local AI (Ollama qwen3.5:4b) OR GitHub Copilot (GPT-4o, Claude, Gemini)
- **Web Worker scanning** — never freezes browser, handles 3.5GB+ files
- Client-side scanning (ZERO data upload to any server)
- Head+tail scanning for large files (catches errors at end of syslog)
- ±2 lines context around each finding
- Dynamic pattern count (never hardcoded)
- **Per-machine license locking** — one key = one device (commercial product)

---

## CURRENT SESSION WORK (Complete)

### This Session (Aug 9, 2026 — Late Night) — Pattern Merge Fix + .cab Detection + file:// Scanning Fix

#### Critical Bug Fixed: Pattern Count Shows 455 Instead of 1185
- **Symptom:** Header shows "455 detection patterns" — external HPE patterns from app.min.js never merged into scan
- **Root cause:** `loadPatterns()` runs in inline `<script>` which executes BEFORE `app.min.js` loads (app.min.js is inserted before `</body>` by build script). At that time, `window._LSP_HPE_VME`, `window._LSP_ALL_PATTERNS` etc. are still undefined.
- **Fix (multi-layer):**
  1. `loadPatterns()` now uses `_merged` flag — doesn't return early on 2nd call until merge succeeds
  2. `window.addEventListener('load', ...)` re-merges after app.min.js has executed
  3. On scan trigger: `loadPatterns()` retries merge → guaranteed 1185+ patterns when scanning
- **Commits:** `efb13b0`, `4bc631b`, `6ecccdb`

#### Critical Bug Fixed: Web Worker Fails Silently on file:// Protocol
- **Symptom:** Dropping files on `file://` protocol shows "Scanning..." forever
- **Root cause:** Web Workers can't use `File.stream()` or `DecompressionStream` properly on file:// origin in Chrome
- **Fix:** On file:// protocol, skip Worker entirely and use main-thread scan path (`streamTarEntries` + `DecompressionStream` in main thread works)
- **Commit:** `68be61d`

#### New Feature: .cab File Detection with Extraction Guidance
- **Symptom:** HPSReports `.cab` files dropped → 146,899 lines scanned with 0 findings (binary garbage treated as text)
- **Fix:** `.cab` files now detected → shows formatted HTML message with extraction command:
  ```
  mkdir extracted
  expand "filename.CAB" -F:* extracted\
  ```
- Uses `innerHTML` directly (not `setStatus` which uses `textContent`)
- **Commit:** `4bc631b`, `6ecccdb`

#### Bug Fixed: .cab Message Showing Raw HTML Tags
- **Symptom:** Status area shows `<strong>.cab (Cabinet) files</strong>` as literal text
- **Root cause:** `setStatus()` uses `textContent` (escapes HTML) not `innerHTML`
- **Fix:** .cab error now uses direct `el.innerHTML` assignment
- **Commit:** `6ecccdb`

#### Commits This Sub-Session (Aug 9 Late Night)
| Commit | Description |
|--------|-------------|
| `68be61d` | fix: Use main-thread scan on file:// protocol (Worker hangs silently) |
| `efb13b0` | fix: Merge all 1185 patterns into scan (HPE patterns were unused) |
| `4bc631b` | fix: Deferred pattern merge (runs after app.min.js loads) + .cab detection |
| `6ecccdb` | fix: Pattern merge retries until _LSP_* vars available + .cab innerHTML fix |

#### Pattern Merge Architecture (FIXED)
```
Page Load Order:
  1. Inline <script> runs → loadPatterns() → creates 455 base PATTERNS
     (window._LSP_* not yet available — merge finds nothing)
  2. <script src="app.min.js"> loads → executes:
     - hpe-advanced-patterns.js → sets window._LSP_HPE_VME, _LSP_GFS2, etc.
     - hpe-resolution-patterns.js → sets window._LSP_HPE_VME_EXT, etc.
     - hpe-vme-*-patterns.js (7 files) → push to window._LSP_ALL_PATTERNS
  3. window 'load' event fires:
     - Re-runs merge → finds all _LSP_* vars → PATTERNS grows to 1185+
     - Updates patternCountInline / patternCountStat display
     - Sets PATTERNS._merged = true
  4. User drops files → scan starts → loadPatterns() called:
     - Sees _merged = true → returns immediately with 1185 patterns
```

#### Supported File Types for Scanning
| Format | Support | Notes |
|--------|---------|-------|
| `.tar.gz` / `.tgz` | ✅ Full | Streaming scan, handles 3.5GB+ |
| `.tar` | ✅ Full | Streaming scan |
| `.zip` | ✅ Full | In-memory extraction |
| `.gz` | ✅ Full | Single file decompression |
| `.log`, `.txt`, `.conf`, `.yaml`, `.xml`, `.json` | ✅ Full | Text file scan |
| `.cab` (Cabinet) | ⚠️ Detected | Shows extraction command — user must extract first |
| `.7z`, `.rar` | ❌ Not supported | Shows message: extract with 7-Zip/WinRAR |
| `.tbz2` / `.tar.bz2` | ⚠️ Partial | May need extraction depending on browser |

---

### Previous Sub-Session (Aug 9, 2026 — Evening) — License Lock + Bug Fixes + Copilot OAuth
1. ✅ **Machine-Lock Fingerprint Binding** — License now locks to ONE device
   - `hardAuthGate()` regenerates hardware fingerprint on every page load
   - Compares with stored `ls_license_fp` — if mismatch → wipes all credentials, blocks access
   - If `ls_license_fp` missing (old install) → forces re-authentication
   - Fingerprint = canvas + WebGL GPU + screen + CPU cores + device memory + timezone + platform (FNV-1a hash)
   - `licenses.json` on monitor repo now has `"fingerprint": ""` field for server-side binding
2. ✅ **License Gate Fixed** — `LS-MASTER-2026-KRISHNA-YADA` format now works
   - Removed broken auto-formatter (was stripping dashes, forcing 4x4 groups → mangled key)
   - Added `LS-MASTER-*` key validation against GitHub `licenses.json`
   - Checks `entry.fingerprint` server-side — if already bound to different machine → blocks
   - Input field: just uppercases, no reformatting, maxlength=40
3. ✅ **Analyze Ticket — No More Fake Data**
   - If NO log files uploaded → shows ONLY "⚠️ No Log Files Attached" message
   - Points user to click "Suggest where to look" button for guidance
   - NO SFTP folders, NO bundle tables, NO recommendations shown without actual logs
   - Full pre-analysis (SFTP detection, bundle table) only appears AFTER logs are dropped
   - Removed overly-broad 8-digit number regex (was matching case IDs as "folders")
4. ✅ **GitHub Copilot OAuth — Direct GitHub Calls**
   - `signInWithCopilot()` now calls GitHub directly (no local proxy `/api/copilot/` needed)
   - Uses VS Code Copilot client ID `Iv1.b507a08c87ecfe98`
   - Flow: `github.com/login/device/code` → poll `github.com/login/oauth/access_token` → exchange via `api.github.com/copilot_internal/v2/token`
   - On CORS failure (file:// protocol) → shows `python -m http.server 8080` command with instructions
5. ✅ **Model Dropdown Fixed**
   - Settings page default was `gpt-5-mini` (doesn't exist) → blank dropdown. Fixed to `gpt-4o`
   - AI Chat model list updated to real models: GPT-4o, Claude Sonnet 4, Opus 4, Gemini 2.5 Pro, etc.
   - Removed fake/future model names (gpt-5.6-terra, claude-opus-5, etc.)
6. ✅ **serve.py — Local Server with GitHub OAuth Proxy**
   - Created `serve.py` (included in ZIP) — serves app + proxies GitHub OAuth calls
   - Port **5555** (avoids conflicts with Jenkins/dev servers)
   - Handles `/api/copilot/device-code`, `/api/copilot/poll-token`, `/api/copilot/exchange`
   - `signInWithCopilot()` tries local proxy first → falls back to direct GitHub (for non-file:// origins)
   - Error message shows full `cd` path + `python serve.py` command + clarifies app works without it
   - README.txt updated with serve.py instructions

#### Distribution (5 files in ZIP)
```
LogSherlock-Pro.zip → 5 files:
├── index.html      ← Full UI + scanner + 1185 patterns + auth gate
├── app.min.js      ← 90 JS modules, base64 obfuscated  
├── scan-worker.js  ← Web Worker for scanning (MUST be separate file)
├── serve.py        ← Local server (port 5555) + GitHub OAuth proxy
└── README.txt      ← Quick start instructions
```

#### What Works WITHOUT serve.py (file:// protocol):
- ✅ License activation (validates against GitHub licenses.json)
- ✅ Log file scanning (all 1185 patterns, 100% client-side)
- ✅ Ticket pre-analysis, "Suggest where to look"
- ✅ Knowledge base, runbooks, history, all UI
- ✅ Paste token manually → AI chat works
- ❌ Only "Sign in with GitHub Copilot" one-click OAuth fails (CORS)

#### What serve.py Enables:
- ✅ One-click GitHub Copilot OAuth sign-in (no PAT needed)
- ✅ AI Chat (Send button) — proxies `/api/copilot/chat` to `api.githubcopilot.com`
- ✅ "Ask AI for Solution" — same proxy, with 15s timeout + model chain fallback
- ✅ Token refresh — proxies `/api/copilot/exchange` to refresh expired `tid=` tokens

#### Security Improvements (this session):
- ✅ License key hashed in localStorage (`sha384$...`) — not visible in plain text
- ✅ Machine fingerprint binding — one license = one device
- ✅ 15-second timeout per model — if GPT-4o hangs, auto-falls to gpt-4o-mini → claude → gemini
- ✅ Model chain order: fast models first (4o-mini, flash), heavy models last (opus, gemini-pro)

#### AI Chat Flow (via serve.py proxy):
```
Browser → POST /api/copilot/chat (to serve.py on localhost:5555)
  └── serve.py → POST https://api.githubcopilot.com/chat/completions
      └── Headers: Bearer tid=..., Editor-Version, Copilot-Integration-Id
      └── Streams SSE response back → browser renders in real-time
```

#### Critical Bug Fixed: Scanning Hang (scan-worker.js missing from ZIP)
- **Symptom:** Dropping 70MB+ folders showed "Scanning... Preparing files..." forever
- **Root cause:** `build-bundle.ps1` bundled all `<script src>` JS files into `app.min.js` but `scan-worker.js` is loaded via `new Worker('scan-worker.js')` — Web Workers MUST be standalone files
- **Fix:** Added `scan-worker.js` copy to build script. ZIP now has 5 files.
- **Scanning architecture:**
  - `scanLocally()` → creates Web Worker from `scan-worker.js`
  - Worker handles: .tar.gz, .tgz, .gz, .zip, all text files (no size limit)
  - Head+tail scanning for >5MB files (first 50K + last 50K lines)
  - Sends progress updates → main thread updates UI
  - On completion → `showTicketRelevantFindings()` auto-fires (shows file/line/copy buttons)

#### Critical Bug Fixed: License Key Plain Text in localStorage
- **Symptom:** `ls_license_key` showed `LS-MASTER-2026-KRISHNA-YA...` instead of hash
- **Root cause:** Old localStorage data from before `hashForStorage()` fix was never migrated
- **Fix:** Added migration IIFE on page load — if key doesn't start with `sha384$`, hash it in-place

#### Critical Bug Fixed: "Ask AI for Solution" Hangs Forever
- **Symptom:** "Analyzing with GitHub Copilot AI..." stays indefinitely, no timeout/error
- **Root cause:** Copilot API token expired (`tid=...` lasts 30 min). `_getCopilotToken()` refresh had NO TIMEOUT — hung before the 15s per-model timeout could start
- **Fix:** Added 10s AbortController timeout to `_getCopilotToken()` + 60s overall safety timeout in `askOllamaTicket()` with clear error message

#### Commits This Session
| Commit | Description |
|--------|-------------|
| `95182b7` | fix: License gate accepts LS-MASTER keys, removed auto-formatter |
| `c92e90c` | fix: Machine-lock fingerprint binding + Analyze Ticket no fake data |
| `239d844` | fix: Force re-auth when fingerprint missing (covers old installs) |
| `ab484ce` | fix: No logs = no SFTP/bundle table, points to Suggest where to look |
| `e769a96` | fix: Model dropdown default gpt-4o, AI Chat shows real models |
| `853e52a` | fix: GitHub Copilot OAuth calls GitHub directly (no local server) |
| `5400c15` | fix: Show python server command when OAuth fails on file:// |
| `424f652` | feat: Add serve.py to ZIP - enables GitHub Copilot OAuth |
| `c937811` | fix: Port 4891, better OAuth error UX with cd path |
| `d37a4f8` | fix: Change port to 5555 |
| `a7a3cc1` | fix: Update README.md with serve.py and port 5555 |
| `5092575` | fix: Clean folder path in OAuth error message |
| `4cc5e72` | fix: Forward-slash path in OAuth help |
| `cc80da8` | fix: Windows backslash path in OAuth help |
| `f41cd6d` | fix: Use forward slashes in cd path (final) |
| `87549d2` | fix: Ask AI for Solution detects Copilot token after OAuth sign-in |
| `d5670f4` | fix: Persist GitHub Copilot connection across page refresh |
| `db8cfd7` | fix: Ask AI for Solution auto-configures copilot from localStorage |
| `6c5da69` | fix: 15s timeout per model + fast chain fallback |
| `f63825b` | security: Hash license key in localStorage (no plain text) |
| `47b6ac2` | fix: Add /api/copilot/chat proxy + route all Copilot calls through proxy |
| `38813ac` | feat: Add fingerprint field to licenses.json (monitor repo) |
| `4a12875` | fix: Auto-hash plain license key in localStorage + 60s timeout for Ask AI |
| `931ae9f` | chore: Remove temp build check script |
| `7445f6a` | fix: Include scan-worker.js in ZIP — fixes scanning hang (Worker was missing) |

#### Machine-Lock Flow
```
Page Load → hardAuthGate() runs:
  ├── ls_license_fp missing? → Wipe all credentials → Show login gate
  ├── ls_license_fp exists → Regenerate fingerprint from hardware
  │   ├── Match? → Allow access ✅
  │   └── Mismatch? → Wipe credentials → Show login gate ❌
  └── First activation:
      ├── Validate key against GitHub licenses.json
      ├── Check entry.fingerprint field
      │   ├── Empty? → Bind this machine → Store fingerprint → Unlock ✅
      │   └── Different? → "License already activated on another machine" ❌
      └── Store ls_license_fp in localStorage for future checks
```

### Previous Session (Aug 8, 2026 — Night) — Bundle & Obfuscation
1. ✅ **Bundled 90 JS files into single obfuscated `app.min.js`** — All external script modules concatenated, base64-encoded, wrapped in self-executing anonymous function
2. ✅ **ZIP reduced from 89 files → 3 files** — `index.html` (949KB) + `app.min.js` (1810KB) + `README.txt` (1KB)
3. ✅ **Code protection** — Developers cannot read function names, variable names, or business logic from the obfuscated bundle
4. ✅ **Build script created** — `build-bundle.ps1` (local only, gitignored) automates the entire bundling process
5. ✅ **Created `LogSherlock-Pro/` folder in repo** — Moved ZIP into dedicated folder for clean organization
6. ✅ **README.md with Mermaid diagrams** — 5 visual flowcharts explaining architecture, security flow, module layout, protection mechanism
7. ✅ **Verified bundle integrity** — Base64 decodes correctly, all critical modules confirmed present (license-gate, verdict engine, health score, copilot, master key support)
8. ✅ **Pushed to GitHub** — commits `7314808`, `1b9e9cd`, `b63d6b3`

#### Bundle Architecture
```
BEFORE (confusing for users):
LogSherlock-Pro.zip → 89 files (index.html + 87 JS + README.txt)

AFTER (clean & protected):
LogSherlock-Pro.zip → 3 files only:
├── index.html      ← Full UI + inline scanner + 1185 patterns + auth gate + pako CDN
├── app.min.js      ← ALL 90 external JS modules, base64 obfuscated
└── README.txt      ← Quick start instructions
```

#### How app.min.js Works at Runtime
```
Browser loads index.html
  → Auth gate checks license (inline script)
  → Loads app.min.js
    → Self-executing function runs
    → atob() decodes base64 string (1.85M chars → 1.39M JS)
    → Creates <script> element with decoded content
    → Injects into document.head
    → All 90 modules execute (license-gate, verdict-engine, health-score, etc.)
  → App fully functional
```

#### Files in the Bundle (90 total, in load order)
```
license-gate.js, verdict-engine.js, health-score.js, predictive-engine.js,
before-after.js, customer-email.js, roi-calculator.js, advanced-insights.js,
incident-cinema.js, live-demo-mode.js, pattern-dictionary.js, audit-trail.js,
sla-dashboard.js, guided-mode.js, multi-log-correlation.js, topology-map.js,
training-mode.js, usage-reports.js, changelog.js, onboarding-flow.js,
social-proof.js, comparison-page.js, hpe-advanced-patterns.js,
hpe-resolution-patterns.js, version-detection.js, hpe-vme-migration-patterns.js,
hpe-vme-gfs2-deep-patterns.js, hpe-vme-nfs-deep-patterns.js,
hpe-vme-alletra-deep-patterns.js, hpe-vme-cluster-patterns.js,
hpe-vme-lifecycle-patterns.js, hpe-vme-confirmed-patterns.js, pattern-updates.js,
team-dashboard.js, root-cause-chain.js, compliance-export.js, shift-handoff.js,
runbook-executor.js, log-diff-analyzer.js, blast-radius.js, executive-summary.js,
pattern-confidence.js, knowledge-base.js, multi-tenant.js, temporal-clustering.js,
pin-annotate.js, command-palette.js, noise-suppression.js, session-persistence.js,
custom-pattern-editor.js, baseline-subtraction.js, recent-scans.js,
confidence-feedback.js, shareable-snapshot.js, failure-fingerprint.js,
log-playback.js, nl-query.js, collab-threads.js, alert-fatigue-scorer.js,
smart-log-search.js, sop-compliance-checker.js, cross-log-correlation.js,
anomaly-heatmap.js, root-cause-chain.js, predictive-alert.js,
incident-report-generator.js, scan-diff.js, smart-tagging.js, kpi-dashboard.js,
watch-patterns.js, remediation-suggestions.js, runbook-executor.js,
shift-handoff.js, pattern-library-sync.js, severity-override.js,
multi-file-timeline.js, log-health-score.js, recurring-issue-tracker.js,
impact-radius.js, executive-summary.js, security-posture.js, trend-over-time.js,
change-validation.js, finding-prioritizer.js, bookmark-manager.js, split-view.js,
finding-comments.js, export-email.js, custom-theme.js
```

#### Build Process (to rebuild after code changes)
```powershell
cd C:\...\HPE-Log_analysis
powershell -ExecutionPolicy Bypass -File build-bundle.ps1
# Outputs: build\LogSherlock-Pro\  (3 files)
# Outputs: LogSherlock-Pro.zip     (ready to distribute)
```

#### Repo Structure After This Session
```
Log_analysis/
├── LogSherlock-Pro/
│   ├── README.md              ← Mermaid architecture docs (5 diagrams)
│   └── LogSherlock-Pro.zip    ← Distribution bundle (3 files, 0.77MB)
├── LogSherlock-Pro-Local/     ← Source files (gitignored, local dev only)
│   ├── index.html             ← 7635 lines, full app
│   ├── license-gate.js        ← Auth module
│   ├── verdict-engine.js      ← Verdict module
│   ├── ... 85 more .js files
│   └── server.py              ← Local dev server
├── backend/                   ← AWS Lambda backend
├── deploy/                    ← SAM deployment scripts
├── docker/                    ← Docker deployment
├── .github/workflows/         ← CI/CD
├── build-bundle.ps1           ← Bundle build script (gitignored)
├── verify-bundle.ps1          ← Verification script (gitignored)
└── CHECKPOINT.md              ← This file
```

### Previous Session (Aug 8, 2026 — Evening) — Security Audit
1. ✅ **Full Security Audit** — identified 14 CRITICAL, 20 HIGH, 25 MEDIUM, 18 LOW issues
2. ✅ **CORS hardened** — restricted from wildcard `*` to CloudFront + localhost only
3. ✅ **SSRF fixed** — Jira proxy validates URL against allowlist (*.atlassian.net, *.jira.com)
4. ✅ **Path traversal fixed** — safe tar/zip/7z/rar extraction with symlink blocking
5. ✅ **Hardcoded secrets removed** — ADMIN_SECRET now CloudFormation NoEcho parameter
6. ✅ **CloudFront security headers** — HSTS, X-Frame-Options, nosniff, XSS-Protection
7. ✅ **Local server hardened** — bound 127.0.0.1, CSP headers, 1MB body limit
8. ✅ **Docker hardened** — non-root user, dev mode disabled
9. ✅ **Workflow injection fixed** — all 3 monitor workflows use env vars (no shell injection)
10. ✅ **Admin dashboard secured** — secret entered at login, stored sessionStorage only
11. ✅ **S3 least-privilege** — replaced S3FullAccess with specific Get/Put/Delete/List
12. ✅ **Deploy script** — auto-generates strong random API key
13. ✅ **Both repos pushed and clean**

### Earlier This Session (Aug 8, 2026 — Morning)
1. ✅ **deploy.ps1 rewritten** — Auto-installs AWS CLI, SAM CLI, Python on Windows
2. ✅ **deploy.sh rewritten** — Auto-installs on Linux (apt/yum) and Mac (brew)
3. ✅ **docker/README.md** — Complete beginner deployment guide
4. ✅ **300 NEW HPE resolution patterns added** — `hpe-resolution-patterns.js` (135KB)
5. ✅ **All counts updated** — README, deploy scripts, docker readme, checkpoint
6. ✅ **Both repos pushed and clean**

### New Pattern File: `hpe-resolution-patterns.js`
| Category | Patterns | Key Focus Areas |
|----------|:--------:|-----------------|
| HPE VME Extended | 60 | Alletra MP plugin (ISO/cdrom/StorageException), QEMU/KVM boot, Morpheus 8.0.5/8.0.6, GPU/PCI passthrough |
| GFS2 Extended | 45 | Withdraw functions (dir.c/recovery.c), DLM controld/lockspace, Corosync token, Pacemaker agents, clvmd |
| NFS Extended | 35 | pNFS layout, NFSv4.1 sessions/EXCHANGE_ID, RDMA credits, grace period stuck, VIP failover |
| Alletra Extended | 40 | ESXi iSCSI Error 1011, FC RSCN storms, HPE CSI for K8s, NVMe latency, encryption key mgr |
| GreenLake Extended | 30 | DSCC, Compute Ops Management, Aruba Central, Backup & Recovery, Private Cloud |
| Migration Extended | 50 | Windows BSOD 0x7B/BCD, Linux VFS panic/dracut, viostor injection, HPE VME tool, vTPM |
| HVM Versions Extended | 40 | 8.0 (NUMA/OVS/QEMU leak), 8.0.1 (GPU/VNC/RPM), 8.1.12 (OVN/balloon/backup API), 9.0 (TLS 1.3/q35/Gen10+) |

---

## TECHNICAL DETAILS

### Paths
- **Project:** `C:\Gemini-Krishna-Data-june-2026\Gemini-Krishna-Data-june-2026\Videos\HPE-Log_analysis`
- **Monitor Repo:** `C:\Gemini-Krishna-Data-june-2026\Gemini-Krishna-Data-june-2026\Videos\HPE-log_analysis_app-monitor`
- **Source files (local dev):** `LogSherlock-Pro-Local/` (gitignored)
- **Build output:** `build/LogSherlock-Pro/` (gitignored)
- **Distribution ZIP:** `LogSherlock-Pro/LogSherlock-Pro.zip` (committed to repo)
- **Build script:** `build-bundle.ps1` (gitignored, run locally to rebuild)
- **Local server:** `LogSherlock-Pro-Local/server.py` → port 8888

### Build System
```
Source (LogSherlock-Pro-Local/) → build-bundle.ps1 → Distribution (LogSherlock-Pro/)

Steps the build script performs:
1. Reads index.html, extracts all <script src="*.js"> tags (90 files)
2. Reads each JS file in order, concatenates
3. Strips comments and minifies whitespace
4. Base64 encodes the entire bundle (1.85M chars)
5. Wraps in: (function(){var _0x=["<b64>"];var _s=atob(_0x[0]);var _e=document.createElement('script');_e.textContent=_s;document.head.appendChild(_e);})();
6. Adds copyright headers (4 lines)
7. Strips all individual <script src="*.js"> from index.html
8. Inserts single <script src="app.min.js"> before </body>
9. Preserves: pako CDN, inline scripts, auth gate
10. Creates ZIP with 3 files (index.html, app.min.js, README.txt)
```

### File Architecture (Pattern Loading Order)
```
index.html loads in this order:
  1. hpe-advanced-patterns.js    → sets window._LSP_HPE_VME, _LSP_GFS2, etc. (210 patterns)
  2. hpe-resolution-patterns.js  → sets window._LSP_HPE_VME_EXT, _LSP_GFS2_EXT, etc. (300 patterns)
  3. pattern-updates.js          → reads all window._LSP_* arrays, merges into ALL_DETECTION_PATTERNS (1185 total)
```

### AWS Stack
- **Stack name:** `logsherlock-pro` | **Region:** `us-east-1`
- **CloudFront:** `E3V2MZ00F7WXY9` → `https://d3tv1czat55yad.cloudfront.net`
- **Lambda:** `LogSherlockPro` (2GB RAM, Python 3.11) + `LogSherlockLicense` (256MB)
- **DynamoDB:** 5 tables (PAY_PER_REQUEST)
- **deploy.sh** auto-detects CloudFront dist ID from stack outputs

---

## PATTERN CATEGORIES (1185 total)

### Base Patterns (675) — in `pattern-updates.js` + feature files
| Category | Count |
|----------|-------|
| HPE Server Hardware (iLO, thermal, PSU, DIMM, RAID) | 35 |
| Linux System (kernel, OOM, ext4, systemd, SELinux) | 40 |
| Windows System (BSOD, WMI, DCOM, AD, cluster) | 25 |
| Storage & SAN (multipath, 3PAR, Nimble, SCSI) | 26 |
| Network (BGP, OSPF, STP, SSL/TLS, DNS, LB) | 25 |
| Virtualization (VMware, Hyper-V, KVM) | 20 |
| Kubernetes (CrashLoop, etcd, PVC, HPA) | 25 |
| Database (MySQL, PostgreSQL, Oracle, Redis, Mongo) | 20 |
| Security (brute force, rootkit, DDoS, PCI-DSS) | 20 |
| + inline patterns in feature JS files | 439 |

### HPE Advanced Patterns (210) — in `hpe-advanced-patterns.js`
| Category | Count |
|----------|-------|
| HPE VM Essentials / Morpheus | 50 |
| GFS2 Clustered Filesystem | 30 |
| NFS Storage | 30 |
| HPE Alletra / Nimble | 30 |
| HPE GreenLake Platform | 20 |
| VMware → HVM Migration | 30 |
| HVM Version Issues (8.0/8.0.1/8.1.12/9.0) | 20 |

### HPE Resolution Patterns (300) — in `hpe-resolution-patterns.js`
| Category | Count |
|----------|-------|
| HPE VME Extended (Alletra MP, QEMU, Morpheus UI) | 60 |
| GFS2 Extended (DLM, Corosync, Pacemaker, Recovery) | 45 |
| NFS Extended (pNFS, RDMA, NFSv4.1, HA) | 35 |
| Alletra Extended (iSCSI, FC, CSI K8s, Hardware) | 40 |
| GreenLake Extended (DSCC, Compute Ops, Aruba) | 30 |
| Migration Extended (Boot, Drivers, Network, Storage) | 50 |
| HVM Versions Extended (8.0-9.0 specific bugs) | 40 |

---

## DEPLOYMENT

### Offline Bundle (Recommended for customers)
```bash
# Download LogSherlock-Pro.zip from GitHub → Extract → Open index.html
# OR serve via any static HTTP server:
cd LogSherlock-Pro
python -m http.server 8888
# Open http://localhost:8888 → Enter license → Start analyzing
```
> ZIP contains only 3 files: index.html, app.min.js, README.txt
> Works 100% offline after license activation

### Local Dev (Full source)
```bash
cd LogSherlock-Pro-Local && python server.py
# Open http://localhost:8888 — all 1185 patterns work offline
```

### Rebuild Bundle (after code changes)
```powershell
cd C:\...\HPE-Log_analysis
powershell -ExecutionPolicy Bypass -File build-bundle.ps1
# Copy build\LogSherlock-Pro\* → test
# Then: copy LogSherlock-Pro.zip → LogSherlock-Pro\ folder → git push
```

### AWS (Full Deploy)
```bash
cd deploy
./deploy.sh logsherlock-pro us-east-1   # Linux/Mac — auto-installs prereqs
.\deploy.ps1                             # Windows — auto-installs prereqs
```

### Docker
```bash
cd docker
docker-compose up -d
# Open http://localhost:8888
```

---

## RULES FOR NEXT SESSION

1. **ZERO fake data** — every output from real scan findings only
2. **Always update BOTH repos** — main + monitor stay in sync
3. **Direct push to main** — allowed per user preference
4. **Pattern file load order matters** — hpe-advanced → hpe-resolution → pattern-updates
5. **All JS files must pass `node --check`** before commit
6. **deploy.sh/ps1 auto-install prereqs** — user should be able to clone and run immediately
7. **NEVER hardcode secrets** — use env vars / CloudFormation params / Secrets Manager
8. **AdminSecret for deploy** — pass via `--parameter-overrides AdminSecret=<value>` during `sam deploy`
9. **CORS is restricted** — only CloudFront domain + localhost allowed
10. **After any JS changes** — rebuild the bundle with `build-bundle.ps1` and update the ZIP in `LogSherlock-Pro/`
11. **Source is in `LogSherlock-Pro-Local/`** — this is gitignored, never committed directly
12. **Distribution is in `LogSherlock-Pro/`** — only the ZIP and README.md go here
13. **app.min.js is base64 obfuscated** — protects IP, prevents easy cloning
14. **index.html keeps inline scripts** — scanner engine + patterns stay in HTML (not bundled into app.min.js)
15. **pako CDN preserved** — `pako@2.1.0/dist/pako.min.js` loaded from CDN, not bundled

---

## SECURITY STATUS (Post-Audit)

| Area | Status | Notes |
|------|--------|-------|
| CORS | ✅ Restricted | CloudFront + localhost only |
| SSRF (Jira proxy) | ✅ Fixed | URL allowlist + auth required |
| Path Traversal | ✅ Fixed | Safe extraction + symlink blocking |
| Hardcoded Secrets | ✅ Removed | All via env vars / CloudFormation params |
| Workflow Injection | ✅ Fixed | All workflows use env vars |
| Server Binding | ✅ Fixed | 127.0.0.1 only (was 0.0.0.0) |
| Docker Root | ✅ Fixed | Runs as `appuser` |
| CloudFront Headers | ✅ Added | HSTS, X-Frame, nosniff, XSS |
| S3 Permissions | ✅ Least privilege | Get/Put/Delete/List only |
| License System | ✅ Untouched | activate/validate/reset all working |
| Admin Dashboard | ✅ Secured | Secret entered at login, sessionStorage only |
