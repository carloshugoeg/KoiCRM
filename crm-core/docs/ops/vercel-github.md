# Vercel — deploy from GitHub

## 1. Import repository

| Setting | Value |
|---------|--------|
| Repository | `KoiCRM` (this repo) |
| **Root Directory** | **`crm-core`** |
| Framework Preset | Next.js |
| Node.js Version | 20.x |

Vercel reads [`vercel.json`](../../vercel.json) inside `crm-core` for install/build commands and region (`iad1`).

## 2. Production environment variables

Add in **Vercel → Project → Settings → Environment Variables** (scope: **Production**, and **Preview** if you want previews to work):

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Supabase **transaction pooler** `:6543`, user `app_user.<project-ref>` |
| `DATABASE_ADMIN_URL` | Supabase **direct** `db.<ref>.supabase.co:5432`, user `admin_user` |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | `https://<your-production-domain>` (no trailing slash) |
| `NEXT_PUBLIC_APP_URL` | Same as `AUTH_URL` |
| `RESEND_API_KEY` | Resend production key |
| `S3_ENDPOINT` | Cloudflare R2 account endpoint |
| `S3_BUCKET` | Bucket name |
| `S3_ACCESS_KEY_ID` | R2 token |
| `S3_SECRET_ACCESS_KEY` | R2 secret |
| `S3_REGION` | `auto` |
| `S3_PUBLIC_URL` | Public R2 URL |
| `NODE_ENV` | `production` |
| `LOG_LEVEL` | `error` |
| `GOOGLE_CLIENT_ID` | Optional |
| `GOOGLE_CLIENT_SECRET` | Optional |

Reference template: [`.env.production.example`](../../.env.production.example).

Sentry (`SENTRY_*`) is optional; builds work without `SENTRY_AUTH_TOKEN`.

## 3. First deploy

1. Push to `main` or click **Deploy** after import.
2. Run migrations once (if not done via `pnpm ops:bootstrap`):

   ```bash
   cd crm-core
   DATABASE_URL="<DATABASE_ADMIN_URL>" pnpm exec prisma migrate deploy
   ```

3. Seed tenant AquaXela (or your `SEED_*` from `.env.deploy.local`):

   ```bash
   DATABASE_ADMIN_URL="<direct-url>" AUTH_URL="https://..." pnpm exec tsx scripts/seed-tenant.ts \
     --name "AquaXela" --slug aquaxela \
     --admin-email koicrm@aquaxela.com --admin-password "..." --admin-name "Koi CRM Admin"
   ```

4. Verify: `GET https://<domain>/api/health` → `{"ok":true,"db":"ok"}`.

## 4. Post-deploy (manual once)

- **R2 CORS** — [r2-production.md](./r2-production.md)
- **Resend** — verify sending domain DNS
- **Google OAuth** — add production redirect: `https://<domain>/api/auth/callback/google`

## 5. Ongoing deploys

- **Git push to `main`** → Vercel builds automatically (if Git integration is enabled).
- Optional CI: [`.github/workflows/deploy-production.yml`](../../../.github/workflows/deploy-production.yml) (migrate + `vercel deploy`).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build runs from repo root / 404 | Set **Root Directory** = `crm-core` |
| `husky` / `.git` error on install | `vercel.json` sets `HUSKY=0` on install |
| Prisma engine not found on Vercel | `binaryTargets` includes `rhel-openssl-3.0.x` in `schema.prisma` |
| `Can't resolve '.prisma/client/default'` | Build runs `prisma generate` before `next build`; `@prisma/client` in `pnpm.onlyBuiltDependencies` |
| `husky` / `.git can't be found` on install | `HUSKY=0` in `vercel.json` + `scripts/skip-husky-on-ci.mjs` |
| Startup crash missing env | See `lib/startup-check.ts` — all `S3_*` and `RESEND_API_KEY` required in prod |
