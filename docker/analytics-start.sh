#!/bin/sh
set -e

PORT=${PORT:-8000}

echo "[analytics] starting risk-profiling on :8001"
python -m uvicorn main:app --app-dir /app/risk-profiling \
  --host 0.0.0.0 --port 8001 --log-level warning &

echo "[analytics] starting disease-trend on :8002"
python -m uvicorn main:app --app-dir /app/disease-trend \
  --host 0.0.0.0 --port 8002 --log-level warning &

echo "[analytics] starting forecasting on :8003"
python -m uvicorn main:app --app-dir /app/forecasting \
  --host 0.0.0.0 --port 8003 --log-level warning &

# Allow ML models to finish training before nginx starts accepting traffic
echo "[analytics] waiting 25 s for model training..."
sleep 25

# Render the nginx config with the runtime PORT substituted in
envsubst '$PORT' < /etc/nginx/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf

echo "[analytics] starting nginx on :${PORT}"
exec nginx -g 'daemon off;'
