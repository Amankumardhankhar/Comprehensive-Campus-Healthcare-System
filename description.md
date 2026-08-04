# Comprehensive Campus Healthcare & Pharmacy Management System

## What It Is

An AI-enabled digital dispensary platform for campus health centres. It replaces paper logbooks and manual prescription pads with a full-stack web system that records patient visits, manages pharmacy inventory, applies machine-learning models to assist with triage, and surfaces real-time analytics for administrators.

The platform is built around three principles:

1. **Automation first, clinical second.** Routine OTC dispensing happens at a self-service kiosk; anything risky escalates to the campus health centre's existing clinical workflow.
2. **Auditability over magic.** Every AI decision (predicted disease, risk class, recommended medicine) is stored with confidence scores so any dispense can be reviewed after the fact.
3. **No paid services required.** The whole stack runs on free tiers — Hugging Face Spaces for compute, MongoDB Atlas for the database, Brevo (optional) for email.

---

## User Roles

| Role | Sees |
|------|------|
| **Student** | Personal dashboard, kiosk symptom flow, Quick Pickup OTC browse, profile edit, password reset |
| **Staff** | Patient visit logs, full inventory CRUD, kiosk session history |
| **Admin** | Everything above plus user management, AI analytics dashboards (risk distribution, disease trend, demand forecast), system configuration |

`/register` is open for student / staff but blocks self-registration as admin (enforced server-side in `auth.service.js`). The first admin must be seeded via the `seedAdmin.js` CLI script.

---

## Core Features

### 1. Self-service AI kiosk

The kiosk is the primary user-facing flow. A student walks up to a terminal and:

1. **Enters symptoms** — typed, voice-transcribed, or by tapping symptom chips (the chip set covers fever, headache, cough, sore throat, stomach pain, nausea, vomiting, body ache, diarrhea, runny nose).
2. **Captures vitals** (optional) — heart rate, temperature, SpO2, respiration rate. The vitals page accepts both sensor input and manual entry.
3. **Takes a photo** (optional, when enabled) — used by the image-analysis service for visible-condition screening.
4. **Sees the AI verdict** — one of:
   - **DISPENSE** — pharmacy vending releases the recommended OTC medicine. Session is marked complete with full audit trail.
   - **CONSULT_DOCTOR** — full-screen high-contrast referral view with patient name, AI predictions, symptoms, vitals, and "why referred" reasons. Patient can hand the phone to a nurse for a 3-second glance, or share the summary on WhatsApp. The dashboard then shows a persistent referral banner until acknowledged.

End-to-end target latency is < 5 s on free-tier hardware.

### 2. Quick Pickup (OTC catalog browse)

For users who know what they need. The Quick Pickup page is gated by two questions (under 12? known drug allergies?) and capped at ₹200 total / 2 units per item per session. The catalog ships with 30 pre-seeded OTC items:

| Category | Items |
|----------|-------|
| Analgesic | Paracetamol 500mg, Ibuprofen 200mg, Aspirin 75mg, Diclofenac Gel 30g |
| Antihistamine | Cetirizine 10mg, Loratadine 10mg, Levocetirizine 5mg |
| Antacid | Antacid Gel 200ml, Pantoprazole 40mg, Ranitidine 150mg |
| Cough & cold | Cough Syrup 100ml, Strepsils Lozenges, Honey-Ginger Cough Drops |
| Topical | Vicks VapoRub 50g, Hydrocortisone Cream 1%, Calamine Lotion 100ml |
| Anti-emetic / diarrheal | Loperamide 2mg, Domperidone 10mg |
| Vitamin | Vitamin C 500mg, Multivitamin, Vitamin D3 60000IU, Calcium 500mg, Iron + Folic Acid, Zinc 50mg |
| First aid | Adhesive Bandage, Povidone Iodine 100ml, Gauze Pad, Crepe Bandage 6cm |
| Other | ORS Sachet, Glucose Powder 100g |

A live search bar above the grid filters across name, generic name, category, and indications (e.g. typing "headache" surfaces Paracetamol, Ibuprofen, and Aspirin). The cart isn't cleared by search — selected items stay in the cart even when filtered out of view. Catalog eligibility is enforced per-Medicine-document by the `dispensableByMachine` boolean.

### 3. Doctor-referral handoff

When the kiosk decides `CONSULT_DOCTOR`:

- Kiosk result page shows the campus health centre name, address, hours, and intercom numbers.
- A **"Show to nurse"** button opens a full-screen view designed to be readable across a desk.
- A **"Share on WhatsApp"** button opens `wa.me` with a pre-filled summary.
- An amber banner appears on the student's dashboard listing all unacknowledged referrals with **View** and **Mark resolved** buttons. The banner disappears once everything is acknowledged.

Acknowledgement is ownership-guarded (`POST /api/machine/session/:id/acknowledge-referral`); admins cannot acknowledge other users' referrals.

### 4. Real-time outbreak alerts

A public endpoint (`GET /api/health/outbreak-alerts`) aggregates kiosk-diagnosed disease counts for the last 7 days vs. the prior 7. A 5-minute in-memory cache keeps it cheap. The Welcome page shows a dismissible banner per outbreak when:

- ≥ 5 cases in the last 7 days, **and**
- ≥ 2× the prior week's count

Dismissals are stored in `sessionStorage` so the banner reappears next browser session if the outbreak persists.

### 5. Inventory management

Real-time stock tracking, low-stock alerts on the admin dashboard, expiry tracking with `isExpired` and `isExpiringSoon` virtuals, and full CRUD on category, manufacturer, batch number, expiry date, price, OTC flag, machine-dispensable flag, and per-session max quantity. The boot-time OTC seeder is idempotent — re-running it inserts only new items.

### 6. Admin user management

Searchable + filterable table of all users with role badges, active/disabled toggle, joined date, and pagination. Admins can:

- Create users with any role (including other admins)
- Edit name, phone, department, studentId, dateOfBirth, chronicConditions, role, active flag, and password
- Delete users

Safety guards in `adminUser.service.js`:

- Cannot change own role
- Cannot disable or delete own account
- Cannot demote / disable / delete the **last active admin**

### 7. Password reset

`PasswordResetToken` model with a TTL index that auto-expires entries. Tokens are 32-byte random; only the SHA-256 hash is stored (replay-safe). The flow:

1. `POST /api/auth/forgot-password` → invalidates prior tokens, mints a new one (60-min TTL), emails the link. The provider call is **not** awaited, so response time doesn't reveal whether the account exists.
2. User opens `/reset-password/:token`; the page first calls `GET /api/auth/reset-password/:token/verify` and only renders the form for a valid token — an expired link says so before the user picks a password. A masked address (`s••••••@campus.edu`) is shown for orientation.
3. `POST /api/auth/reset-password` → rejects a password identical to the current one, saves, marks the token used, invalidates any siblings, and sends a "your password was changed" notification.
4. Token is single-use; replay returns "invalid or expired" with no email-existence leak.

Changing a password stamps `passwordChangedAt`, and `protect` rejects any JWT issued before it — so a reset ends every prior session rather than leaving a compromised token valid for the rest of its lifetime.

Rate limits: 5 requests/hour per email address (caps inbox flooding) plus a looser 20/hour per IP. `trust proxy` is set so the per-IP limiter sees real client addresses rather than the edge proxy.

**Email transport** is chosen at boot in the order **Brevo → SMTP → Resend → console**, and verified at startup so bad credentials appear in the logs immediately. With none configured the app still runs and reset links are written to the log. A *failed* send also logs the link — the raw token exists only in that request's closure (Mongo holds just the hash), so it's the only way to rescue a user manually.

### 8. Internationalisation

UI strings live in `client/src/i18n/index.js` for English, Hindi, and Tamil. The NLP service also accepts Hinglish phrases (`bukhar`, `sir dard`, `pet me dard`) using a fuzzy-match symptom dictionary.

---

## AI Architecture

The system runs **10 FastAPI microservices** split into two groups.

### Kiosk pipeline (real-time, target < 5 s end-to-end)

```
User input (text / vitals / image)
        │
        ▼
  [Orchestrator :8100]
        │
        ├──► [NLP Service :8106]          — text → canonical symptoms (negation-aware, multilingual)
        │
        ├──► [Disease Prediction :8101]   — symptoms + vitals → top-K diseases (RF + GBM ensemble)
        ├──► [Risk Classification :8102]  — vitals + symptoms → LOW / MEDIUM / HIGH (LR + rules)
        ├──► [Anomaly Detection  :8105]   — vitals → outlier flag (IsolationForest + Z-score)
        ├──► [Image Analysis     :8104]   — photo → screening flags (MobileNetV2 + colour heuristics)
        │
        └──► [Medicine Recommender :8103] — rule-based OTC matching (auditable, not ML-driven)
                │
                ▼
        Decision Engine → DISPENSE | CONSULT_DOCTOR
```

The orchestrator is fault-tolerant: if any individual service returns 5xx or times out, the pipeline degrades gracefully (e.g. missing image analysis just means no skin-condition flags; the disease ensemble still runs). The final decision engine widens the safety bar (referral) when fewer signals are available.

### Analytics pipeline (on-demand, admin only)

| Service | Port | Algorithm | Input | Output |
|---------|------|-----------|-------|--------|
| Risk Profiling | 8001 | Random Forest (160 estimators) | 6 patient features | Low / Medium / High + probability |
| Disease Trend | 8002 | Rolling moving avg + Z-score | Daily diagnosis counts | Trend line + anomaly dates |
| Forecasting | 8003 | SARIMA / Exponential Smoothing | Daily medicine demand history | 14–90 day forecast + reorder flag |

In the single-container HF Spaces image, all three analytics services run behind an internal nginx that path-routes `/predict`, `/analyze`, and `/forecast` to the correct port, so the Express server only needs one URL for all three.

---

## Backend API Routes

| Method + Path | Purpose |
|---------------|---------|
| `GET /api/health` | App + AI health check (15 s in-memory cache) |
| `GET /api/health/ai` | Public AI services status (used by Welcome page) |
| `GET /api/health/outbreak-alerts` | Public anonymous outbreak counts (5 min cache) |
| `POST /api/auth/register` | Student / staff signup (admin blocked) |
| `POST /api/auth/login` | JWT login |
| `GET /api/auth/me` | Current user profile |
| `PATCH /api/auth/me` | Self profile edit (whitelisted fields) |
| `POST /api/auth/forgot-password` | Email a reset token |
| `POST /api/auth/reset-password` | Consume reset token |
| `GET / POST / PATCH / DELETE /api/medicines/...` | Inventory CRUD |
| `GET / POST /api/records/...` | Legacy medical record CRUD |
| `POST /api/machine/session/start` | Start kiosk symptom session |
| `POST /api/machine/session/:id/submit` | Submit symptoms + vitals + image |
| `POST /api/machine/session/:id/acknowledge-referral` | Mark referral as seen |
| `POST /api/machine/quick/session/start` | Start Quick Pickup session |
| `POST /api/machine/quick/session/:id/cart` | Set cart contents |
| `GET /api/machine/quick/catalog` | OTC catalog (dispensable + active) |
| `GET /api/machine/sessions` | List own sessions (paginated) |
| `GET /api/analytics/risk/:studentId` | ML risk profile for one student |
| `GET /api/analytics/trend` | Disease trend time-series |
| `GET /api/analytics/forecast/:medicineId` | Demand forecast |
| `GET /api/analytics/distribution` | Risk distribution across all students |
| `POST /api/sensor/reading` | Submit sensor vitals reading |
| `GET / POST / PATCH / DELETE /api/admin/users/...` | Admin user CRUD |
| `GET / PUT /api/system/config` | Admin system settings |

Authentication: `Authorization: Bearer <JWT>` for everything except the explicitly public health endpoints. Rate limits via `express-rate-limit`; CORS configured against `CLIENT_URL`.

---

## Data Models (MongoDB)

| Collection | Key fields |
|------------|------------|
| `users` | name, email, password (bcrypt × 12), role (`student` / `staff` / `admin`), studentId, department, phone, dateOfBirth, chronicConditions, isActive |
| `medicines` | name, genericName, category (10 categories), manufacturer, batchNumber, quantity, unit, pricePerUnit, expiryDate, minStockLevel, otcSafe, dispensableByMachine, maxPerSession, indications, contraindications |
| `machinesessions` | user, sessionId, type (`kiosk` / `quick`), status, symptoms, vitals, aiResponse, decision (action + reasons + acknowledgedAt), cart, completedAt |
| `medicalrecords` | student, staff, symptoms, diagnosis, medicinesIssued, visitDate |
| `sensorreadings` | user, temperature, heartRate, spO2, respirationRate, timestamp |
| `passwordresettokens` | userId, tokenHash, expiresAt (TTL-indexed), usedAt |
| `systemconfigs` | minConfidence, maxDispenseQuantity, maintenanceMode |

Each Medicine document has virtuals for `isLowStock`, `isExpired`, and `isExpiringSoon` so the client never has to compute these.

---

## Deployment

### 1. Hugging Face Spaces (single container, free tier)

The root `Dockerfile` builds a single image containing:

- The React production bundle (Vite build, stage 1)
- The Express API (stage 2, Node 20 on Debian)
- All 10 Python AI microservices (Python 3.11)
- An internal nginx for analytics path-routing
- A `start.sh` that boots every AI service on a loopback port, then runs Express in the foreground on port 7860 (HF's default)

The Space is created with **SDK: Docker** (Blank template), Public, CPU Basic Free hardware. HF Spaces' Docker SDK auto-reads `./Dockerfile` at repo root — there is no config option to point at a different path.

Build time on first push: ~5–8 min (PyTorch CPU wheel download dominates). Subsequent builds are ~3–5 min thanks to Docker layer caching.

Required secrets in Space settings (see README for the full list).

### 2. VM with Docker Compose

`docker-compose.yml` declares four services:

| Service | Image source | Purpose |
|---------|--------------|---------|
| `mongo` | `mongo:7` | Bundled MongoDB with a `mongo_data` Docker volume |
| `analytics-ai` | `docker/analytics.Dockerfile` | Risk, trend, forecast services behind nginx |
| `kiosk-ai` | `docker/kiosk.Dockerfile` | Orchestrator + 6 kiosk sub-services |
| `app` | `docker/app.Dockerfile` | Express API + React build, port 5050 |

Compose secrets read from a root `.env` via `${VAR:?}` interpolation, so the stack fails fast if any required value is missing. Mongo's port is **not** published — only the app reaches it on the internal network. Front the app with a reverse proxy for HTTPS.

### 3. Local development (no Docker)

`start.sh` boots all AI services, Express, and the Vite dev server in parallel. Prerequisites: Node 20, Python 3.11, and a local MongoDB.

---

## Environment Variables

| Variable | Required | Used by | Description |
|----------|----------|---------|-------------|
| `MONGO_URI` | Yes | Express | Mongo connection string. **Name is `MONGO_URI`, not `MONGODB_URI`** — wrong name = `FATAL: missing required env vars`. |
| `JWT_SECRET` | Yes | Express | Random secret for signing tokens. Generate with `openssl rand -base64 48`. |
| `JWT_EXPIRES_IN` | No | Express | Token lifetime (default `7d`). For kiosk-shared environments, set lower (`15m` is a sane minimum). |
| `CLIENT_URL` | Yes | Express | Public origin of the app — used for CORS. |
| `APP_URL` | Yes | Express | Public origin for password-reset links (usually same as `CLIENT_URL`). |
| `BREVO_API_KEY` | No | Express | Brevo API key. Sends over HTTPS — **the only transport that works on HF Spaces** (see Security Notes). If unset, falls through to SMTP → Resend → console. |
| `EMAIL_FROM` | No | Express | Sender for reset emails, e.g. `Campus Healthcare <you@gmail.com>`. Must be a **verified sender** on the provider account or mail is rejected. Defaults to `Campus Healthcare <SMTP_USER>` when SMTP is configured. |
| `SMTP_USER` / `SMTP_PASS` | No | Express | Gmail address + **App Password** (16 chars, needs 2-Step Verification). Works on a VM; **not** on HF Spaces. |
| `SMTP_HOST` / `SMTP_PORT` | No | Express | Default `smtp.gmail.com` / `587`. Port `465` switches to implicit TLS. |
| `RESEND_API_KEY` | No | Express | Alternative HTTPS provider. Its shared `onboarding@resend.dev` sender only delivers to your own Resend account address; anyone else needs a verified domain. |
| `AI_ORCHESTRATOR_URL` | No | Express | Override the kiosk pipeline URL. Defaults to `http://kiosk-ai:8100` (compose) or `http://127.0.0.1:8100` (HF). |
| `AI_RISK_URL` / `AI_TREND_URL` / `AI_FORECAST_URL` | No | Express | Analytics URLs. All three point to the same nginx in the HF image. |

For docker-compose, `MONGO_URI`, `NODE_ENV`, `PORT`, and AI URLs are wired automatically by `docker-compose.yml`. The root `.env` only needs `JWT_SECRET`, `CLIENT_URL`, `APP_URL`, and (optionally) the email keys.

---

## Security Notes

- Passwords hashed with bcrypt cost 12; never returned by `User.toJSON`.
- Auth tokens signed with HS256; secret length minimum enforced.
- Password reset tokens are single-use, SHA-256 hashed at rest, and TTL-expire.
- The "forgot password" endpoint returns the same response whether the email exists or not, and does not await the mail provider — so neither the body nor the timing leaks whether an account exists.
- Resetting a password stamps `passwordChangedAt`; JWTs issued earlier are rejected, so a reset terminates existing sessions.
- Reset endpoints are rate limited per email (5/h) and per IP (20/h).
- **HF Spaces blocks outbound SMTP.** Connections to `smtp.gmail.com` fail `ENETUNREACH` on IPv6 (no IPv6 route in the container) and time out on IPv4, on both 587 and 465. Use `BREVO_API_KEY`, which goes over 443 like the app's Atlas and PyTorch traffic.
- Mongo's port is not exposed in either deploy path; only the Node container reaches it.
- HF Spaces secrets are injected as environment variables, never written to disk.
- The `0.0.0.0/0` Atlas allowlist is intentional for HF Spaces (no fixed egress IPs) — for VM deploys, restrict to the VM's IP.

---

## Free-tier Constraints to Be Aware Of

| Resource | Limit | Notes |
|----------|-------|-------|
| MongoDB Atlas M0 | 512 MB storage | A demo run uses < 10 MB; 25 000+ kiosk sessions fit before hitting the cap. |
| MongoDB Atlas M0 idle | 60 days no connections | Cluster auto-pauses; one-click resume in Atlas UI, no data loss. |
| HF Spaces free | 16 GB RAM, 2 vCPU shared | All 10 AI services use ~3–4 GB at peak. |
| HF Spaces sleep | After ~48 h idle | First request takes ~30 s to wake; no data loss. |
| Brevo free | ~300 emails / day | Plenty for password resets on a campus scale. Verify current limits — providers change them. |
| HF Spaces egress IP | Changes on restart | Observed three different AWS IPs in ~35 minutes. Never put the Space behind an IP allowlist (Brevo's, Atlas's, or anyone's). |

---

## Quick Reference

| Action | Command |
|--------|---------|
| Local dev | `chmod +x start.sh && ./start.sh` |
| Local Docker | `cp .env.example .env && docker compose up --build` |
| Seed an admin against any running DB | `MONGO_URI="..." JWT_SECRET="..." node server/src/utils/seedAdmin.js admin@example.com Password123 "Display Name"` |
| Force re-seed OTC catalog | Restart the server (seed runs on boot, idempotent on `genericName + name`) |
| Run tests | (project does not currently ship a test suite) |
