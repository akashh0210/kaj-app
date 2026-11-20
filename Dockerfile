# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

# Python + pypdf: PDF text for the rule-based fallback parser (server calls `python`)
RUN apk add --no-cache python3 py3-pip \
 && pip install --no-cache-dir --break-system-packages pypdf \
 && ln -sf /usr/bin/python3 /usr/bin/python

# Only copy what's needed for the server
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js db.js ./
COPY scripts ./scripts
COPY demo-data ./demo-data
COPY --from=builder /app/dist ./dist

# Writable dirs for the local JSON store and uploads (in-memory on Cloud Run)
RUN mkdir -p uploads data

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

# Seed demo data if the local store is empty, then start the server
CMD ["sh", "-c", "node scripts/seed-if-empty.js; exec node server.js"]
