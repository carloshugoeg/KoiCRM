#!/usr/bin/env bash
# VERIFY-ONLY: refuse to load env that looks like production.
set -euo pipefail

guard_verify_env() {
  local env_file="${1:-}"

  if [[ -z "${KOICRM_VERIFY:-}" || "${KOICRM_VERIFY}" != "1" ]]; then
    echo "REFUSE: KOICRM_VERIFY=1 is required. This is not a production runner." >&2
    return 1
  fi

  if [[ "${NODE_ENV:-}" == "production" ]]; then
    echo "REFUSE: NODE_ENV=production. Verification only runs in development." >&2
    return 1
  fi

  local db_url="${DATABASE_URL:-}"
  local db_admin="${DATABASE_ADMIN_URL:-}"
  local auth_url="${AUTH_URL:-}"
  local s3_endpoint="${S3_ENDPOINT:-}"
  local s3_bucket="${S3_BUCKET:-}"

  if [[ -z "$db_url" || -z "$db_admin" ]]; then
    echo "REFUSE: DATABASE_URL and DATABASE_ADMIN_URL are required." >&2
    return 1
  fi

  # Host must be loopback.
  if ! echo "$db_url" | grep -Eqi '@(localhost|127\.0\.0\.1)(:|/)' ; then
    echo "REFUSE: DATABASE_URL host is not localhost/127.0.0.1." >&2
    return 1
  fi
  if ! echo "$db_admin" | grep -Eqi '@(localhost|127\.0\.0\.1)(:|/)' ; then
    echo "REFUSE: DATABASE_ADMIN_URL host is not localhost/127.0.0.1." >&2
    return 1
  fi

  # Dedicated verify DB name.
  if ! echo "$db_url" | grep -Eqi '/koicrm_verify(\?|$)' ; then
    echo "REFUSE: DATABASE_URL database name must be koicrm_verify." >&2
    return 1
  fi
  if ! echo "$db_admin" | grep -Eqi '/koicrm_verify(\?|$)' ; then
    echo "REFUSE: DATABASE_ADMIN_URL database name must be koicrm_verify." >&2
    return 1
  fi

  # Block known hosted / prod providers even if somehow rewritten.
  local blocked='neon\.tech|supabase\.co|amazonaws\.com|rds\.|azure\.com|railway\.app|render\.com|vercel-storage|prisma\.io|cloud\.google|digitalocean|planetscale|cockroachlabs|aivencloud'
  if echo "$db_url$db_admin" | grep -Eqi "$blocked"; then
    echo "REFUSE: DATABASE_* looks like a hosted/production provider." >&2
    return 1
  fi

  if [[ -z "$auth_url" ]] || ! echo "$auth_url" | grep -Eqi '^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?/?'; then
    echo "REFUSE: AUTH_URL must be http(s)://127.0.0.1 or localhost." >&2
    return 1
  fi

  if echo "$auth_url" | grep -Eqi 'koicrm\.vercel\.app|vercel\.app|https://[^/]*koi'; then
    echo "REFUSE: AUTH_URL looks like a deployed host." >&2
    return 1
  fi

  if [[ -z "$s3_bucket" ]] || ! echo "$s3_bucket" | grep -Eqi 'verify'; then
    echo "REFUSE: S3_BUCKET must contain 'verify' (local verify bucket only)." >&2
    return 1
  fi

  if echo "${s3_endpoint}" | grep -Eqi 'r2\.cloudflarestorage\.com|amazonaws\.com'; then
    echo "REFUSE: S3_ENDPOINT looks like production object storage." >&2
    return 1
  fi

  if [[ -n "$env_file" && ! -f "$env_file" ]]; then
    echo "REFUSE: env file missing: $env_file" >&2
    return 1
  fi

  echo "OK: verify env guards passed (db=koicrm_verify, auth=$auth_url, bucket=$s3_bucket)"
}
