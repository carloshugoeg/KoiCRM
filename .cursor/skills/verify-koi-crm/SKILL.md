---
name: verify-koi-crm
description: "Drive the real KoiCRM web app (crm-core Next.js UI) in a fully isolated local verify environment. Use for /verify-koi-crm, proving UI journeys, CSV export, pipeline, auth, or search without touching production."
---

# verify-koi-crm

Agent-facing control skill for **KoiCRM** (`crm-core/`). Surface: **web UI** at a dedicated loopback port. Drive with the bundled Playwright helper. Production hosts, Neon/Supabase/R2 credentials, and the default Docker volumes are out of scope — refuse rather than reuse them.

Read `features/README.md` before driving. Maintain the map with `/maintain-verification-skill` when routes or labels change.

## Isolation (hard rules)

| Resource | Verify value | Never |
| -------- | ------------ | ----- |
| Env file | `crm-core/.env.verify` (`KOICRM_VERIFY=1`) | `.env`, `.env.local`, `.env.production*`, deploy env |
| Postgres | DB name **`koicrm_verify`**, host `127.0.0.1` | `DATABASE_URL` with neon/supabase/rds/prod hosts; default `koicrm` volume while verifying |
| Compose | Project **`koicrm-verify`**, file `docker-compose.verify.yml`, ports **5436** / **9100** / **9101** | Default `docker-compose.yml` `pgdata` / prod |
| App | `http://127.0.0.1:3100` | `localhost:3000` shared session, `*.vercel.app`, prod `AUTH_URL` |
| Object storage | MinIO bucket **`koicrm-verify`** (or local endpoint with `verify` in bucket name) | Cloudflare R2 / prod S3 |
| Seed | `pnpm seed:test` or `pnpm seed:demo` into `koicrm_verify` only | Production tenants |
| Evidence | `/tmp/koicrm-verify-evidence/<RUN_ID>/` | Deleted by cleanup (must survive) |

Guards live in `crm-core/scripts/verify/guard-env.sh` and run on every `launch` / `doctor` / `browser` load. They refuse when:

- `KOICRM_VERIFY` is not `1`
- `NODE_ENV=production`
- `DATABASE_*` host is not loopback, DB name is not `koicrm_verify`, or URL matches neon/supabase/rds/etc.
- `AUTH_URL` is not loopback (or looks like a Vercel deploy)
- `S3_BUCKET` lacks `verify`, or `S3_ENDPOINT` looks like R2/AWS

Cleanup kills **only** the Next pid recorded for the run, downs **only** compose project `koicrm-verify`, and drops **only** database `koicrm_verify`. It never deletes evidence.

## Helpers

All commands from repo root (scripts are executable):

```bash
CTRL=".cursor/skills/verify-koi-crm/scripts/control-koicrm"
chmod +x "$CTRL" .cursor/skills/verify-koi-crm/scripts/browser.mjs
```

`browser.mjs` loads Playwright via `createRequire` from `crm-core`'s `@playwright/test` dependency (pnpm does not hoist a top-level `playwright` package). Install browsers once: `cd crm-core && pnpm exec playwright install chromium`.

## Launch

Preferred path (Docker available):

```bash
cp crm-core/.env.verify.example crm-core/.env.verify   # once
"$CTRL" launch --seed=test
```

What launch does:

1. Creates/loads `.env.verify` and runs prod-looking-env guards.
2. Starts `docker compose -p koicrm-verify -f crm-core/docker-compose.verify.yml up -d` (Postgres 15 + MinIO + bucket `koicrm-verify`).
3. `pnpm install` if needed, `prisma migrate deploy`, `pnpm seed:test` (or `--seed=demo`).
4. Starts `next dev -H 127.0.0.1 -p 3100`, writes pid/log under `crm-core/.verify/runs/<RUN_ID>/`.
5. Ready gate: `GET /signin` returns HTML (usable). `/api/health` is checked if present but is not sufficient alone.

Stand-in when Docker is missing: `KOICRM_VERIFY_DB_MODE=local-postgres` (or `auto`) uses system Postgres on `127.0.0.1:5432` with DB **`koicrm_verify`** only, rewrites port in `.env.verify`, and **does not** start MinIO (upload journeys fail until Docker MinIO exists). Document that stand-in in any proof report.

Test credentials after `--seed=test`:

| Field | Value |
| ----- | ----- |
| Email | `admin@test.local` |
| Password | `Test1234!` |
| Tenant | `test` → `/app/test/pipeline` |

Demo seed (`--seed=demo`): `roberto@demo-aqua.local` / `Demo1234!` → `/app/demo-aqua/pipeline`.

## Doctor

```bash
"$CTRL" doctor
```

Requires: Next pid alive, `/signin` reachable, `koicrm_verify` reachable, env guards green. Run this first whenever anything looks off. Do not drive an instance you did not launch.

## Drive

Harness: Playwright via `control-koicrm browser`. Prefer roles and accessible names from the feature map.

```bash
"$CTRL" browser auth-credentials --email admin@test.local --password 'Test1234!'
"$CTRL" browser goto --url /app/test/pipeline
"$CTRL" browser wait --text Prospecto
"$CTRL" browser screenshot --path pipeline/board.png
"$CTRL" browser snapshot --aria --path pipeline/board.aria.txt
```

Common actions: `goto`, `fill`, `click`, `press`, `wait`, `snapshot`, `screenshot`, `download-click`, `auth-credentials`, `eval`. Session storage persists in the run dir between calls.

CSV export (requires export UI from PR `#4` / branch `cursor/tenant-csv-export-593c` or merged main):

```bash
"$CTRL" browser goto --url /app/test/settings/general
"$CTRL" browser wait --text "Exportar datos"
"$CTRL" browser download-click --role link --name "Descargar CSV" --path csv-export/tenant.zip
```

If the link is missing, report failure and the unmet precondition — do not weaken the journey.

## Evidence

- Directory: `"$CTRL" evidence-dir` → `/tmp/koicrm-verify-evidence/<RUN_ID>/`
- Proof standards:
  - Exercise the real user path (sign-in form, Settings → General → Descargar CSV, pipeline buttons). No test-only setters as the primary proof.
  - Capture the action and resulting state (screenshot + ARIA snapshot and/or downloaded file bytes).
  - Verify side effects: ZIP size > 0 for CSV; URL contains `/app/<slug>/` after sign-in; kanban stage labels visible after pipeline load.
  - Mocks only at true production boundaries (local MinIO instead of R2). Never mock the CRM UI under test.
- Record feature id and entry point in the artifact folder name (e.g. `sign-in/`, `csv-export/`).

## Cleanup

```bash
"$CTRL" cleanup
```

Tears down the Next process from the pidfile; `docker compose -p koicrm-verify ... down -v` **or** `DROP DATABASE koicrm_verify` in local-postgres mode. **Evidence under `/tmp/koicrm-verify-evidence/<RUN_ID>/` is retained.** Confirm with `ls "$( "$CTRL" evidence-dir )"`.

## Feature map

See [`features/README.md`](features/README.md). Seeded journeys: sign-in, pipeline kanban, create deal, global search, CSV export.
