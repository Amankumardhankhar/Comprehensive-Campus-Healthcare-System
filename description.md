# Comprehensive Campus Healthcare & Pharmacy Management System

## What It Is

An AI-enabled digital dispensary platform for campus health centres. It replaces paper logbooks and manual prescription pads with a full-stack web system that records patient visits, manages pharmacy inventory, and applies machine-learning models to assist with triage and administration.

---

## User Roles

| Role | What they can do |
|------|-----------------|
| **Student** | View own medical history, browse medicine availability |
| **Staff** | Log patient visits, issue medicines, manage inventory |
| **Admin** | Full system access + AI analytics dashboard |

---

## Core Features

### 1. Self-Service AI Kiosk
Students walk up to a kiosk terminal, enter symptoms (typed or voice-transcribed), optionally provide vitals from a hardware sensor, and optionally take a photo. An AI pipeline analyses the input in real time and returns one of two decisions:
- **DISPENSE** — prints a token; pharmacy vending machine releases OTC medicine
- **REFER TO DOCTOR** — directs the student to the dispensary staff

### 2. Quick Pickup
Students with existing prescriptions scan a QR code to collect medicine without going through the full kiosk flow.

### 3. Staff Dashboard
Logs consultation records (symptoms, diagnosis, medicines issued), updates stock levels, and reviews kiosk session history.

### 4. Admin Analytics
Three ML-powered dashboards visible only to admins:
- **Risk Distribution** — pie chart of patient risk levels (Low / Medium / High) across all students
- **Disease Trend** — rolling moving-average line chart with Z-score anomaly flags for outbreak detection
- **Demand Forecast** — 14–90 day SARIMA-based medicine demand forecast with reorder alerts

### 5. Inventory Management
Real-time stock tracking with low-stock alerts; seeded with 8 OTC medicines on first boot.

### 6. Sensor Integration
Hardware vitals sensors (temperature, heart rate, SpO2, respiration rate) stream readings to the backend, which feeds them directly into the AI pipeline.

### 7. Internationalisation
UI supports multiple languages; NLP service understands Hinglish phrases (e.g., "bukhar", "sir dard") in addition to English.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Recharts, Three.js / Vanta backgrounds |
| Backend | Node.js 20, Express, MongoDB / Mongoose, JWT auth |
| Security | Helmet, express-rate-limit, bcryptjs, CORS |
| AI Services | Python 3.11, FastAPI, uvicorn (×10 microservices) |
| ML Libraries | scikit-learn, statsmodels, PyTorch (CPU), rapidfuzz |
| Database | MongoDB 7 (bundled Docker container) |
| Orchestration | Docker, Docker Compose |

---

## AI Architecture

The system runs **10 FastAPI microservices** split into two groups.

### Kiosk Pipeline (real-time, target < 5 s end-to-end)

```
User input (text / vitals / image)
        │
        ▼
  [Orchestrator :8100]
        │
        ├──► [NLP Service :8106]          — text → canonical symptoms (negation-aware)
        │
        ├──► [Disease Prediction :8101]   — symptoms + vitals → top-K diseases (RF + GBM ensemble)
        ├──► [Risk Classification :8102]  — vitals + symptoms → LOW / MEDIUM / HIGH (LR + rules)
        ├──► [Anomaly Detection  :8105]   — vitals → outlier flag (IsolationForest + Z-score)
        ├──► [Image Analysis     :8104]   — photo → screening flags (MobileNetV2 + colour heuristics)
        │
        └──► [Medicine Recommender :8103] — rule-based OTC matching (auditable, not ML-driven)
                │
                ▼
        Decision Engine → DISPENSE | REFER_TO_DOCTOR
```

### Analytics Pipeline (on-demand, admin only)

| Service | Port | Algorithm | Input | Output |
|---------|------|-----------|-------|--------|
| Risk Profiling | 8001 | Random Forest (160 estimators) | 6 patient features | Low / Medium / High + probability |
| Disease Trend | 8002 | Rolling moving avg + Z-score | Daily diagnosis counts | Trend line + anomaly dates |
| Forecasting | 8003 | SARIMA / Exp. Smoothing | Daily medicine demand history | 14–90 day forecast + reorder flag |

---

## Backend API Routes

| Prefix | Purpose |
|--------|---------|
| `GET /api/health` | Health check (also pings all 4 AI services) |
| `POST /api/auth/login` | JWT login |
| `GET/POST /api/medicines` | Inventory CRUD |
| `GET/POST /api/records` | Medical record CRUD |
| `GET /api/analytics/risk/:studentId` | ML risk profile for one student |
| `GET /api/analytics/trend` | Disease trend time-series |
| `GET /api/analytics/forecast/:medicineId` | Demand forecast |
| `GET /api/analytics/distribution` | Risk distribution across all students |
| `POST /api/machine/session` | Start a kiosk session |
| `POST /api/machine/quick/pickup` | Quick pickup via QR |
| `POST /api/sensor/reading` | Submit sensor vitals |
| `GET/PUT /api/system/config` | Admin system settings |

---

## Data Models (MongoDB)

| Collection | Key Fields |
|-----------|-----------|
| `users` | role, studentId, profile, medicalHistory |
| `medicines` | name, stock, category, isOTC, unit |
| `medicalrecords` | student, staff, symptoms, diagnosis, medicinesIssued, date |
| `machinesessions` | studentId, input, aiResponse, decision, dispensed |
| `quickpickups` | qrCode, medicine, studentId, dispensedAt |
| `sensorreadings` | studentId, temperature, heartRate, spO2, respirationRate, timestamp |
| `systemconfigs` | minConfidence, maxDispenseQuantity, maintenanceMode |

---

## Production Architecture (single VM + Docker Compose)

```
Browser
   │
   ▼
[ app ]            Node.js 20 — serves the React SPA + REST API on port 5050
   │
   ├── [ mongo ]          MongoDB 7 — bundled container, data in a Docker volume
   │
   ├── [ analytics-ai ]   Risk / trend / forecast services behind nginx
   │
   └── [ kiosk-ai ]       Real-time kiosk pipeline (orchestrator + sub-services)
```

All four services are defined in `docker-compose.yml` and start with a single
`docker compose up -d`. They communicate over the internal Compose network;
only the app's port 5050 is published to the host. A reverse proxy in front of
the app adds HTTPS.

---

## Environment Variables

For a Docker Compose deploy, only the values below go in a root `.env` file
(`cp .env.example .env`). `MONGO_URI`, `NODE_ENV`, `PORT`, and the AI service
URLs are wired automatically in `docker-compose.yml`.

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Random secret for signing tokens (`openssl rand -base64 48`) |
| `JWT_EXPIRES_IN` | No | Token lifetime (default `7d`) |
| `CLIENT_URL` | Yes | Public origin of the app — used for CORS |
| `APP_URL` | Yes | Public origin for password-reset links (usually same as `CLIENT_URL`) |
| `RESEND_API_KEY` | No | Resend API key for reset emails; blank logs links to the console |
| `EMAIL_FROM` | No | Sender address for password-reset emails |

---

## Local Development

```bash
# Prerequisites: Node 20, Python 3.11, MongoDB running

chmod +x start.sh && ./start.sh
# → App at http://localhost:5050
```

## Docker (local full-stack)

```bash
docker compose up --build
# → App at http://localhost:5050
```
