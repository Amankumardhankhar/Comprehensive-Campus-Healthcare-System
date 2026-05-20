#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
#  Campus Healthcare System — full-stack demo launcher
#  Usage:  chmod +x start.sh && ./start.sh
#  Stops:  Ctrl-C  (kills all child processes)
# ──────────────────────────────────────────────────────────────
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_DIR="$ROOT/ai-services"
SERVER_DIR="$ROOT/server"
CLIENT_DIR="$ROOT/client"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[START]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }

PIDS=()
cleanup() {
  echo ""
  warn "Shutting down all services..."
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null
  echo "Done."
}
trap cleanup INT TERM EXIT

# ── 0. Free any ports still held from a previous run ───────────
free_port() {
  local port=$1
  local pids
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    warn "Port $port in use — killing previous process(es): $pids"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 0.4
  fi
}

for p in 5050 8100 8101 8102 8103 8104 8105 8106 8001 8002 8003; do
  free_port "$p"
done

# ── 1. Python venv ─────────────────────────────────────────────
log "Checking Python virtual environment..."
if [ ! -d "$AI_DIR/venv" ]; then
  log "Creating venv (first run — may take a minute)..."
  python3 -m venv "$AI_DIR/venv"
  "$AI_DIR/venv/bin/pip" install -q --upgrade pip
  "$AI_DIR/venv/bin/pip" install -q -r "$AI_DIR/requirements.txt"
fi
PY="$AI_DIR/venv/bin/python"

# ── 2. Build frontend (only if dist is missing or stale) ───────
if [ ! -f "$CLIENT_DIR/dist/index.html" ]; then
  log "Building React frontend..."
  cd "$CLIENT_DIR" && npm run build
  cd "$ROOT"
fi

# ── 3. Kiosk AI services (8100-8106) ──────────────────────────
start_ai() {
  local name=$1; local dir=$2; local port=$3
  log "Starting $name on :$port"
  PORT=$port "$PY" -m uvicorn main:app \
    --app-dir "$AI_DIR/$dir" \
    --host 0.0.0.0 --port "$port" \
    --log-level warning &
  PIDS+=($!)
}

start_ai "Orchestrator"       orchestrator       8100
start_ai "Disease Prediction" disease-prediction 8101
start_ai "Risk Classifier"    risk-classification 8102
start_ai "Med Recommender"    medicine-recommender 8103
start_ai "Image Analysis"     image-analysis     8104
start_ai "Anomaly Detection"  anomaly-detection  8105
start_ai "NLP Service"        nlp-service        8106

# ── 4. Analytics AI services (8001-8003) ──────────────────────
start_ai "Risk Profiling"  risk-profiling 8001
start_ai "Disease Trend"   disease-trend  8002
start_ai "Forecasting"     forecasting    8003

# ── 5. Node.js backend ────────────────────────────────────────
log "Starting Node.js backend on :5050"
NODE_ENV=production node "$SERVER_DIR/src/server.js" &
PIDS+=($!)

# ── 6. Summary ────────────────────────────────────────────────
sleep 3
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Campus Healthcare System — running!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  App:        ${YELLOW}http://localhost:5050${NC}"
echo -e "  API health: ${YELLOW}http://localhost:5050/api/health${NC}"
echo ""
echo -e "  AI services: 8100 (orch) · 8101-8106 (kiosk) · 8001-8003 (analytics)"
echo ""
echo -e "  To share publicly: ${YELLOW}npx ngrok http 5050${NC}  (in another terminal)"
echo ""
echo -e "  Press Ctrl-C to stop everything."
echo ""

wait
