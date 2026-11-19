#!/usr/bin/env bash
# deploy.sh – Build and deploy KAJ to Cloud Run
# Prerequisites: gcloud CLI installed and authenticated, Docker available.
# Usage: ./deploy.sh [PROJECT_ID] [REGION]
set -euo pipefail

PROJECT_ID="${1:-$(gcloud config get-value project)}"
REGION="${2:-asia-south1}"
SERVICE_NAME="kaj-app"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🏗  Building Docker image: ${IMAGE}"
gcloud builds submit --tag "${IMAGE}" .

echo "🚀 Deploying to Cloud Run (region: ${REGION})"
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "TENANT_ID=${TENANT_ID:-das-cooling-services}" \
  --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --set-secrets "FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest" \
  --set-secrets "FIREBASE_CLIENT_EMAIL=FIREBASE_CLIENT_EMAIL:latest" \
  --set-secrets "FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest"

URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --platform managed \
  --region "${REGION}" \
  --format 'value(status.url)')

echo ""
echo "✅ Deployed! KAJ is live at: ${URL}"
echo ""
echo "Next steps:"
echo "  1. Set the VITE_ env vars in .env and rebuild for the client-side Firebase config."
echo "  2. Run 'npm run seed' once to seed Firestore with demo data."
echo "  3. Visit ${URL}"
