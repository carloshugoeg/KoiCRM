# CSV export

CSV export lets an owner or admin download a ZIP of per-entity CSV files for the current tenant from Settings → General.

## Sub-features

- `export-section` shows Exportar datos and **Descargar CSV** for active owner/admin.
- `export-download` returns a ZIP via `GET /api/tenants/<slug>/export`.
- `export-forbidden` denies member/viewer (403) — out of browser happy-path; note if role changes.

## How to get to it (user POV)

- Open Settings (header gear, title Configuración) → **General**.
- Choose **Descargar CSV** under Exportar datos.

## Driving it with control-koicrm

Preconditions:

- Branch/main includes the export UI and route from PR `#4` (`cursor/tenant-csv-export-593c`) or a later merge. If **Descargar CSV** is absent on General settings, **fail** this journey and record: unmet precondition `csv-export-ui-not-deployed`.
- Signed in as owner/admin (`admin@test.local` or demo Roberto).
- Doctor OK.
- Object storage not required for export (attachment bytes stay in storage; CSV omits secrets).

- **Open General settings.** Run `control-koicrm browser goto --url /app/test/settings/general` (or `/app/demo-aqua/settings/general`). Wait for heading `General`.
- **Locate export.** Run `control-koicrm browser wait --text "Exportar datos"`. Link/button **Descargar CSV** is visible.
- **Download.** Run `control-koicrm browser download-click --role link --name "Descargar CSV" --path csv-export/tenant.zip`. File exists under the evidence dir; size greater than 0.
- **Side effect check.** Inspect ZIP locally (`unzip -l` on the evidence file). Archive lists multiple `.csv` entries (PR documents 24 entity files). Confirm no password/PIN/token column content is the intent of the product; spot-check filenames only in the verify skill.
- **Proof.** Keep `csv-export/tenant.zip` plus a screenshot of the General page showing **Descargar CSV** (`csv-export/general.png`) and ARIA snapshot (`csv-export/general.aria.txt`).

## Gotchas

- Until PR `#4` merges, mainline checkouts lack the control — do not invent a substitute API call as “verified UI”.
- Members/supervisors/viewers get 403; use owner/admin seed users.
- Formula-injection quoting is a unit/integration concern; browser proof is download success + ZIP listing.
- Settings nav labels: Apariencia is the gear default; switch to General explicitly (`/settings/general`).
