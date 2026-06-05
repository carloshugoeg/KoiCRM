# KoiCRM

Multitenant white-label CRM. Application code lives in [`crm-core/`](crm-core/).

## Deploy to Vercel (GitHub)

1. [vercel.com/new](https://vercel.com/new) → Import this repository.
2. **Root Directory:** `crm-core` (required — monorepo).
3. **Framework:** Next.js (auto-detected).
4. **Build / Install:** defined in [`crm-core/vercel.json`](crm-core/vercel.json).
5. **Environment variables:** copy from [`crm-core/.env.production.example`](crm-core/.env.production.example) into Vercel → Project → Settings → Environment Variables (Production).

Full checklist: [`crm-core/docs/ops/vercel-github.md`](crm-core/docs/ops/vercel-github.md).

One-shot bootstrap (CLI): [`crm-core/LAUNCH_RUNBOOK.md`](crm-core/LAUNCH_RUNBOOK.md).

## Local development

```bash
cd crm-core
pnpm install
cp .env.example .env
pnpm db:up && pnpm db:migrate
pnpm dev
```

See [`crm-core/README.md`](crm-core/README.md).
