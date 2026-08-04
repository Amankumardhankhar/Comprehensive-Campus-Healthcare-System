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
| **Auth** | JWT access tokens · rate-limited password reset · email via Brevo / SMTP / Resend |

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
| `APP_URL` | Same as `CLIENT_URL` — password-reset links are built from it, so a wrong value makes every emailed link dead |
| `BREVO_API_KEY` | Sends reset emails over HTTPS — **the only transport that works on Spaces** |
| `EMAIL_FROM` | Sender address, e.g. `Campus Healthcare <you@gmail.com>`. Must be a **verified sender** in Brevo |
| `SMTP_USER` / `SMTP_PASS` | *(optional)* Gmail SMTP — works on a VM, **not** on Spaces (see below) |
| `RESEND_API_KEY` | *(optional)* alternative HTTPS provider; needs a verified domain |

Email transport is chosen at boot in the order **Brevo → SMTP → Resend → console**.
With none configured the app still runs; reset links are written to the Space logs
instead of sent. A failed send always logs the link too, so a locked-out user can be
rescued manually.

> **Hugging Face Spaces blocks outbound SMTP.** Connections to `smtp.gmail.com` fail
> with `ENETUNREACH` on IPv6 (no IPv6 route in the container) and time out on IPv4,
> on both port 587 and 465. Gmail SMTP therefore cannot work on a Space regardless of
> credentials — use `BREVO_API_KEY`, which goes over port 443 like the app's existing
> MongoDB Atlas and PyTorch traffic. Brevo supports single-sender verification, so you
> can send from a plain Gmail address without owning a domain.

Gmail App Passwords (for VM deploys) require 2-Step Verification on the account
(Google Account → Security → App passwords). Resend's shared `onboarding@resend.dev`
sender only delivers to your own Resend account address — reaching anyone else needs
a verified domain.

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

## Troubleshooting: password-reset emails

Every failure below is invisible from the app's side — the API returns success and the
user just never receives anything. Each now produces a specific line in the **Container
logs**, so start there.

**First, read the boot line.** The transport is verified at startup:

```
Email service: Brevo verified (account: you@gmail.com), sending as Campus Healthcare <you@gmail.com>
```

| Log line | Cause | Fix |
|---|---|---|
| `Brevo key rejected (HTTP 401)` with `unrecognised IP address` | Brevo's IP allowlist is enforcing. The Space's egress IP changes on every restart. | Brevo → Settings → Security → **Authorized IPs**. Keep "Blocking unauthorized IP addresses" **Deactivated** for both API and SMTP keys. |
| `Brevo key rejected (HTTP 401)` without an IP mention | Wrong or revoked API key. | Regenerate under SMTP & API → API keys. Must be a v3 key (`xkeysib-…`), **not** an SMTP key. |
| `EMAIL_FROM is still the placeholder` | `EMAIL_FROM` unset or left as `onboarding@resend.dev`. | Set it to an address verified under Brevo → Senders, domains, IPs. |
| `sender you used … is not valid` (in Brevo's own logs) | The From address isn't a verified sender. | Add it under Senders and click the confirmation email Brevo sends. |
| `SMTP verification FAILED (ENETUNREACH …:587)` | No IPv6 route in the container. | Don't use SMTP on Spaces — see below. |
| `SMTP send failed: Connection timeout` | Outbound SMTP port is blocked. | Same — use `BREVO_API_KEY`. |

> **Hugging Face Spaces blocks outbound SMTP.** Gmail SMTP cannot work there on any port
> or credentials: IPv6 fails `ENETUNREACH` (no route in the container) and IPv4 times out
> on both 587 and 465. HTTPS on 443 is unaffected — the same path Atlas and the PyTorch
> weight download already use — so `BREVO_API_KEY` is the transport to use on a Space.
> The `SMTP_USER`/`SMTP_PASS` path is kept for VM deploys, where SMTP is normally allowed.

**Sending from a `@gmail.com` address is fine.** Brevo rewrites the envelope to its own
authenticated subdomain (`…@NNNNNNN.brevosend.com`) while keeping your display name, which
is what gets it past the Gmail/Yahoo DMARC rules for freemail senders.

**Nothing in the provider's logs at all?** Then the app never called it. Check `BREVO_API_KEY`
is present in the Space secrets, and look for `Email service: … configured` at boot.

**Rescuing a locked-out user.** Any failed send logs the full reset link:

```
[password-reset] Delivery failed (mode=brevo) for someone@example.com. Link: https://…/reset-password/<token>
```

The raw token exists only for that request — the database stores just its SHA-256 hash — so
this log line is the only way to recover it. Valid for 60 minutes.

---

## Documentation Map

- [description.md](./description.md) — full technical description (AI pipeline, API routes, data models, env vars)
- [client/](./client/) — frontend source
- [server/](./server/) — backend API source
- [ai-services/](./ai-services/) — Python microservices

---

## License

MIT.
