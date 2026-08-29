#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID to a dedicated MirrorLoop GCP project.}"
: "${BILLING_ACCOUNT_ID:?Set BILLING_ACCOUNT_ID. GCP free tiers still require billing for Cloud Run.}"
: "${CONFIRM_GCP_BOOTSTRAP:?Set CONFIRM_GCP_BOOTSTRAP=mirrorloopai.com after reviewing the project and billing account.}"

if [[ "$CONFIRM_GCP_BOOTSTRAP" != "mirrorloopai.com" ]]; then
  echo "Refusing: confirmation must exactly equal mirrorloopai.com." >&2
  exit 1
fi

REGION="${REGION:-us-central1}"
SERVICE_ACCOUNT="mirrorloopai-subscriber"

gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT_ID"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  firebase.googleapis.com \
  --project="$PROJECT_ID"

if ! gcloud firestore databases describe --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud firestore databases create --location="$REGION" --type=firestore-native --project="$PROJECT_ID"
fi
gcloud firestore fields ttls update pendingExpiresAt \
  --collection-group=subscribers \
  --database='(default)' \
  --enable-ttl \
  --project="$PROJECT_ID"

if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SERVICE_ACCOUNT" \
    --display-name="MirrorLoop subscriber API" \
    --project="$PROJECT_ID"
fi

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/datastore.user" \
  --condition=None >/dev/null

SUBSCRIBER_SECRETS=(
  mirrorloop-token-secret
  mirrorloop-subscriber-id-secret
  mirrorloop-resend-api-key
  mirrorloop-resend-webhook-secret
  mirrorloop-resend-inbound-api-key
  mirrorloop-turnstile-secret
  mirrorloop-stripe-checkout-key
  mirrorloop-stripe-webhook-secret
)

for secret in "${SUBSCRIBER_SECRETS[@]}"; do
  if ! gcloud secrets describe "$secret" --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud secrets create "$secret" \
      --project="$PROJECT_ID" \
      --replication-policy=automatic >/dev/null
  fi
  gcloud secrets add-iam-policy-binding "$secret" \
    --project="$PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
done

if gcloud projects get-iam-policy "$PROJECT_ID" \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/secretmanager.secretAccessor AND bindings.members:serviceAccount:$SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com" \
  --format="value(bindings.role)" | grep -q .; then
  gcloud projects remove-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" \
    --condition=None >/dev/null
fi

echo "Bootstrap complete. Create the subscriber secrets described in docs before deploying."
echo "The checkout service requires a Stripe restricted key version in:"
echo "  mirrorloop-stripe-checkout-key"
echo "  mirrorloop-stripe-webhook-secret"
echo "Inbound catch-all forwarding also requires:"
echo "  mirrorloop-resend-webhook-secret"
echo "  mirrorloop-resend-inbound-api-key"
echo "Stripe audit secrets remain optional and operator-only:"
echo "  mirrorloop-stripe-audit-readonly-key"
echo "  mirrorloop-stripe-audit-hash-salt"
