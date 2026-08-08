# LogSherlock Pro — Session Checkpoint

**Last Updated:** 2026-08-08 17:22 IST  
**Project:** HPE VME L4 Support Engineering Tool  
**Owner:** Krishna Yada | Senior Tech Lead | Wipro  
**Repo:** https://github.com/yadakrishna245/Log_analysis  
**Monitor Repo:** https://github.com/yadakrishna245/HPE-log_analysis_app-monitor (PRIVATE)  
**Live URL:** https://d3tv1czat55yad.cloudfront.net  
**Latest Commit (Main):** `16422ca` — security: Harden application against OWASP Top 10 vulnerabilities  
**Latest Commit (Monitor):** `a5d955d` — security: Fix workflow injection + remove hardcoded secrets  
**Total Features:** 172  
**Total JS Modules:** 79 (78 feature/pattern files + 1 server.py)  
**Total Detection Patterns:** 1185 (675 base + 210 HPE-advanced + 300 HPE-resolution)  
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

### This Session (Aug 8, 2026 — Evening)
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
- **Local server:** `LogSherlock-Pro-Local/server.py` → port 8888

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

### Local (No AWS)
```bash
cd LogSherlock-Pro-Local && python server.py
# Open http://localhost:8888 — all 1185 patterns work offline
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
