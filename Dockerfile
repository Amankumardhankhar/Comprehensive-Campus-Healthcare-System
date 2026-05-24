# ─────────────────────────────────────────────────────────────────
# Single-container build for Hugging Face Spaces.
#
# Hugging Face Spaces run one container, not docker-compose — so this
# image bundles everything: the React build, the Express API, and the
# nine Python AI microservices. docker-compose.yml + docker/app.Dockerfile
# remain the multi-container equivalent for a VM or local development.
# ─────────────────────────────────────────────────────────────────

# ── Stage 1: build the React frontend ────────────────────────────
FROM node:20-bookworm-slim AS build-client
WORKDIR /build
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ── Stage 2: runtime — Node server + Python AI services ──────────
FROM node:20-bookworm-slim
WORKDIR /app

# Python 3.11 (Debian bookworm default), nginx (analytics router),
# gettext-base (envsubst for the nginx template), curl (health checks).
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3 python3-pip nginx gettext-base curl \
 && rm -rf /var/lib/apt/lists/*

# Python dependencies for every AI service
COPY docker/requirements-kiosk.txt     ./req-kiosk.txt
COPY docker/requirements-analytics.txt ./req-analytics.txt
RUN pip3 install --no-cache-dir --break-system-packages \
      -r req-kiosk.txt -r req-analytics.txt

COPY ai-services/orchestrator         ./ai/orchestrator
COPY ai-services/disease-prediction   ./ai/disease-prediction
COPY ai-services/risk-classification  ./ai/risk-classification
COPY ai-services/medicine-recommender ./ai/medicine-recommender
COPY ai-services/image-analysis       ./ai/image-analysis
COPY ai-services/anomaly-detection    ./ai/anomaly-detection
COPY ai-services/nlp-service          ./ai/nlp-service
COPY ai-services/risk-profiling       ./ai/risk-profiling
COPY ai-services/disease-trend        ./ai/disease-trend
COPY ai-services/forecasting          ./ai/forecasting

# nginx routing for the three analytics services
RUN rm -f /etc/nginx/sites-enabled/default
COPY docker/nginx.conf.template /etc/nginx/nginx.conf.template

# Express server: production deps, then source, then the built React app
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev
COPY server/ ./server/
COPY --from=build-client /build/dist ./client/dist

COPY docker/hf-start.sh /start.sh
RUN chmod +x /start.sh

# The Express app (user-facing) listens on 7860 — the Hugging Face
# Spaces default. Every AI service stays on an internal loopback port.
ENV NODE_ENV=production \
    PORT=7860 \
    AI_RISK_URL=http://127.0.0.1:8000 \
    AI_TREND_URL=http://127.0.0.1:8000 \
    AI_FORECAST_URL=http://127.0.0.1:8000 \
    AI_ORCHESTRATOR_URL=http://127.0.0.1:8100

EXPOSE 7860
CMD ["/start.sh"]
