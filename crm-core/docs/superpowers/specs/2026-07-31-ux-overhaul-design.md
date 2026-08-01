# UX overhaul — vertical chrome, clients, calendar, archive reason — Design Spec

**Date:** 2026-07-31
**Status:** Approved
**Base:** `feat/permissions-and-scope` @ the merge of `fix/documented-findings`

---

## Context

The funnel screen was just given a four-tier responsive system (`tailwind.config.ts`: `tablet`
at 520px, `board` at 1024px, plus a `short`/`tall` height split). That work stopped at the
funnel. This spec extends the same treatment to the rest of the app and adds two data fields
the business asked for.

The customer runs a **Samsung Galaxy Tab A9 8.7"** — 533×893 CSS in portrait, 893×533 in
landscape — alongside phones and desktops. A new client is being onboarded, so the app is
about to be seen fresh by people who did not build it.

---

## Decisions taken

| Question | Decision | Why |
|---|---|---|
| How to express "vertical view" | **Reuse the existing tiers: below `board` (1024px)** | The request said "height greater than width", i.e. orientation. But the app already has a width/height tier system, and layering an orientation query on top would give two systems competing for the same properties — exactly the failure that put the tablet on the wrong side of the line the first time. For every device in play the two rules coincide; below-1024 additionally collapses a narrow desktop window, which is desirable. |
| Calendar direction | **Month grid fills the available height** | Rescues the wasted space directly rather than changing what the screen is for. Today the grid occupies the top third and more than half the viewport is empty. |
| Archive reason capture | **Configurable catalog + optional free note** | Matches the `CatalogItem` pattern the app already uses for channels and deal statuses, keeps it out of hardcoded V1 config, and yields data that can actually be aggregated — free text alone would be dead for reporting. |
| Ownership of `features/clients` | **One workstream owns the whole directory** | The client-address field and the Apple-Contacts list both touch `ClientProfile.tsx`. Splitting them across parallel agents would manufacture a conflict for no benefit. |

---

## Workstreams

Four independent workstreams, then an audit. Each is scoped so that no two touch the same
files.

### 1. Archive reason

**Owns:** `features/deals/`, `features/catalogs/`, the archive settings surface, `prisma/`.

Archiving a deal is currently a bare confirmation dialog. It becomes a small form:

- A new `CatalogItem` catalogue key `archiveReason`, editable in Ajustes alongside the
  existing catalogues, so each tenant defines its own motives.
- `Deal.archiveReasonKey String?` and `Deal.archiveNote String?`.
- The archive dialog requires a reason and accepts an optional note. Unarchiving leaves both
  in place as history rather than clearing them.
- The Archivo listing shows the reason.

Both schema changes ship in one migration. `Deal` is already RLS-protected and `CatalogItem`
already carries the tenant policy, so no new RLS work — but the migration must still be
verified against `app_user`, not assumed.

### 2. Clients — address field and the Apple-Contacts list

**Owns:** `features/clients/`, `features/deals/components/ClientFormModal.tsx`, `prisma/`.

**Address.** `Client.address String?`, surfaced everywhere a client is created, edited or
displayed: the client form, the client profile, and the quick-create flow that runs when a
deal is opened for a client that does not exist yet. Optional throughout — never blocks a save.

**The list.** Below `board` the master-detail split ends. The list fills the screen; tapping a
client opens their profile as its own view with a back affordance, the way iOS Contacts
behaves. The alphabet index that already exists is kept. At `board` and above the current
master-detail layout is unchanged.

The back navigation must survive a browser back button and a page reload — a selected client
should be addressable, not held only in component state.

### 3. Vertical chrome

**Owns:** `components/app/tenant-header.tsx`, `features/pipeline/components/PipelineClient.tsx`.

Below `board`:

- The top navigation collapses into a hamburger with a dropdown. Today it overflows and clips
  ("Ca..." at 533px). Every destination stays reachable; nothing is dropped.
- "Nueva oportunidad" moves up beside "Filtros", which sits in a half-empty row today, and
  that row is centred and balanced against the Total embudo / Ganado pair.

At `board` and above, the header and the funnel chrome are unchanged.

Touch targets stay at 44px or more. This is the tier where every target is a finger.

### 4. Calendar

**Owns:** `features/calendar/`.

The month grid stretches to the height available instead of leaving the lower half of the
screen empty. Cells show more follow-ups before truncating. The day panel — currently a narrow
right-hand column that is empty most of the time — is folded into the layout rather than
standing beside it.

Mobile gets a layout that works at 375px rather than a squeezed desktop grid.

### 5. Visual coherence audit

Runs **after** 1–4 land. Walks every screen at **375×812**, **533×893**, **893×533** and
**1280×800**.

This is a findings pass, not a fixing pass. It reports what is inconsistent — spacing, type
scale, control sizes, colour, clipped content, touch targets under 44px — and the human
decides what gets fixed. An audit that silently rewrites screens cannot be reviewed.

---

## Execution

Workstreams 1–4 run in **parallel git worktrees**, one agent each, branched off the merged
base. They own disjoint file sets, so merge conflicts should be limited to `prisma/schema.prisma`
(workstreams 1 and 2 both add a field) and possibly `features/deals/schemas.ts`. Both are
append-style edits in different regions of the file; git handles them, but the merges are done
one at a time with the suite run after each.

**Each worktree gets its own PostgreSQL on its own port.** The integration suite truncates the
database it runs against, and this project has already lost its demo data to that twice in one
day while someone was testing. Isolation is not optional here — it is the difference between
an agent finishing and an agent wiping the customer demo mid-review.

Workstream 5 runs last, in a single worktree, after 1–4 are merged.

---

## Constraints that bind every workstream

- **Apple-style minimalism.** High-contrast, restrained, purposeful whitespace, precise
  typography. Extend the app's existing visual language rather than importing a new one.
- **Banned:** gradient text, decorative glassmorphism, coloured side-stripe accent borders,
  bounce/elastic easing, dark glows, purple gradients, cream/beige backgrounds, tiny uppercase
  tracked eyebrow labels as new scaffolding, numbered section markers, nested cards.
- **Touch targets ≥44px** below `board`.
- Respect `prefers-reduced-motion`.
- **Desktop must come out unchanged** except where a workstream explicitly redesigns it
  (only the calendar does).
- No statement semicolons; the repo is written without them despite `.prettierrc`. Never run
  Prettier.
- No `Co-Authored-By` trailers. `git add` explicit paths only.
- Never a bare `prisma.*` call on a tenant-scoped table — reads and writes go through
  `withTenant`, or they silently return nothing as `app_user`.
- No new per-request transaction fan-out. A production P2028 outage came from exactly that;
  commit `15889e3` fixed it.

---

## Production

Nothing in this spec reaches production on its own. Vercel's build does not run
`migrate deploy`, so the two migrations arrive only when applied by hand as `admin_user`
through the pooler. Take a production dump before that — the development dump at
`KoiCRM-backups/dev-db-2026-07-31.sql` covers only the local database.
