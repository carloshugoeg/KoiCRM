# Pipeline kanban

Pipeline kanban shows the tenant sales board: stage columns and deal cards a user can scan and open.

## Sub-features

- `pipeline-open` loads `/app/<slug>/pipeline` with the board shell.
- `pipeline-stages` shows configured stage labels (generic or aquasistemas template).
- `pipeline-cards` exposes focusable deal cards when deals exist.

## How to get to it (user POV)

- After sign-in, land on `/app/<slug>/pipeline` (default post-login for seeded tenants).
- Choose the Embudo tab in the app header.

## Driving it with control-koicrm

Preconditions:

- Signed in (`auth-credentials` completed for the seeded user).
- Tenant has a pipeline (seed:test / seed:demo both apply an industry template).
- Doctor OK.

- **Open board.** Run `control-koicrm browser goto --url /app/test/pipeline` (or `/app/demo-aqua/pipeline`). Wait for `Nueva oportunidad`. Stage titles like `Prospecto` may be `attached` but CSS-truncated/`hidden` at default viewport — use `control-koicrm browser wait --text Prospecto --attached` or assert via ARIA snapshot regions.
- **Stage labels.** Confirm at least one stage text from the tenant template is visible via snapshot.
- **Cards (when seeded deals exist).** Demo seed includes deals. Run `control-koicrm browser eval --js 'document.querySelectorAll("[aria-roledescription=draggable]").length'`. Count is greater than 0 for demo; may be 0 for empty seed:test — report empty board as observed, not as failure of stage rendering.
- **Proof.** Run `control-koicrm browser screenshot --path pipeline-kanban/board.png` and `control-koicrm browser snapshot --aria --path pipeline-kanban/board.aria.txt`. Artifacts include stage labels and header branding.

## Gotchas

- seed:test uses industry `generic`; stage names may differ from aquasistemas demo (`Prospecto`, `Contactado`, …). Prefer waiting for `Nueva oportunidad` when unsure.
- Do not use DnD coordinate drags as the primary proof; keyboard/ARIA presence is enough for this map entry.
- Header tabs may omit Clientes/Archivo even when routes exist — stay on Embudo for this feature.
