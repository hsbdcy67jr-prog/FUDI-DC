#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${GOOGLE_CLOUD_REGION:-us-central1}"
if [[ -z "$PROJECT_ID" || "$PROJECT_ID" == "(unset)" ]]; then
  echo "Set GOOGLE_CLOUD_PROJECT or select a gcloud project first." >&2
  exit 1
fi
if [[ -z "${GOOGLE_CLOUD_BILLING_ACCOUNT:-}" || -z "${FUDI_MONTHLY_BUDGET_AMOUNT:-}" ]]; then
  echo "Set GOOGLE_CLOUD_BILLING_ACCOUNT and FUDI_MONTHLY_BUDGET_AMOUNT (for example, 25USD) so deployment creates a monthly billing alert." >&2
  exit 1
fi

REPO="fudi-services"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com billingbudgets.googleapis.com --project "$PROJECT_ID"
BUDGET_NAME="FUDI-DC monthly · $PROJECT_ID"
EXISTING_BUDGET="$(gcloud billing budgets list --billing-account "$GOOGLE_CLOUD_BILLING_ACCOUNT" --filter="displayName=$BUDGET_NAME" --format='value(name)')"
if [[ -z "$EXISTING_BUDGET" ]]; then
  gcloud billing budgets create --billing-account "$GOOGLE_CLOUD_BILLING_ACCOUNT" --display-name "$BUDGET_NAME" \
    --budget-amount "$FUDI_MONTHLY_BUDGET_AMOUNT" --calendar-period month --filter-projects "projects/$PROJECT_ID" \
    --threshold-rule percent=0.5 --threshold-rule percent=0.9 --threshold-rule percent=1.0 \
    --threshold-rule percent=0.9,basis=forecasted-spend
fi
gcloud artifacts repositories describe "$REPO" --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "$REPO" --repository-format docker --location "$REGION" --project "$PROJECT_ID"

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT
git clone --depth 1 --recursive https://github.com/openwebwork/renderer.git "$TMP_ROOT/renderer"
RENDERER_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/renderer:latest"
docker build -f Dockerfile_with_OPL -t "$RENDERER_IMAGE" "$TMP_ROOT/renderer"
docker push "$RENDERER_IMAGE"
gcloud run deploy fudi-renderer --image "$RENDERER_IMAGE" --region "$REGION" --project "$PROJECT_ID" \
  --allow-unauthenticated --min 0 --max 2 --cpu 2 --memory 3Gi --concurrency 5 --port 3000
RENDERER_URL="$(gcloud run services describe fudi-renderer --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)')"

gcloud run deploy fudi-api --source . --region "$REGION" --project "$PROJECT_ID" \
  --allow-unauthenticated --min 0 --max 1 --cpu 1 --memory 512Mi --concurrency 1 --cpu-throttling \
  --set-env-vars "FUDI_RENDERER_ORIGIN=$RENDERER_URL,GEMINI_BILLING_TIER=disabled,FUDI_CLOUD_AI_ENABLED=false"
API_URL="$(gcloud run services describe fudi-api --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)')"
gcloud run services update fudi-api --region "$REGION" --project "$PROJECT_ID" --update-env-vars "FUDI_PUBLIC_API_URL=$API_URL"
echo "API URL: $API_URL"
echo "Renderer URL: $RENDERER_URL"
echo "Set this in api-config.js before publishing: window.FUDI_API_BASE = \"$API_URL\";"
echo "Cloud feedback remains disabled. Enable it only after paid Gemini billing and request-spend limits are configured."
