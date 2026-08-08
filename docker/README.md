# 🐳 LogSherlock Pro — Docker Deployment Guide

> **For absolute beginners.** Follow step-by-step — no prior Docker knowledge needed.

---

## What is Docker?

Docker runs your app in an isolated container — like a lightweight virtual machine.  
You don't need to install Python, AWS CLI, or anything else. Docker handles it all.

---

## 📋 Prerequisites (Install Once)

### Windows

1. Download **Docker Desktop**: https://www.docker.com/products/docker-desktop/
2. Run the installer → Click "Install" → Restart computer
3. Open Docker Desktop → Wait until it says "Docker is running" (green icon in taskbar)

### Linux (Ubuntu/Debian)

```bash
# One command — installs Docker + Docker Compose
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# Log out and back in (or reboot)
```

### Linux (RHEL/CentOS/Fedora)

```bash
sudo dnf install docker docker-compose -y
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# Log out and back in
```

### macOS

1. Download **Docker Desktop**: https://www.docker.com/products/docker-desktop/
2. Drag to Applications → Open → Allow permissions
3. Wait for Docker whale icon in menu bar to show "running"

---

## 🚀 Deploy LogSherlock Pro (3 Commands)

### Step 1: Open Terminal

- **Windows:** Right-click Start → "Terminal" or "PowerShell"
- **Linux/Mac:** Open any terminal

### Step 2: Go to the Docker folder

```bash
cd Log_analysis/docker
```

(If you haven't cloned yet:)
```bash
git clone https://github.com/yadakrishna245/Log_analysis.git
cd Log_analysis/docker
```

### Step 3: Start the app

```bash
docker-compose up -d
```

**That's it!** Wait 30-60 seconds, then open:

👉 **http://localhost:8888**

---

## ✅ Verify It's Running

```bash
docker ps
```

You should see:
```
CONTAINER ID   IMAGE              STATUS          PORTS
abc123def      logsherlock-pro    Up 2 minutes    0.0.0.0:8888->8888/tcp
```

---

## 🤖 Optional: Add Local AI (Ollama)

Want AI-powered analysis without cloud? Add the `--profile ai` flag:

```bash
docker-compose --profile ai up -d
```

Then pull an AI model:
```bash
docker exec logsherlock-ollama ollama pull qwen2.5:3b
```

This gives you local AI analysis — no internet needed, no data leaves your machine.

---

## 🔧 Common Operations

### Stop the app
```bash
docker-compose down
```

### Restart the app
```bash
docker-compose restart
```

### View logs (troubleshooting)
```bash
docker-compose logs -f
```

### Update to latest version
```bash
git pull
docker-compose build --no-cache
docker-compose up -d
```

### Remove everything (clean slate)
```bash
docker-compose down -v
docker rmi logsherlock-pro
```

---

## 🌐 Access from Other Machines on Network

By default, the app listens on all interfaces. Other machines on your network can access it at:

```
http://YOUR-IP:8888
```

Find your IP:
- **Windows:** `ipconfig` → look for IPv4 Address
- **Linux/Mac:** `hostname -I` or `ifconfig`

---

## ⚙️ Configuration (Environment Variables)

Edit `docker-compose.yml` to change settings:

| Variable | Default | What It Does |
|----------|---------|-------------|
| `PORT` | 8888 | Port the app runs on |
| `FLASK_ENV` | production | `production` or `development` |
| `LOGSHERLOCK_DEV_MODE` | true | `true` = skip license check |
| `STORAGE_BACKEND` | local | `local` (files) or `dynamodb` (AWS) |

### Change the port

In `docker-compose.yml`, change:
```yaml
ports:
  - "9999:8888"  # Access on port 9999 instead
```

---

## 🔐 Production Deployment (With License System)

For production with license enforcement:

```yaml
environment:
  - LOGSHERLOCK_DEV_MODE=false
  - STORAGE_BACKEND=dynamodb
  - AWS_ACCESS_KEY_ID=your-key
  - AWS_SECRET_ACCESS_KEY=your-secret
  - AWS_DEFAULT_REGION=us-east-1
```

---

## 📊 What's Included

| Component | Details |
|-----------|---------|
| Features | 172 |
| Detection Patterns | 885 |
| Categories | 21 (HPE VME, GFS2, NFS, Alletra, GreenLake, K8s, etc.) |
| Max File Size | 3GB+ (streaming engine) |
| AI Support | Optional Ollama sidecar |
| Image Size | ~200MB |
| Base Image | python:3.11-slim |

---

## ❓ Troubleshooting

### "docker-compose: command not found"

Try `docker compose` (without the hyphen) — newer Docker versions use this format:
```bash
docker compose up -d
```

### "Port 8888 already in use"

Something else is using port 8888. Either stop it or change the port:
```bash
# Find what's using it
# Windows: netstat -ano | findstr 8888
# Linux: sudo lsof -i :8888

# Or just use a different port in docker-compose.yml
```

### "Cannot connect to Docker daemon"

Docker Desktop isn't running. Open it and wait for it to start.

### "Permission denied" (Linux)

```bash
sudo usermod -aG docker $USER
# Then log out and back in
```

### Container starts but app doesn't load

Check logs:
```bash
docker-compose logs logsherlock
```

---

## 🏗️ Build from Scratch (Advanced)

If you want to build the image manually:

```bash
# From the project ROOT directory (not docker/)
docker build -t logsherlock-pro -f docker/Dockerfile .

# Run it
docker run -d -p 8888:8888 --name logsherlock logsherlock-pro

# Stop it
docker stop logsherlock && docker rm logsherlock
```

---

## 📁 Files in This Folder

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage build recipe (~200MB final) |
| `docker-compose.yml` | Orchestration (app + optional AI) |
| `.dockerignore` | Files excluded from build |
| `README.md` | This guide |
