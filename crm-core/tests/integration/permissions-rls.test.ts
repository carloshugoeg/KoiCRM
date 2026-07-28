import path from "path"
import { readFileSync } from "fs"
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { PrismaClient } from "@prisma/client"
import { prismaAdmin, prismaApp, withTenant, cleanDatabase, disconnectAll } from "./helpers"

// Extracts the compatibility-backfill INSERT ... SELECT ... FROM "Tenant"; statement straight
// out of the shipped migration file, so the test executes the exact SQL a `migrate deploy`
// would run rather than a hand-typed copy that could drift from it.
function readBackfillStatement(): string {
  const migrationPath = path.resolve(
    __dirname,
    "../../prisma/migrations/20260727045954_role_permissions/migration.sql",
  )
  const sql = readFileSync(migrationPath, "utf8")
  const match = sql.match(/INSERT INTO "RolePermission"[\s\S]*?FROM "Tenant";/)
  if (!match) {
    throw new Error(
      `Could not find the RolePermission backfill statement (INSERT INTO "RolePermission" ... FROM "Tenant";) in ${migrationPath}. ` +
        "The migration file may have changed shape — this test needs to be updated to match, not silently skipped.",
    )
  }
  return match[0]
}

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
  it("a tenant created after the migration has no backfilled row", async () => {
    // tenantA is created by this suite's beforeAll, long after the migration would have
    // run in a real deploy. This only proves that a *post-migration* tenant inherits the
    // restricted default (no pipeline.viewAll row) — it says nothing about whether the
    // backfill INSERT itself works. See the "actually running the backfill" block below
    // for a test that executes the shipped statement and checks its output.
    const rows = await withTenant(tenantA, (tx) =>
      tx.rolePermission.findMany({ where: { tenantId: tenantA, key: "pipeline.viewAll" } }),
    )
    expect(rows).toHaveLength(0)
  })

  describe("actually running the backfill", () => {
    it("inserts MEMBER/pipeline.viewAll for tenants that existed at migration time, and nothing for pipeline.viewTotals", async () => {
      const statement = readBackfillStatement()

      // tenantA and tenantB stand in for "tenants that existed when the migration ran" —
      // they're the only rows in "Tenant" at this point in the suite. Run the statement at
      // the same privilege level a migration executes at.
      await prismaAdmin.$executeRawUnsafe(statement)

      const tenantARows = await withTenant(tenantA, (tx) =>
        tx.rolePermission.findMany({ where: { tenantId: tenantA, key: "pipeline.viewAll" } }),
      )
      expect(tenantARows).toHaveLength(1)
      expect(tenantARows[0].role).toBe("MEMBER")
      expect(tenantARows[0].allowed).toBe(true)

      // tenantB never had any RolePermission row before this ran (unlike tenantA, which
      // already carries a manually-inserted pipeline.viewTotals row from an earlier
      // describe block), so its full row set proves both what the backfill inserted and
      // what it deliberately left out.
      const tenantBRows = await withTenant(tenantB, (tx) => tx.rolePermission.findMany({ where: { tenantId: tenantB } }))
      expect(tenantBRows).toHaveLength(1)
      expect(tenantBRows[0].role).toBe("MEMBER")
      expect(tenantBRows[0].key).toBe("pipeline.viewAll")
      expect(tenantBRows[0].allowed).toBe(true)

      const tenantBViewTotals = await withTenant(tenantB, (tx) =>
        tx.rolePermission.findMany({ where: { tenantId: tenantB, key: "pipeline.viewTotals" } }),
      )
      expect(tenantBViewTotals).toHaveLength(0)
    })
  })
})
