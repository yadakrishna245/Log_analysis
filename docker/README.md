# 🐳 LogSherlock Pro — Docker Deployment

## Quick Start

```bash
cd docker
docker-compose up -d
```

Open: **http://localhost:8888**

## With Local AI (Ollama)

```bash
docker-compose --profile ai up -d
# Wait for Ollama to start, then pull a model:
docker exec logsherlock-ollama ollama pull qwen2.5:3b
```

## Build Only

```bash
docker build -t logsherlock-pro -f docker/Dockerfile .
docker run -p 8888:8888 logsherlock-pro
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8888 | Server port |
| `FLASK_ENV` | production | Flask environment |
| `STORAGE_BACKEND` | local | `local` or `dynamodb` |
| `LOGSHERLOCK_DEV_MODE` | true | Skip license check |
| `OLLAMA_HOST` | http://ollama:11434 | Ollama AI endpoint |

## Image Details

- Base: `python:3.11-slim` (~200MB final)
- Multi-stage build (dependencies cached)
- Health check included
- Non-root recommended for production
