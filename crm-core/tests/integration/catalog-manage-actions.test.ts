import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest"
import type { Session } from "next-auth"
import { prismaAdmin, withTenant, cleanDatabase, disconnectAll } from "./helpers"

process.env.AUTH_SECRET ??= "test-catalog-manage-actions-secret"
process.env.DATABASE_SET_ROLE ??= "app_user"

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { createCatalogItemAction, deleteCatalogItemAction } from "@/features/catalogs/actions"
import { auth } from "@/lib/auth/auth"

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>

let tenantId: string
let tenantSlug: string
let ownerId: string
let adminId: string
let memberId: string

beforeAll(async () => {
  await cleanDatabase()

  const tenant = await prismaAdmin.tenant.create({
    data: { slug: `catalog-manage-${Date.now()}`, name: "Catalog Manage", subscriptionValidated: true },
  })
  tenantId = tenant.id
  tenantSlug = tenant.slug

  const owner = await prismaAdmin.user.create({ data: { email: `owner-${Date.now()}@test.com` } })
  ownerId = owner.id
  await prismaAdmin.membership.create({
    data: { userId: ownerId, tenantId, role: "OWNER", status: "ACTIVE" },
  })

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
})

afterAll(async () => {
  await cleanDatabase()
  await disconnectAll()
})

beforeEach(async () => {
  mockAuth.mockReset()
  await withTenant(tenantId, async (tx) => {
    await tx.rolePermission.deleteMany({ where: { tenantId } })
    await tx.userPermission.deleteMany({ where: { tenantId } })
    await tx.catalogItem.deleteMany({ where: { tenantId, catalogKey: "equipment" } })
  })
})

function equipmentPayload(key: string, label: string) {
  return {
    tenantId,
    tenantSlug,
    catalogKey: "equipment" as const,
    key,
    label,
    order: 0,
    parentId: null,
  }
}

describe("createCatalogItemAction authorization for equipment", () => {
  it("allows OWNER", async () => {
    mockAuth.mockResolvedValue({ user: { id: ownerId } } as Session)
    const res = await createCatalogItemAction(equipmentPayload("bomba_owner", "Bomba Owner"))
    expect(res.ok).toBe(true)
  })

  it("allows ADMIN", async () => {
    mockAuth.mockResolvedValue({ user: { id: adminId } } as Session)
    const res = await createCatalogItemAction(equipmentPayload("bomba_admin", "Bomba Admin"))
    expect(res.ok).toBe(true)
  })

  it("denies MEMBER without catalog.manage", async () => {
    mockAuth.mockResolvedValue({ user: { id: memberId } } as Session)
    const res = await createCatalogItemAction(equipmentPayload("bomba_denied", "Bomba Denied"))
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/denegado/i)
  })

  it("allows MEMBER with catalog.manage", async () => {
    await prismaAdmin.rolePermission.create({
      data: {
        tenantId,
        role: "MEMBER",
        key: "catalog.manage",
        allowed: true,
        updatedAt: new Date(),
      },
    })
    mockAuth.mockResolvedValue({ user: { id: memberId } } as Session)
    const res = await createCatalogItemAction(equipmentPayload("bomba_granted", "Bomba Granted"))
    expect(res.ok).toBe(true)
  })
})

describe("deleteCatalogItemAction authorization for equipment", () => {
  async function seedItem(key: string, label: string) {
    return prismaAdmin.catalogItem.create({
      data: { tenantId, catalogKey: "equipment", key, label, order: 0 },
    })
  }

  it("allows OWNER", async () => {
    const item = await seedItem("del_owner", "Del Owner")
    mockAuth.mockResolvedValue({ user: { id: ownerId } } as Session)
    const res = await deleteCatalogItemAction({ tenantId, tenantSlug, id: item.id })
    expect(res.ok).toBe(true)
  })

  it("allows ADMIN", async () => {
    const item = await seedItem("del_admin", "Del Admin")
    mockAuth.mockResolvedValue({ user: { id: adminId } } as Session)
    const res = await deleteCatalogItemAction({ tenantId, tenantSlug, id: item.id })
    expect(res.ok).toBe(true)
  })

  it("denies MEMBER without catalog.manage", async () => {
    const item = await seedItem("del_denied", "Del Denied")
    mockAuth.mockResolvedValue({ user: { id: memberId } } as Session)
    const res = await deleteCatalogItemAction({ tenantId, tenantSlug, id: item.id })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/denegado/i)
  })

  it("allows MEMBER with catalog.manage", async () => {
    await prismaAdmin.rolePermission.create({
      data: {
        tenantId,
        role: "MEMBER",
        key: "catalog.manage",
        allowed: true,
        updatedAt: new Date(),
      },
    })
    const item = await seedItem("del_granted", "Del Granted")
    mockAuth.mockResolvedValue({ user: { id: memberId } } as Session)
    const res = await deleteCatalogItemAction({ tenantId, tenantSlug, id: item.id })
    expect(res.ok).toBe(true)
  })
})
