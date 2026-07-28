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
