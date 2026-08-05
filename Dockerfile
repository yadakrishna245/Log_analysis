# ─────────────────────────────────────────────────────────────────────────────
# LogSherlock Pro — Production Docker Image
# HPE VME L4 Support Engineering Tool
# © 2026 Krishna Yada
# ─────────────────────────────────────────────────────────────────────────────
# Usage:
#   docker build -t logsherlock-pro .
#   docker run -d -p 5000:5000 --name logsherlock logsherlock-pro
#
# With Ollama (optional AI):
#   docker-compose up -d
#
# Environment Variables:
#   LOGSHERLOCK_DEV_MODE=true    → Bypass API key auth (for local dev)
#   API_KEY=logsherlock-hpe-2026 → Production API key
#   OLLAMA_HOST=http://host.docker.internal:11434  → Ollama connection (optional)
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ─────────────────────────────────────────────────────────────────────────────
# Production image (minimal)
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim

LABEL maintainer="Krishna Yada <yadakrishna245@gmail.com>"
LABEL description="LogSherlock Pro — HPE VME L4 Support Engineering Tool"
LABEL version="3.0"

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -r -s /bin/bash logsherlock

# Copy Python packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY app.py config.py models.py storage.py db_dynamo.py run_server.py ./
COPY engine/ ./engine/
COPY knowledge/ ./knowledge/
COPY routes/ ./routes/
COPY services/ ./services/
COPY templates/ ./templates/
COPY static/ ./static/
COPY deploy/lambda_handler.py ./deploy/

# Create required directories with proper permissions
RUN mkdir -p uploads logs reports extracted data instance \
    && chown -R logsherlock:logsherlock /app

# Initialize SQLite database
RUN python -c "from app import create_app; app = create_app(); ctx = app.app_context(); ctx.push(); from models import db; db.create_all(); ctx.pop()" 2>/dev/null || true

# Set environment defaults
ENV FLASK_APP=app.py \
    FLASK_ENV=production \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    LOGSHERLOCK_DEV_MODE=true \
    OLLAMA_HOST=http://host.docker.internal:11434

# Switch to non-root user
USER logsherlock

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -sf http://localhost:5000/api/health || exit 1

# Run with gunicorn (4 workers, 300s timeout for large file analysis)
CMD ["gunicorn", \
     "--bind", "0.0.0.0:5000", \
     "--workers", "4", \
     "--threads", "2", \
     "--timeout", "300", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--log-level", "info", \
     "app:app"]
