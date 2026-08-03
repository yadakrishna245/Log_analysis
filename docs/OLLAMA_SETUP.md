# 🤖 Local AI Setup Guide (Ollama)

LogSherlock Pro supports **optional** AI-powered root cause summaries using Ollama running on your local machine. Your data never leaves your computer.

## Why Local AI?

| Benefit | Detail |
|---------|--------|
| 🔒 Privacy | Zero data sent to cloud — AI runs on YOUR machine |
| ⚡ Speed | 2-5 second responses |
| 💰 Free | No API keys, no subscriptions |
| 🌐 Offline | Works without internet after model download |

## System Requirements

| Your RAM | Recommended Model | Download Size | RAM Usage | Accuracy |
|----------|------------------|---------------|-----------|----------|
| 8GB | `llama3.2:1b` | 1.3 GB | ~2 GB | Good |
| 16GB | `qwen3.5:4b` ★ | 3.4 GB | ~5 GB | Excellent |
| 32GB | `qwen3.5:9b` | 5.5 GB | ~8 GB | Best |
| 32GB+ | `llama3.1:8b` | 4.7 GB | ~8 GB | Very Good |

> **Model priority:** The app auto-selects: qwen3.5 > gemma4 > llama3 > mistral > any available model.

**All HPE team laptops (32GB RAM, i7, 1TB SSD) → Use `qwen3.5:9b` for best quality.**
**16GB laptops → Use `qwen3.5:4b` (excellent balance of speed + quality).**

## Installation (One-Time, 2 minutes)

### Step 1: Install Ollama

**Windows:**
- Download from: https://ollama.com/download/windows
- Run the installer
- Ollama starts automatically in the background

**Mac:**
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Step 2: Pull a Model

Open terminal/PowerShell and run:

```bash
# For 16GB RAM laptops (recommended for most team members)
ollama pull qwen3.5:4b

# For 32GB RAM laptops (best quality)
ollama pull qwen3.5:9b

# For 8GB RAM or fastest response
ollama pull llama3.2:1b
```

Wait for download to complete (2-5 minutes depending on internet).

### Step 3: Verify

```bash
ollama list
```

Should show your downloaded model.

### Step 4: Test

```bash
ollama run qwen3.5:4b "What causes GFS2 filesystem withdraw?"
```

If you get a response, you're ready!

## Using AI in LogSherlock Pro

1. Open LogSherlock Pro (https://d3tv1czat55yad.cloudfront.net or localhost:5000)
2. Check the sidebar: 🤖 icon should show **green dot** = Connected
3. Scan a log file (drop tar.gz or click Try Demo)
4. After scan results appear, you'll see **"🤖 AI-Powered Analysis"** panel
5. Click **"✨ Generate AI Summary"**
6. Wait 3-10 seconds — AI generates root cause summary locally

## What Data Does the AI See?

| Sent to AI (local) | NOT sent to AI |
|-------------------|----------------|
| Pattern names (e.g., "kernel_panic") | Raw log lines |
| Severity counts (5 Critical, 12 High) | Customer hostnames |
| Category names (cluster, storage) | IP addresses |
| File names (messages, corosync.log) | Ticket numbers |

**The AI only sees pattern detection RESULTS — never raw customer log content.**

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 🤖 shows grey dot (Not detected) | Is Ollama running? Check: `ollama list` |
| "Mixed content blocked" in browser | Configure browser flags (see above) or use `http://localhost:5000` |
| Slow responses (>30s) | Use smaller model: `ollama pull llama3.2:1b` |
| Out of memory errors | Close other apps, or use `llama3.2:1b` |
| Model not found | Run: `ollama pull qwen3.5:4b` |

## Browser Configuration (Edge or Chrome)

Since CloudFront uses HTTPS and Ollama uses HTTP (localhost), browsers may block the connection. You can either run locally OR configure your browser:

### Option A: Configure Browser (use with CloudFront)

**Microsoft Edge:**
1. Open `edge://flags/#unsafely-treat-insecure-origin-as-secure`
2. Add `http://localhost:11434` to the text field
3. Set to **Enabled**
4. Click **Relaunch**

**Google Chrome:**
1. Open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
2. Add `http://localhost:11434` to the text field
3. Set to **Enabled**
4. Click **Relaunch**

### Option B: Run LogSherlock Locally

```bash
cd Log_analysis
pip install -r requirements.txt
python app.py
# Open http://localhost:5000
```

This connects to Ollama on localhost:11434 without any mixed-content issues.

## FAQ

**Q: Is this mandatory?**
A: No! AI is 100% optional. The app works perfectly without Ollama. All regex detection, RCA reports, and KB lookup work without AI.

**Q: Does any data go to the internet?**
A: No. Ollama runs completely offline on your laptop after the initial model download.

**Q: Can I use a different model?**
A: Yes! Any Ollama model works. The app auto-detects the best available model.

**Q: How much disk space does it need?**
A: 1.3-5GB depending on model choice.
