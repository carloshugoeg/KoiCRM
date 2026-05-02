#!/usr/bin/env bash
# Full M2 migration flow: T2.1 (identity) → T2.2 (business) → T2.3 (RLS)
# Run from crm-core/ directory. Docker Desktop must be running.
set -e

WORKTREE_DIR="$(pwd)"

echo "==> Starting Docker DB..."
pnpm db:up
echo "Waiting 10s for Postgres to be healthy..."
sleep 10

# ── T2.1: Identity models ────────────────────────────────────────────────────
echo ""
echo "==> T2.1: schema.prisma already has identity-only models."
echo "==> Applying init_identity migration..."
pnpm prisma migrate dev --name init_identity
pnpm prisma generate
echo "T2.1 done."

# ── T2.2: Business models ────────────────────────────────────────────────────
echo ""
echo "==> T2.2: Swapping schema.prisma to full (T2.1 + T2.2) model set..."
cp prisma/schema.full.prisma prisma/schema.prisma
pnpm prisma validate
pnpm prisma migrate dev --name business_models
pnpm prisma generate
echo "T2.2 done."

# ── T2.3: RLS policies ───────────────────────────────────────────────────────
echo ""
echo "==> T2.3: Creating empty RLS migration..."
pnpm prisma migrate dev --create-only --name rls
RLS_DIR=$(ls -td prisma/migrations/*_rls | head -1)
cp prisma/rls.sql "$RLS_DIR/migration.sql"
echo "RLS SQL copied to $RLS_DIR/migration.sql"

echo "==> T2.3: Applying RLS migration via deploy..."
pnpm prisma migrate deploy
echo "T2.3 done."

# ── Tests ────────────────────────────────────────────────────────────────────
echo ""
echo "==> Running M2 integration tests..."
pnpm test:integration

echo ""
echo "All M2 migrations and tests complete!"
