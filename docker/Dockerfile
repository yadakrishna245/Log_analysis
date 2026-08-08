# LogSherlock Pro — Multi-stage Docker Build
# 172 features | 885 patterns | HPE VME L4 Support Tool
# Usage: docker build -t logsherlock-pro . && docker run -p 8888:8888 logsherlock-pro

# Stage 1: Build dependencies
FROM python:3.11-slim AS builder

WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --target=/app/deps -r requirements.txt

# Stage 2: Production image
FROM python:3.11-slim

LABEL maintainer="Krishna Yada <yadakrishna245>"
LABEL description="LogSherlock Pro - HPE VME L4 Support Engineering Tool"
LABEL version="4.0"
LABEL features="172"
LABEL patterns="885"

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /app/deps /usr/local/lib/python3.11/site-packages/

# Copy application code
COPY backend/ ./backend/
COPY LogSherlock-Pro-Local/ ./static/

# Environment
ENV FLASK_ENV=production
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV STORAGE_BACKEND=local
ENV UPLOAD_FOLDER=/tmp/uploads
ENV LOG_DIR=/tmp/logs
ENV PORT=8888
ENV LOGSHERLOCK_DEV_MODE=false

# Create non-root user and required directories
RUN adduser --disabled-password --gecos '' appuser \
    && mkdir -p /tmp/uploads /tmp/logs \
    && chown -R appuser:appuser /app /tmp/uploads /tmp/logs

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8888

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8888/api/health')" || exit 1

# Run
CMD ["python", "backend/app.py"]
