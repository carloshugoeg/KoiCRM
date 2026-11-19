# Create deal

Create deal lets a user open Nueva oportunidad, fill the client/deal form, and persist a new opportunity on the pipeline.

## Sub-features

- `deal-open-form` opens ClientFormModal from Nueva oportunidad.
- `deal-save` submits Crear oportunidad and shows the new card or detail.
- `deal-cancel` closes without persisting when the user dismisses the dialog.

## How to get to it (user POV)

- On the pipeline board, choose **Nueva oportunidad** (toolbar or floating control with aria-label `Nueva oportunidad`).
- From a client profile, choose Nueva oportunidad (pre-fills client).

## Driving it with control-koicrm

Preconditions:

- Signed in as a role that can create deals (seed admin / demo Roberto).
- Pipeline page loaded for the tenant slug.
- Doctor OK.
- Unique client name for this run, e.g. `Verify Client <RUN_ID>`.

- **Open form.** Run `control-koicrm browser goto --url /app/test/pipeline`, then `control-koicrm browser click --role button --name "Nueva oportunidad"`. Dialog / form for the new opportunity appears.
- **Fill required fields.** Use labeled inputs from the modal (nombre del cliente and other required fields present in the form). Prefer `fill --label` / `--placeholder` from the live ARIA snapshot if labels drift. Observable: **Crear oportunidad** becomes enabled.
- **Save.** Run `control-koicrm browser click --role button --name "Crear oportunidad"`. Toast or board refresh shows the new opportunity; card text includes the client name.
- **Confirm persistence.** Reload pipeline and search or scan for the client name. Run `control-koicrm browser goto --url /app/test/pipeline` and `control-koicrm browser wait --text "Verify Client"`.
- **Proof.** Screenshot and ARIA of the board or open deal dialog under `create-deal/`. Include the unique client name.

## Gotchas

- Required fields vary by industry template and custom fields. If seed:test lacks a catalog option the form needs, the journey fails — record the missing precondition; do not skip validation.
- Floating vs toolbar **Nueva oportunidad** both valid; prove one entry point and note the other as unproven if not clicked.
- Do not call server actions directly as proof.
