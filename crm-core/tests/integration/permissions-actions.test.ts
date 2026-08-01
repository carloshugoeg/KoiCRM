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
