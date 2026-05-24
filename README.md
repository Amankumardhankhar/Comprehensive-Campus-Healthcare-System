---
title: Campus Healthcare
emoji: 🏥
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

# Comprehensive Campus Healthcare & Pharmacy Management System

An AI-enabled digital dispensary platform for campus health centres. Replaces paper logbooks and manual prescription pads with a full-stack web application that handles patient visits, real-time symptom triage, pharmacy inventory, and predictive analytics — all behind a role-based UI for students, staff, and administrators.

**Live demo:** https://Cchs-campus-healthcare.hf.space

---

## At a Glance

| | |
|---|---|
| **Frontend** | React 18 · Vite · Tailwind CSS · Recharts · Three.js / Vanta backgrounds · i18next (EN / HI / TA) |
| **Backend** | Node.js 20 · Express · MongoDB · Mongoose · JWT · bcryptjs · Helmet · express-rate-limit |
| **AI services** | Python 3.11 · FastAPI · uvicorn · 10 microservices |
| **ML libraries** | scikit-learn · statsmodels · PyTorch (CPU) · rapidfuzz |
| **Database** | MongoDB 7 (bundled container for VM deploys) or MongoDB Atlas (for cloud) |
| **Orchestration** | Docker · Docker Compose · single-container Hugging Face Spaces build |
| **Auth** | JWT access tokens · password reset via Resend (optional) |

---

## Repository Layout

```
Comprehensive-Campus-Healthcare-System/
├── Dockerfile               # Single-container build (Hugging Face Spaces)
├── docker-compose.yml       # Multi-container build (VM / local)
├── docker/
│   ├── app.Dockerfile       # Slim Node + React image (used by compose)
│   ├── analytics.Dockerfile # 3 analytics AI services behind nginx
│   ├── kiosk.Dockerfile     # 7 kiosk AI services + orchestrator
│   ├── hf-start.sh          # Boot script for the HF single-container image
│   └── nginx.conf.template  # Path routing inside the analytics container
├── client/                  # React 18 SPA (Vite + Tailwind)
├── server/                  # Node.js 20 + Express API (MVC)
└── ai-services/             # 10 Python FastAPI microservices
    ├── orchestrator/        # Kiosk pipeline coordinator
    ├── nlp-service/         # Symptom text → canonical labels
    ├── disease-prediction/  # RF + GBM ensemble
    ├── risk-classification/ # LR + rules → LOW / MEDIUM / HIGH
    ├── medicine-recommender/# Rule-based OTC matching
    ├── anomaly-detection/   # IsolationForest + Z-score on vitals
    ├── image-analysis/      # MobileNetV2 image screening
    ├── risk-profiling/      # RF for admin analytics
    ├── disease-trend/       # Moving average + Z-score anomaly
    └── forecasting/         # SARIMA medicine demand forecasting
```

---

## User Roles

| Role | Sees |
|------|-----|
| **Student** | Personal dashboard, kiosk symptom flow, Quick Pickup OTC catalog, password reset |
| **Staff** | Patient visit logs, inventory CRUD, kiosk session history |
| **Admin** | Everything above plus User Management, AI analytics dashboards, system configuration |

The public `/register` endpoint blocks self-registration as admin. Admins are created via the `seedAdmin.js` CLI script against the running database.

---

## Feature Summary

- **Self-service AI kiosk** — students enter symptoms (typed, voice, or chip-picker), optionally provide vitals and a photo; an orchestrator runs them through NLP, disease prediction, risk classification, anomaly detection, image screening, and a rule-based OTC recommender to decide *dispense* vs. *refer to doctor*.
- **Quick Pickup** — direct OTC catalog browse with per-item caps, total-cost cap, an under-12 gate, and an allergy gate. 30 OTC items pre-seeded across analgesics, antihistamines, antacids, anti-diarrheals, anti-emetics, cough & cold, vitamins, topicals, and first-aid. Live search across name, generic, category, and indications.
- **Doctor-referral handoff** — when AI returns `CONSULT_DOCTOR`, the kiosk shows a full-screen high-contrast nurse view, a WhatsApp share button, and a persistent banner on the student dashboard until acknowledged.
- **Real-time outbreak alerts** — anonymous trend endpoint surfaces a banner on the Welcome page when any disease's 7-day count crosses a threshold and at least doubles the previous week.
- **Inventory** — low-stock card on the admin dashboard, full CRUD with category, batch, expiry, and dispense-by-machine flag.
- **Admin user management** — searchable table, role/active toggles, password override, last-active-admin protection.
- **Password reset by email** — Resend integration with a console-fallback when `RESEND_API_KEY` is unset.
- **Sensor integration** — vitals (temperature, heart rate, SpO2, respiration rate) feed straight into the kiosk pipeline.
- **Internationalisation** — UI in English, Hindi, Tamil; NLP handles Hinglish phrases ("bukhar", "sir dard") alongside English.

For per-feature implementation detail, see [description.md](./description.md).

---

## Deployment Options

### 1. Hugging Face Spaces (single container, free tier)

Used by the live demo. The root `Dockerfile` is the single-container build that bundles the Node app, the React build, all 10 Python AI services, and an internal nginx router for the analytics services. The HF Space reads it automatically.

Required HF Space secrets (Settings → Variables and secrets):

| Name | Value |
|------|-------|
| `MONGO_URI` | MongoDB Atlas connection string (note: server reads `MONGO_URI`, **not** `MONGODB_URI`) |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `JWT_EXPIRES_IN` | e.g. `7d` (or shorter for kiosk-shared environments) |
| `CLIENT_URL` | `https://<owner>-<space>.hf.space` |
| `APP_URL` | Same as `CLIENT_URL` |
| `RESEND_API_KEY` | *(optional)* enables real reset emails |
| `EMAIL_FROM` | *(optional)* sender for reset emails |

The free tier sleeps after ~48 h of inactivity; the first request after sleep takes ~30 s to wake.

### 2. VM with Docker Compose

```bash
git clone <repo>
cd Comprehensive-Campus-Healthcare-System
cp .env.example .env       # then fill in JWT_SECRET, CLIENT_URL, APP_URL, etc.
docker compose up --build -d
```

App listens on `http://localhost:5050`. Compose brings up Mongo (bundled), the analytics-ai container, the kiosk-ai container, and the Node app. Front the app with a reverse proxy (Caddy / nginx / Traefik) for HTTPS in production.

### 3. Local development (no Docker)

```bash
# Prerequisites: Node 20, Python 3.11, MongoDB running locally
chmod +x start.sh && ./start.sh
# → App at http://localhost:5050
```

`start.sh` boots all AI services, the Express API, and the Vite dev server in parallel.

---

## Documentation Map

- [description.md](./description.md) — full technical description (AI pipeline, API routes, data models, env vars)
- [client/](./client/) — frontend source
- [server/](./server/) — backend API source
- [ai-services/](./ai-services/) — Python microservices

---

## License

MIT.
