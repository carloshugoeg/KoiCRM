#!/usr/bin/env bash
# Validates .env.deploy.local before ops:bootstrap (no cloud calls).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env.deploy.local}"

required=(
  SUPABASE_ORG_ID
  SUPABASE_DB_PASSWORD
  S3_ENDPOINT
  S3_ACCESS_KEY_ID
  S3_SECRET_ACCESS_KEY
  S3_PUBLIC_URL
  SEED_TENANT_NAME
  SEED_TENANT_SLUG
  SEED_ADMIN_EMAIL
  SEED_ADMIN_PASSWORD
  SEED_ADMIN_NAME
)

[[ -f "$ENV_FILE" ]] || {
  echo "Missing $ENV_FILE — copy from .env.deploy.example"
  exit 1
}

# shellcheck disable=SC1091
source "$ROOT/scripts/ops/load-env.sh"
load_env_file "$ENV_FILE"

missing=()
for k in "${required[@]}"; do
  if [[ -z "${!k:-}" ]]; then
    missing+=("$k")
  fi
done

missing_auth=()
if [[ -z "${VERCEL_TOKEN:-}" ]] && ! command -v vercel >/dev/null 2>&1 && [[ ! -x "$ROOT/node_modules/.bin/vercel" ]]; then
  missing_auth+=("VERCEL_TOKEN, or run: pnpm install && pnpm exec vercel login")
fi
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" && -z "${SUPABASE_PROJECT_REF:-}" ]]; then
  missing_auth+=("SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF")
fi

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Unset required keys in $ENV_FILE:"
  printf '  - %s\n' "${missing[@]}"
  echo "Tip: pnpm ops:sync-deploy-env copies R2/Resend/Google from .env.local"
  exit 1
fi

if [[ ${#missing_auth[@]} -gt 0 ]]; then
  echo "Missing auth (MCP/CLI — no need to paste tokens if logged in):"
  printf '  - %s\n' "${missing_auth[@]}"
  exit 1
fi

echo "OK: $ENV_FILE has all required keys for pnpm ops:bootstrap"
