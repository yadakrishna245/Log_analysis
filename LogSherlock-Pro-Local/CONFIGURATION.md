# GitHub Copilot Integration — Configuration Guide

## Overview

LogSherlock Pro's AI features use GitHub Copilot's API to provide:
- 🤖 Intelligent root cause analysis
- 💬 Professional Jira reply generation
- 🧭 Investigation suggestions based on ticket context
- 💬 Free-form Q&A about HPE VME issues

**Privacy guarantee:** Only pattern names, severities, and categories are sent to Copilot. Raw log content NEVER leaves your machine.

---

## Prerequisites

1. ✅ GitHub Copilot Business/Enterprise license from your organization
2. ✅ API access enabled by your org admin
3. ✅ A Personal Access Token (PAT) with `copilot` scope

---

## Step 1: Get Your API Token

### Option A: GitHub Copilot for Business (Recommended)

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. Give it a name: `LogSherlock-Pro`
4. Select scopes:
   - ✅ `copilot` (GitHub Copilot access)
5. Click **"Generate token"**
6. Copy the token (starts with `ghp_` or `github_pat_`)

### Option B: Azure OpenAI (Enterprise)

If your org uses Azure OpenAI instead:

1. Get your Azure OpenAI endpoint from your admin
2. Get your API key from Azure Portal → Cognitive Services → Keys
3. Set endpoint to: `https://{your-resource}.openai.azure.com/openai/deployments/{model}/chat/completions?api-version=2024-02-15-preview`

### Option C: OpenAI API Direct

If your org provides an OpenAI API key:

1. Get API key from https://platform.openai.com/api-keys
2. Endpoint: `https://api.openai.com/v1/chat/completions`
3. Model: `gpt-4o` or `gpt-4-turbo`

---

## Step 2: Configure in LogSherlock Pro

### Method 1: UI Configuration (Recommended)

1. Open `index.html` in your browser
2. Click the ⚙️ (Settings) icon in the sidebar
3. In the "AI Configuration" section:
   - **API Key:** Paste your token
   - **Endpoint:** (auto-filled for GitHub Copilot)
   - **Model:** Select your preferred model
4. Click "Save & Test Connection"
5. Green checkmark = ready to use!

### Method 2: JavaScript Console (Quick Test)

Open browser DevTools (F12) → Console tab:

```javascript
// Configure Copilot
copilot.configure({
    apiKey: 'ghp_YOUR_TOKEN_HERE',
    endpoint: 'https://api.githubcopilot.com/chat/completions',
    model: 'gpt-4o'
});

// Test connection
copilot.askQuestion('What causes GFS2 withdraw?').then(r => console.log(r));
```

### Method 3: localStorage Direct

```javascript
localStorage.setItem('ls_copilot_api_key', 'ghp_YOUR_TOKEN_HERE');
localStorage.setItem('ls_copilot_endpoint', 'https://api.githubcopilot.com/chat/completions');
localStorage.setItem('ls_copilot_model', 'gpt-4o');
// Reload the page
location.reload();
```

---

## Step 3: Verify Integration

After configuration, verify the AI features are active:

1. **Status indicator:** The AI status in the sidebar should show green 🟢
2. **Analyze button:** The "🤖 Ask AI for Solution" button should be enabled
3. **Quick test:** Paste any ticket text → Click "🤖 Ask AI" → Should get a response

---

## Supported Models

| Provider | Model | Best For |
|----------|-------|----------|
| GitHub Copilot | `gpt-4o` | Best quality analysis |
| GitHub Copilot | `gpt-4o-mini` | Faster responses, good quality |
| Azure OpenAI | `gpt-4-turbo` | Enterprise deployment |
| OpenAI | `gpt-4o` | Direct API access |
| Ollama (local) | `qwen3.5:4b` | Fully offline, no API key needed |

---

## API Endpoints Reference

| Provider | Endpoint |
|----------|----------|
| GitHub Copilot | `https://api.githubcopilot.com/chat/completions` |
| OpenAI | `https://api.openai.com/v1/chat/completions` |
| Azure OpenAI | `https://{resource}.openai.azure.com/openai/deployments/{model}/chat/completions?api-version=2024-02-15-preview` |
| Ollama (local) | `http://localhost:11434/v1/chat/completions` |

---

## Privacy & Security Details

### What IS sent to the API:
- Pattern names (e.g., "GFS2 Withdraw Detected")
- Severity levels (CRITICAL, HIGH, MEDIUM, LOW)
- Category labels (cluster, storage, filesystem)
- Pattern descriptions (from the built-in pattern database)
- Ticket context text (what you type in the ticket box)

### What is NEVER sent:
- ❌ Raw log file content
- ❌ Customer hostnames or IP addresses
- ❌ File paths from customer systems
- ❌ Actual log lines (line_content field)
- ❌ Any file you drop into the scanner

### How it works:
```
Your Log Files → [Scanned locally in browser] → Pattern matches found
                                                        ↓
                                              Pattern NAMES only sent
                                                        ↓
                                              [Copilot API] → Analysis
                                                        ↓
                                              Response displayed in UI
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "401 Unauthorized" | Token expired. Generate a new one |
| "403 Forbidden" | Your license doesn't include API access. Ask admin |
| "429 Rate Limited" | Wait 60 seconds, try again |
| "Network Error" | Check internet connection. Or use Ollama for offline AI |
| "No response" | Model might be overloaded. Try `gpt-4o-mini` |
| AI features still grayed | Reload page after setting token |

---

## Offline AI Alternative: Ollama

If you can't get Copilot API access, use Ollama for 100% local AI:

```bash
# Install Ollama
# Download from: https://ollama.com/download

# Pull a model (choose based on RAM)
ollama pull qwen3.5:4b      # 4GB RAM minimum
ollama pull qwen3.5:9b      # 16GB RAM minimum

# Configure LogSherlock Pro
# Endpoint: http://localhost:11434/v1/chat/completions
# Model: qwen3.5:4b
# API Key: ollama (any value works)
```

---

## Support

For integration issues, contact:

**Krishna Yada** | Senior Tech Lead  
📧 yadakrishna245@gmail.com

---

© 2026 Krishna Yada. All Rights Reserved.
