#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID to the dedicated MirrorLoop GCP project.}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-mirrorloopai-subscriber}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_ACCOUNT="$SERVICE@$PROJECT_ID.iam.gserviceaccount.com"

gcloud run deploy "$SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --source="$ROOT" \
  --service-account="$SERVICE_ACCOUNT" \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=1 \
  --concurrency=40 \
  --cpu=1 \
  --memory=256Mi \
  --timeout=15s \
  --set-env-vars="^|^GOOGLE_CLOUD_PROJECT=$PROJECT_ID|MEMORY_STORE=false|LOG_EMAIL=false|CHALLENGE_REQUIRED=true|RESEND_INBOUND_ENABLED=true|PUBLIC_API_URL=https://mirrorloopai.com/api|CONFIRMED_URL=https://mirrorloopai.com/confirmed|ALLOWED_ORIGINS=https://mirrorloopai.com,https://www.mirrorloopai.com|FROM_EMAIL=MIRROR//LOOP <reflection@mirrorloopai.com>|REPLY_TO_EMAIL=constantine@aitrailblazer.com|ORDER_NOTIFICATION_EMAIL=constantine@aitrailblazer.com" \
  --set-secrets="TOKEN_SECRET=mirrorloop-token-secret:latest,SUBSCRIBER_ID_SECRET=mirrorloop-subscriber-id-secret:latest,RESEND_API_KEY=mirrorloop-resend-api-key:latest,RESEND_WEBHOOK_SECRET=mirrorloop-resend-webhook-secret:latest,RESEND_INBOUND_API_KEY=mirrorloop-resend-inbound-api-key:latest,TURNSTILE_SECRET=mirrorloop-turnstile-secret:latest,STRIPE_SECRET_KEY=mirrorloop-stripe-checkout-key:latest,STRIPE_WEBHOOK_SECRET=mirrorloop-stripe-webhook-secret:latest"

echo "Cloud Run deployed. Run firebase deploy --only hosting,firestore from $ROOT after configuring .firebaserc."
