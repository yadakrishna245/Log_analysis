# Production Readiness Plan — LogSherlock Pro

**Status:** Demo-Ready (85%) → Production-Ready (100%)  
**Last Updated:** 2026-08-02  
**Owner:** Yada Krishna Chaithanya

---

## Current State

| Area | Status | Notes |
|------|--------|-------|
| Core functionality | ✅ Complete | 113 patterns, client-side scan, RCA report |
| AWS deployment | ✅ Working | Lambda + API GW + DynamoDB + CloudFront |
| Security (data privacy) | ✅ Solid | Zero customer data uploaded |
| Documentation | ✅ Complete | README, docstrings, mermaid diagrams |
| Demo data | ✅ Available | Synthetic 9.4KB tar.gz in demo/ |
| Branding | ✅ HPE green | Logo on all pages |

---

## Priority 1 — Must Have Before Production (1-2 days)

### 1.1 Authentication & Authorization
- [ ] Integrate with HPE SSO (Azure AD / Okta SAML)
- [ ] Fallback: username + password with bcrypt hashing
- [ ] Session tokens with expiry (24hr)
- [ ] Role-based access: `admin` (manage KB) vs `user` (scan only)
- [ ] API key rotation mechanism

### 1.2 CI/CD Pipeline — Tests
- [ ] Add `pytest tests/test_basic.py` step in `.github/workflows/deploy.yml`
- [ ] Block deployment if tests fail
- [ ] Add test for pattern count (assert >= 113)
- [ ] Add test for KB count (assert >= 66)
- [ ] Add test for critical endpoints (/api/patterns/export, /api/advisor)

### 1.3 Error Monitoring & Alerting
- [ ] CloudWatch Alarm: Lambda errors > 5 in 5 minutes → SNS email
- [ ] CloudWatch Alarm: Lambda duration > 25s (approaching 30s timeout)
- [ ] CloudWatch Alarm: API Gateway 5xx > 10 in 5 minutes
- [ ] Dead Letter Queue (DLQ) for failed Lambda invocations
- [ ] Log retention policy: 30 days

### 1.4 Rate Limiting
- [ ] API Gateway throttling: 100 req/s burst, 50 sustained
- [ ] Per-IP rate limiting via WAF rules
- [ ] 429 Too Many Requests response with Retry-After header

### 1.5 Access Logging
- [ ] Enable API Gateway access logs (JSON format)
- [ ] CloudWatch Log Group with 30-day retention
- [ ] Log: timestamp, IP, endpoint, status code, latency, user-agent

---

## Priority 2 — Should Have (1 day)

### 2.1 WAF (Web Application Firewall)
- [ ] AWS WAF on CloudFront distribution
- [ ] AWS Managed Rules: Common Rule Set (XSS, SQLi)
- [ ] AWS Managed Rules: Known Bad Inputs
- [ ] Geo-restriction (optional: limit to HPE office IPs)
- [ ] Rate-based rule: block IP after 1000 req/5min

### 2.2 Custom Domain
- [ ] Register `logsherlock.internal.hpe.com` or similar
- [ ] ACM certificate (auto-renew) in us-east-1
- [ ] CloudFront alternate domain name configuration
- [ ] DNS CNAME record pointing to CloudFront

### 2.3 Database Backup & Recovery
- [ ] Enable DynamoDB Point-in-Time Recovery (PITR) on all tables
- [ ] Monthly manual backup export to S3 (patterns + KB)
- [ ] Document restore procedure

### 2.4 Lambda Configuration
- [ ] Reserved concurrency: 10 (prevents runaway costs)
- [ ] Provisioned concurrency: 2 (eliminates cold starts)
- [ ] Memory: 512MB (current), monitor and adjust
- [ ] Timeout: 30s (current), sufficient for all endpoints

### 2.5 Health Monitoring
- [ ] `/api/health` returns: status, version, pattern count, DB connectivity
- [ ] Route53 health check or external monitoring (UptimeRobot/Pingdom)
- [ ] Scheduled CloudWatch synthetic canary (every 5 min)

---

## Priority 3 — Nice to Have (Future Sprints)

### 3.1 Frontend Refactoring
- [ ] Split `index.html` (114KB) into separate modules:
  - `scanner.js` — pako + tar parser + regex engine
  - `dashboard.js` — heatmap, donut, cascade, timeline
  - `report.js` — RCA builder + Jira renderer
  - `advisor.js` — ticket advisor panel
  - `styles.css` — extracted from inline
- [ ] Use Vite/esbuild for bundling and minification
- [ ] Add source maps for debugging

### 3.2 Pattern Versioning
- [ ] Version tag on each pattern set release (v1.0, v1.1, etc.)
- [ ] API returns pattern version in /api/patterns/export
- [ ] Ability to rollback to previous pattern version
- [ ] Changelog for pattern additions/modifications

### 3.3 Usage Analytics (Privacy-Safe)
- [ ] Track: scan count, avg findings per scan, top patterns triggered
- [ ] NO user identification or customer data
- [ ] DynamoDB counter table or CloudWatch custom metrics
- [ ] Monthly usage report for management

### 3.4 Multi-Region Failover
- [ ] Deploy to us-west-2 as secondary
- [ ] Route53 failover routing policy
- [ ] DynamoDB Global Tables for KB replication
- [ ] RTO: < 5 minutes, RPO: < 1 minute

### 3.5 Load Testing
- [ ] Artillery or k6 script for 100 concurrent users
- [ ] Test /api/patterns/export (highest traffic)
- [ ] Test /api/knowledge/lookup (most complex)
- [ ] Establish performance baseline and alert thresholds

### 3.6 Offline / PWA Mode
- [ ] Service Worker for full offline capability
- [ ] Cache patterns + KB locally after first load
- [ ] Works on airplane mode after initial visit
- [ ] Auto-sync when back online

---

## Cost Estimate (Production)

| Resource | Monthly Cost |
|----------|-------------|
| Lambda (10K invocations) | ~$0.10 |
| API Gateway (10K requests) | ~$0.35 |
| DynamoDB (on-demand, low traffic) | ~$1.00 |
| CloudFront (10GB transfer) | ~$0.85 |
| WAF (1 ACL + managed rules) | ~$6.00 |
| CloudWatch (logs + alarms) | ~$2.00 |
| **Total** | **~$10/month** |

---

## Commands to Implement Priority 1

```bash
# 1. Enable API Gateway access logging
aws apigatewayv2 update-stage --api-id <id> --stage-name prod \
  --access-log-settings '{"DestinationArn":"arn:aws:logs:...","Format":"$requestId $ip $method $path $status $latency"}'

# 2. Add CloudWatch Alarm
aws cloudwatch put-metric-alarm --alarm-name LogSherlock-Lambda-Errors \
  --metric-name Errors --namespace AWS/Lambda \
  --statistic Sum --period 300 --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 --alarm-actions <sns-arn>

# 3. Enable DynamoDB PITR
aws dynamodb update-continuous-backups \
  --table-name LogSherlock-Patterns \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

# 4. Set Lambda reserved concurrency
aws lambda put-function-concurrency \
  --function-name LogSherlockPro \
  --reserved-concurrent-executions 10
```

---

## Definition of Done — Production

- [ ] All Priority 1 items completed
- [ ] All Priority 2 items completed
- [ ] Load test passed (100 concurrent, <2s P95 latency)
- [ ] Security review signed off
- [ ] Manager approval
- [ ] URL shared with team via email/Slack

---

*This document will be updated as items are completed.*


---

## Phase 2 — AI Integration & Authentication Roadmap

### Why NOT use Cloud AI APIs directly on logs

| Risk | Impact |
|------|--------|
| Customer log data sent to third-party (OpenAI/Google/xAI) | ❌ Compliance violation — project killed |
| Cost at scale ($0.10-$2.00 per scan) | ❌ $500-$1000/month for team usage |
| Added latency (15-30s per AI call) | ❌ Current 0.8s scan becomes 30s |
| AI hallucinations in RCA | ❌ Wrong fix suggestion → production outage |
| Destroys "zero data upload" selling point | ❌ Security approval revoked |

### Phase 2a: Authentication (Week 1)

| Option | Implementation | Best For |
|--------|---------------|----------|
| **GitHub OAuth** | `flask-dance` + GitHub App | Dev teams, open source |
| **HPE Azure AD SSO** | MSAL library + SAML/OIDC | Internal HPE (recommended) |
| **API Key per user** | DynamoDB user table + key generation | Quick start |

**Implementation plan:**
```python
# GitHub OAuth example (flask-dance)
from flask_dance.contrib.github import make_github_blueprint, github

github_bp = make_github_blueprint(
    client_id="GITHUB_CLIENT_ID",
    client_secret="GITHUB_CLIENT_SECRET",
)
app.register_blueprint(github_bp, url_prefix="/login")

@app.route("/api/user")
@login_required
def user_info():
    resp = github.get("/user")
    return jsonify(resp.json())
```

**What this enables:**
- Track who uses the tool (usage analytics)
- Per-user scan history (cloud-synced)
- Role-based access (admin can edit KB, user can only scan)
- Audit trail for compliance

### Phase 2b: Safe AI Integration — Local LLM (Week 2-3)

**Approach:** Run a small LLM (Llama 3.1 8B / Mistral 7B) locally via Ollama. Zero data leaves the infrastructure.

```
┌─────────────────────────────────────────────────────────┐
│  YOUR INFRASTRUCTURE (no external calls)                │
│                                                         │
│  Browser → LogSherlock API → Ollama (local LLM)        │
│                                                         │
│  Input to LLM: pattern names + severity counts ONLY    │
│  NOT: raw log content, customer IPs, hostnames          │
└─────────────────────────────────────────────────────────┘
```

**What we send to LLM (safe):**
```json
{
  "patterns_found": ["kernel_panic", "oom_kill", "gfs2_withdraw"],
  "severity_counts": {"CRITICAL": 5, "HIGH": 12, "MEDIUM": 3},
  "categories": ["cluster", "filesystem", "storage"],
  "cascade": "cluster → filesystem → storage"
}
```

**What we NEVER send to LLM:**
- Raw log lines
- Customer hostnames or IPs
- File paths from customer systems
- Ticket descriptions with customer names

**Implementation:**
```python
# Ollama integration (runs locally, no cloud)
import requests

def ai_summarize(pattern_names, severity_counts, categories):
    """Generate AI summary using LOCAL Ollama instance only."""
    prompt = f"""You are an HPE VME L4 support engineer. 
    Given these detected patterns: {pattern_names}
    Severity: {severity_counts}
    Affected subsystems: {categories}
    
    Write a 2-sentence root cause summary and top 3 recommended actions."""
    
    response = requests.post("http://localhost:11434/api/generate", json={
        "model": "llama3.1:8b",
        "prompt": prompt,
        "stream": False
    })
    return response.json()["response"]
```

**UI integration:**
- Add "🤖 AI Summary" toggle button (off by default)
- When enabled, sends pattern names to local Ollama after scan
- Shows AI-generated summary alongside the deterministic RCA
- Clear label: "AI-generated (may contain inaccuracies)" vs "Pattern-based (deterministic)"

### Phase 2c: AI-Powered Pattern Suggestions (Week 3-4)

**Use AI to IMPROVE the tool, not replace it:**

| Use Case | How | Data sent to AI |
|----------|-----|-----------------|
| Suggest new patterns | Feed AI a log line that didn't match → suggest regex | Single sanitized log line (no customer context) |
| Improve descriptions | AI rewrites pattern descriptions for clarity | Pattern name + current description only |
| Generate runbook steps | AI drafts investigation steps based on pattern type | Pattern metadata only |
| KB enrichment | AI writes better solutions for known issues | Issue title + category only |

### Phase 2d: Cloud AI Option (Month 2+, requires compliance approval)

**Only after getting explicit security team sign-off:**

| Provider | Model | Use Case | Monthly Cost Est. |
|----------|-------|----------|-------------------|
| AWS Bedrock (Claude) | Claude 3.5 Sonnet | RCA summary generation | ~$50/month |
| Google Vertex AI | Gemini Pro | Pattern suggestion | ~$30/month |
| Azure OpenAI | GPT-4o mini | KB enrichment (batch) | ~$20/month |
| xAI | Grok | Alternative option | TBD |

**Required before enabling:**
- [ ] Security team written approval
- [ ] Data Processing Agreement (DPA) with AI provider
- [ ] Confirm: only pattern names sent, never raw logs
- [ ] User opt-in toggle (not enabled by default)
- [ ] Audit log of all AI API calls

### GitHub Secrets Required (Future)

| Secret | Purpose |
|--------|---------|
| `GITHUB_CLIENT_ID` | GitHub OAuth app ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth secret |
| `OLLAMA_ENDPOINT` | Local LLM endpoint (default: localhost:11434) |
| `AZURE_AD_CLIENT_ID` | HPE SSO integration |
| `AZURE_AD_TENANT_ID` | HPE Azure AD tenant |
| `BEDROCK_ACCESS_KEY` | AWS Bedrock (if approved) |

### Decision Framework: When to use AI vs Regex

```
Is the question "what pattern is this?" → Use REGEX (deterministic)
Is the question "what does this mean?" → Use LOCAL LLM (safe)
Is the question "what should I do?"   → Use KB first, then LOCAL LLM
Is the question "write me a report?"  → Use template + LOCAL LLM polish
```

### Timeline

| Week | Milestone |
|------|-----------|
| Week 1 | GitHub OAuth login working |
| Week 2 | Ollama local LLM integrated (optional toggle) |
| Week 3 | AI pattern suggestions prototype |
| Week 4 | Security review for Phase 2d (cloud AI) |
| Month 2 | Cloud AI with compliance approval (if granted) |

---
