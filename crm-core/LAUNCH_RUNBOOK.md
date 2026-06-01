# Launch Runbook — First Client Deployment

This document covers the 8 manual steps required to deploy KoiCRM to production on Vercel + managed Postgres. Complete them in order.

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
```
