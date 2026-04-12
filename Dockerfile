# ── Build stage ──────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Runtime stage ─────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

# Non-root user for security
RUN addgroup -S picnic && adduser -S picnic -G picnic

# Copy dependencies and source
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server.js    ./
COPY views/       ./views/
COPY public/      ./public/

# Data directory (persisted via volume)
RUN mkdir -p data && chown -R picnic:picnic /app

USER picnic

EXPOSE 3000

ENV NODE_ENV=production \
    PORT=3000

CMD ["node", "server.js"]
