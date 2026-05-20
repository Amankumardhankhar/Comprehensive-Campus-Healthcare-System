#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d venv ]; then
  echo "Creating venv..."
  python3.11 -m venv venv
  ./venv/bin/pip install -r requirements.txt
fi

PY="$SCRIPT_DIR/venv/bin/python"

echo "Starting AI services..."
$PY -m uvicorn main:app --app-dir risk-profiling --host 0.0.0.0 --port 8001 &
PID_RISK=$!

$PY -m uvicorn main:app --app-dir disease-trend --host 0.0.0.0 --port 8002 &
PID_TREND=$!

$PY -m uvicorn main:app --app-dir forecasting --host 0.0.0.0 --port 8003 &
PID_FORECAST=$!

echo "Risk:     PID $PID_RISK → http://localhost:8001"
echo "Trend:    PID $PID_TREND → http://localhost:8002"
echo "Forecast: PID $PID_FORECAST → http://localhost:8003"

trap "echo 'Stopping...'; kill $PID_RISK $PID_TREND $PID_FORECAST 2>/dev/null || true" INT TERM EXIT
wait
