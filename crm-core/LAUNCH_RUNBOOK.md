# Launch Runbook — First Client Deployment

## Automated path (recommended)

One-command bootstrap for **Supabase Postgres + Vercel** (no Sentry required).

### Prerequisites

- Node.js 20+, pnpm, `jq`, `curl`, `openssl` (`psql` optional — bootstrap uses Prisma if missing)
- Vercel token: [vercel.com/account/tokens](https://vercel.com/account/tokens)
- Supabase access token: [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)
- R2 bucket + API keys, Resend API key (app fails startup without them)
- Optional: `vercel` and `supabase` CLIs (script falls back to `npx vercel` and Supabase HTTP API)

### Steps

```bash
cd crm-core
cp .env.deploy.example .env.deploy.local
pnpm ops:sync-deploy-env   # copies R2/Resend/Google from .env.local + org IDs (MCP/defaults)
# Still required manually: SUPABASE_DB_PASSWORD, real RESEND key for prod, vercel login OR VERCEL_TOKEN
pnpm ops:check-deploy
pnpm ops:bootstrap
```

With **Vercel + Supabase MCP** connected in Cursor, you do not need `VERCEL_TOKEN` / `SUPABASE_ACCESS_TOKEN` in the file if you run `pnpm exec vercel login` once (Vercel CLI is a devDependency).

The script will:

1. Create (or reuse) a Supabase project and `app_user` / `admin_user` roles
2. Run `prisma migrate deploy`
3. Push env vars to Vercel and deploy production
4. Set `AUTH_URL` from the Vercel URL and redeploy
5. Seed the first tenant from `SEED_*` variables
6. Hit `/api/health`

Progress is stored in `bootstrap-state.json` (gitignored). Re-run `pnpm ops:bootstrap` to resume after a failure.

### After bootstrap (manual once)

- **R2 CORS** — [`docs/ops/r2-production.md`](docs/ops/r2-production.md) (include your Vercel URL and `https://*.vercel.app`)
- **Resend** — verify sending domain DNS at [resend.com/domains](https://resend.com/domains)

### Deploy from GitHub (Vercel dashboard)

Import the repo at [vercel.com/new](https://vercel.com/new) with **Root Directory = `crm-core`**. Full checklist: [`docs/ops/vercel-github.md`](docs/ops/vercel-github.md).

### Ongoing deploys (CI)

GitHub Actions workflow [`.github/workflows/deploy-production.yml`](../.github/workflows/deploy-production.yml) runs on push to `main` (or manually). Required repository secrets:

| Secret | Description |
|--------|-------------|
| `VERCEL_TOKEN` | Vercel API token |
| `VERCEL_ORG_ID` | Team ID (optional if default) |
| `DATABASE_ADMIN_URL` | Direct Postgres URL (`admin_user`, port 5432) |
| `AUTH_URL` | Production app URL for health check |
| `VERCEL_PROJECT_NAME` | Optional — defaults to `koi-crm` |

---

## Manual path (legacy)

The sections below cover the 8 manual steps for deploy without the bootstrap script. Complete them in order.

---

## Prerequisites

- Node.js 20+ and pnpm installed locally
- Access to the GitHub repo
- A Vercel account connected to GitHub

---

## Step 1 — Create a Postgres database

Choose one of:

### Option A — Neon (recommended for serverless)

1. Go to [neon.tech](https://neon.tech) → New Project
2. Choose **PostgreSQL 15**, pick a region close to your Vercel region (`us-east-1` for `iad1`)
3. From the Connection Details panel, copy two strings:
   - **Pooled connection** (`pgbouncer=true`) → `DATABASE_URL`
   - **Direct connection** (no pooler) → `DATABASE_ADMIN_URL`
4. In the pooled URL, append `&connect_timeout=10` if not already present

### Option B — Supabase

1. Go to [supabase.com](https://supabase.com) → New Project
2. From Project Settings → Database:
   - Port **6543** (Transaction Pooler) → `DATABASE_URL`
   - Port **5432** (Direct) → `DATABASE_ADMIN_URL`

> **Note:** You will need to create the `app_user` and `admin_user` roles manually.
> Run the contents of `crm-core/docker/init.sql` via the database console after creating the project.

---

## Step 2 — Create a Cloudflare R2 bucket
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com) → R2 Object Storage
2. Click **Create bucket**, name it `koicrm-uploads` (or similar)
3. Under **Settings**, enable public access (or use a custom domain)
4. Go to **Manage R2 API tokens** → Create token with **Object Read & Write** on your bucket
5. Save:
   - **Access Key ID** → `S3_ACCESS_KEY_ID`
   - **Secret Access Key** → `S3_SECRET_ACCESS_KEY`
   - **Endpoint** (`https://<account-id>.r2.cloudflarestorage.com`) → `S3_ENDPOINT`
   - Public bucket URL → `S3_PUBLIC_URL`

---

## Step 3 — Create a Resend account

1. Go to [resend.com](https://resend.com) → Sign up
2. **Verify your sending domain** (DNS records, required before launch — emails from unverified domains go to spam)
3. Go to API Keys → Create API Key with **Full access**
4. Save: `RESEND_API_KEY`

---

## Step 4 — Generate AUTH_SECRET

Run this in your terminal and save the output:

```bash
openssl rand -base64 32
```

Save the result as `AUTH_SECRET`.

---

## Step 5 — Create a Sentry project

1. Go to [sentry.io](https://sentry.io) → Projects → New Project
2. Select **Next.js** as the platform
3. Copy the **DSN** → set as both `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`
4. Go to Settings → Auth Tokens → Create token with `project:releases` and `org:read` scopes
5. Save as `SENTRY_AUTH_TOKEN` (Vercel env only — do not commit)
6. Save your org slug as `SENTRY_ORG` and project slug as `SENTRY_PROJECT`

---

## Step 6 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Select the `KoiCRM` repo, set **Root Directory** to `crm-core`
3. In **Environment Variables**, add all vars from `.env.production.example` plus:
   - `SENTRY_AUTH_TOKEN` (build-time only)
   - `SENTRY_ORG`
   - `SENTRY_PROJECT`
4. Click **Deploy** — the first deploy will fail until the database is seeded (expected)
5. After deploy succeeds, go to **Settings → Domains** to add your custom domain

---

## Step 7 — Run database migrations

From your local machine, with `DATABASE_ADMIN_URL` pointing to production:

```bash
cd crm-core
DATABASE_URL="<your-DATABASE_ADMIN_URL>" pnpm exec prisma migrate deploy
```

This applies all 10 migrations in order, including the RLS policies.

> Verify with: `pnpm exec prisma migrate status`

---

## Step 8 — Create the first tenant and admin user

```bash
cd crm-core
DATABASE_ADMIN_URL="<your-DATABASE_ADMIN_URL>" \
AUTH_URL="https://app.yourdomain.com" \
pnpm tsx scripts/seed-tenant.ts --name "Client Company Name" --slug "client-slug"
```

The script will prompt for:
- Admin full name
- Admin email
- Admin password (min 8 characters)

On success it prints the tenant ID and login URL.

> If the tenant slug already exists, the script exits cleanly with no changes.

---

## Post-launch verification checklist

- [ ] `GET https://app.yourdomain.com/api/health` returns `{"ok":true,"db":"ok"}`
- [ ] Sign in at `/signin` with the admin credentials created in Step 8
- [ ] Validate tenant license: `UPDATE "Tenant" SET "subscriptionValidated" = true WHERE slug = '<slug>';` (new tenants default to `false`)
- [ ] Verify you land on the tenant pipeline (`/app/<slug>/pipeline`)
- [ ] Upload a test file (confirms R2 is connected)
- [ ] Invite a second user and confirm the invite email arrives
- [ ] Accept the invite and verify the new user lands in the correct tenant
- [ ] Trigger a test Sentry event and confirm it appears in your Sentry dashboard:
  ```ts
  // Temporarily add to any server action, then remove:
  throw new Error("sentry-connectivity-test")
  ```
- [ ] 11th sign-in attempt within 60 seconds should redirect to `/signin?error=TooManyRequests`

---

## Useful commands (day-2 operations)

```bash
# View production logs
vercel logs --prod

# Apply a new migration to production
DATABASE_URL="<ADMIN_URL>" pnpm exec prisma migrate deploy

# Add a new team member to an existing tenant (from psql)
-- INSERT INTO "Membership" ("id","tenantId","userId","role","createdAt")
-- VALUES (gen_random_uuid(), '<tenantId>', '<userId>', 'MEMBER', now());

# Activate owner workspace license (required before anyone can open the embudo)
-- UPDATE "Tenant" SET "subscriptionValidated" = true WHERE slug = '<slug>';

# Suspend a single user without affecting the rest of the team
-- UPDATE "Membership" SET status = 'INACTIVE' WHERE "userId" = '<userId>' AND "tenantId" = '<tenantId>';
```
