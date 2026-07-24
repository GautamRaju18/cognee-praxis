# syntax=docker/dockerfile:1
# Single-container Praxis: FastAPI serves both the API and the built React app,
# with the pre-seeded company memory baked in. Runs with ZERO external API keys
# (cache-only mode). Built for Render, works anywhere Docker runs.

# ---------- Stage 1: build the React frontend ----------
FROM node:20-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# same-origin API calls — FastAPI serves this build, so no host prefix
ENV VITE_API_URL=""
RUN npm run build

# ---------- Stage 2: Python runtime ----------
FROM python:3.12-slim AS app
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends libgomp1 \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install -r requirements.txt

# Backend source
COPY backend/ ./backend/

# Pre-seeded company memory (baked in → no runtime seeding, no external keys).
# Paths match praxis.config PROJECT_ROOT (= /app).
COPY deploy/seed/data_storage/ ./.data_storage/
COPY deploy/seed/cognee_system/ ./.cognee_system/
COPY deploy/seed/praxis.db ./praxis.db

# Built frontend
COPY --from=web /web/dist ./frontend_dist

ENV PRAXIS_DEMO_CACHE_ONLY=true \
    PRAXIS_FRONTEND_DIST=/app/frontend_dist \
    COGNEE_SKIP_CONNECTION_TEST=true \
    ENABLE_BACKEND_ACCESS_CONTROL=false \
    PRAXIS_API_HOST=0.0.0.0

EXPOSE 8000
# Render injects $PORT; default to 8000 for local runs.
CMD ["sh", "-c", "python -m uvicorn praxis.main:app --app-dir backend --host 0.0.0.0 --port ${PORT:-8000}"]
