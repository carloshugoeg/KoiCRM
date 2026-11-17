# Global search

Global search lets a user open the command menu, query deals/clients, and jump to a result.

## Sub-features

- `search-open-shortcut` opens the menu with Meta+K / Control+K.
- `search-open-button` opens via the header Buscar control.
- `search-query` filters results as the user types.
- `search-open-result` navigates to a deal or client surface.

## How to get to it (user POV)

- Press ⌘K / Ctrl+K from the app shell while signed in.
- Choose the Buscar button in the header.

## Driving it with control-koicrm

Preconditions:

- Signed in; pipeline (or any app page) loaded.
- For match proofs with demo seed, deals exist. For seed:test empty boards, prove open + empty/no-match only unless deals were created first.
- Doctor OK.

- **Keyboard entry.** Run `control-koicrm browser goto --url /app/test/pipeline`, then `control-koicrm browser press --key Control+k`. Placeholder matching `/cotización o pago/i` (or current search placeholder) is visible.
- **Button entry.** Close with Escape if open, then `control-koicrm browser click --role button --name Buscar`. Same search field appears.
- **Query.** `control-koicrm browser fill --placeholder "cotización o pago" --value a` (adjust placeholder from live UI if copy changed). Wait briefly for debounce; cmdk items may appear.
- **Proof.** Screenshot/ARIA under `global-search/` showing the open command menu. If opening a result, confirm URL contains `deal=` or a client route and capture the dialog.

## Gotchas

- Debounce: wait for results or empty state; do not assert on a fixed short sleep alone.
- Meta+K vs Control+K depends on OS; in Linux verify VMs use Control+K.
- Empty tenants yield no deal hits — that is not a search-open failure.
