# ── Stage 1: build React frontend ─────────────────────────────
FROM node:20-alpine AS build-client
WORKDIR /build
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ── Stage 2: production Node.js server ────────────────────────
FROM node:20-alpine
WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/ ./
# Place built React files where Express expects them: ../../client/dist
# relative to server/src/ → /app/client/dist
COPY --from=build-client /build/dist /app/client/dist

ENV NODE_ENV=production
EXPOSE 5050
CMD ["node", "src/server.js"]
