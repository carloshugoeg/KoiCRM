# Port demo work into main — Permissions, funnel scope, reports, mobile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-apply the KoiCRM-Demo working tree onto `main` as a permission system, a funnel scope derived from it, a reports screen, per-panel stats filters, a mobile funnel and two defect fixes — with the test coverage the demo never had.

**Architecture:** Permissions resolve in three layers (role default in code → `RolePermission` → `UserPermission`), with `OWNER`/`ADMIN` short-circuiting all three. Everything else consumes that resolution: the funnel pins its SQL `where` to an owner, reports key off their own permission, stats hide money aggregates. Both new tables are RLS-protected like every other business table.

**Tech Stack:** Next.js App Router (server components + server actions), Prisma, PostgreSQL with row-level security, zod, vitest (unit + integration), Tailwind, dnd-kit, lucide-react.

**Spec:** [`../specs/2026-07-27-port-permisos-y-alcance-design.md`](../specs/2026-07-27-port-permisos-y-alcance-design.md)

## Global Constraints

- **Source of truth for ported code:** `/Users/carloshugo/Documents/Projects/KoiCRM-Demo/crm-core/`. Referred to below as `$DEMO`. Export it once per shell: `export DEMO=/Users/carloshugo/Documents/Projects/KoiCRM-Demo/crm-core`.
- **Working directory** for every command: `/Users/carloshugo/Documents/Projects/KoiCRM/crm-core`.
- **Branch:** `feat/permissions-and-scope`, already created off `15889e3`. Do not merge to `main` inside this plan.
- **No semicolons.** The repo is written without statement semicolons even though `.prettierrc` says otherwise. Do not run Prettier over ported files; match the surrounding code.
- **No `Co-Authored-By` trailers** in commit messages.
- **Never use bare `prisma.*` on a tenant-scoped table.** `RolePermission`, `UserPermission`, `Deal`, `PipelineStage` and friends are RLS-protected; reads must go through `withTenant` from `@/lib/db/rls` or they silently return nothing as `app_user`. `prisma.tenant` / `prisma.membership` are not tenant-scoped and are fine bare.
- **Permission catalogue is four keys:** `pipeline.viewAll`, `pipeline.viewTotals`, `reports.viewAll`, `stats.viewTotals`. The demo's fifth key `clients.viewAll` is deliberately dropped — it had no consumer.
- **`dealScopeFor` is renamed `pipelineScopeFor`** and its type `DealScope` → `PipelineScope`, everywhere, in the same task that introduces it. The demo name never lands in this repo.
- **A restricted member's scope is `visibleToUserId`, never a bare `ownerId`.** The repo already expresses deal visibility as `dealVisibilityWhere(userId)` — owned **or ceded through `DealViewer`** — and `stats/listado`, `getDeal`, `getArchivedDeals` and search all use it. The demo pinned on `ownerId`, which would hide a ceded opportunity from the advisor's funnel while leaving it visible in archive and search. Deviate from the demo here.
- **Demo scaffolding stays out of every commit:** `scripts/demo-setup.sh`, `scripts/demo-bundle.sh`, `docs/ops/demo-playground.md`, the root `README.md` demo section, `package.json` scripts `demo:setup` / `seed:heiss`, `prisma/seed/demo-heiss.ts`, `public/demo/`. Always `git add` explicit paths; never `git add -A`.
- **Integration tests truncate the database.** After running them, re-seed the dev database before using the app.

---

## File Structure

**New — permission foundation**

| File | Responsibility |
|---|---|
| `lib/permissions/defaults.ts` | Permission catalogue: keys, labels, role defaults, `LOCKED_ROLES`. Pure data + type guards, no DB. |
| `lib/permissions/resolve.ts` | The three-layer resolution and everything derived from it. Server-only, all reads via `withTenant`. |
| `features/permissions/actions.ts` | The two server actions that write the tables. |
| `features/permissions/components/permissions-settings.tsx` | The role matrix UI. |
| `features/permissions/components/user-permissions.tsx` | Per-person exceptions UI. |
| `app/app/[tenantSlug]/settings/permissions/page.tsx` | Composes both sections. |
| `prisma/migrations/20260727045954_role_permissions/migration.sql` | Table + RLS + grant + compatibility backfill. |
| `prisma/migrations/20260727220015_user_permissions/migration.sql` | Table + RLS + grant. |

**New — features**

| File | Responsibility |
|---|---|
| `features/reports/queries.ts` | `getOpenOpportunities` — open deals, owner-filtered, sorted by age. |
| `features/reports/components/ReportsTable.tsx` | Presentation of the report rows. |
| `features/reports/components/ReportsFilterBar.tsx` | Sort + advisor controls. |
| `app/app/[tenantSlug]/reports/page.tsx` | Route; resolves `reports.viewAll` and pins the query. |
| `features/stats/panel-filters.ts` | Isomorphic per-panel filter contract: param naming, parsing, merging, de-duplicated loading. |
| `features/stats/components/PanelFilters.tsx` | The client control that writes `<panelId>.<key>` into the URL. |
| `features/stats/components/StatsPanel.tsx` | Panel shell that hosts a title + its filters. |
| `features/pipeline/hooks/use-narrow-viewport.ts` | `useSyncExternalStore` over `matchMedia`, so dnd-kit can be disarmed below 768px. |

**New — tests**

| File | Covers |
|---|---|
| `tests/unit/permissions-defaults.test.ts` | Catalogue integrity and `isPermissionKey`. |
| `tests/unit/panel-filters.test.ts` | Param naming, parsing, merging, `loadPanelData` de-duplication. |
| `tests/unit/equipment-icon.test.ts` | Longest-prefix-wins icon resolution. |
| `tests/integration/permissions-rls.test.ts` | RLS + grants on both new tables. |
| `tests/integration/permissions-resolve.test.ts` | Three-layer resolution, `LOCKED_ROLES`, backfill, `pipelineScopeFor`. |
| `tests/integration/permissions-actions.test.ts` | Both server actions: authz, validation, locked targets, clearing. |
| `tests/integration/pipeline-scope.test.ts` | `?owner=` widening attempt; deep-link authorization. |
| `tests/integration/reports-queries.test.ts` | Open-deal definition and `reports.viewAll` scoping. |

**Modified**

| File | Change |
|---|---|
| `prisma/schema.prisma` | Two models + two `Tenant` relations + one `User` relation. |
| `tests/integration/helpers.ts` | Truncate the two new tables. |
| `features/pipeline/queries.ts` | `scope` parameter; merged against `15889e3`. |
| `app/app/[tenantSlug]/pipeline/page.tsx` | Resolve scope, pass it down. |
| `features/pipeline/components/{PipelineClient,KanbanBoard,KanbanColumn,FilterBar,DealCard}.tsx` | Totals gating, mobile carousel, `?deal=` consumption. |
| `features/deals/actions.ts` | Deep-link authorization in `getDealSummaryAction`. |
| `features/clients/components/ClientProfile.tsx` | "Abrir" button. |
| `features/stats/queries.ts` + the 7 `stats/*/page.tsx` | Per-panel filters; money gated on `stats.viewTotals`. |
| `components/app/tenant-header.tsx` | "Reportes" nav entry. |
| `lib/settings/constants.ts` | "Permisos" nav entry (Task 3); `equipmentIcon` fix (Task 10). |
| `lib/storage/s3.ts`, `lib/storage/s3-health.ts` | `S3_FORCE_PATH_STYLE`. |
| `docker-compose.yml` | MinIO dev service. |

---

## Task 1: Schema, migrations and the compatibility backfill

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260727045954_role_permissions/migration.sql`
- Create: `prisma/migrations/20260727220015_user_permissions/migration.sql`
- Modify: `tests/integration/helpers.ts:36-53`
- Test: `tests/integration/permissions-rls.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: Prisma models `RolePermission` and `UserPermission`, each with a compound primary key — `prisma.rolePermission` keyed by `tenantId_role_key`, `prisma.userPermission` keyed by `tenantId_userId_key`. Both are RLS-protected: every read and write must go through `withTenant`.

- [ ] **Step 1: Add both models to the Prisma schema**

Append to `prisma/schema.prisma`:

```prisma
/// Workspace-level override of a role's built-in permission defaults.
/// Only rows that differ from the default are stored — a workspace with no rows is correct.
model RolePermission {
  tenantId  String
  role      Role
  key       String
  allowed   Boolean
  updatedAt DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@id([tenantId, role, key])
  @@index([tenantId])
}

/// Per-person exception on top of the role matrix. Absence means "inherit the role".
model UserPermission {
  tenantId  String
  userId    String
  key       String
  allowed   Boolean
  updatedAt DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([tenantId, userId, key])
  @@index([tenantId])
  @@index([userId])
}
```

Add the back-relations. In `model Tenant`, alongside the other relation fields:

```prisma
  rolePermissions RolePermission[]
  userPermissions UserPermission[]
```

In `model User`, alongside `memberships`:

```prisma
  userPermissions UserPermission[]
```

- [ ] **Step 2: Write the role-permissions migration**

Create `prisma/migrations/20260727045954_role_permissions/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "RolePermission" (
    "tenantId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "key" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("tenantId","role","key")
);

-- CreateIndex
CREATE INDEX "RolePermission_tenantId_idx" ON "RolePermission"("tenantId");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: RolePermission is tenant-scoped like every other business table.
ALTER TABLE "RolePermission" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "RolePermission"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- Grant new table permissions to app_user (policy applies automatically)
GRANT SELECT, INSERT, UPDATE, DELETE ON "RolePermission" TO app_user;

-- Compatibility backfill. Workspaces that already exist ran an open funnel: every member
-- saw every deal. The new MEMBER default is restricted, so pin the previous behaviour for
-- them. Workspaces created after this migration have no row here and get the restricted
-- default. Deliberately does NOT backfill pipeline.viewTotals — money aggregates are what
-- the restriction is for.
INSERT INTO "RolePermission" ("tenantId", "role", "key", "allowed", "updatedAt")
SELECT "id", 'MEMBER', 'pipeline.viewAll', true, NOW() FROM "Tenant";
```

- [ ] **Step 3: Write the user-permissions migration**

Create `prisma/migrations/20260727220015_user_permissions/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "UserPermission" (
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("tenantId","userId","key")
);

-- CreateIndex
CREATE INDEX "UserPermission_tenantId_idx" ON "UserPermission"("tenantId");

-- CreateIndex
CREATE INDEX "UserPermission_userId_idx" ON "UserPermission"("userId");

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: UserPermission is tenant-scoped like every other business table.
ALTER TABLE "UserPermission" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "UserPermission"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- Grant new table permissions to app_user (policy applies automatically)
GRANT SELECT, INSERT, UPDATE, DELETE ON "UserPermission" TO app_user;
```

- [ ] **Step 4: Add the new tables to the integration teardown**

In `tests/integration/helpers.ts`, add both names to the head of the business-tables list in `cleanDatabase` (they FK to `Tenant` and `User`, so they must be truncated before the identity tables):

```ts
  for (const table of [
    "RolePermission",
    "UserPermission",
    "Activity",
    "SavedView",
```

- [ ] **Step 5: Apply the migrations to the dev database**

Run:

```bash
pnpm db:up && pnpm db:migrate
```

Expected: Prisma reports both migrations applied and regenerates the client. If it offers to reset the database, accept — the dev data is re-seedable.

- [ ] **Step 6: Write the failing RLS test**

Create `tests/integration/permissions-rls.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { PrismaClient } from "@prisma/client"
import { prismaAdmin, prismaApp, withTenant, cleanDatabase, disconnectAll } from "./helpers"

/**
 * RLS + grants for the two permission tables. Same contract as every other business
 * table: readable under the tenant GUC, invisible without it, invisible to another tenant.
 */

let tenantA: string
let tenantB: string
let userA: string

beforeAll(async () => {
  await cleanDatabase()

  const a = await prismaAdmin.tenant.create({ data: { slug: `perm-rls-a-${Date.now()}`, name: "A" } })
  const b = await prismaAdmin.tenant.create({ data: { slug: `perm-rls-b-${Date.now()}`, name: "B" } })
  tenantA = a.id
  tenantB = b.id

  const u = await prismaAdmin.user.create({ data: { email: `perm-rls-${Date.now()}@test.com` } })
  userA = u.id
  await prismaAdmin.membership.create({
    data: { userId: userA, tenantId: tenantA, role: "MEMBER", status: "ACTIVE" },
  })
})

afterAll(async () => {
  await cleanDatabase()
  await disconnectAll()
})

describe("RolePermission RLS", () => {
  it("app_user can write and read back under its own tenant", async () => {
    await withTenant(tenantA, (tx) =>
      tx.rolePermission.create({
        data: { tenantId: tenantA, role: "MEMBER", key: "pipeline.viewTotals", allowed: true },
      }),
    )

    const rows = await withTenant(tenantA, (tx) => tx.rolePermission.findMany({ where: { tenantId: tenantA } }))
    expect(rows).toHaveLength(1)
    expect(rows[0].allowed).toBe(true)
  })

  it("is invisible from another tenant's context", async () => {
    const rows = await withTenant(tenantB, (tx) => tx.rolePermission.findMany({}))
    expect(rows).toHaveLength(0)
  })

  it("is invisible to a bare prisma read with no tenant GUC", async () => {
    const rows = await (prismaApp as PrismaClient).rolePermission.findMany({})
    expect(rows).toHaveLength(0)
  })
})

describe("UserPermission RLS", () => {
  it("app_user can write and read back under its own tenant", async () => {
    await withTenant(tenantA, (tx) =>
      tx.userPermission.create({
        data: { tenantId: tenantA, userId: userA, key: "reports.viewAll", allowed: true },
      }),
    )

    const rows = await withTenant(tenantA, (tx) => tx.userPermission.findMany({ where: { tenantId: tenantA } }))
    expect(rows).toHaveLength(1)
    expect(rows[0].key).toBe("reports.viewAll")
  })

  it("is invisible from another tenant's context", async () => {
    const rows = await withTenant(tenantB, (tx) => tx.userPermission.findMany({}))
    expect(rows).toHaveLength(0)
  })

  it("is invisible to a bare prisma read with no tenant GUC", async () => {
    const rows = await (prismaApp as PrismaClient).userPermission.findMany({})
    expect(rows).toHaveLength(0)
  })
})

describe("compatibility backfill", () => {
  it("gives every tenant that existed at migration time MEMBER pipeline.viewAll", async () => {
    // The backfill ran against tenants present when the migration was applied. Tenants
    // created by this suite are newer, so they must NOT carry a backfilled row.
    const rows = await withTenant(tenantA, (tx) =>
      tx.rolePermission.findMany({ where: { tenantId: tenantA, key: "pipeline.viewAll" } }),
    )
    expect(rows).toHaveLength(0)
  })
})
```

- [ ] **Step 7: Run the test and verify it passes**

Run:

```bash
pnpm test:integration tests/integration/permissions-rls.test.ts
```

Expected: 7 passing. If any RLS assertion returns rows instead of none, the `GRANT`/policy in the migration did not apply — re-check the migration ran as the database owner, not `app_user`.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260727045954_role_permissions prisma/migrations/20260727220015_user_permissions tests/integration/helpers.ts tests/integration/permissions-rls.test.ts
git commit -m "feat(permissions): add RolePermission and UserPermission tables

Both are tenant-scoped business tables: RLS enabled, tenant_isolation policy,
and the app_user grant. The role-permissions migration carries a compatibility
backfill so workspaces that already ran the open funnel keep MEMBER
pipeline.viewAll and see no change on deploy."
```

---

## Task 2: Permission catalogue and three-layer resolution

**Files:**
- Create: `lib/permissions/defaults.ts`
- Create: `lib/permissions/resolve.ts`
- Test: `tests/unit/permissions-defaults.test.ts`, `tests/integration/permissions-resolve.test.ts`

**Interfaces:**
- Consumes: `RolePermission` / `UserPermission` from Task 1; `withTenant` from `@/lib/db/rls`.
- Produces:
  - `PERMISSION_KEYS: readonly ["pipeline.viewAll","pipeline.viewTotals","reports.viewAll","stats.viewTotals"]`
  - `type PermissionKey`, `type PermissionMatrix = Record<Role, Record<PermissionKey, boolean>>`
  - `PERMISSION_DEFS: PermissionDef[]`, `ROLES: Role[]`, `ROLE_LABELS: Record<Role, string>`, `LOCKED_ROLES: Role[]`
  - `defaultPermission(role, key): boolean`, `defaultMatrix(): PermissionMatrix`, `isPermissionKey(v: string): v is PermissionKey`
  - `permissionsFor(tenantId, role, userId): Promise<Record<PermissionKey, boolean>>`
  - `permissionsForRole(tenantId, role): Promise<Record<PermissionKey, boolean>>`
  - `can(tenantId, role, userId, key): Promise<boolean>`
  - `permissionMatrix(tenantId): Promise<PermissionMatrix>`
  - `memberPermissions(tenantId, members: {userId, role}[]): Promise<MemberPermissions[]>` where `MemberPermissions = { userId, overrides: Record<PermissionKey, boolean|null>, inherited: Record<PermissionKey, boolean>, overrideCount: number }`
  - `interface PipelineScope { visibleToUserId: string | null; canSeeTotals: boolean }`
  - `pipelineScopeFor(tenantId, role, userId): Promise<PipelineScope>`

- [ ] **Step 1: Copy both files from the demo**

```bash
export DEMO=/Users/carloshugo/Documents/Projects/KoiCRM-Demo/crm-core
mkdir -p lib/permissions
cp $DEMO/lib/permissions/defaults.ts $DEMO/lib/permissions/resolve.ts lib/permissions/
```

- [ ] **Step 2: Drop `clients.viewAll` from the catalogue**

In `lib/permissions/defaults.ts`, three edits.

Remove the key from `PERMISSION_KEYS`:

```ts
export const PERMISSION_KEYS = [
  "pipeline.viewAll",
  "pipeline.viewTotals",
  "reports.viewAll",
  "stats.viewTotals",
] as const
```

Remove this whole entry from `PERMISSION_DEFS`:

```ts
  {
    key: "clients.viewAll",
    group: "Clientes",
    label: "Ver la base de datos de clientes",
    description: "Acceso al listado completo de clientes, sin importar quién atiende cada cuenta.",
  },
```

Remove the `"clients.viewAll": true,` line from all five role blocks in `DEFAULTS`, so each role reads exactly four keys. `MEMBER` and `VIEWER` end up as:

```ts
  MEMBER: {
    "pipeline.viewAll": false,
    "pipeline.viewTotals": false,
    "reports.viewAll": false,
    "stats.viewTotals": false,
  },
  VIEWER: {
    "pipeline.viewAll": true,
    "pipeline.viewTotals": false,
    "reports.viewAll": false,
    "stats.viewTotals": false,
  },
```

Then add this note above `DEFAULTS`, replacing the existing comment:

```ts
/**
 * Built-in defaults. Only supervisor, admin and superadmin see funnel totals; an asesor
 * sees their own funnel. Every key here must have a consumer somewhere in the app — a
 * toggle the settings screen renders but nothing reads is worse than no toggle at all.
 */
```

- [ ] **Step 3: Rename `dealScopeFor` to `pipelineScopeFor`**

In `lib/permissions/resolve.ts`, replace the final block:

```ts
/**
 * Pipeline-visibility scope for one person. When `visibleToUserId` is set, callers must pin
 * their query to what that user may see — their own deals plus anything ceded to them via
 * DealViewer. That is what `dealVisibilityWhere` already expresses, and what archive, search
 * and stats/listado already use; a bare `ownerId` here would hide ceded deals from the funnel
 * while leaving them visible everywhere else.
 *
 * Named for the permission it reads — `pipeline.viewAll`. Reports and stats have their own
 * keys and diverge the moment a workspace overrides one and not the other, so they must
 * read those directly rather than reuse this.
 */
export interface PipelineScope {
  visibleToUserId: string | null
  canSeeTotals: boolean
}

export async function pipelineScopeFor(
  tenantId: string,
  role: Role,
  userId: string,
): Promise<PipelineScope> {
  const perms = await permissionsFor(tenantId, role, userId)
  return {
    visibleToUserId: perms["pipeline.viewAll"] ? null : userId,
    canSeeTotals: perms["pipeline.viewTotals"],
  }
}
```

- [ ] **Step 4: Write the failing catalogue unit test**

Create `tests/unit/permissions-defaults.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  PERMISSION_KEYS,
  PERMISSION_DEFS,
  ROLES,
  ROLE_LABELS,
  LOCKED_ROLES,
  defaultMatrix,
  defaultPermission,
  isPermissionKey,
} from "@/lib/permissions/defaults"

describe("permission catalogue integrity", () => {
  it("gives every key exactly one definition", () => {
    const defKeys = PERMISSION_DEFS.map((d) => d.key).sort()
    expect(defKeys).toEqual([...PERMISSION_KEYS].sort())
    expect(new Set(defKeys).size).toBe(defKeys.length)
  })

  it("gives every role a default for every key", () => {
    const matrix = defaultMatrix()
    for (const role of ROLES) {
      expect(Object.keys(matrix[role]).sort()).toEqual([...PERMISSION_KEYS].sort())
    }
  })

  it("labels every role", () => {
    for (const role of ROLES) expect(ROLE_LABELS[role]).toBeTruthy()
  })

  it("does not carry clients.viewAll, which has no consumer", () => {
    expect(PERMISSION_KEYS as readonly string[]).not.toContain("clients.viewAll")
  })

  it("gives locked roles every permission by default", () => {
    for (const role of LOCKED_ROLES) {
      for (const key of PERMISSION_KEYS) expect(defaultPermission(role, key)).toBe(true)
    }
  })

  it("restricts MEMBER from the shared funnel and its totals", () => {
    expect(defaultPermission("MEMBER", "pipeline.viewAll")).toBe(false)
    expect(defaultPermission("MEMBER", "pipeline.viewTotals")).toBe(false)
  })

  it("returns a fresh matrix each call, so callers cannot mutate the defaults", () => {
    const first = defaultMatrix()
    first.MEMBER["pipeline.viewAll"] = true
    expect(defaultMatrix().MEMBER["pipeline.viewAll"]).toBe(false)
  })

  it("narrows known keys and rejects unknown ones", () => {
    expect(isPermissionKey("pipeline.viewAll")).toBe(true)
    expect(isPermissionKey("pipeline.nonsense")).toBe(false)
    expect(isPermissionKey("")).toBe(false)
  })
})
```

- [ ] **Step 5: Run the unit test**

Run:

```bash
pnpm test tests/unit/permissions-defaults.test.ts
```

Expected: 8 passing.

- [ ] **Step 6: Write the failing resolution integration test**

Create `tests/integration/permissions-resolve.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest"
import { prismaAdmin, withTenant, cleanDatabase, disconnectAll } from "./helpers"
import {
  permissionsFor,
  permissionsForRole,
  can,
  permissionMatrix,
  memberPermissions,
  pipelineScopeFor,
} from "@/lib/permissions/resolve"

let tenantId: string
let memberId: string
let ownerId: string

beforeAll(async () => {
  await cleanDatabase()

  const tenant = await prismaAdmin.tenant.create({
    data: { slug: `perm-resolve-${Date.now()}`, name: "Resolve" },
  })
  tenantId = tenant.id

  const member = await prismaAdmin.user.create({ data: { email: `member-${Date.now()}@test.com` } })
  memberId = member.id
  await prismaAdmin.membership.create({
    data: { userId: memberId, tenantId, role: "MEMBER", status: "ACTIVE" },
  })

  const owner = await prismaAdmin.user.create({ data: { email: `owner-${Date.now()}@test.com` } })
  ownerId = owner.id
  await prismaAdmin.membership.create({
    data: { userId: ownerId, tenantId, role: "OWNER", status: "ACTIVE" },
  })
})

afterAll(async () => {
  await cleanDatabase()
  await disconnectAll()
})

beforeEach(async () => {
  await withTenant(tenantId, async (tx) => {
    await tx.rolePermission.deleteMany({ where: { tenantId } })
    await tx.userPermission.deleteMany({ where: { tenantId } })
  })
})

async function setRole(role: "MEMBER" | "SUPERVISOR" | "VIEWER", key: string, allowed: boolean) {
  await withTenant(tenantId, (tx) =>
    tx.rolePermission.create({ data: { tenantId, role, key, allowed } }),
  )
}

async function setUser(userId: string, key: string, allowed: boolean) {
  await withTenant(tenantId, (tx) =>
    tx.userPermission.create({ data: { tenantId, userId, key, allowed } }),
  )
}

describe("layer 1 — built-in defaults", () => {
  it("applies the role default when nothing is stored", async () => {
    const perms = await permissionsFor(tenantId, "MEMBER", memberId)
    expect(perms["pipeline.viewAll"]).toBe(false)
    expect(perms["stats.viewTotals"]).toBe(false)
  })
})

describe("layer 2 — RolePermission overrides the default", () => {
  it("opens the funnel for the whole role", async () => {
    await setRole("MEMBER", "pipeline.viewAll", true)
    const perms = await permissionsFor(tenantId, "MEMBER", memberId)
    expect(perms["pipeline.viewAll"]).toBe(true)
  })

  it("closes a permission the default grants", async () => {
    await setRole("SUPERVISOR", "stats.viewTotals", false)
    const perms = await permissionsForRole(tenantId, "SUPERVISOR")
    expect(perms["stats.viewTotals"]).toBe(false)
  })

  it("ignores a row whose key is not in the catalogue", async () => {
    await setRole("MEMBER", "pipeline.nonsense", true)
    const perms = await permissionsFor(tenantId, "MEMBER", memberId)
    expect(perms).not.toHaveProperty("pipeline.nonsense")
  })
})

describe("layer 3 — UserPermission overrides the role", () => {
  it("grants one person what the role denies", async () => {
    await setUser(memberId, "pipeline.viewAll", true)
    const perms = await permissionsFor(tenantId, "MEMBER", memberId)
    expect(perms["pipeline.viewAll"]).toBe(true)
  })

  it("beats a conflicting role override", async () => {
    await setRole("MEMBER", "pipeline.viewAll", true)
    await setUser(memberId, "pipeline.viewAll", false)
    const perms = await permissionsFor(tenantId, "MEMBER", memberId)
    expect(perms["pipeline.viewAll"]).toBe(false)
  })

  it("does not leak into the role-level view used by the matrix", async () => {
    await setUser(memberId, "pipeline.viewAll", true)
    const perms = await permissionsForRole(tenantId, "MEMBER")
    expect(perms["pipeline.viewAll"]).toBe(false)
  })
})

describe("locked roles", () => {
  it("keeps full access despite a hostile role row and a hostile user row", async () => {
    await withTenant(tenantId, async (tx) => {
      await tx.rolePermission.create({
        data: { tenantId, role: "OWNER", key: "pipeline.viewAll", allowed: false },
      })
      await tx.userPermission.create({
        data: { tenantId, userId: ownerId, key: "pipeline.viewAll", allowed: false },
      })
    })

    const perms = await permissionsFor(tenantId, "OWNER", ownerId)
    expect(perms["pipeline.viewAll"]).toBe(true)
    expect(perms["stats.viewTotals"]).toBe(true)
    expect(await can(tenantId, "OWNER", ownerId, "reports.viewAll")).toBe(true)
  })

  it("keeps locked roles out of the settings matrix overrides", async () => {
    await withTenant(tenantId, (tx) =>
      tx.rolePermission.create({
        data: { tenantId, role: "ADMIN", key: "stats.viewTotals", allowed: false },
      }),
    )
    const matrix = await permissionMatrix(tenantId)
    expect(matrix.ADMIN["stats.viewTotals"]).toBe(true)
  })
})

describe("memberPermissions", () => {
  it("reports the inherited baseline and counts only real exceptions", async () => {
    await setRole("MEMBER", "reports.viewAll", true)
    await setUser(memberId, "pipeline.viewAll", true)

    const [row] = await memberPermissions(tenantId, [{ userId: memberId, role: "MEMBER" }])
    expect(row.inherited["reports.viewAll"]).toBe(true)
    expect(row.overrides["pipeline.viewAll"]).toBe(true)
    expect(row.overrides["stats.viewTotals"]).toBeNull()
    expect(row.overrideCount).toBe(1)
  })
})

describe("pipelineScopeFor", () => {
  it("pins a restricted member to what they may see, and hides totals", async () => {
    const scope = await pipelineScopeFor(tenantId, "MEMBER", memberId)
    expect(scope.visibleToUserId).toBe(memberId)
    expect(scope.canSeeTotals).toBe(false)
  })

  it("unpins the member once pipeline.viewAll is granted", async () => {
    await setRole("MEMBER", "pipeline.viewAll", true)
    const scope = await pipelineScopeFor(tenantId, "MEMBER", memberId)
    expect(scope.visibleToUserId).toBeNull()
    expect(scope.canSeeTotals).toBe(false)
  })

  it("grants totals independently of visibility", async () => {
    await setRole("MEMBER", "pipeline.viewTotals", true)
    const scope = await pipelineScopeFor(tenantId, "MEMBER", memberId)
    expect(scope.visibleToUserId).toBe(memberId)
    expect(scope.canSeeTotals).toBe(true)
  })
})
```

- [ ] **Step 7: Run the integration test**

Run:

```bash
pnpm test:integration tests/integration/permissions-resolve.test.ts
```

Expected: 13 passing.

- [ ] **Step 8: Type-check and commit**

```bash
pnpm type-check
git add lib/permissions tests/unit/permissions-defaults.test.ts tests/integration/permissions-resolve.test.ts
git commit -m "feat(permissions): resolve permissions in three layers

Role default in code, then RolePermission, then UserPermission, with OWNER and
ADMIN short-circuiting all three so no matrix row or per-person exception can
lock an administrator out.

Drops the demo's clients.viewAll key: it was rendered as a toggle in the matrix
but no query read it, so turning it off did nothing. Names the funnel scope
pipelineScopeFor after the permission it actually reads, since reports and stats
have their own keys."
```

---

## Task 3: Permissions settings screen

**Files:**
- Create: `features/permissions/actions.ts`, `features/permissions/components/permissions-settings.tsx`, `features/permissions/components/user-permissions.tsx`
- Create: `app/app/[tenantSlug]/settings/permissions/page.tsx`
- Modify: `lib/settings/constants.ts` (nav entry only)
- Test: `tests/integration/permissions-actions.test.ts`

**Interfaces:**
- Consumes: everything from Task 2.
- Produces: `setRolePermissionAction(raw)` and `setUserPermissionAction(raw)`, both returning `Promise<{ ok: boolean; error?: string }>`. `setUserPermissionAction` accepts `allowed: boolean | null`, where `null` deletes the exception.

- [ ] **Step 1: Copy the feature and route from the demo**

```bash
export DEMO=/Users/carloshugo/Documents/Projects/KoiCRM-Demo/crm-core
mkdir -p features/permissions/components "app/app/[tenantSlug]/settings/permissions"
cp $DEMO/features/permissions/actions.ts features/permissions/
cp $DEMO/features/permissions/components/permissions-settings.tsx $DEMO/features/permissions/components/user-permissions.tsx features/permissions/components/
cp "$DEMO/app/app/[tenantSlug]/settings/permissions/page.tsx" "app/app/[tenantSlug]/settings/permissions/page.tsx"
```

The UI iterates `PERMISSION_DEFS`, so dropping `clients.viewAll` in Task 2 removes its row from both screens with no further edit. Verify no file names it:

```bash
grep -rn "clients.viewAll" features/permissions "app/app/[tenantSlug]/settings/permissions" || echo "clean"
```

Expected: `clean`.

- [ ] **Step 2: Add the nav entry**

In `lib/settings/constants.ts`, add `ShieldCheck` to the `lucide-react` import list, then insert the entry into `SETTINGS_NAV` between Usuarios and Equipos:

```ts
export const SETTINGS_NAV = [
  { label: "Apariencia", section: "appearance", icon: Palette },
  { label: "Usuarios", section: "users", icon: Users },
  { label: "Permisos", section: "permissions", icon: ShieldCheck },
  { label: "Equipos", section: "equipment", icon: Package },
```

Leave `EQUIPMENT_ICONS` and `equipmentIcon` untouched — they are Task 10.

- [ ] **Step 3: Write the failing server-action test**

Create `tests/integration/permissions-actions.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest"
import type { Session } from "next-auth"
import { prismaAdmin, withTenant, cleanDatabase, disconnectAll } from "./helpers"

process.env.AUTH_SECRET ??= "test-permissions-actions-secret"

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

// Import AFTER mocks.
import { setRolePermissionAction, setUserPermissionAction } from "@/features/permissions/actions"
import { permissionsFor } from "@/lib/permissions/resolve"
import { auth } from "@/lib/auth/auth"

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>

let tenantId: string
let adminId: string
let memberId: string
let outsiderId: string

beforeAll(async () => {
  await cleanDatabase()

  const tenant = await prismaAdmin.tenant.create({
    data: { slug: `perm-actions-${Date.now()}`, name: "Actions" },
  })
  tenantId = tenant.id

  const admin = await prismaAdmin.user.create({ data: { email: `admin-${Date.now()}@test.com` } })
  adminId = admin.id
  await prismaAdmin.membership.create({
    data: { userId: adminId, tenantId, role: "ADMIN", status: "ACTIVE" },
  })

  const member = await prismaAdmin.user.create({ data: { email: `mem-${Date.now()}@test.com` } })
  memberId = member.id
  await prismaAdmin.membership.create({
    data: { userId: memberId, tenantId, role: "MEMBER", status: "ACTIVE" },
  })

  const outsider = await prismaAdmin.user.create({ data: { email: `out-${Date.now()}@test.com` } })
  outsiderId = outsider.id
})

afterAll(async () => {
  await cleanDatabase()
  await disconnectAll()
})

beforeEach(async () => {
  mockAuth.mockReset()
  mockAuth.mockResolvedValue({ user: { id: adminId } } as Session)
  await withTenant(tenantId, async (tx) => {
    await tx.rolePermission.deleteMany({ where: { tenantId } })
    await tx.userPermission.deleteMany({ where: { tenantId } })
  })
})

describe("setRolePermissionAction", () => {
  it("stores an override an admin sets", async () => {
    const res = await setRolePermissionAction({
      tenantId,
      role: "MEMBER",
      key: "pipeline.viewAll",
      allowed: true,
    })
    expect(res.ok).toBe(true)
    expect((await permissionsFor(tenantId, "MEMBER", memberId))["pipeline.viewAll"]).toBe(true)
  })

  it("updates the existing row instead of failing on the second write", async () => {
    await setRolePermissionAction({ tenantId, role: "MEMBER", key: "reports.viewAll", allowed: true })
    const res = await setRolePermissionAction({
      tenantId,
      role: "MEMBER",
      key: "reports.viewAll",
      allowed: false,
    })
    expect(res.ok).toBe(true)
    expect((await permissionsFor(tenantId, "MEMBER", memberId))["reports.viewAll"]).toBe(false)
  })

  it("rejects a key outside the catalogue", async () => {
    const res = await setRolePermissionAction({
      tenantId,
      role: "MEMBER",
      key: "pipeline.nonsense",
      allowed: true,
    })
    expect(res.ok).toBe(false)
  })

  it("refuses to weaken a locked role", async () => {
    const res = await setRolePermissionAction({
      tenantId,
      role: "ADMIN",
      key: "pipeline.viewAll",
      allowed: false,
    })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/acceso completo/i)
  })

  it("denies a plain member", async () => {
    mockAuth.mockResolvedValue({ user: { id: memberId } } as Session)
    const res = await setRolePermissionAction({
      tenantId,
      role: "MEMBER",
      key: "pipeline.viewAll",
      allowed: true,
    })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/denegado/i)
  })

  it("denies an unauthenticated caller", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await setRolePermissionAction({
      tenantId,
      role: "MEMBER",
      key: "pipeline.viewAll",
      allowed: true,
    })
    expect(res.ok).toBe(false)
  })
})

describe("setUserPermissionAction", () => {
  it("stores a per-person exception", async () => {
    const res = await setUserPermissionAction({
      tenantId,
      userId: memberId,
      key: "pipeline.viewAll",
      allowed: true,
    })
    expect(res.ok).toBe(true)
    expect((await permissionsFor(tenantId, "MEMBER", memberId))["pipeline.viewAll"]).toBe(true)
  })

  it("clears the exception when allowed is null, restoring inheritance", async () => {
    await setUserPermissionAction({ tenantId, userId: memberId, key: "pipeline.viewAll", allowed: true })
    const res = await setUserPermissionAction({
      tenantId,
      userId: memberId,
      key: "pipeline.viewAll",
      allowed: null,
    })
    expect(res.ok).toBe(true)
    expect((await permissionsFor(tenantId, "MEMBER", memberId))["pipeline.viewAll"]).toBe(false)
  })

  it("refuses a target who is not a member of the workspace", async () => {
    const res = await setUserPermissionAction({
      tenantId,
      userId: outsiderId,
      key: "pipeline.viewAll",
      allowed: true,
    })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/no pertenece/i)
  })

  it("refuses to give an admin an exception", async () => {
    const res = await setUserPermissionAction({
      tenantId,
      userId: adminId,
      key: "pipeline.viewAll",
      allowed: false,
    })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/acceso completo/i)
  })

  it("denies a plain member", async () => {
    mockAuth.mockResolvedValue({ user: { id: memberId } } as Session)
    const res = await setUserPermissionAction({
      tenantId,
      userId: memberId,
      key: "pipeline.viewAll",
      allowed: true,
    })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/denegado/i)
  })
})
```

- [ ] **Step 4: Run the test**

Run:

```bash
pnpm test:integration tests/integration/permissions-actions.test.ts
```

Expected: 11 passing.

- [ ] **Step 5: Verify the screen builds and lints**

Run:

```bash
pnpm type-check && pnpm lint
```

Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add features/permissions "app/app/[tenantSlug]/settings/permissions" lib/settings/constants.ts tests/integration/permissions-actions.test.ts
git commit -m "feat(permissions): settings screen for the role matrix and per-person exceptions

Two sections under Ajustes → Permisos: the workspace role matrix, and per-person
exceptions with a three-state control (hereda / sí / no) that states what
'hereda' currently resolves to. Both server actions validate with zod and gate on
OWNER/ADMIN; locked roles are rejected server-side, not just hidden."
```

---

## Task 4: Deep-link authorization in `getDealSummaryAction`

**Files:**
- Modify: `features/deals/actions.ts`
- Test: `tests/integration/pipeline-scope.test.ts` (created here, extended in Task 5)

**Interfaces:**
- Consumes: `pipelineScopeFor` from Task 2.
- Produces: no new exports. `getDealSummaryAction` now returns `{ ok: false, error: "Oportunidad no encontrada." }` for a deal outside the caller's scope.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/pipeline-scope.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest"
import type { Session } from "next-auth"
import { randomBytes } from "crypto"
import { prismaAdmin, withTenant, cleanDatabase, disconnectAll } from "./helpers"

/**
 * Deal visibility must be enforced on the server, not only in the UI. The pipeline
 * `?deal=<id>` deep link calls getDealSummaryAction with a caller-supplied id, so a
 * restricted member could otherwise read a colleague's opportunity by editing the URL.
 */

process.env.AUTH_SECRET ??= "test-pipeline-scope-secret"

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

// Import AFTER mocks.
import { getDealSummaryAction } from "@/features/deals/actions"
import { auth } from "@/lib/auth/auth"

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>

function makeCuid(): string {
  return "c" + randomBytes(12).toString("hex")
}

let tenantId: string
let memberId: string
let otherId: string
let ownDealId: string
let foreignDealId: string
let cededDealId: string

beforeAll(async () => {
  await cleanDatabase()

  const tenant = await prismaAdmin.tenant.create({
    data: { slug: `scope-${Date.now()}`, name: "Scope" },
  })
  tenantId = tenant.id

  const member = await prismaAdmin.user.create({ data: { email: `sofia-${Date.now()}@test.com` } })
  memberId = member.id
  await prismaAdmin.membership.create({
    data: { userId: memberId, tenantId, role: "MEMBER", status: "ACTIVE" },
  })

  const other = await prismaAdmin.user.create({ data: { email: `karla-${Date.now()}@test.com` } })
  otherId = other.id
  await prismaAdmin.membership.create({
    data: { userId: otherId, tenantId, role: "MEMBER", status: "ACTIVE" },
  })

  const pipeline = await prismaAdmin.pipeline.create({
    data: { tenantId, name: "P", isDefault: true },
  })
  const stage = await prismaAdmin.pipelineStage.create({
    data: {
      tenantId,
      pipelineId: pipeline.id,
      order: 0,
      key: "nuevo",
      label: "Nuevo",
      color: "#6366f1",
      iconKey: "circle",
    },
  })

  const own = await prismaAdmin.deal.create({
    data: {
      id: makeCuid(),
      tenantId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      ownerId: memberId,
      name: "Propia",
      channelKey: "web",
      statusKey: "active",
      value: 100,
    },
  })
  ownDealId = own.id

  const foreign = await prismaAdmin.deal.create({
    data: {
      id: makeCuid(),
      tenantId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      ownerId: otherId,
      name: "Ajena",
      channelKey: "web",
      statusKey: "active",
      value: 200,
    },
  })
  foreignDealId = foreign.id

  // Owned by someone else but ceded to the member through DealViewer. It must behave
  // like one of their own — the same way archive, search and stats/listado treat it.
  const ceded = await prismaAdmin.deal.create({
    data: {
      id: makeCuid(),
      tenantId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      ownerId: otherId,
      name: "Cedida",
      channelKey: "web",
      statusKey: "active",
      value: 300,
    },
  })
  cededDealId = ceded.id
  await prismaAdmin.dealViewer.create({
    data: { tenantId, dealId: cededDealId, userId: memberId },
  })
})

afterAll(async () => {
  await cleanDatabase()
  await disconnectAll()
})

beforeEach(async () => {
  mockAuth.mockReset()
  mockAuth.mockResolvedValue({ user: { id: memberId } } as Session)
  await withTenant(tenantId, (tx) => tx.rolePermission.deleteMany({ where: { tenantId } }))
})

describe("getDealSummaryAction deep-link authorization", () => {
  it("returns the caller's own deal", async () => {
    const res = await getDealSummaryAction({ tenantId, dealId: ownDealId })
    expect(res.ok).toBe(true)
  })

  it("refuses a deal owned by someone else", async () => {
    const res = await getDealSummaryAction({ tenantId, dealId: foreignDealId })
    expect(res.ok).toBe(false)
  })

  it("returns a deal ceded to the caller through DealViewer", async () => {
    const res = await getDealSummaryAction({ tenantId, dealId: cededDealId })
    expect(res.ok).toBe(true)
  })

  it("does not distinguish a foreign deal from a missing one", async () => {
    const foreign = await getDealSummaryAction({ tenantId, dealId: foreignDealId })
    const missing = await getDealSummaryAction({ tenantId, dealId: makeCuid() })
    expect(foreign.ok).toBe(false)
    expect(missing.ok).toBe(false)
    expect(foreign.error).toBe(missing.error)
  })

  it("returns the foreign deal once the role is granted pipeline.viewAll", async () => {
    await withTenant(tenantId, (tx) =>
      tx.rolePermission.create({
        data: { tenantId, role: "MEMBER", key: "pipeline.viewAll", allowed: true },
      }),
    )
    const res = await getDealSummaryAction({ tenantId, dealId: foreignDealId })
    expect(res.ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run it and verify it fails**

Run:

```bash
pnpm test:integration tests/integration/pipeline-scope.test.ts
```

Expected: FAIL — "refuses a deal owned by someone else" and "does not distinguish…" both fail, because the action still returns any deal to any member. The ceded-deal case passes for the wrong reason at this point; it becomes meaningful once the fix lands.

- [ ] **Step 3: Apply the fix**

In `features/deals/actions.ts`, add the import next to the other `@/lib` imports:

```ts
import { pipelineScopeFor } from "@/lib/permissions/resolve"
```

In `getDealSummaryAction`, replace the `// Embudo abierto: every member can view any deal.` comment and the `getDeal` call that follows it with:

```ts
  // Deal visibility is permission-driven: a role without pipeline.viewAll sees only what is
  // theirs or ceded to them. Enforced here rather than only in the UI, because this action is
  // reachable directly — the pipeline ?deal=<id> deep link calls it with an arbitrary id.
  // Passing the scope into getDeal applies the restriction in the same query that fetches the
  // deal, so an out-of-scope id takes the ordinary not-found path and is not an existence oracle.
  const scope = await pipelineScopeFor(tenantId, role, session.user.id)
  const d = await getDeal(tenantId, dealId, scope.visibleToUserId ?? undefined)
  if (!d) return { ok: false, error: "Oportunidad no encontrada." }
```

`getDeal(tenantId, dealId, visibleToUserId?)` already exists in `features/deals/queries.ts` and applies `dealVisibilityWhere` when the third argument is present — no change is needed there.

- [ ] **Step 4: Run the test again**

Run:

```bash
pnpm test:integration tests/integration/pipeline-scope.test.ts
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add features/deals/actions.ts tests/integration/pipeline-scope.test.ts
git commit -m "fix(security): authorize deal summary reads against the caller's scope

getDealSummaryAction was written for the open funnel and returned any deal to any
member. The new ?deal=<id> deep link calls it with a caller-supplied id, so a
restricted advisor could read a colleague's opportunity by editing the URL.

Resolves pipelineScopeFor server-side and passes it into the existing getDeal
visibility overload, so the restriction is applied in the same query that fetches
the deal: an out-of-scope id takes the ordinary not-found path rather than a
separate branch, and a deal ceded through DealViewer still resolves."
```

---

## Task 5: Funnel scope in the pipeline

**Files:**
- Modify: `features/pipeline/queries.ts`
- Modify: `app/app/[tenantSlug]/pipeline/page.tsx`
- Modify: `features/pipeline/components/{PipelineClient,KanbanColumn,FilterBar,DealCard}.tsx`
- Test: `tests/integration/pipeline-scope.test.ts` (extended)

**Interfaces:**
- Consumes: `pipelineScopeFor` and `PipelineScope` from Task 2.
- Produces: `loadPipelineKanbanData(tenantId, dealFilters, scope?)` — the third parameter is optional so existing callers keep compiling; when `scope.visibleToUserId` is set it is merged into `dealFilters.visibleToUserId`. `PipelineClient` gains props `canSeeTotals: boolean` and `restrictedOwnerId: string | null` (the latter only drives whether the advisor select renders).

- [ ] **Step 1: Extend the test with the `?owner=` widening attempt**

Append to `tests/integration/pipeline-scope.test.ts`, and add the import at the top of the file:

```ts
import { loadPipelineKanbanData } from "@/features/pipeline/queries"
import { pipelineScopeFor } from "@/lib/permissions/resolve"
```

```ts
describe("loadPipelineKanbanData scope enforcement", () => {
  it("returns the member's own deals plus what was ceded to them, and nothing else", async () => {
    const scope = await pipelineScopeFor(tenantId, "MEMBER", memberId)
    const { deals } = await loadPipelineKanbanData(tenantId, {}, scope)
    expect(deals.map((d) => d.id).sort()).toEqual([ownDealId, cededDealId].sort())
  })

  it("cannot be widened by a hand-crafted ?owner= naming someone else", async () => {
    const scope = await pipelineScopeFor(tenantId, "MEMBER", memberId)
    const { deals } = await loadPipelineKanbanData(tenantId, { ownerId: otherId }, scope)
    const ids = deals.map((d) => d.id)
    expect(ids).not.toContain(foreignDealId)
    // ownerId narrows within the visible set: the ceded deal is owned by otherId.
    expect(ids).toEqual([cededDealId])
  })

  it("returns the whole funnel once pipeline.viewAll is granted", async () => {
    await withTenant(tenantId, (tx) =>
      tx.rolePermission.create({
        data: { tenantId, role: "MEMBER", key: "pipeline.viewAll", allowed: true },
      }),
    )
    const scope = await pipelineScopeFor(tenantId, "MEMBER", memberId)
    const { deals } = await loadPipelineKanbanData(tenantId, {}, scope)
    expect(deals.map((d) => d.id).sort()).toEqual([ownDealId, foreignDealId, cededDealId].sort())
  })

  it("still honours an explicit ?owner= for an unrestricted role", async () => {
    const scope = await pipelineScopeFor(tenantId, "SUPERVISOR", memberId)
    const { deals } = await loadPipelineKanbanData(tenantId, { ownerId: otherId }, scope)
    expect(deals.map((d) => d.id).sort()).toEqual([foreignDealId, cededDealId].sort())
  })
})
```

- [ ] **Step 2: Run it and verify the new cases fail**

Run:

```bash
pnpm test:integration tests/integration/pipeline-scope.test.ts
```

Expected: FAIL. `loadPipelineKanbanData` still takes two parameters, so the third argument is ignored and a restricted member gets the whole funnel. The five Task 4 cases still pass.

- [ ] **Step 3: Add the scope parameter to the loader, merged against `15889e3`**

`main` moved `getCatalogItemsInTx` into `features/catalogs/queries.ts`; the demo version still declares it locally. Keep `main`'s import and take only the demo's scope logic.

In `features/pipeline/queries.ts`, add below the existing imports:

```ts
import type { PipelineScope } from "@/lib/permissions/resolve"
```

Then replace the `loadPipelineKanbanData` signature and doc comment with:

```ts
/**
 * Loads all pipeline/kanban page data in a single DB transaction.
 * Avoids opening many parallel pool connections (Supabase session pooler limit: 15).
 *
 * `scope` comes from `pipelineScopeFor()`. When `scope.visibleToUserId` is set the query is pinned
 * to what that user may see — their own deals plus anything ceded to them. `visibleToUserId` and a
 * caller-supplied `ownerId` compose as AND in the where clause, so a member without
 * `pipeline.viewAll` can only ever narrow the result with `?owner=`, never widen it.
 */
export async function loadPipelineKanbanData(
  tenantId: string,
  dealFilters: PipelineFilters,
  scope?: PipelineScope,
) {
  const effectiveFilters: PipelineFilters = scope?.visibleToUserId
    ? { ...dealFilters, visibleToUserId: scope.visibleToUserId }
    : dealFilters
```

Inside the transaction, swap the two uses of `dealFilters` for `effectiveFilters`:

```ts
    const rawDeals = pipeline ? await fetchPipelineDealsInTx(tx, tenantId, effectiveFilters) : []
    const deals = mapPipelineDeals(rawDeals, effectiveFilters)
```

Do **not** re-add a local `getCatalogItemsInTx`; `main` imports it from `@/features/catalogs/queries`.

- [ ] **Step 4: Run the test again and verify it passes**

Run:

```bash
pnpm test:integration tests/integration/pipeline-scope.test.ts
```

Expected: 9 passing.

- [ ] **Step 5: Resolve the scope in the page and pass it down**

In `app/app/[tenantSlug]/pipeline/page.tsx`, add the import:

```ts
import { pipelineScopeFor } from "@/lib/permissions/resolve"
```

Before the `loadPipelineKanbanData` call, add:

```ts
  // Permission scope: `visibleToUserId` pins the query to what this member may see (their own
  // deals plus anything ceded to them), `canSeeTotals` controls only the aggregate money
  // (per-stage totals + KPIs), never each deal's value.
  const scope = await pipelineScopeFor(tenantId, membership.role, session.user.id)
```

Pass `scope` as the third argument to `loadPipelineKanbanData`, and add two props to `<PipelineClient>`. `restrictedOwnerId` is only read to decide whether the advisor select renders, so the scope's user id is the right value:

```tsx
          canSeeTotals={scope.canSeeTotals}
          restrictedOwnerId={scope.visibleToUserId}
```

- [ ] **Step 6: Copy the four presentation components**

```bash
export DEMO=/Users/carloshugo/Documents/Projects/KoiCRM-Demo/crm-core
cp $DEMO/features/pipeline/components/PipelineClient.tsx features/pipeline/components/
cp $DEMO/features/pipeline/components/KanbanColumn.tsx features/pipeline/components/
cp $DEMO/features/pipeline/components/FilterBar.tsx features/pipeline/components/
cp $DEMO/features/pipeline/components/DealCard.tsx features/pipeline/components/
```

`PipelineClient.tsx` also carries the mobile carousel wiring and the `?deal=` consumption, which Tasks 8 and 9 depend on — copying the whole file here is intentional. `KanbanBoard.tsx` is **not** copied yet; it is Task 9, and until then the board renders as it does on `main`.

- [ ] **Step 7: Type-check, lint, run the full suite**

Run:

```bash
pnpm type-check && pnpm lint && pnpm test
```

Expected: clean, and every previously passing unit test still passes. If `PipelineClient.tsx` fails to compile on a missing `use-narrow-viewport` import, create the hook now rather than in Task 9:

```bash
mkdir -p features/pipeline/hooks
cp $DEMO/features/pipeline/hooks/use-narrow-viewport.ts features/pipeline/hooks/
```

- [ ] **Step 8: Commit**

```bash
git add features/pipeline "app/app/[tenantSlug]/pipeline/page.tsx" tests/integration/pipeline-scope.test.ts
git commit -m "feat(pipeline): scope the funnel to what the member may see

pipelineScopeFor resolves a visibleToUserId and a totals flag; the id is merged into
the query filters before the where clause is built, so a member without
pipeline.viewAll cannot widen the funnel by hand-crafting ?owner= — the two compose
as AND and can only narrow. The advisor select is hidden for a restricted member.

Scope reuses the existing visibleToUserId mechanism rather than a bare ownerId, so a
deal ceded through DealViewer stays in the advisor's funnel, matching how archive,
search and stats/listado already behave.

Without pipeline.viewTotals, per-stage totals and the KPI bar disappear; each
deal's own value stays on its card."
```

---

## Task 6: Reports

**Files:**
- Create: `features/reports/queries.ts`, `features/reports/components/ReportsTable.tsx`, `features/reports/components/ReportsFilterBar.tsx`, `app/app/[tenantSlug]/reports/page.tsx`
- Modify: `components/app/tenant-header.tsx`
- Test: `tests/integration/reports-queries.test.ts`

**Interfaces:**
- Consumes: `permissionsFor` from Task 2.
- Produces: `getOpenOpportunities({ tenantId, ownerId?, sort? })` returning `OpenOpportunity[]`, where `OpenOpportunity = { id, name, clientName, ownerId, ownerName, stageKey, stageLabel, stageColor, value, createdAt, daysOpen }` and `sort: "oldest" | "newest"` defaults to `"oldest"`.

- [ ] **Step 1: Copy the feature and route**

```bash
export DEMO=/Users/carloshugo/Documents/Projects/KoiCRM-Demo/crm-core
mkdir -p features/reports/components "app/app/[tenantSlug]/reports"
cp $DEMO/features/reports/queries.ts features/reports/
cp $DEMO/features/reports/components/ReportsTable.tsx $DEMO/features/reports/components/ReportsFilterBar.tsx features/reports/components/
cp "$DEMO/app/app/[tenantSlug]/reports/page.tsx" "app/app/[tenantSlug]/reports/page.tsx"
```

- [ ] **Step 2: Confirm the page reads its own permission, not the funnel's**

Run:

```bash
grep -n "viewAll" "app/app/[tenantSlug]/reports/page.tsx"
```

Expected: `reports.viewAll`, and no occurrence of `pipelineScopeFor` or `pipeline.viewAll`. If it reads the pipeline key, change it to `permissionsFor(...)["reports.viewAll"]` — this is the trap the rename was meant to expose.

- [ ] **Step 3: Add the nav entry**

In `components/app/tenant-header.tsx`, add `FileText` to the `lucide-react` import, then add the entry to `navItems` immediately after Clientes:

```tsx
  const navItems: { href: string; label: string; icon: LucideIcon; badge?: number }[] = [
    { href: `${base}/pipeline`, label: "Embudo", icon: LayoutDashboard },
    { href: `${base}/clients`, label: "Clientes", icon: Users, badge: clientsCount },
    { href: `${base}/reports`, label: "Reportes", icon: FileText },
    { href: `${base}/calendar`, label: "Calendario", icon: Calendar },
```

Leave the rest of the array — Archivo and the conditional Estadísticas entry — unchanged.

- [ ] **Step 4: Write the failing test**

Create `tests/integration/reports-queries.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { randomBytes } from "crypto"
import { prismaAdmin, cleanDatabase, disconnectAll } from "./helpers"
import { getOpenOpportunities } from "@/features/reports/queries"

function makeCuid(): string {
  return "c" + randomBytes(12).toString("hex")
}

let tenantId: string
let mineId: string
let theirsId: string
let openMine: string
let openTheirs: string
let wonId: string
let archivedId: string

beforeAll(async () => {
  await cleanDatabase()

  const tenant = await prismaAdmin.tenant.create({
    data: { slug: `reports-${Date.now()}`, name: "Reports" },
  })
  tenantId = tenant.id

  const mine = await prismaAdmin.user.create({ data: { email: `mine-${Date.now()}@test.com` } })
  mineId = mine.id
  const theirs = await prismaAdmin.user.create({ data: { email: `theirs-${Date.now()}@test.com` } })
  theirsId = theirs.id
  for (const userId of [mineId, theirsId]) {
    await prismaAdmin.membership.create({
      data: { userId, tenantId, role: "MEMBER", status: "ACTIVE" },
    })
  }

  const pipeline = await prismaAdmin.pipeline.create({
    data: { tenantId, name: "P", isDefault: true },
  })
  const stages: Record<string, string> = {}
  let order = 0
  for (const key of ["nuevo", "ganado", "perdido"]) {
    const s = await prismaAdmin.pipelineStage.create({
      data: {
        tenantId,
        pipelineId: pipeline.id,
        order: order++,
        key,
        label: key,
        color: "#6366f1",
        iconKey: "circle",
      },
    })
    stages[key] = s.id
  }

  async function deal(opts: {
    ownerId: string
    stageId: string
    name: string
    createdAt: Date
    isArchived?: boolean
  }) {
    const d = await prismaAdmin.deal.create({
      data: {
        id: makeCuid(),
        tenantId,
        pipelineId: pipeline.id,
        stageId: opts.stageId,
        ownerId: opts.ownerId,
        name: opts.name,
        channelKey: "web",
        statusKey: "active",
        value: 100,
        createdAt: opts.createdAt,
        isArchived: opts.isArchived ?? false,
      },
    })
    return d.id
  }

  openMine = await deal({
    ownerId: mineId,
    stageId: stages.nuevo,
    name: "Abierta mía",
    createdAt: new Date("2026-01-01T00:00:00Z"),
  })
  openTheirs = await deal({
    ownerId: theirsId,
    stageId: stages.nuevo,
    name: "Abierta ajena",
    createdAt: new Date("2026-02-01T00:00:00Z"),
  })
  wonId = await deal({
    ownerId: mineId,
    stageId: stages.ganado,
    name: "Ganada",
    createdAt: new Date("2026-01-15T00:00:00Z"),
  })
  archivedId = await deal({
    ownerId: mineId,
    stageId: stages.nuevo,
    name: "Archivada",
    createdAt: new Date("2026-01-20T00:00:00Z"),
    isArchived: true,
  })
})

afterAll(async () => {
  await cleanDatabase()
  await disconnectAll()
})

describe("getOpenOpportunities", () => {
  it("excludes won, lost and archived deals", async () => {
    const rows = await getOpenOpportunities({ tenantId })
    const ids = rows.map((r) => r.id)
    expect(ids).toContain(openMine)
    expect(ids).toContain(openTheirs)
    expect(ids).not.toContain(wonId)
    expect(ids).not.toContain(archivedId)
  })

  it("sorts oldest first by default", async () => {
    const rows = await getOpenOpportunities({ tenantId })
    expect(rows[0].id).toBe(openMine)
  })

  it("sorts newest first on request", async () => {
    const rows = await getOpenOpportunities({ tenantId, sort: "newest" })
    expect(rows[0].id).toBe(openTheirs)
  })

  it("pins the report to one advisor when ownerId is given", async () => {
    const rows = await getOpenOpportunities({ tenantId, ownerId: mineId })
    expect(rows.map((r) => r.id)).toEqual([openMine])
  })

  it("computes days open from the creation date", async () => {
    const rows = await getOpenOpportunities({ tenantId, ownerId: mineId })
    expect(rows[0].daysOpen).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 5: Run the test**

Run:

```bash
pnpm test:integration tests/integration/reports-queries.test.ts
```

Expected: 5 passing.

- [ ] **Step 6: Type-check, lint, commit**

```bash
pnpm type-check && pnpm lint
git add features/reports "app/app/[tenantSlug]/reports" components/app/tenant-header.tsx tests/integration/reports-queries.test.ts
git commit -m "feat(reports): list open opportunities by age

Open means neither ganado, perdido nor archived — resolved by reading
PipelineStage.key rather than hardcoding stage ids. Sortable by creation date and
filterable by advisor; a member without reports.viewAll sees only their own and
gets no advisor filter."
```

---

## Task 7: Per-panel stats filters

**Files:**
- Create: `features/stats/panel-filters.ts`, `features/stats/components/PanelFilters.tsx`, `features/stats/components/StatsPanel.tsx`
- Modify: `features/stats/queries.ts`, and all seven of `app/app/[tenantSlug]/stats/{resumen,embudo,canal,equipo,productos,listado,alerts}/page.tsx`
- Test: `tests/unit/panel-filters.test.ts`

**Interfaces:**
- Consumes: `permissionsFor` from Task 2.
- Produces: `PANEL_FILTER_KEYS`, `panelParamName(panelId, key)`, `readPanelFilters(searchParams, panelId, keys)`, `toStatsFilters(range, values)`, `loadPanelData(filtersList, load)`, plus the types `PanelFilterKey`, `PanelFilterValues`, `StatsFilters`, `StatsFilterOptions`, `FilterOption`. The module is isomorphic — no `server-only` import — because both the client control and the server pages read from it.

- [ ] **Step 1: Copy the module, the components and the pages**

```bash
export DEMO=/Users/carloshugo/Documents/Projects/KoiCRM-Demo/crm-core
mkdir -p features/stats/components
cp $DEMO/features/stats/panel-filters.ts features/stats/
cp $DEMO/features/stats/components/PanelFilters.tsx $DEMO/features/stats/components/StatsPanel.tsx features/stats/components/
cp $DEMO/features/stats/queries.ts features/stats/
for p in resumen embudo canal equipo productos listado alerts; do
  cp "$DEMO/app/app/[tenantSlug]/stats/$p/page.tsx" "app/app/[tenantSlug]/stats/$p/page.tsx"
done
```

`features/stats/queries.ts` is untouched by `15889e3`, so a whole-file copy is safe here.

- [ ] **Step 2: Write the failing unit test**

Create `tests/unit/panel-filters.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import {
  PANEL_FILTER_KEYS,
  panelParamName,
  readPanelFilters,
  toStatsFilters,
  loadPanelData,
  type StatsFilters,
} from "@/features/stats/panel-filters"

describe("panelParamName", () => {
  it("namespaces a key under its panel", () => {
    expect(panelParamName("alerts", "owner")).toBe("alerts.owner")
  })

  it("keeps two panels' identical keys apart", () => {
    expect(panelParamName("embudo", "owner")).not.toBe(panelParamName("canal", "owner"))
  })
})

describe("readPanelFilters", () => {
  it("reads only the requested panel's params", () => {
    const params = { "alerts.owner": "u1", "canal.owner": "u2" }
    expect(readPanelFilters(params, "alerts", ["owner"])).toEqual({ owner: "u1" })
  })

  it("ignores keys the panel does not declare", () => {
    const params = { "alerts.owner": "u1", "alerts.channel": "web" }
    expect(readPanelFilters(params, "alerts", ["owner"])).toEqual({ owner: "u1" })
  })

  it("treats an empty or whitespace value as absent", () => {
    const params = { "alerts.owner": "   ", "alerts.channel": "" }
    expect(readPanelFilters(params, "alerts", ["owner", "channel"])).toEqual({})
  })

  it("takes the first entry when a param repeats", () => {
    const params = { "alerts.owner": ["u1", "u2"] }
    expect(readPanelFilters(params, "alerts", ["owner"])).toEqual({ owner: "u1" })
  })

  it("returns nothing when the panel has no params", () => {
    expect(readPanelFilters({}, "alerts", [...PANEL_FILTER_KEYS])).toEqual({})
  })
})

describe("toStatsFilters", () => {
  it("composes the panel's filters with the global range rather than replacing it", () => {
    const from = new Date("2026-01-01T00:00:00Z")
    const to = new Date("2026-02-01T00:00:00Z")
    expect(toStatsFilters({ from, to }, { owner: "u1", category: "solar" })).toEqual({
      from,
      to,
      ownerId: "u1",
      channelKey: undefined,
      equipmentCategoryKey: "solar",
      statusKey: undefined,
    })
  })

  it("keeps the range when the panel filters nothing", () => {
    const from = new Date("2026-01-01T00:00:00Z")
    expect(toStatsFilters({ from }, {}).from).toBe(from)
  })
})

describe("loadPanelData", () => {
  it("loads once per distinct filter set and reuses the result", async () => {
    const load = vi.fn(async (f: StatsFilters) => f.ownerId ?? "all")
    const shared: StatsFilters = {}
    const results = await loadPanelData([shared, shared, { ownerId: "u1" }], load)

    expect(results).toEqual(["all", "all", "u1"])
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("does not fan out concurrently", async () => {
    let inFlight = 0
    let peak = 0
    const load = vi.fn(async (f: StatsFilters) => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 1))
      inFlight -= 1
      return f.ownerId ?? "all"
    })

    await loadPanelData([{ ownerId: "a" }, { ownerId: "b" }, { ownerId: "c" }], load)
    expect(peak).toBe(1)
  })

  it("preserves the caller's ordering", async () => {
    const load = async (f: StatsFilters) => f.ownerId ?? "all"
    expect(await loadPanelData([{ ownerId: "b" }, { ownerId: "a" }], load)).toEqual(["b", "a"])
  })
})
```

- [ ] **Step 3: Run the unit test**

Run:

```bash
pnpm test tests/unit/panel-filters.test.ts
```

Expected: 11 passing.

- [ ] **Step 4: Type-check, lint, build**

Run:

```bash
pnpm type-check && pnpm lint && pnpm build
```

Expected: all clean. The build matters here — seven pages changed at once.

- [ ] **Step 5: Commit**

```bash
git add features/stats "app/app/[tenantSlug]/stats" tests/unit/panel-filters.test.ts
git commit -m "feat(stats): give each panel its own filters

Every panel owns a <panelId>.<key> slice of the query string and composes with the
global date range instead of replacing it, so a filtered view stays shareable. A
panel never offers a filter on the dimension it already groups by, and panels that
end up with identical filters share one round trip.

Without stats.viewTotals the money charts and columns disappear and the amount KPIs
give way to their count equivalents, so the panel stays useful rather than hollow.

Note: stats/alerts moves from ?owner= to ?alerts.owner=. Nothing in the app linked
that way, but a hand-saved link stops applying its filter."
```

---

## Task 8: Clients → open opportunity

**Files:**
- Modify: `features/clients/components/ClientProfile.tsx`

**Interfaces:**
- Consumes: the `?deal=` handling already copied into `PipelineClient.tsx` in Task 5.
- Produces: nothing new.

- [ ] **Step 1: Copy the component**

```bash
export DEMO=/Users/carloshugo/Documents/Projects/KoiCRM-Demo/crm-core
cp $DEMO/features/clients/components/ClientProfile.tsx features/clients/components/
```

- [ ] **Step 2: Verify the deep link is consumed exactly once**

Run:

```bash
grep -n "consumedDealParam" features/pipeline/components/PipelineClient.tsx
```

Expected: at least two hits — the ref declaration and its guard. This is what stops the modal reopening every time it is closed. If the grep is empty, Task 5's copy of `PipelineClient.tsx` did not land; re-copy it.

- [ ] **Step 3: Type-check, lint, commit**

```bash
pnpm type-check && pnpm lint
git add features/clients/components/ClientProfile.tsx
git commit -m "feat(clients): open an opportunity from the client profile

Each opportunity row links to /pipeline?deal=<id>. The pipeline consumes the
parameter once, opens the modal and clears the URL, so closing the modal does not
re-trigger it. The action is authorized server-side by getDealSummaryAction."
```

---

## Task 9: Mobile funnel

**Files:**
- Modify: `features/pipeline/components/KanbanBoard.tsx`
- Create (if not already created in Task 5 Step 6): `features/pipeline/hooks/use-narrow-viewport.ts`

**Interfaces:**
- Consumes: `PipelineClient` props from Task 5.
- Produces: `useNarrowViewport(): boolean` — `true` below 768px, backed by `useSyncExternalStore` over `matchMedia` so server render and hydration agree.

- [ ] **Step 1: Copy the board and the hook**

```bash
export DEMO=/Users/carloshugo/Documents/Projects/KoiCRM-Demo/crm-core
mkdir -p features/pipeline/hooks
cp $DEMO/features/pipeline/hooks/use-narrow-viewport.ts features/pipeline/hooks/
cp $DEMO/features/pipeline/components/KanbanBoard.tsx features/pipeline/components/
```

- [ ] **Step 2: Verify dnd-kit is disarmed on narrow viewports**

Run:

```bash
grep -n "useNarrowViewport\|useSensors" features/pipeline/components/KanbanBoard.tsx
```

Expected: `useNarrowViewport` is called, and the `useSensors` result is an empty sensor list when it returns `true`. If drag sensors stay active below 768px, the swipe gesture and the drag gesture fight and neither works reliably.

- [ ] **Step 3: Verify desktop is untouched**

Run:

```bash
grep -c "md:" features/pipeline/components/KanbanColumn.tsx
```

Expected: a non-zero count — the mobile styles are all behind `md:` breakpoints, so above 768px the board keeps `md:flex-1` columns and the previous behaviour.

- [ ] **Step 4: Type-check, lint, build**

```bash
pnpm type-check && pnpm lint && pnpm build
```

Expected: all clean.

- [ ] **Step 5: Commit**

```bash
git add features/pipeline/components/KanbanBoard.tsx features/pipeline/hooks
git commit -m "feat(pipeline): make the funnel usable on a phone

One DOM tree, no duplicated board: the stage container becomes a scroll-snap
carousel below md and returns to md:flex-1 columns above it, so desktop is
unchanged. Adds a 44px pill rail for jumping between stages and a 56px FAB that
honours the safe-area inset.

dnd-kit gets zero sensors below 768px, so the native scroll gesture wins
uncontested; stage changes on mobile go through the detail modal."
```

---

## Task 10: Equipment icon resolution

**Files:**
- Modify: `lib/settings/constants.ts`
- Test: `tests/unit/equipment-icon.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `equipmentIcon(label: string): LucideIcon` — unchanged signature, corrected resolution order.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/equipment-icon.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { Sun, Zap, Star } from "lucide-react"
import { equipmentIcon } from "@/lib/settings/constants"

describe("equipmentIcon", () => {
  it("prefers the longest matching prefix over a shorter one", () => {
    // "Calentador" also prefixes this label; the specific entry has to win.
    expect(equipmentIcon("Calentadores solares 150L")).toBe(Sun)
  })

  it("still resolves the shorter prefix on its own", () => {
    expect(equipmentIcon("Calentador de paso")).toBe(Zap)
  })

  it("matches case-insensitively", () => {
    expect(equipmentIcon("CALENTADORES SOLARES 200L")).toBe(Sun)
  })

  it("falls back to a star for an unknown label", () => {
    expect(equipmentIcon("Artículo sin categoría")).toBe(Star)
  })

  it("falls back for an empty label", () => {
    expect(equipmentIcon("")).toBe(Star)
  })
})
```

- [ ] **Step 2: Run it and verify it fails**

Run:

```bash
pnpm test tests/unit/equipment-icon.test.ts
```

Expected: FAIL — "prefers the longest matching prefix" fails because `Object.keys` returns insertion order and `Calentador` is reached first; `Calentadores solares` is not in the map at all yet.

- [ ] **Step 3: Add the missing prefixes and sort by length**

In `lib/settings/constants.ts`, add `Sun`, `ShowerHead`, `Wrench` and `Lightbulb` to the `lucide-react` import, then replace the `EQUIPMENT_ICONS` block and `equipmentIcon` with:

```ts
/** Icon by equipment label prefix. Longest matching prefix wins, so a specific
 *  entry ("Calentadores solares") beats a generic one ("Calentador"). */
export const EQUIPMENT_ICONS: Record<string, LucideIcon> = {
  "Calentadores solares": Sun,
  "Calentadores eléctricos": Zap,
  "Calentador solar": Sun,
  Drenaje: ShowerHead,
  Drenajes: ShowerHead,
  Accesorios: Wrench,
  Repuesto: Wrench,
  Mantenimiento: Wrench,
  Kit: Wrench,
  Bomba: Waves,
  Jacuzzi: Droplets,
  Sauna: Thermometer,
  Calentador: Zap,
  Filtro: Wind,
  Hidrojet: Activity,
  Iluminacion: Lightbulb,
  Iluminación: Lightbulb,
  Otros: Package,
  General: Package,
}

const EQUIPMENT_ICON_KEYS = Object.keys(EQUIPMENT_ICONS).sort((a, b) => b.length - a.length)

export function equipmentIcon(label: string): LucideIcon {
  const target = label.toLowerCase()
  const match = EQUIPMENT_ICON_KEYS.find((k) => target.startsWith(k.toLowerCase()))
  return (match && EQUIPMENT_ICONS[match]) || Star
}
```

- [ ] **Step 4: Run the test again**

Run:

```bash
pnpm test tests/unit/equipment-icon.test.ts
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/settings/constants.ts tests/unit/equipment-icon.test.ts
git commit -m "fix(settings): resolve equipment icons by longest matching prefix

The map was scanned in insertion order, so 'Calentador' matched before
'Calentadores solares' and a solar heater rendered the electric icon. Sorts the
keys by length and adds the drainage, accessory, lighting and generic prefixes."
```

---

## Task 11: Storage path-style flag and MinIO

**Files:**
- Modify: `lib/storage/s3.ts`, `lib/storage/s3-health.ts`, `docker-compose.yml`

**Interfaces:**
- Consumes: nothing.
- Produces: `S3_FORCE_PATH_STYLE` environment variable, read identically by both S3 clients. Unset or anything other than `"true"` keeps today's R2 behaviour.

- [ ] **Step 1: Add the flag to the upload client**

In `lib/storage/s3.ts`, inside the `new S3Client({...})` call, after `endpoint`:

```ts
      // MinIO (local S3-compatible storage) addresses buckets by path, not by subdomain.
      // Left off for R2, which keeps its default virtual-host addressing.
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
```

- [ ] **Step 2: Add the same flag to the health probe**

In `lib/storage/s3-health.ts`, inside its own `new S3Client({...})` call, after `endpoint`:

```ts
      // Must match the main client in lib/storage/s3.ts, or the probe reports a
      // false failure against path-style storage (MinIO) while uploads work fine.
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
```

- [ ] **Step 3: Add MinIO to compose**

In `docker-compose.yml`, add these two services after the existing `db` service, keeping the same two-space indentation under `services:`. Leave the `${DB_PORT:-5435}` line as it already is — it is present in this working tree.

```yaml
  # Local object storage for development. Stands in for Cloudflare R2 so file uploads
  # work without R2 credentials. Both upload routes call putObject server-side, so there
  # is no browser CORS surface. Production keeps using R2 — this only runs locally.
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD:-minioadmin}
    ports:
      - "${MINIO_PORT:-9000}:9000"
      - "${MINIO_CONSOLE_PORT:-9001}:9001"
    volumes:
      - miniodata:/data
    healthcheck:
      test: ["CMD-SHELL", "mc ready local || exit 1"]
      interval: 5s
      timeout: 5s
      retries: 12

  # One-shot: create the bucket and make objects publicly readable, so the URLs
  # stored in the database render directly in the browser.
  minio-init:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    environment:
      MINIO_USER: ${MINIO_USER:-minioadmin}
      MINIO_PASSWORD: ${MINIO_PASSWORD:-minioadmin}
      MINIO_BUCKET: ${MINIO_BUCKET:-koicrm-local}
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 $$MINIO_USER $$MINIO_PASSWORD &&
      mc mb --ignore-existing local/$$MINIO_BUCKET &&
      mc anonymous set download local/$$MINIO_BUCKET &&
      echo 'minio bucket ready'
      "
    restart: "no"
```

Then add the volume to the existing `volumes:` block at the bottom of the file, so it reads:

```yaml
volumes:
  pgdata:
  miniodata:
```

- [ ] **Step 4: Verify both clients read the same flag**

Run:

```bash
grep -c "S3_FORCE_PATH_STYLE" lib/storage/s3.ts lib/storage/s3-health.ts
```

Expected: `1` for each file. A count of `1` and `0` is exactly the bug this step exists to prevent — the probe would report `storage: "error"` while uploads succeeded.

- [ ] **Step 5: Verify compose still parses**

Run:

```bash
docker compose config >/dev/null && echo ok
```

Expected: `ok`.

- [ ] **Step 6: Type-check and commit**

```bash
pnpm type-check
git add lib/storage/s3.ts lib/storage/s3-health.ts docker-compose.yml
git commit -m "feat(storage): opt-in path-style addressing and a MinIO dev service

S3_FORCE_PATH_STYLE is read by both S3 clients — the uploader and the health probe.
When only one had it, the probe reported storage: error while uploads worked fine.
Off by default, so R2 keeps its virtual-host addressing.

Adds MinIO to compose so a developer can exercise uploads without R2 credentials.
Production never sees it."
```

---

## Task 12: Full verification

**Files:** none — this task changes nothing.

- [ ] **Step 1: Confirm the demo scaffolding never got committed**

Run:

```bash
git diff --stat 15889e3..HEAD -- crm-core/scripts crm-core/docs/ops/demo-playground.md crm-core/prisma/seed/demo-heiss.ts crm-core/public/demo README.md crm-core/package.json
```

Expected: empty output. Any listed file means a `git add` was too broad — remove it from the branch before proceeding.

- [ ] **Step 2: Confirm the demo's names and its strict-ownership scope never landed**

Run:

```bash
grep -rn "dealScopeFor\|DealScope\|clients.viewAll\|scope\.ownerId" app features lib tests --include="*.ts" --include="*.tsx" || echo "clean"
```

Expected: `clean`. A `scope.ownerId` hit means a call site kept the demo's strict-ownership scope, which would hide ceded deals from the funnel while archive and search still show them.

- [ ] **Step 3: Run everything**

Run:

```bash
pnpm type-check && pnpm lint && pnpm test && pnpm test:integration && pnpm build
```

Expected: type-check clean, lint clean, build succeeds, and both suites green. This plan adds 24 unit tests (8 catalogue + 11 panel filters + 5 equipment icon) on top of the 98 that already pass, and 45 integration tests (7 RLS + 13 resolution + 11 actions + 9 scope + 5 reports).

- [ ] **Step 4: Re-seed the dev database**

The integration suite truncates. Run:

```bash
pnpm db:reset && pnpm seed:demo
```

- [ ] **Step 5: Verify by hand what no test covers**

Start the app on port 3000 — `AUTH_URL` depends on it — and check, signed in as an admin:

```bash
pnpm dev
```

1. Ajustes → Permisos renders both sections; the Superadmin and Admin rows are locked.
2. Turning off `pipeline.viewAll` for Asesor and signing in as one shows only their own deals plus anything ceded to them, with no advisor filter and no per-stage totals.
3. A per-person exception granting that advisor `pipeline.viewAll` restores the full funnel, and the "Hereda" label states the right baseline.
4. Reportes lists only open opportunities, oldest first.
5. On a real phone (or a 375px-wide viewport), the funnel swipes between stages, the pill rail tracks the current stage, and the FAB opens the new-deal modal. **This is the one thing most worth doing on actual hardware** — the emulated gesture is not the same.

- [ ] **Step 6: Record the production step**

Both migrations must be applied by hand as `admin_user` through the pooler before the deploy is promoted — Vercel's build does not run `migrate deploy`, and without them the app throws P2022 against the missing tables. Confirm this is on the deploy checklist before merging.

---

## Deferred, by decision

These are recorded in the spec and deliberately not in this plan:

1. **Per-team exceptions.** Today an exception is per person; "Karla's whole team sees X" is set one person at a time.
2. **Client scoping.** `clients.viewAll` was dropped rather than shipped inert. When client scoping is built, re-add the key with its consumer in the same change.
3. **Permission caching.** `permissionsFor` runs a query per call site. Acceptable at current scale, and the first thing to revisit if the pipeline page regresses after `15889e3`'s connection work.
