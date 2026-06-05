#!/usr/bin/env bash
# Merge known keys from .env.local into .env.deploy.local and fill org IDs (no secrets printed).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_FILE="${DEPLOY_FILE:-$ROOT/.env.deploy.local}"
LOCAL_FILE="${LOCAL_FILE:-$ROOT/.env.local}"
EXAMPLE_FILE="$ROOT/.env.deploy.example"

# From MCP / dashboard discovery (non-secret)
DEFAULT_SUPABASE_ORG_ID="${DEFAULT_SUPABASE_ORG_ID:-gzxytepyoaoeertajuxu}"
DEFAULT_VERCEL_ORG_ID="${DEFAULT_VERCEL_ORG_ID:-team_Do6MIQ68MihHIXm3lYsipCsC}"

KEYS=(
  S3_ENDPOINT
  S3_BUCKET
  S3_ACCESS_KEY_ID
  S3_SECRET_ACCESS_KEY
  S3_REGION
  S3_PUBLIC_URL
  RESEND_API_KEY
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  AUTH_SECRET
)

[[ -f "$DEPLOY_FILE" ]] || cp "$EXAMPLE_FILE" "$DEPLOY_FILE"

get_val() {
  local file="$1" key="$2"
  grep -E "^${key}=" "$file" 2>/dev/null | head -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true
}

set_val() {
  local key="$1" val="$2"
  local quoted="$val"
  if [[ "$val" == *" "* || "$val" == *"#"* ]]; then
    quoted="\"${val//\"/\\\"}\""
  fi
  if grep -qE "^${key}=" "$DEPLOY_FILE" 2>/dev/null; then
    local tmp
    tmp="$(mktemp)"
    while IFS= read -r line; do
      if [[ "$line" =~ ^${key}= ]]; then
        echo "${key}=${quoted}"
      else
        echo "$line"
      fi
    done <"$DEPLOY_FILE" >"$tmp"
    mv "$tmp" "$DEPLOY_FILE"
  else
    echo "${key}=${quoted}" >>"$DEPLOY_FILE"
  fi
}

if [[ -f "$LOCAL_FILE" ]]; then
  for key in "${KEYS[@]}"; do
    current="$(get_val "$DEPLOY_FILE" "$key")"
    from_local="$(get_val "$LOCAL_FILE" "$key")"
    if [[ -z "$current" && -n "$from_local" ]]; then
      set_val "$key" "$from_local"
      echo "Synced $key from .env.local"
    fi
  done
fi

for pair in "SUPABASE_ORG_ID:$DEFAULT_SUPABASE_ORG_ID" "VERCEL_ORG_ID:$DEFAULT_VERCEL_ORG_ID"; do
  key="${pair%%:*}"
  default="${pair#*:}"
  current="$(get_val "$DEPLOY_FILE" "$key")"
  if [[ -z "$current" ]]; then
    set_val "$key" "$default"
    echo "Set $key (from MCP discovery)"
  fi
done

# Quote seed name if it contains spaces and is unquoted
seed_name="$(get_val "$DEPLOY_FILE" "SEED_TENANT_NAME")"
if [[ "$seed_name" == *" "* ]] && ! grep -qE '^SEED_TENANT_NAME="' "$DEPLOY_FILE"; then
  set_val "SEED_TENANT_NAME" "$seed_name"
  echo "Quoted SEED_TENANT_NAME"
fi

echo "Done. Run: pnpm ops:check-deploy"
