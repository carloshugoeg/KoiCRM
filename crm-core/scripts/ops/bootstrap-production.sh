#!/usr/bin/env bash
# One-shot production bootstrap: Supabase Postgres + Vercel deploy + first tenant.
# Prerequisites: cp .env.deploy.example .env.deploy.local and fill secrets.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

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

compute_db_urls() {
  REF="${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF required}"
  APP_USER_PASSWORD="${APP_USER_PASSWORD:?APP_USER_PASSWORD required}"
  ADMIN_USER_PASSWORD="${ADMIN_USER_PASSWORD:?ADMIN_USER_PASSWORD required}"
  POOLER="$(pooler_host)"
  ENC_APP="$(urlencode "$APP_USER_PASSWORD")"
  ENC_ADMIN="$(urlencode "$ADMIN_USER_PASSWORD")"
  ENC_PASS="$(urlencode "$SUPABASE_DB_PASSWORD")"
  # App runtime (Vercel): transaction pooler — port 6543, user projectref suffix
  export DATABASE_URL="postgresql://app_user.${REF}:${ENC_APP}@${POOLER}:6543/postgres?pgbouncer=true&connect_timeout=10"
  # Migrations/seeds: direct host — port 5432, no pooler (Prisma migrate)
  export DATABASE_ADMIN_URL="postgresql://admin_user:${ENC_ADMIN}@db.${REF}.supabase.co:5432/postgres"
  # One-time role setup: postgres superuser, direct
  export POSTGRES_URL="postgresql://postgres:${ENC_PASS}@db.${REF}.supabase.co:5432/postgres"
}

rand_password() {
  openssl rand -base64 24 | tr -d '/+=' | head -c 32
}

pooler_host() {
  case "${SUPABASE_REGION:-us-east-1}" in
    us-east-1) echo "aws-0-us-east-1.pooler.supabase.com" ;;
    us-west-1) echo "aws-0-us-west-1.pooler.supabase.com" ;;
    eu-west-1) echo "aws-0-eu-west-1.pooler.supabase.com" ;;
    eu-central-1) echo "aws-0-eu-central-1.pooler.supabase.com" ;;
    ap-southeast-1) echo "aws-0-ap-southeast-1.pooler.supabase.com" ;;
    *)
      die "Unknown SUPABASE_REGION=$SUPABASE_REGION — add mapping in pooler_host()"
      ;;
  esac
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

# Prefer global vercel, else pnpm devDependency (see package.json).
vercel_bin() {
  if command -v vercel >/dev/null 2>&1; then
    echo "vercel"
  elif [[ -x "$ROOT/node_modules/.bin/vercel" ]]; then
    echo "$ROOT/node_modules/.bin/vercel"
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
  : "${RESEND_API_KEY:?Set RESEND_API_KEY in $ENV_FILE}"
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

vercel_cmd() {
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

  log "  → Linking Vercel project: $project"
  if ! vercel_cmd link "${link_args[@]}" 2>/dev/null; then
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

  APP_USER_PASSWORD="${APP_USER_PASSWORD:-$(rand_password)}"
  ADMIN_USER_PASSWORD="${ADMIN_USER_PASSWORD:-$(rand_password)}"
  export SUPABASE_PROJECT_REF
  export APP_USER_PASSWORD ADMIN_USER_PASSWORD
  compute_db_urls

  save_state supabase_project "{\"supabase_project_ref\":\"$SUPABASE_PROJECT_REF\"}"

  # Persist generated values back into deploy env (no secret echo)
  grep -q '^SUPABASE_PROJECT_REF=' "$ENV_FILE" 2>/dev/null && \
    sed -i.bak "s/^SUPABASE_PROJECT_REF=.*/SUPABASE_PROJECT_REF=$REF/" "$ENV_FILE" || \
    echo "SUPABASE_PROJECT_REF=$REF" >>"$ENV_FILE"
  grep -q '^APP_USER_PASSWORD=' "$ENV_FILE" 2>/dev/null && \
    sed -i.bak "s/^APP_USER_PASSWORD=.*/APP_USER_PASSWORD=$APP_USER_PASSWORD/" "$ENV_FILE" || \
    echo "APP_USER_PASSWORD=$APP_USER_PASSWORD" >>"$ENV_FILE"
  grep -q '^ADMIN_USER_PASSWORD=' "$ENV_FILE" 2>/dev/null && \
    sed -i.bak "s/^ADMIN_USER_PASSWORD=.*/ADMIN_USER_PASSWORD=$ADMIN_USER_PASSWORD/" "$ENV_FILE" || \
    echo "ADMIN_USER_PASSWORD=$ADMIN_USER_PASSWORD" >>"$ENV_FILE"
  rm -f "$ENV_FILE.bak"
}

supabase_roles() {
  should_run supabase_roles || return 0
  log "Creating Postgres roles (app_user / admin_user)"
  compute_db_urls

  escape_sed() { printf '%s' "$1" | sed -e 's/[\/&]/\\&/g' -e "s/'/''/g"; }
  SQL_TMP="$(mktemp)"
  sed -e "s/__APP_USER_PASSWORD__/$(escape_sed "$APP_USER_PASSWORD")/g" \
    -e "s/__ADMIN_USER_PASSWORD__/$(escape_sed "$ADMIN_USER_PASSWORD")/g" \
    "$ROOT/scripts/ops/init-supabase.sql" >"$SQL_TMP"

  execute_sql_file "$SQL_TMP" "$POSTGRES_URL"
  rm -f "$SQL_TMP"

  save_state supabase_roles
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
  printf '%s' "$value" | vercel_cmd env add "$key" production --force --yes 2>/dev/null || \
    printf '%s' "$value" | vercel_cmd env add "$key" production --yes
}

vercel_env() {
  should_run vercel_env || return 0
  log "Pushing environment variables to Vercel"
  compute_db_urls

  ensure_vercel_linked

  AUTH_SECRET="${AUTH_SECRET:-$(openssl rand -base64 32)}"
  export AUTH_SECRET

  vercel_env_push DATABASE_URL "$DATABASE_URL"
  vercel_env_push DATABASE_ADMIN_URL "$DATABASE_ADMIN_URL"
  vercel_env_push AUTH_SECRET "$AUTH_SECRET"
  vercel_env_push RESEND_API_KEY "$RESEND_API_KEY"
  vercel_env_push S3_ENDPOINT "$S3_ENDPOINT"
  vercel_env_push S3_BUCKET "${S3_BUCKET:-koicrm-uploads}"
  vercel_env_push S3_ACCESS_KEY_ID "$S3_ACCESS_KEY_ID"
  vercel_env_push S3_SECRET_ACCESS_KEY "$S3_SECRET_ACCESS_KEY"
  vercel_env_push S3_REGION "${S3_REGION:-auto}"
  vercel_env_push S3_PUBLIC_URL "$S3_PUBLIC_URL"
  vercel_env_push NODE_ENV production
  vercel_env_push LOG_LEVEL error

  if [[ -n "${AUTH_URL:-}" ]]; then
    vercel_env_push AUTH_URL "$AUTH_URL"
    vercel_env_push NEXT_PUBLIC_APP_URL "$AUTH_URL"
  fi

  if [[ -n "${GOOGLE_CLIENT_ID:-}" ]]; then
    vercel_env_push GOOGLE_CLIENT_ID "$GOOGLE_CLIENT_ID"
    vercel_env_push GOOGLE_CLIENT_SECRET "${GOOGLE_CLIENT_SECRET:-}"
  fi

  save_state vercel_env
}

vercel_deploy() {
  should_run vercel_deploy || return 0
  log "Vercel production deploy"
  DEPLOY_OUT="$(vercel_cmd deploy --prod 2>&1)" || die "vercel deploy failed"
  echo "$DEPLOY_OUT"
  PRODUCTION_URL="$(echo "$DEPLOY_OUT" | grep -Eo 'https://[a-zA-Z0-9.-]+\.vercel\.app' | tail -1)"
  [[ -n "$PRODUCTION_URL" ]] || PRODUCTION_URL="$(vercel_cmd inspect 2>/dev/null | head -1 || true)"
  [[ -n "$PRODUCTION_URL" ]] || die "Could not detect production URL from deploy output"
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
  vercel_cmd deploy --prod >/dev/null
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
  URL="${AUTH_URL:-${PRODUCTION_URL:-}}"
  [[ -n "$URL" ]] || URL="$(jq -r '.production_url // empty' "$STATE_FILE" 2>/dev/null)"
  [[ -n "$URL" ]] || die "No production URL for health check"
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
