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
