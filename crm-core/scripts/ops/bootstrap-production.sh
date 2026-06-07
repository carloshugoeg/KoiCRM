#!/usr/bin/env bash
# One-shot production bootstrap: Supabase Postgres + Vercel deploy + first tenant.
# Prerequisites: cp .env.deploy.example .env.deploy.local and fill secrets.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

# Git monorepo root (KoiCRM/). Vercel project Root Directory is crm-core for GitHub deploys.
REPO_ROOT="$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null || echo "$ROOT")"

ENV_FILE="${ENV_FILE:-$ROOT/.env.deploy.local}"
STATE_FILE="${STATE_FILE:-$ROOT/bootstrap-state.json}"
VERCEL_TOKEN_ARG=()

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

log() { echo -e "${GREEN}==>${NC} $*"; }
die() { echo -e "${RED}ERROR:${NC} $*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing command: $1. Install it and retry."
}

load_env() {
  [[ -f "$ENV_FILE" ]] || die "Create $ENV_FILE from .env.deploy.example"
  # shellcheck disable=SC1091
  source "$ROOT/scripts/ops/load-env.sh"
  load_env_file "$ENV_FILE"
}

save_state() {
  local step="$1"
  shift
  local extra="${1:-}"
  if command -v jq >/dev/null 2>&1; then
    local base='{}'
    [[ -f "$STATE_FILE" ]] && base="$(cat "$STATE_FILE")"
    echo "$base" | jq --arg step "$step" --argjson extra "${extra:-null}" \
      '.last_step = $step | . + (if $extra != "null" then $extra else {} end)' >"$STATE_FILE"
  else
    echo "{\"last_step\":\"$step\"}" >"$STATE_FILE"
  fi
}

STEP_ORDER=(preflight supabase_project supabase_roles migrations vercel_env vercel_deploy auth_url seed verify)

step_index() {
  local step="$1"
  local i
  for i in "${!STEP_ORDER[@]}"; do
    [[ "${STEP_ORDER[$i]}" == "$step" ]] && echo "$i" && return 0
  done
  echo -1
}

should_run() {
  local step="$1"
  local last=""
  if [[ -f "$STATE_FILE" ]] && command -v jq >/dev/null 2>&1; then
    last="$(jq -r '.last_step // ""' "$STATE_FILE")"
  fi
  [[ -z "$last" ]] && return 0
  local last_i step_i
  last_i="$(step_index "$last")"
  step_i="$(step_index "$step")"
  [[ "$step_i" -gt "$last_i" ]]
}

set_deploy_env_key() {
  local key="$1" val="$2"
  local quoted="$val"
  if [[ "$val" == *" "* || "$val" == *"#"* || "$val" == *"."* ]]; then
    quoted="\"${val//\"/\\\"}\""
  fi
  if grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
    local tmp
    tmp="$(mktemp)"
    while IFS= read -r line || [[ -n "$line" ]]; do
      if [[ "$line" =~ ^${key}= ]]; then
        echo "${key}=${quoted}"
      else
        echo "$line"
      fi
    done <"$ENV_FILE" >"$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    echo "${key}=${quoted}" >>"$ENV_FILE"
  fi
}

load_role_passwords() {
  if [[ -f "$STATE_FILE" ]] && command -v jq >/dev/null 2>&1; then
    [[ -n "${APP_USER_PASSWORD:-}" ]] || \
      APP_USER_PASSWORD="$(jq -r '.app_user_password // empty' "$STATE_FILE")"
    [[ -n "${ADMIN_USER_PASSWORD:-}" ]] || \
      ADMIN_USER_PASSWORD="$(jq -r '.admin_user_password // empty' "$STATE_FILE")"
  fi
}

save_role_passwords() {
  export APP_USER_PASSWORD ADMIN_USER_PASSWORD
  set_deploy_env_key APP_USER_PASSWORD "$APP_USER_PASSWORD"
  set_deploy_env_key ADMIN_USER_PASSWORD "$ADMIN_USER_PASSWORD"
  if [[ -f "$STATE_FILE" ]] && command -v jq >/dev/null 2>&1; then
    local base='{}'
    [[ -f "$STATE_FILE" ]] && base="$(cat "$STATE_FILE")"
    echo "$base" | jq \
      --arg app "$APP_USER_PASSWORD" \
      --arg admin "$ADMIN_USER_PASSWORD" \
      '.app_user_password = $app | .admin_user_password = $admin' >"$STATE_FILE"
  fi
}

apply_supabase_roles_sql() {
  escape_sed() { printf '%s' "$1" | sed -e 's/[\/&]/\\&/g' -e "s/'/''/g"; }
  local sql_tmp
  sql_tmp="$(mktemp)"
  sed -e "s/__APP_USER_PASSWORD__/$(escape_sed "$APP_USER_PASSWORD")/g" \
    -e "s/__ADMIN_USER_PASSWORD__/$(escape_sed "$ADMIN_USER_PASSWORD")/g" \
    "$ROOT/scripts/ops/init-supabase.sql" >"$sql_tmp"
  execute_sql_file "$sql_tmp" "$POSTGRES_URL"
  rm -f "$sql_tmp"
}

ensure_role_passwords() {
  load_role_passwords
  local generated=0
  if [[ -z "${APP_USER_PASSWORD:-}" ]]; then
    APP_USER_PASSWORD="$(rand_password)"
    generated=1
  fi
  if [[ -z "${ADMIN_USER_PASSWORD:-}" ]]; then
    ADMIN_USER_PASSWORD="$(rand_password)"
    generated=1
  fi
  export APP_USER_PASSWORD ADMIN_USER_PASSWORD

  if [[ "$generated" -eq 1 ]]; then
    log "Generated DB role passwords (persisting to $ENV_FILE and bootstrap-state.json)"
    save_role_passwords
    local last=""
    if [[ -f "$STATE_FILE" ]]; then
      last="$(jq -r '.last_step // ""' "$STATE_FILE" 2>/dev/null || true)"
    fi
    if [[ -n "$last" ]] && [[ "$(step_index "$last")" -ge "$(step_index supabase_roles)" ]]; then
      log "Syncing app_user/admin_user passwords in Supabase (resume after roles step)"
      ENC_PASS="$(urlencode "$SUPABASE_DB_PASSWORD")"
      export POSTGRES_URL="postgresql://postgres:${ENC_PASS}@db.${SUPABASE_PROJECT_REF}.supabase.co:5432/postgres"
      apply_supabase_roles_sql
    fi
  fi
}

pooler_host_candidates() {
  if [[ -n "${SUPABASE_POOLER_HOST:-}" ]]; then
    echo "$SUPABASE_POOLER_HOST"
    return
  fi
  case "${SUPABASE_REGION:-us-east-1}" in
    us-east-1) echo "aws-0-us-east-1.pooler.supabase.com aws-1-us-east-1.pooler.supabase.com" ;;
    us-west-1) echo "aws-0-us-west-1.pooler.supabase.com aws-1-us-west-1.pooler.supabase.com" ;;
    eu-west-1) echo "aws-0-eu-west-1.pooler.supabase.com aws-1-eu-west-1.pooler.supabase.com" ;;
    eu-central-1) echo "aws-0-eu-central-1.pooler.supabase.com aws-1-eu-central-1.pooler.supabase.com" ;;
    ap-southeast-1) echo "aws-0-ap-southeast-1.pooler.supabase.com aws-1-ap-southeast-1.pooler.supabase.com" ;;
    *)
      die "Unknown SUPABASE_REGION=$SUPABASE_REGION — set SUPABASE_POOLER_HOST from Supabase Dashboard"
      ;;
  esac
}

# Logs inside $() must go to stderr — stdout is only the return value.
probe_pooler_url() {
  local url="$1"
  run_with_timeout 15 pnpm exec prisma db execute --url "$url" --stdin <<< "SELECT 1;" >/dev/null 2>&1
}

# Shared Supavisor pooler is IPv4-compatible (required for Vercel). Host varies (aws-0 vs aws-1).
# Echoes "hostname:port" on stdout (logs go to stderr; port is lost if set only in this subshell).
detect_pooler_host() {
  local ref="$1" enc_pass="$2" host url port

  if [[ -z "${SUPABASE_POOLER_HOST:-}" && -f "$STATE_FILE" ]] && command -v jq >/dev/null 2>&1; then
    local cached cached_port
    cached="$(jq -r '.supabase_pooler_host // empty' "$STATE_FILE")"
    cached_port="$(jq -r '.supabase_pooler_port // "6543"' "$STATE_FILE")"
    if [[ -n "$cached" ]]; then
      log "  → using cached pooler: ${cached}:${cached_port}" >&2
      echo "${cached}:${cached_port}"
      return 0
    fi
  fi

  if [[ -n "${SUPABASE_POOLER_HOST:-}" ]]; then
    log "  → probing SUPABASE_POOLER_HOST from $ENV_FILE" >&2
  else
    log "Detecting Supabase pooler host (~30s; set SUPABASE_POOLER_HOST to skip)" >&2
  fi

  for host in $(pooler_host_candidates); do
    log "  → trying pooler: $host:6543 (transaction)" >&2
    url="postgresql://postgres.${ref}:${enc_pass}@${host}:6543/postgres?pgbouncer=true&sslmode=require&connect_timeout=5"
    if probe_pooler_url "$url"; then
      log "  → pooler OK: $host:6543" >&2
      cache_pooler_host "$host" "6543"
      echo "${host}:6543"
      return 0
    fi
    log "  → trying pooler: $host:5432 (session)" >&2
    url="postgresql://postgres.${ref}:${enc_pass}@${host}:5432/postgres?sslmode=require&connect_timeout=5"
    if probe_pooler_url "$url"; then
      log "  → pooler OK: $host:5432 (session)" >&2
      cache_pooler_host "$host" "5432"
      echo "${host}:5432"
      return 0
    fi
    log "  → pooler unreachable: $host" >&2
  done

  if [[ -n "${SUPABASE_POOLER_HOST:-}" ]]; then
    log "  → WARN: pooler probe failed; using $SUPABASE_POOLER_HOST:5432 (session) from $ENV_FILE" >&2
    echo "${SUPABASE_POOLER_HOST}:5432"
    return 0
  fi

  echo "Supabase pooler unreachable — paste Transaction pooler URI as SUPABASE_DATABASE_URL in $ENV_FILE" >&2
  return 1
}

cache_pooler_host() {
  local host="$1" port="$2"
  if command -v jq >/dev/null 2>&1 && [[ -f "$STATE_FILE" ]]; then
    local base='{}'
    [[ -f "$STATE_FILE" ]] && base="$(cat "$STATE_FILE")"
    echo "$base" | jq --arg h "$host" --arg p "$port" \
      '.supabase_pooler_host = $h | .supabase_pooler_port = $p' >"$STATE_FILE"
  fi
}

compute_db_urls() {
  REF="${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF required}"
  ensure_role_passwords
  ENC_APP="$(urlencode "$APP_USER_PASSWORD")"
  ENC_ADMIN="$(urlencode "$ADMIN_USER_PASSWORD")"
  ENC_PASS="$(urlencode "$SUPABASE_DB_PASSWORD")"

  if [[ -n "${SUPABASE_DATABASE_URL:-}" ]]; then
    log "  → using SUPABASE_DATABASE_URL from $ENV_FILE"
    export DATABASE_URL="$SUPABASE_DATABASE_URL"
    export DATABASE_SET_ROLE="app_user"
  else
    local pooler_result
    pooler_result="$(detect_pooler_host "$REF" "$ENC_PASS")" || die "Supabase pooler unreachable — set SUPABASE_DATABASE_URL or SUPABASE_POOLER_HOST in $ENV_FILE"
    POOLER_HOST="${pooler_result%:*}"
    SUPABASE_POOLER_PORT="${pooler_result##*:}"
    log "  → Supabase pooler: ${POOLER_HOST}:${SUPABASE_POOLER_PORT} (IPv4 / Vercel-safe)"
    if [[ "$SUPABASE_POOLER_PORT" == "5432" ]]; then
      export DATABASE_URL="postgresql://postgres.${REF}:${ENC_PASS}@${POOLER_HOST}:5432/postgres?sslmode=require&connect_timeout=10&pool_timeout=30&connection_limit=1"
    else
      export DATABASE_URL="postgresql://postgres.${REF}:${ENC_PASS}@${POOLER_HOST}:6543/postgres?pgbouncer=true&sslmode=require&connect_timeout=10&pool_timeout=30&connection_limit=1"
    fi
    export DATABASE_SET_ROLE="app_user"
  fi
  # Migrations/seeds: direct host — port 5432, no pooler (Prisma migrate)
  export DATABASE_ADMIN_URL="postgresql://admin_user:${ENC_ADMIN}@db.${REF}.supabase.co:5432/postgres"
  # One-time role setup: postgres superuser, direct
  export POSTGRES_URL="postgresql://postgres:${ENC_PASS}@db.${REF}.supabase.co:5432/postgres"
}

rand_password() {
  openssl rand -base64 24 | tr -d '/+=' | head -c 32
}

urlencode() {
  python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1"
}

# Run SQL file against POSTGRES_URL (psql if installed, else Prisma db execute).
execute_sql_file() {
  local sql_file="$1"
  local db_url="$2"
  if command -v psql >/dev/null 2>&1; then
    psql "$db_url" -v ON_ERROR_STOP=1 -f "$sql_file"
  else
    log "psql not found — using: pnpm exec prisma db execute"
    pnpm exec prisma db execute --file "$sql_file" --url "$db_url"
  fi
}

# Run command in background; kill after $1 seconds (macOS has no GNU timeout).
run_with_timeout() {
  local max_secs="$1"
  shift
  "$@" &
  local pid=$!
  local elapsed=0
  while kill -0 "$pid" 2>/dev/null && [[ "$elapsed" -lt "$max_secs" ]]; do
    sleep 1
    elapsed=$((elapsed + 1))
  done
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null
    wait "$pid" 2>/dev/null || true
    return 124
  fi
  wait "$pid"
}

# Prefer project-pinned vercel (package.json); fall back to global CLI.
vercel_bin() {
  if [[ -x "$ROOT/node_modules/.bin/vercel" ]]; then
    echo "$ROOT/node_modules/.bin/vercel"
  elif command -v vercel >/dev/null 2>&1; then
    echo "vercel"
  else
    echo ""
  fi
}

# ─── Preflight ────────────────────────────────────────────────────────────────
preflight() {
  should_run preflight || return 0
  log "Preflight checks"

  log "  → local tools (pnpm, openssl, curl, python3, jq)"
  require_cmd pnpm
  require_cmd openssl
  require_cmd curl
  require_cmd python3
  require_cmd jq

  log "  → required env vars"
  : "${SUPABASE_DB_PASSWORD:?Set SUPABASE_DB_PASSWORD in $ENV_FILE}"
  : "${SUPABASE_PROJECT_REF:?Set SUPABASE_PROJECT_REF in $ENV_FILE}"
  : "${S3_ENDPOINT:?Set S3_* in $ENV_FILE}"
  : "${S3_ACCESS_KEY_ID:?Set S3_ACCESS_KEY_ID}"
  : "${S3_SECRET_ACCESS_KEY:?Set S3_SECRET_ACCESS_KEY}"
  : "${S3_PUBLIC_URL:?Set S3_PUBLIC_URL}"
  : "${SEED_TENANT_NAME:?Set SEED_TENANT_NAME}"
  : "${SEED_TENANT_SLUG:?Set SEED_TENANT_SLUG}"
  : "${SEED_ADMIN_EMAIL:?Set SEED_ADMIN_EMAIL}"
  : "${SEED_ADMIN_PASSWORD:?Set SEED_ADMIN_PASSWORD}"
  : "${SEED_ADMIN_NAME:?Set SEED_ADMIN_NAME}"
  [[ ${#SUPABASE_DB_PASSWORD} -ge 12 ]] || die "SUPABASE_DB_PASSWORD must be at least 12 characters"

  log "  → Supabase project ref: ${SUPABASE_PROJECT_REF}"
  if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    log "  → Supabase: no API token (OK — using SUPABASE_PROJECT_REF + postgres password)"
  fi

  if [[ -d node_modules/.pnpm ]] && [[ -x "$ROOT/node_modules/.bin/vercel" ]]; then
    log "  → dependencies already installed (skip pnpm install)"
  else
    log "  → pnpm install (includes vercel CLI; first run can take 1–2 min)..."
    pnpm install --frozen-lockfile
  fi

  log "  → Vercel auth"
  local vc
  vc="$(vercel_bin)"
  if [[ -n "${VERCEL_TOKEN:-}" ]]; then
    [[ -n "$vc" ]] || die "Run pnpm install first (vercel CLI missing)"
    VERCEL_TOKEN_ARG=(--token "$VERCEL_TOKEN")
    vercel_cmd whoami >/dev/null 2>&1 || die "Invalid VERCEL_TOKEN"
    log "  → Vercel: using VERCEL_TOKEN from $ENV_FILE"
  elif [[ -n "$vc" ]]; then
    VERCEL_TOKEN_ARG=()
    if ! run_with_timeout 25 "$vc" whoami >/dev/null 2>&1; then
      die "Vercel auth failed — run: pnpm exec vercel login  (or set VERCEL_TOKEN in $ENV_FILE)"
    fi
    log "  → Vercel: CLI session OK"
  else
    die "Run: pnpm install && pnpm exec vercel login  (or set VERCEL_TOKEN in $ENV_FILE)"
  fi

  log "Preflight OK"
  save_state preflight
}

init_vercel_token_arg() {
  if [[ ${#VERCEL_TOKEN_ARG[@]} -eq 0 && -n "${VERCEL_TOKEN:-}" ]]; then
    VERCEL_TOKEN_ARG=(--token "$VERCEL_TOKEN")
  fi
}

ensure_vercel_project_ids() {
  if [[ -f "$ROOT/.vercel/project.json" ]]; then
    [[ -n "${VERCEL_PROJECT_ID:-}" ]] || \
      VERCEL_PROJECT_ID="$(jq -r '.projectId // empty' "$ROOT/.vercel/project.json")"
    [[ -n "${VERCEL_ORG_ID:-}" ]] || \
      VERCEL_ORG_ID="$(jq -r '.orgId // empty' "$ROOT/.vercel/project.json")"
    export VERCEL_PROJECT_ID VERCEL_ORG_ID
  fi
}

# Deploy from monorepo root so Vercel Root Directory (crm-core) does not become crm-core/crm-core.
vercel_run_deploy() {
  ensure_vercel_project_ids
  local args=(deploy --prod "$@")
  if [[ "$REPO_ROOT" != "$ROOT" ]]; then
    log "  → deploying from repo root: $REPO_ROOT (Vercel Root Directory: crm-core)"
  fi
  (cd "$REPO_ROOT" && vercel_cmd "${args[@]}")
}

vercel_cmd() {
  init_vercel_token_arg
  local args=("$@")
  if [[ ${#VERCEL_TOKEN_ARG[@]} -gt 0 ]]; then
    args+=("${VERCEL_TOKEN_ARG[@]}")
  fi
  local vc
  vc="$(vercel_bin)"
  [[ -n "$vc" ]] || die "Vercel CLI not found — run: pnpm install"
  # .env.deploy.local exports VERCEL_ORG_ID; CLI errors unless VERCEL_PROJECT_ID is also set.
  if [[ -n "${VERCEL_ORG_ID:-}" && -z "${VERCEL_PROJECT_ID:-}" ]]; then
    env -u VERCEL_ORG_ID -u VERCEL_PROJECT_ID "$vc" "${args[@]}"
  else
    "$vc" "${args[@]}"
  fi
}

ensure_vercel_linked() {
  local project="${VERCEL_PROJECT_NAME:-koi-crm}"
  local team="${VERCEL_ORG_ID:-}"

  if [[ -f "$ROOT/.vercel/project.json" ]]; then
    log "  → Vercel project already linked"
    return 0
  fi

  local link_args=(--yes --project "$project")
  [[ -n "$team" ]] && link_args+=(--scope "$team")

  log "  → Linking Vercel project: $project (may take ~15s)"
  if ! vercel_cmd link "${link_args[@]}"; then
    log "  → Creating Vercel project: $project"
    local create_args=(project add "$project")
    [[ -n "$team" ]] && create_args+=(--scope "$team")
    vercel_cmd "${create_args[@]}" || true
    vercel_cmd link "${link_args[@]}"
  fi

  [[ -f "$ROOT/.vercel/project.json" ]] || die "Vercel link failed — check VERCEL_TOKEN and VERCEL_ORG_ID"
}

# ─── Supabase project ─────────────────────────────────────────────────────────
supabase_project() {
  should_run supabase_project || return 0
  log "Supabase project"

  export SUPABASE_ACCESS_TOKEN
  PROJECT_NAME="${SUPABASE_PROJECT_NAME:-koi-crm-prod}"

  if [[ -z "${SUPABASE_ORG_ID:-}" ]]; then
    if command -v supabase >/dev/null 2>&1; then
      SUPABASE_ORG_ID="$(supabase orgs list -o json 2>/dev/null | jq -r '.[0].id // empty')" || true
    fi
    if [[ -z "${SUPABASE_ORG_ID:-}" ]]; then
      SUPABASE_ORG_ID="$(curl -sS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
        "https://api.supabase.com/v1/organizations" | jq -r '.[0].id // empty')"
    fi
    [[ -n "${SUPABASE_ORG_ID:-}" ]] || die "Set SUPABASE_ORG_ID in $ENV_FILE"
  fi

  if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
    if command -v supabase >/dev/null 2>&1; then
      log "Creating Supabase project: $PROJECT_NAME"
      out="$(supabase projects create "$PROJECT_NAME" \
        --org-id "$SUPABASE_ORG_ID" \
        --db-password "$SUPABASE_DB_PASSWORD" \
        --region "${SUPABASE_REGION:-us-east-1}" \
        -o json 2>&1)" || die "supabase projects create failed: $out"
      SUPABASE_PROJECT_REF="$(echo "$out" | jq -r '.id // .ref // empty')"
    else
      log "Creating Supabase project via API: $PROJECT_NAME"
      resp="$(curl -sS -X POST "https://api.supabase.com/v1/projects" \
        -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"organization_id\":\"$SUPABASE_ORG_ID\",\"name\":\"$PROJECT_NAME\",\"db_pass\":\"$SUPABASE_DB_PASSWORD\",\"region\":\"${SUPABASE_REGION:-us-east-1}\"}")"
      SUPABASE_PROJECT_REF="$(echo "$resp" | jq -r '.id // empty')"
      [[ -n "$SUPABASE_PROJECT_REF" ]] || die "Supabase project create failed: $resp"
    fi
    log "Waiting for Supabase project to become active..."
    for _ in $(seq 1 60); do
      status="$(curl -sS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
        "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF" | jq -r '.status // empty')"
      [[ "$status" == "ACTIVE_HEALTHY" ]] && break
      sleep 10
    done
    [[ "$status" == "ACTIVE_HEALTHY" ]] || die "Supabase project not healthy after wait (status=$status)"
  else
    log "Reusing SUPABASE_PROJECT_REF=$SUPABASE_PROJECT_REF"
  fi

  export SUPABASE_PROJECT_REF
  compute_db_urls
  set_deploy_env_key SUPABASE_PROJECT_REF "$SUPABASE_PROJECT_REF"
  save_role_passwords

  save_state supabase_project "{\"supabase_project_ref\":\"$SUPABASE_PROJECT_REF\",\"app_user_password\":\"$APP_USER_PASSWORD\",\"admin_user_password\":\"$ADMIN_USER_PASSWORD\"}"
}

supabase_roles() {
  should_run supabase_roles || return 0
  log "Creating Postgres roles (app_user / admin_user)"
  compute_db_urls
  apply_supabase_roles_sql
  save_role_passwords
  save_state supabase_roles "{\"app_user_password\":\"$APP_USER_PASSWORD\",\"admin_user_password\":\"$ADMIN_USER_PASSWORD\"}"
}

migrations() {
  should_run migrations || return 0
  log "Prisma migrate deploy"
  compute_db_urls
  DATABASE_URL="$DATABASE_ADMIN_URL" pnpm exec prisma migrate deploy
  save_state migrations
}

vercel_env_push() {
  local key="$1"
  local value="$2"
  printf '%s' "$value" | vercel_cmd env add "$key" production --force
}

# Prefer stable Vercel "Aliased" domain from deploy output (e.g. koicrm.vercel.app).
# Project name (koi-crm) often differs from the production *.vercel.app alias.
extract_production_url() {
  local deploy_out="$1"
  local url
  url="$(echo "$deploy_out" | grep -i 'Aliased' | grep -Eo 'https://[a-zA-Z0-9.-]+\.vercel\.app' | head -1)"
  if [[ -n "$url" ]]; then
    echo "$url"
    return 0
  fi
  # Skip per-deployment preview URLs (…-team-projects-….vercel.app)
  url="$(echo "$deploy_out" | grep -Eo 'https://[a-zA-Z0-9.-]+\.vercel\.app' \
    | grep -vE -- '-[a-z0-9]+-[^/]*-projects-' | tail -1)"
  if [[ -n "$url" ]]; then
    echo "$url"
    return 0
  fi
  echo ""
}

resolve_production_url() {
  if [[ -n "${AUTH_URL:-}" ]]; then
    echo "$AUTH_URL"
    return 0
  fi
  if [[ -n "${PRODUCTION_URL:-}" ]]; then
    echo "$PRODUCTION_URL"
    return 0
  fi
  if [[ -f "$STATE_FILE" ]] && command -v jq >/dev/null 2>&1; then
    local saved
    saved="$(jq -r '.production_url // empty' "$STATE_FILE")"
    if [[ -n "$saved" ]]; then
      echo "$saved"
      return 0
    fi
  fi
  echo ""
}

# Next.js production build validates AUTH_URL at compile time (lib/startup-check.ts).
# Use a stable placeholder before the first deploy; auth_url() updates after deploy.
bootstrap_auth_url() {
  local resolved
  resolved="$(resolve_production_url)"
  if [[ -n "$resolved" ]]; then
    echo "$resolved"
    return 0
  fi
  echo "https://${VERCEL_PROJECT_NAME:-koi-crm}.vercel.app"
}

vercel_env() {
  should_run vercel_env || return 0
  log "Pushing environment variables to Vercel"
  compute_db_urls

  ensure_vercel_linked

  AUTH_SECRET="${AUTH_SECRET:-$(openssl rand -base64 32)}"
  export AUTH_SECRET

  vercel_env_push DATABASE_URL "$DATABASE_URL"
  vercel_env_push DATABASE_SET_ROLE "${DATABASE_SET_ROLE:-app_user}"
  vercel_env_push DATABASE_ADMIN_URL "$DATABASE_ADMIN_URL"
  vercel_env_push AUTH_SECRET "$AUTH_SECRET"
  vercel_env_push S3_ENDPOINT "$S3_ENDPOINT"
  vercel_env_push S3_BUCKET "${S3_BUCKET:-koicrm-uploads}"
  vercel_env_push S3_ACCESS_KEY_ID "$S3_ACCESS_KEY_ID"
  vercel_env_push S3_SECRET_ACCESS_KEY "$S3_SECRET_ACCESS_KEY"
  vercel_env_push S3_REGION "${S3_REGION:-auto}"
  vercel_env_push S3_PUBLIC_URL "$S3_PUBLIC_URL"
  vercel_env_push NODE_ENV production
  vercel_env_push LOG_LEVEL error

  local auth_url_value
  auth_url_value="$(bootstrap_auth_url)"
  if [[ -z "${AUTH_URL:-}" ]]; then
    log "  → AUTH_URL placeholder for first build: $auth_url_value (updated after deploy)"
  fi
  vercel_env_push AUTH_URL "$auth_url_value"
  vercel_env_push NEXT_PUBLIC_APP_URL "$auth_url_value"

  if [[ -n "${GOOGLE_CLIENT_ID:-}" ]]; then
    vercel_env_push GOOGLE_CLIENT_ID "$GOOGLE_CLIENT_ID"
    vercel_env_push GOOGLE_CLIENT_SECRET "${GOOGLE_CLIENT_SECRET:-}"
  fi

  save_state vercel_env
}

ensure_vercel_auth_url_for_build() {
  local auth_url_value
  auth_url_value="$(bootstrap_auth_url)"
  if [[ -z "${AUTH_URL:-}" ]]; then
    log "  → ensuring AUTH_URL on Vercel for production build: $auth_url_value"
  fi
  vercel_env_push AUTH_URL "$auth_url_value"
  vercel_env_push NEXT_PUBLIC_APP_URL "$auth_url_value"
}

vercel_deploy() {
  should_run vercel_deploy || return 0
  ensure_vercel_linked
  ensure_vercel_auth_url_for_build
  log "Vercel production deploy (upload + remote build; often 3–8 min)"
  local deploy_log
  deploy_log="$(mktemp)"
  if ! vercel_run_deploy 2>&1 | tee "$deploy_log"; then
    rm -f "$deploy_log"
    die "vercel deploy failed (output above)"
  fi
  DEPLOY_OUT="$(cat "$deploy_log")"
  rm -f "$deploy_log"
  PRODUCTION_URL="$(extract_production_url "$DEPLOY_OUT")"
  [[ -n "$PRODUCTION_URL" ]] || PRODUCTION_URL="$(resolve_production_url)"
  [[ -n "$PRODUCTION_URL" ]] || die "Could not detect production URL from deploy output (set AUTH_URL in $ENV_FILE)"
  export PRODUCTION_URL
  log "Production URL: $PRODUCTION_URL"
  save_state vercel_deploy "{\"production_url\":\"$PRODUCTION_URL\"}"
}

auth_url() {
  should_run auth_url || return 0
  if [[ -n "${AUTH_URL:-}" ]]; then
    save_state auth_url
    return 0
  fi
  PRODUCTION_URL="${PRODUCTION_URL:-}"
  if [[ -z "$PRODUCTION_URL" && -f "$STATE_FILE" ]]; then
    PRODUCTION_URL="$(jq -r '.production_url // empty' "$STATE_FILE")"
  fi
  [[ -n "$PRODUCTION_URL" ]] || die "Missing production URL for AUTH_URL"
  log "Setting AUTH_URL=$PRODUCTION_URL"
  vercel_env_push AUTH_URL "$PRODUCTION_URL"
  vercel_env_push NEXT_PUBLIC_APP_URL "$PRODUCTION_URL"
  AUTH_URL="$PRODUCTION_URL"
  vercel_run_deploy >/dev/null
  save_state auth_url "{\"production_url\":\"$PRODUCTION_URL\"}"
}

seed_tenant() {
  should_run seed || return 0
  log "Seeding first tenant"
  compute_db_urls
  AUTH_URL="${AUTH_URL:-${PRODUCTION_URL:-}}"
  [[ -n "$AUTH_URL" ]] || AUTH_URL="$(jq -r '.production_url // empty' "$STATE_FILE" 2>/dev/null)"
  DATABASE_ADMIN_URL="$DATABASE_ADMIN_URL" \
  AUTH_URL="$AUTH_URL" \
  pnpm exec tsx scripts/seed-tenant.ts \
    --name "$SEED_TENANT_NAME" \
    --slug "$SEED_TENANT_SLUG" \
    --admin-name "$SEED_ADMIN_NAME" \
    --admin-email "$SEED_ADMIN_EMAIL" \
    --admin-password "$SEED_ADMIN_PASSWORD"
  save_state seed
}

verify_health() {
  should_run verify || return 0
  log "Final verify: pooler DATABASE_URL + redeploy + health check"
  ensure_vercel_linked
  log "Resolving Supabase DATABASE_URL for Vercel (shared pooler)..."
  compute_db_urls
  log "Ensuring postgres can SET ROLE app_user (pooler runtime)"
  printf '%s\n' "GRANT app_user TO postgres;" | pnpm exec prisma db execute --stdin --url "$POSTGRES_URL" >/dev/null 2>&1 || true
  log "Syncing DATABASE_URL to Vercel (Supabase shared pooler + SET ROLE app_user)"
  vercel_env_push DATABASE_URL "$DATABASE_URL"
  vercel_env_push DATABASE_SET_ROLE "${DATABASE_SET_ROLE:-app_user}"
  log "Redeploying production (required for env var changes)"
  local deploy_log
  deploy_log="$(mktemp)"
  vercel_run_deploy 2>&1 | tee "$deploy_log"
  PRODUCTION_URL="$(extract_production_url "$(cat "$deploy_log")")"
  rm -f "$deploy_log"
  [[ -n "$PRODUCTION_URL" ]] || PRODUCTION_URL="$(resolve_production_url)"
  [[ -n "$PRODUCTION_URL" ]] || die "No production URL for health check (set AUTH_URL=https://koicrm.vercel.app in $ENV_FILE)"

  if [[ "${AUTH_URL:-}" != "$PRODUCTION_URL" ]]; then
    log "Syncing AUTH_URL to production alias: $PRODUCTION_URL"
    vercel_env_push AUTH_URL "$PRODUCTION_URL"
    vercel_env_push NEXT_PUBLIC_APP_URL "$PRODUCTION_URL"
    AUTH_URL="$PRODUCTION_URL"
    save_state auth_url "{\"production_url\":\"$PRODUCTION_URL\"}"
  fi

  URL="$PRODUCTION_URL"
  log "Health check: $URL/api/health"
  for _ in $(seq 1 12); do
    body="$(curl -sS "$URL/api/health" 2>/dev/null || true)"
    if echo "$body" | grep -q '"db":"ok"'; then
      log "Health OK"
      save_state verify
      print_post_deploy "$URL"
      return 0
    fi
    sleep 10
  done
  die "Health check failed after retries. Response: $body"
}

print_post_deploy() {
  local url="$1"
  echo ""
  echo "══════════════════════════════════════════════════════════════"
  echo " Bootstrap complete"
  echo " App:        $url"
  echo " Sign-in:    $url/signin"
  echo " Pipeline:   $url/app/${SEED_TENANT_SLUG}/pipeline"
  echo ""
  echo " Manual follow-ups:"
  echo " 1. R2 CORS — see docs/ops/r2-production.md (include $url and https://*.vercel.app)"
  echo " 2. Resend — verify sending domain DNS at resend.com/domains"
  echo "══════════════════════════════════════════════════════════════"
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
  load_env
  preflight
  supabase_project
  supabase_roles
  migrations
  vercel_env
  vercel_deploy
  auth_url
  seed_tenant
  verify_health
}

main "$@"
