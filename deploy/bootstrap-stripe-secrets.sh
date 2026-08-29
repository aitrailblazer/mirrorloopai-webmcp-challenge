#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-mirrorloopai-com}"
READONLY_SECRET="${STRIPE_READONLY_KEY_SECRET_NAME:-mirrorloop-stripe-audit-readonly-key}"
SALT_SECRET="${STRIPE_AUDIT_HASH_SALT_SECRET_NAME:-mirrorloop-stripe-audit-hash-salt}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud is required." >&2
  exit 1
fi

read -r -s -p "Fresh Stripe restricted read-only key (rk_test_ or rk_live_): " stripe_key
printf '\n'

if [[ ! "$stripe_key" =~ ^rk_(test|live)_ ]]; then
  unset stripe_key
  echo "Refusing: use a restricted key beginning with rk_test_ or rk_live_." >&2
  exit 1
fi

for secret in "$READONLY_SECRET" "$SALT_SECRET"; do
  if ! gcloud secrets describe "$secret" --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud secrets create "$secret" \
      --project="$PROJECT_ID" \
      --replication-policy=automatic >/dev/null
  fi
done

printf '%s' "$stripe_key" \
  | gcloud secrets versions add "$READONLY_SECRET" \
      --project="$PROJECT_ID" \
      --data-file=- >/dev/null
unset stripe_key

openssl rand -base64 32 \
  | gcloud secrets versions add "$SALT_SECRET" \
      --project="$PROJECT_ID" \
      --data-file=- >/dev/null

echo "Stripe operator secrets stored in GCP Secret Manager project: $PROJECT_ID"
echo "No Stripe API key was written to this repository."
