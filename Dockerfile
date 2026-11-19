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

# Only copy what's needed for the server
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY --from=builder /app/dist ./dist

# Create uploads dir
RUN mkdir -p uploads

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "server.js"]
