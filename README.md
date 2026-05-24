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

An AI-enabled digital healthcare platform for campus dispensaries — replacing manual logbooks with a modern, data-driven system for medical records, pharmacy inventory, and predictive analytics.

## Architecture

```
Comprehensive-Campus-Healthcare-System/
├── client/              # React 18 + Vite + Tailwind CSS
├── server/              # Node.js + Express + MongoDB (MVC)
├── ai-services/         # Python FastAPI microservices
│   ├── risk-profiling/  # Random Forest patient risk classifier
│   ├── disease-trend/   # Moving average + Z-score anomaly detection
│   └── forecasting/     # SARIMA medicine demand forecasting
└── docker/              # Dockerfiles and compose configs
```

## Tech Stack

| Layer          | Technology                                  |
| -------------- | ------------------------------------------- |
| Frontend       | React 18, Vite, Tailwind CSS, Recharts      |
| Backend        | Node.js, Express, MongoDB, Mongoose, JWT    |
| AI Services    | Python 3.11, FastAPI, scikit-learn, statsmodels |
| Orchestration  | Docker, Docker Compose                      |

## Roles

- **Student** — view own medical history, browse medicine availability
- **Staff** — log patient visits, issue medicines, manage inventory
- **Admin** — AI analytics dashboard (risk distribution, disease trends, forecasts)

## Getting Started

Documentation for each service lives in its own subdirectory. See:
- [client/README.md](./client/README.md)
- [server/README.md](./server/README.md)
- [ai-services/](./ai-services/)

## Deployment

The whole stack — Node app, two AI service groups, and MongoDB — runs as
Docker containers defined in `docker-compose.yml`.

### Local
1. Install Docker and Docker Compose.
2. `cp .env.example .env` and fill in the values.
3. `docker compose up --build`
4. Open http://localhost:5050

### Production (single VM)
1. Provision a Linux VM (2+ vCPU, 4+ GB RAM) with Docker installed.
2. Clone the repo, then `cp .env.example .env` and set production values.
3. `docker compose up --build -d`
4. The app listens on port 5050; front it with a reverse proxy for HTTPS.

MongoDB runs as a bundled container; its data lives in the `mongo_data`
Docker volume. Back it up periodically with `mongodump`.
