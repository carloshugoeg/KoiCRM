# KoiCRM verification map

Maintained source for verifying user-facing behavior of the real app in `crm-core/`. Read this index, then the matching feature file. Do not drive production or the default `:3000` shared session.

## Baseline preconditions

- Launch via `control-koicrm launch --seed=test` (or `--seed=demo`).
- App URL `http://127.0.0.1:3100` with env from `crm-core/.env.verify`.
- Database name `koicrm_verify` on loopback only; compose project `koicrm-verify` when using Docker.
- `control-koicrm doctor` reports `DOCTOR_OK`.
- Never drive an instance this verify run did not start.
- Evidence root: `/tmp/koicrm-verify-evidence/<RUN_ID>/` (survives cleanup).

## Driving conventions

- Start every recipe from baseline unless the feature lists extra preconditions.
- Prefer ARIA roles and accessible names over CSS or coordinates.
- Treat commands as literal; keep quoted emails/passwords unchanged.
- Browser actions go through `control-koicrm browser`.
- After mutations, confirm with a second user-visible view when the feature says so.
- Cleanup must not remove proof artifacts.

## Proof and skip reporting

- Capture the user action and resulting state (screenshot + ARIA and/or file download).
- Mutation proof includes a read-back (reopen deal, re-list pipeline, inspect ZIP).
- Record feature id and entry point in the artifact path.
- Unreachable paths: report the attempted command and unmet precondition.
- Do not claim a skipped entry point was verified via a different path.

## Feature entry contract

Each feature file: H1 + one paragraph, then exactly these H2s in order:

1. `Sub-features`
2. `How to get to it (user POV)`
3. `Driving it with control-koicrm`
4. `Gotchas`

## Features

- [Sign in](./sign-in.md) — email/password session into a tenant.
- [Pipeline kanban](./pipeline-kanban.md) — board stages and deal cards.
- [Create deal](./create-deal.md) — Nueva oportunidad → Crear oportunidad.
- [Global search](./global-search.md) — ⌘K / Buscar command menu.
- [CSV export](./csv-export.md) — Settings → General → Descargar CSV (PR `#4` until merged).
