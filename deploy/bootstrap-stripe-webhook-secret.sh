#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID to the dedicated MirrorLoop GCP project.}"
SECRET_NAME="${STRIPE_WEBHOOK_SECRET_NAME:-mirrorloop-stripe-webhook-secret}"

echo "Enter the Stripe signing secret for https://mirrorloopai.com/api/v1/stripe/webhook."
read -r -s -p "Stripe webhook secret (whsec_...): " WEBHOOK_SECRET
echo

if [[ ! "$WEBHOOK_SECRET" =~ ^whsec_[A-Za-z0-9_]+$ ]]; then
  echo "Refusing: expected a Stripe signing secret beginning with whsec_." >&2
  exit 1
fi

if ! gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud secrets create "$SECRET_NAME" \
    --project="$PROJECT_ID" \
    --replication-policy=automatic >/dev/null
fi

printf '%s' "$WEBHOOK_SECRET" |
  gcloud secrets versions add "$SECRET_NAME" \
    --project="$PROJECT_ID" \
    --data-file=- >/dev/null

unset WEBHOOK_SECRET
echo "Added a new version to $SECRET_NAME. The secret was not written to disk."
