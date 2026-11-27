# Proof run (verify-koi-crm)

Recorded so a cold agent can see the skill was executed once end-to-end.

## Run

- `RUN_ID`: `proof-20261117T195141Z`
- Date: 2026-11-17
- Feature driven: **sign-in** (session bootstrap → `/app/test/pipeline`)
- DB mode: **local-postgres** stand-in (Docker not installed on the proof VM)

## Steps executed

1. `control-koicrm launch --seed=test` → `LAUNCH_OK`
2. `control-koicrm doctor` → `DOCTOR_OK`
3. `control-koicrm browser auth-credentials --email admin@test.local --password 'Test1234!'`
4. `goto /app/test/pipeline`, wait `Nueva oportunidad`, screenshot + ARIA under `sign-in/`
5. `control-koicrm cleanup` → `CLEANUP_OK`; Next stopped; `DROP DATABASE koicrm_verify`
6. Confirmed evidence still present after cleanup

## Evidence paths (survive cleanup)

- `/tmp/koicrm-verify-evidence/proof-20261117T195141Z/sign-in/after-login.png`
- `/tmp/koicrm-verify-evidence/proof-20261117T195141Z/sign-in/after-login.aria.txt`

ARIA shows tenant shell for slug `test` (Embudo, Nueva oportunidad, Prospecto region) — not the sign-in form.

## Stand-in setup steps still unverified on a fresh Docker machine

These were done on the proof VM and are **not** covered by a Docker Compose verify run yet:

1. `apt` install of PostgreSQL 16 and `pg_ctlcluster 16 main start` (instead of `docker compose -p koicrm-verify -f docker-compose.verify.yml up -d`)
2. Manual role/database bootstrap in `control-koicrm` local-postgres mode (instead of container `init.sql` + volume `pgdata_verify`)
3. No MinIO: upload journeys remain unproven until Docker MinIO on ports 9100/9101
4. `pnpm install` + `pnpm exec playwright install chromium` on this image
5. Node 22 used despite `engines.node: 20.x` (worked; prefer Node 20 on target)

Fresh machine with Docker should use the preferred compose path in `SKILL.md` Launch and re-prove once.
