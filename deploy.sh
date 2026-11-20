#!/usr/bin/env bash
# deploy.sh – Build from source and deploy the KAJ demo to Cloud Run (Gemini on Vertex AI).
# Prerequisites: gcloud CLI, logged in, project with Cloud Run, Cloud Build, Artifact Registry
# and Vertex AI (aiplatform.googleapis.com) enabled. No API key is needed: the Cloud Run
# service account calls Vertex AI and needs roles/aiplatform.user (and roles/run.builder
# for source builds in new projects).
#
# Usage: ./deploy.sh [PROJECT_ID] [REGION]
# Optional env: GEMINI_MODEL, GEMINI_FALLBACK_MODEL, GOOGLE_CLOUD_LOCATION, TENANT_ID
set -euo pipefail

PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${2:-asia-south1}"
SERVICE_NAME="kaj"

# Env vars go through a temporary file that is always deleted.
ENV_FILE="$(mktemp)"
trap 'rm -f "$ENV_FILE"' EXIT
cat > "$ENV_FILE" <<EOF
GEMINI_USE_VERTEX: "true"
GOOGLE_CLOUD_PROJECT: "${PROJECT_ID}"
GOOGLE_CLOUD_LOCATION: "${GOOGLE_CLOUD_LOCATION:-global}"
GEMINI_MODEL: "${GEMINI_MODEL:-gemini-3.8-flash}"
GEMINI_FALLBACK_MODEL: "${GEMINI_FALLBACK_MODEL:-gemini-4-hydrogen}"
KAJ_STORE: "local"
TENANT_ID: "${TENANT_ID:-das-cooling-services}"
EOF

# Demo setup: in-memory local store seeded on start. One instance that never scales to zero,
# so data people add persists while they try the app (lost on redeploy or restart).
echo "Deploying ${SERVICE_NAME} to Cloud Run (project: ${PROJECT_ID}, region: ${REGION})"
gcloud run deploy "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --source . \
  --region "${REGION}" \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 1 \
  --memory 512Mi \
  --env-vars-file "${ENV_FILE}" \
  --quiet

URL=$(gcloud run services describe "${SERVICE_NAME}" --project "${PROJECT_ID}" --region "${REGION}" --format 'value(status.url)')
echo ""
echo "KAJ is live at: ${URL}"
