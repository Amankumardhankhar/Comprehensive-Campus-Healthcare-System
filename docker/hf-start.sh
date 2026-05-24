#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# Single-container startup for Hugging Face Spaces.
#
# Launches the nine Python AI services on internal loopback ports,
# the analytics nginx router, the kiosk orchestrator, and finally the
# Express app in the foreground (it binds the public Hugging Face
# port). The Express app starts immediately so the Space comes up
# fast; AI models finish training in the background within ~1 minute.
# ─────────────────────────────────────────────────────────────────
set -e
cd /app

echo "[hf] starting analytics AI services (8001-8003)..."
python3 -m uvicorn main:app --app-dir /app/ai/risk-profiling --host 127.0.0.1 --port 8001 --log-level warning &
python3 -m uvicorn main:app --app-dir /app/ai/disease-trend  --host 127.0.0.1 --port 8002 --log-level warning &
python3 -m uvicorn main:app --app-dir /app/ai/forecasting    --host 127.0.0.1 --port 8003 --log-level warning &

echo "[hf] starting kiosk AI services (8101-8106)..."
python3 -m uvicorn main:app --app-dir /app/ai/disease-prediction   --host 127.0.0.1 --port 8101 --log-level warning &
python3 -m uvicorn main:app --app-dir /app/ai/risk-classification  --host 127.0.0.1 --port 8102 --log-level warning &
python3 -m uvicorn main:app --app-dir /app/ai/medicine-recommender --host 127.0.0.1 --port 8103 --log-level warning &
python3 -m uvicorn main:app --app-dir /app/ai/image-analysis       --host 127.0.0.1 --port 8104 --log-level warning &
python3 -m uvicorn main:app --app-dir /app/ai/anomaly-detection    --host 127.0.0.1 --port 8105 --log-level warning &
python3 -m uvicorn main:app --app-dir /app/ai/nlp-service          --host 127.0.0.1 --port 8106 --log-level warning &

echo "[hf] starting analytics nginx router on :8000"
PORT=8000 envsubst '$PORT' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf
nginx -g 'daemon off;' &

echo "[hf] starting kiosk orchestrator on :8100"
DISEASE_URL=http://127.0.0.1:8101 \
RISK_URL=http://127.0.0.1:8102 \
MEDICINE_URL=http://127.0.0.1:8103 \
IMAGE_URL=http://127.0.0.1:8104 \
ANOMALY_URL=http://127.0.0.1:8105 \
NLP_URL=http://127.0.0.1:8106 \
python3 -m uvicorn main:app --app-dir /app/ai/orchestrator --host 127.0.0.1 --port 8100 --log-level warning &

echo "[hf] starting Express app on :${PORT:-7860}"
cd /app/server
exec node src/server.js
