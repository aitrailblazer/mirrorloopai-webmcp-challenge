#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID to the dedicated MirrorLoop GCP project.}"
SECRET_NAME="${STRIPE_CHECKOUT_SECRET_NAME:-mirrorloop-stripe-checkout-key}"

echo "Enter the Stripe restricted live key for MIRROR//LOOP checkout."
echo "Minimum dashboard permissions: Checkout Sessions Write; Products Read; Prices Read."
read -r -s -p "Stripe restricted key (rk_live_...): " STRIPE_KEY
echo

if [[ ! "$STRIPE_KEY" =~ ^rk_live_[A-Za-z0-9_]+$ ]]; then
  echo "Refusing: expected a Stripe restricted live key beginning with rk_live_." >&2
  exit 1
fi

if ! gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud secrets create "$SECRET_NAME" \
    --project="$PROJECT_ID" \
    --replication-policy=automatic >/dev/null
fi

printf '%s' "$STRIPE_KEY" |
  gcloud secrets versions add "$SECRET_NAME" \
    --project="$PROJECT_ID" \
    --data-file=- >/dev/null

unset STRIPE_KEY
echo "Added a new version to $SECRET_NAME. The key was not written to disk."
