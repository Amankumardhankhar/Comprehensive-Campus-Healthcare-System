#!/bin/sh
set -e

PORT=${PORT:-8100}

echo "[kiosk] starting disease-prediction on :8101"
python -m uvicorn main:app --app-dir /app/disease-prediction \
  --host 0.0.0.0 --port 8101 --log-level warning &

echo "[kiosk] starting risk-classification on :8102"
python -m uvicorn main:app --app-dir /app/risk-classification \
  --host 0.0.0.0 --port 8102 --log-level warning &

echo "[kiosk] starting medicine-recommender on :8103"
python -m uvicorn main:app --app-dir /app/medicine-recommender \
  --host 0.0.0.0 --port 8103 --log-level warning &

# image-analysis (port 8104) is skipped — requires PyTorch which exceeds free-tier RAM.
# The orchestrator silently skips image screening when the service is unreachable.

echo "[kiosk] starting anomaly-detection on :8105"
python -m uvicorn main:app --app-dir /app/anomaly-detection \
  --host 0.0.0.0 --port 8105 --log-level warning &

echo "[kiosk] starting nlp-service on :8106"
python -m uvicorn main:app --app-dir /app/nlp-service \
  --host 0.0.0.0 --port 8106 --log-level warning &

# Wait for ML models to finish training (RF + GBM ensemble takes ~20 s)
echo "[kiosk] waiting 30 s for sub-service startup..."
sleep 30

echo "[kiosk] starting orchestrator on :${PORT}"
exec env \
  DISEASE_URL=http://127.0.0.1:8101 \
  RISK_URL=http://127.0.0.1:8102 \
  MEDICINE_URL=http://127.0.0.1:8103 \
  ANOMALY_URL=http://127.0.0.1:8105 \
  NLP_URL=http://127.0.0.1:8106 \
  python -m uvicorn main:app --app-dir /app/orchestrator \
    --host 0.0.0.0 --port "$PORT" --log-level warning
