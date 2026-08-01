# Port demo work into main — Permissions, funnel scope, reports, mobile — Design Spec

**Date:** 2026-07-27
**Status:** Approved
**Base:** `main` @ `15889e3`
**Source:** uncommitted working tree of the `KoiCRM-Demo` clone (@ `49d818c`), catalogued in
that repo's `PORT_TO_MAIN.md`

---

## Context

A separate clone (`KoiCRM-Demo`) was used to prepare the Heiss sales pitch. It grew a real
feature set on top of `49d818c` that never made it back: a per-role and per-person permission
system, funnel scoping derived from it, a reports screen, per-panel stats filters, a mobile
funnel, and two defects worth fixing regardless of the pitch. All of it sits **uncommitted** in
that clone's working tree — there is no branch to merge, so the port is a deliberate, file-by-file
re-application onto `main`.

`main` is one commit ahead of the demo's base (`15889e3`, the P2028 fan-out fix). That commit and
the demo work overlap in exactly one file.

Volume: 24 modified files (~1,049 insertions) plus ~1,270 lines of new files.

---

## Decisions taken during brainstorming

| Decision | Choice | Rationale |
|---|---|---|
| Existing tenants and the "embudo abierto" | **Backfill `pipeline.viewAll = true` for `MEMBER`** in every existing tenant | Today every member sees every deal. The new default restricts them. Without a backfill, every advisor at every client loses the shared funnel on deploy day. |
| Funnel totals for existing members | **Not backfilled** — members lose per-stage totals and the `KpiBar` | Explicitly chosen over the wider backfill. Money aggregates are the thing the restriction is actually for; individual deal values stay visible on each card. |
| Test coverage | **Full** — permissions, funnel scope, reports, stats panel filters, server actions | This is production multi-tenant code and one change is a security patch. |
| `dealScopeFor` | **Rename to `pipelineScopeFor`** | The name is generic but the function reads `pipeline.viewAll`. Reusing it in reports would silently apply the wrong key — invisible under defaults, wrong the moment a workspace enables one key and not the other. |
| `S3_FORCE_PATH_STYLE` | **Port**, in both S3 clients | Opt-in. Off, R2 behaves identically. Both clients must read the same flag or the health probe reports `storage: "error"` while uploads work. |
| MinIO dev service | **Port** | Lets any dev exercise uploads without R2 credentials. Production never sees it. |
| `DB_PORT` in compose | **Already present** in this working tree | Default stays 5435, so the integration harness is unaffected. |
| `VIEWER` defaults | **Keep `pipeline.viewAll: true`, no totals** | A `VIEWER` owns no deals, so a restricted read-only role would render an empty funnel. |
| How a restricted member's scope is expressed | **Reuse the existing `visibleToUserId` mechanism**, not strict `ownerId` | The repo already has `dealVisibilityWhere(userId)` — owned **or ceded via `DealViewer`** — used by `stats/listado`, `getDeal`, `getArchivedDeals` and search. The demo pinned on `ownerId` alone, which would make a ceded opportunity vanish from the advisor's funnel while still appearing in archive, search and stats. |
| `clients.viewAll` | **Drop from the catalogue** | Declared, labelled and rendered as a toggle in the matrix, but no query or page reads it. It defaults to `true` everywhere so nobody notices today; the moment an admin turns it off, nothing happens. A switch that lies is worse than no switch. Re-add it when client scoping exists. |
| Demo scaffolding | **Excluded from every commit, not deleted** | Already sitting uncommitted in this working tree; it stays there. |

---

## Scope

### In

1. Permission foundation — two tables, three resolution layers, settings UI.
2. Funnel scope derived from permissions, enforced in SQL.
3. Two defect fixes (deep-link authorization; wrong permission key in reports).
4. Reports screen.
5. Per-panel stats filters.
6. Clients → "Abrir oportunidad" deep link.
7. Mobile funnel (slides + FAB) and the drag-vs-swipe resolution.
8. `S3_FORCE_PATH_STYLE` flag and the MinIO dev service.
9. Test coverage for all of the above.

### Out

| Item | Reason |
|---|---|
| `prisma/seed/demo-heiss.ts` | Fictional pitch dataset. |
| `scripts/demo-setup.sh`, `scripts/demo-bundle.sh` | Demo tooling. Already untracked here; left untouched. |
| `docs/ops/demo-playground.md`, `SETUP_NEW_MAC.md`, root `README.md` demo section | Demo documentation. |
| `public/demo/` | Prospect logo. |
| `package.json` scripts `demo:setup` and `seed:heiss` | Demo-only entry points. |

---

## Architecture — permissions

### Three layers

Effective permissions resolve in order, each overriding the previous:

```
1. built-in role default   lib/permissions/defaults.ts   (in code, no rows)
2. RolePermission          the workspace's role matrix
3. UserPermission          a per-person exception
```

`OWNER` and `ADMIN` short-circuit at every layer. Neither the matrix nor a per-person exception
can lock an administrator out of their own workspace — enforced in `resolve.ts` via `LOCKED_ROLES`,
not only hidden in the UI.

Both tables store **only what changed**. A new workspace is correct with zero rows; a person with
no exceptions inherits their role.

### Permission catalogue

Four keys, defined once in `PERMISSION_DEFS` — label, description and grouping travel with the key,
so adding a permission is a single-file change that surfaces in the settings matrix automatically.
Every key in the catalogue must have a consumer; `clients.viewAll` came from the demo with none and
is dropped rather than shipped inert.

| Key | Superadmin | Admin | Supervisor | Asesor | Solo lectura |
|---|---|---|---|---|---|
| `pipeline.viewAll` | yes | yes | yes | **no** | yes |
| `pipeline.viewTotals` | yes | yes | yes | **no** | no |
| `reports.viewAll` | yes | yes | yes | no | no |
| `stats.viewTotals` | yes | yes | yes | no | no |

### Public surface of `lib/permissions/resolve.ts`

| Function | Layers | Used by |
|---|---|---|
| `permissionsFor(tenantId, role, userId)` | 1+2+3 | feature code — the default choice |
| `permissionsForRole(tenantId, role)` | 1+2 | the settings matrix |
| `can(tenantId, role, userId, key)` | 1+2+3 | single-key checks |
| `permissionMatrix(tenantId)` | 1+2, all roles | settings screen |
| `memberPermissions(tenantId, members)` | 1+2+3, all members | per-person exceptions screen |
| `pipelineScopeFor(tenantId, role, userId)` | 1+2+3 | pipeline queries and `getDealSummaryAction` |

`pipelineScopeFor` returns `{ visibleToUserId: string | null, canSeeTotals: boolean }`. The field is
named after the filter it feeds, so the call site cannot mistake it for strict ownership.

`memberPermissions` reads the whole tenant's rows in one pass rather than one query per member.
Every read goes through `withTenant`, as required for RLS-protected tables.

### Settings UI

Route `settings/permissions` renders two sections:

- **Role matrix** — the five permissions × five roles. `OWNER`/`ADMIN` rows render locked.
- **Per-person exceptions** — one collapsible row per member; each permission is a three-state
  control (**Hereda · yes/no**, **Yes**, **No**). "Hereda" states what it actually resolves to
  under the current matrix, so the effect is visible without leaving the screen. A badge counts
  each person's exceptions, and a "volver a heredar todo del rol" action clears them.

Both server actions (`setRolePermissionAction`, `setUserPermissionAction`) validate with zod and
gate on `requireRole(session, tenantId, ["OWNER", "ADMIN"])` from `lib/auth/rbac.ts`.

---

## Data model

```prisma
model RolePermission {
  tenantId  String
  role      Role
  key       String
  allowed   Boolean
  updatedAt DateTime @updatedAt
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@id([tenantId, role, key])
  @@index([tenantId])
}

model UserPermission {
  tenantId  String
  userId    String
  key       String
  allowed   Boolean
  updatedAt DateTime @updatedAt
  tenant    Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user      User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([tenantId, userId, key])
  @@index([tenantId])
  @@index([userId])
}
```

### Migrations

Two migrations, carried over from the demo with one change.

`20260727045954_role_permissions` — table, index, FK, then the standard business-table treatment:

```sql
ALTER TABLE "RolePermission" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "RolePermission"
  USING ("tenantId" = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "RolePermission" TO app_user;
```

**The compatibility backfill is appended to this same migration**, not added as a third one, so
production has a single story: apply the migration, behaviour does not change.

```sql
-- Existing workspaces ran an open funnel: every member saw every deal. The new MEMBER
-- default is restricted, so pin the old behaviour for tenants that already exist. New
-- tenants get the restricted default, since they have no row here.
INSERT INTO "RolePermission" ("tenantId", "role", "key", "allowed", "updatedAt")
SELECT "id", 'MEMBER', 'pipeline.viewAll', true, NOW() FROM "Tenant";
```

`20260727220015_user_permissions` — same shape, both FKs, RLS, policy, grant. No backfill.

---

## Funnel scope

`pipelineScopeFor` returns `{ visibleToUserId, canSeeTotals }`. When `visibleToUserId` is non-null,
callers must pin the query to what that user may see — their own deals plus anything ceded to them
through `DealViewer`, which is exactly what the existing `dealVisibilityWhere` fragment expresses.

- `loadPipelineKanbanData(tenantId, dealFilters, scope?)` merges the scope into the filters
  **before** building the `where`, so a member without `pipeline.viewAll` cannot widen it by
  hand-crafting `?owner=`. The restriction lives in SQL, not in the client. `visibleToUserId` and
  `ownerId` compose as `AND`, so a hostile `?owner=` can only ever narrow the visible set.
- `canSeeTotals: false` hides **aggregates only** — per-stage totals and the `KpiBar`. Each deal's
  own value stays on its card. This is a deliberate product decision, not an oversight.
- The "Asesor" select in `FilterBar` is not rendered for a restricted member.

Touched: `app/app/[tenantSlug]/pipeline/page.tsx`, `features/pipeline/queries.ts`,
`KanbanColumn.tsx`, `PipelineClient.tsx`, `FilterBar.tsx`, `DealCard.tsx`.

---

## Defect fixes

### 1. Deep-link authorization — `features/deals/actions.ts`

`getDealSummaryAction` was written for the open funnel and returned any deal to any member. The
new `?deal=<id>` deep link calls it with a caller-supplied id, so a restricted advisor could read
another advisor's opportunity by editing the URL. The fix resolves `pipelineScopeFor` **server-side**
and passes `visibleToUserId` into the existing `getDeal(tenantId, dealId, visibleToUserId)` overload,
so the restriction is applied in the same query that fetches the deal. An out-of-scope deal comes back
as `null` and takes the ordinary "Oportunidad no encontrada." path — no separate branch, and no oracle
distinguishing "exists but not yours" from "does not exist".

### 2. Wrong permission key in reports

`pipelineScopeFor` derives its filter from `pipeline.viewAll`. Reports must read `reports.viewAll`
directly. The rename makes the misuse obvious at the call site; the function keeps its doc comment
warning against reuse.

---

## Features

### Reports — `app/app/[tenantSlug]/reports`

Lists **open** opportunities — excludes the `ganado` and `perdido` stages and anything
`isArchived` — sortable by creation date (oldest ↔ newest), filterable by advisor. Closed stages
are resolved by reading `PipelineStage.key`, never by hardcoded ids.

An advisor without `reports.viewAll` sees only their own and the advisor filter is not rendered.

New: `features/reports/queries.ts`, `features/reports/components/ReportsTable.tsx`,
`ReportsFilterBar.tsx`, `app/app/[tenantSlug]/reports/page.tsx`. Nav entry in `tenant-header.tsx`.

### Per-panel stats filters

Each panel carries its own filters (advisor, channel, equipment category, status) which **compose**
with the global date range rather than replacing it. State lives in the URL as `<panelId>.<key>`, so
a filtered view is shareable.

Design rule: a panel never offers a filter on the dimension it already groups by.

With `stats.viewTotals` off, money charts and columns disappear and amount KPI cards are replaced by
their count equivalents — the panel stays useful instead of going hollow.

New: `features/stats/panel-filters.ts`, `components/PanelFilters.tsx`, `components/StatsPanel.tsx`.
Modified: `features/stats/queries.ts` and all seven `stats/` pages.

**Behaviour change:** `stats/alerts` loses its page-wide `?owner=`. It carries three panels, and
each namespaces its own — `?vencidos.owner=`, `?hoy.owner=`, `?proximos.owner=`. Nothing in the app
linked that way, but a hand-saved link would stop applying its filter, and there is no single
parameter that filters all three panels at once any more.

### Clients → open opportunity

Each opportunity row in the client profile gets an **Abrir** button linking to `/pipeline?deal=<id>`.
The pipeline consumes the parameter exactly once (a `consumedDealParam` ref), opens the modal and
clears the URL, so closing the modal does not re-trigger it.

### Mobile funnel

One DOM tree, no duplicated board. The stage container is a `scroll-snap` carousel; each column is
`basis-full snap-center` on mobile and returns to `md:flex-1` on desktop. **Above `md` the Kanban is
byte-for-byte the same experience.** A 44px pill rail (`md:hidden`) shows and jumps between stages;
a 56px circular FAB honouring `env(safe-area-inset-bottom)` opens the existing modal.

Drag vs swipe: below 768px, dnd-kit is given **zero sensors** (`use-narrow-viewport.ts`, a
`useSyncExternalStore` over `matchMedia`), so the native scroll gesture wins uncontested. Stage
changes on mobile go through the detail modal.

### `lib/settings/constants.ts` — needs splitting

The source document listed this file only for the "Permisos" nav entry, but the demo changed three
things in it. Port all three, for distinct reasons:

1. **"Permisos" nav entry** in `SETTINGS_NAV` — the feature.
2. **Longest-prefix-wins in `equipmentIcon`** — a real defect. With the previous `Object.keys` scan,
   `Calentador` matched before `Calentadores solares`, so a solar heater rendered the electric icon.
3. **Additional icon prefixes** — `Drenaje`, `Accesorios`, `Repuesto`, `Mantenimiento`, `Kit`,
   `Iluminación`, `Otros`, `General`. Generic Spanish equipment terms that were added for the pitch
   but help any tenant whose catalogue uses them, and are inert for tenants that don't.

---

## Storage

`forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true"` in **both** `lib/storage/s3.ts` and
`lib/storage/s3-health.ts`. The health probe builds its own client; when only the main client had the
flag it reported `storage: "error"` while uploads succeeded.

`docker-compose.yml` gains MinIO as a dev service (~45 lines) alongside the already-present
`${DB_PORT:-5435}` parameterisation.

---

## Conflict with `15889e3`

One file: `features/pipeline/queries.ts`.

`15889e3` moved `getCatalogItemsInTx` out to `features/catalogs/queries.ts` and imports it. The demo
change adds a `scope` parameter to `loadPipelineKanbanData`. The two edits are orthogonal — take
`main`'s import and function removal, apply the demo's signature and `effectiveFilters` change on top.

No other file `15889e3` touched (`clients/queries.ts`, `follow-ups/queries.ts`, `layout.tsx`,
`catalogs/queries.ts`, the two `clients` pages) is touched by the demo.

---

## Testing

Full coverage, in two tiers.

### Unit — `tests/unit/`, run by `pnpm test`

- Three-layer resolution: default only; role override wins over default; user override wins over
  role override.
- `LOCKED_ROLES`: `OWNER` and `ADMIN` keep full access with a hostile `RolePermission` row **and**
  a hostile `UserPermission` row present.
- `permissionsForRole` ignores `UserPermission` rows; `permissionsFor` honours them.
- `memberPermissions` reports the correct `inherited` baseline and `overrideCount`.
- `pipelineScopeFor` maps `pipeline.viewAll` → `visibleToUserId` and `pipeline.viewTotals` →
  `canSeeTotals`.
- `isPermissionKey` rejects an unknown key, so a stale row cannot inject an arbitrary field.
- Catalogue integrity: every key in `PERMISSION_KEYS` has a `PERMISSION_DEFS` entry and a default
  for all five roles. This is what would have caught `clients.viewAll` shipping without a consumer.

### Integration — `tests/integration/`, run by `pnpm test:integration` (`app_user` harness, Postgres on :5435)

- `RolePermission` and `UserPermission` are readable and writable as `app_user` under the tenant
  GUC, and return nothing for a different tenant — the standard RLS assertion for a new business
  table. A bare `prisma.*` call must return nothing.
- A `MEMBER` without `pipeline.viewAll` receives only their own deals from
  `loadPipelineKanbanData`, **including when `dealFilters.ownerId` names someone else** — the
  `?owner=` widening attempt.
- That same member **does** receive a deal ceded to them through `DealViewer`, so the funnel agrees
  with archive, search and `stats/listado`.
- `getDealSummaryAction` returns the not-found error for a deal owned by someone else, succeeds for
  the caller's own, and succeeds for one ceded to them.
- The backfill: a tenant created before the migration resolves `pipeline.viewAll = true` for
  `MEMBER`; a tenant created after it resolves `false`.
- Reports scope keys off `reports.viewAll`, and is unaffected by toggling `pipeline.viewAll`.
- `setRolePermissionAction` / `setUserPermissionAction` reject a `MEMBER` caller, reject an unknown
  key, and reject a `LOCKED_ROLES` target.

Operational note: the integration suite truncates, so the dev database needs re-seeding afterwards.

### Verification gate before merge

`pnpm type-check`, `next lint`, `vitest run` (existing 98 plus the new suites), `pnpm build`, and a
manual pass on the two things no test covers: the swipe gesture on a real phone, and toggling the
matrix while signed in.

---

## Delivery

Branch `feat/permissions-and-scope` off `15889e3`, committed in dependency order. Each commit
carries its own tests rather than deferring them to a final pass:

1. Schema, both migrations including the backfill, RLS coverage.
2. Permission catalogue and three-layer resolution.
3. Permissions settings screen and its two server actions.
4. Deep-link authorization fix.
5. Funnel scope.
6. Reports.
7. Per-panel stats filters.
8. Clients → open opportunity.
9. Mobile funnel.
10. Equipment icon resolution fix.
11. Storage flag + MinIO.

The task-by-task breakdown lives in
[`../plans/2026-07-27-port-permisos-y-alcance.md`](../plans/2026-07-27-port-permisos-y-alcance.md).

Demo scaffolding stays uncommitted throughout. `docker-compose.yml` is committed (it carries
`DB_PORT` and MinIO); `package.json` and the root `README.md` are **not**, since their only pending
changes are demo-only.

---

## Production rollout

Migrations do not run in the Vercel build. Both must be applied by hand as `admin_user` through the
pooler before the deploy is promoted, or the app throws P2022 against the missing tables.

---

## Known debt, accepted

1. **Exceptions are per person, not per team.** "Karla's whole team sees X" is person-by-person today.
2. **Members lose funnel totals** on deploy day. Deliberate; recoverable per workspace by enabling
   `pipeline.viewTotals` for `MEMBER` in the matrix.
3. **No permission caching.** `permissionsFor` runs a query per call site. Acceptable at current
   scale and consistent with the one-transaction-per-request shape `15889e3` established, but it is
   the first thing to revisit if the pipeline page regresses.
