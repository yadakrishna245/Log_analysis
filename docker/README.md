# 🐳 LogSherlock Pro — Docker Deployment

One-command deployment using Docker.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed
- [Docker Compose](https://docs.docker.com/compose/install/) (included with Docker Desktop)

---

## 🚀 One-Command Deploy

```bash
cd docker
docker-compose up -d
```

**That's it!** App will be running at: **http://localhost:5000**

---

## 📋 All Commands

| Action | Command |
|--------|---------|
| **Start app** | `docker-compose up -d` |
| **Start app + AI** | `docker-compose --profile ai up -d` |
| **Stop** | `docker-compose down` |
| **View logs** | `docker-compose logs -f logsherlock` |
| **Rebuild** | `docker-compose up -d --build` |
| **Status** | `docker-compose ps` |
| **Restart** | `docker-compose restart` |
| **Clean everything** | `docker-compose down -v` (removes data!) |

---

## 🤖 With Ollama AI (Optional)

```bash
# Start app + Ollama
docker-compose --profile ai up -d

# Wait 30s for Ollama to initialize, then pull a model:
docker exec logsherlock-ollama ollama pull qwen2.5:3b

# Verify Ollama is running:
curl http://localhost:11434/api/tags
```

The app works **100% without Ollama** — AI is optional for deeper analysis.

---

## 🔧 Configuration

Environment variables (set in docker-compose.yml):

| Variable | Default | Description |
|----------|---------|-------------|
| `LOGSHERLOCK_DEV_MODE` | `true` | Bypass API key auth (set `false` for production) |
| `OLLAMA_HOST` | `http://ollama:11434` | Ollama connection URL |
| `FLASK_ENV` | `production` | Flask environment |

### Production mode (with API key):

Edit `docker-compose.yml`:
```yaml
environment:
  - LOGSHERLOCK_DEV_MODE=false
  - API_KEY=your-secret-key-here
```

---

## 🏗️ Architecture

```
┌────────────────────────────────────────┐
│  Docker Network: logsherlock-net       │
│                                        │
│  ┌──────────────┐   ┌──────────────┐  │
│  │ logsherlock  │   │   ollama     │  │
│  │  (Flask +    │──▶│  (Local AI)  │  │
│  │  Gunicorn)   │   │  [optional]  │  │
│  │  Port 5000   │   │  Port 11434  │  │
│  └──────────────┘   └──────────────┘  │
│         │                              │
│  ┌──────┴──────────────────────┐       │
│  │  Volumes (persistent data)  │       │
│  │  - uploads                  │       │
│  │  - data (SQLite DB)         │       │
│  │  - logs                     │       │
│  └─────────────────────────────┘       │
└────────────────────────────────────────┘
```

---

## 📊 What's Included

- **455 detection patterns** across 14 categories
- **120 known issues** with solutions
- **Pattern matching engine** (0.04s analysis time)
- **Auto-generated Jira RCA reports**
- **Knowledge base search** (runbooks + VME guide)
- **File upload** (log files, tar.gz, 7z)
- **Web UI** at http://localhost:5000

---

## 🔍 Verify It's Working

```bash
# Health check
curl http://localhost:5000/api/health

# Check pattern count
curl http://localhost:5000/api/patterns/export | python -c "import sys,json; print(f'Patterns: {len(json.load(sys.stdin)[\"patterns\"])}')"

# Upload a log file for analysis
curl -X POST http://localhost:5000/api/analyze/quick \
  -F "file=@/path/to/your/logfile.log"
```

---

## 🗑️ Uninstall

```bash
# Stop and remove containers + volumes
docker-compose down -v

# Remove image
docker rmi logsherlock-pro
```

---

## 💡 Tips

- **GPU for Ollama**: Uncomment the `deploy:` section in docker-compose.yml if you have NVIDIA GPU
- **Persist data**: Volumes survive `docker-compose down` (use `-v` to remove)
- **Memory**: App needs ~512MB. With Ollama: 4GB+ recommended
- **Logs**: `docker-compose logs -f logsherlock` for real-time logs
- **Update**: `git pull && docker-compose up -d --build`
