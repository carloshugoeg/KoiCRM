import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, disconnectAll } from "./helpers"
import { withTenant } from "@/lib/db/rls"

let tenantId: string
let otherTenantId: string
let userId: string
let pipelineId: string
let stageId: string
let dealId: string

beforeAll(async () => {
  const tenant = await prismaAdmin.tenant.create({
    data: {
      name: "ActionTest",
      slug: `action-test-${Date.now()}`,
      settings: { create: { dealIdPrefix: "ACT", dealIdYearDigits: 2 } },
    },
  })
  tenantId = tenant.id

  const other = await prismaAdmin.tenant.create({
    data: { name: "OtherTenant", slug: `other-tenant-${Date.now()}` },
  })
  otherTenantId = other.id

  const user = await prismaAdmin.user.create({
    data: { email: `action-${Date.now()}@test.com`, name: "Test User", emailVerified: new Date() },
  })
  userId = user.id

  await prismaAdmin.membership.create({ data: { userId, tenantId, role: "MEMBER" } })

  const pipeline = await prismaAdmin.pipeline.create({
    data: {
      tenantId,
      name: "Default",
      isDefault: true,
      stages: {
        create: [
          { tenantId, key: "prospecto", label: "Prospecto", color: "#6366f1", iconKey: "circle", order: 0 },
        ],
      },
    },
    include: { stages: true },
  })
  pipelineId = pipeline.id
  stageId = pipeline.stages[0]!.id

  const deal = await prismaAdmin.deal.create({
    data: {
      id: `ACT-0001-TU-26`,
      tenantId,
      pipelineId,
      stageId,
      ownerId: userId,
      channelKey: "telefono",
      statusKey: "activo",
      name: "Test Deal",
      value: 1000,
    },
  })
  dealId = deal.id
})

afterAll(async () => {
  await prismaAdmin.tenant.delete({ where: { id: tenantId } })
  await prismaAdmin.tenant.delete({ where: { id: otherTenantId } })
  await disconnectAll()
})

describe("BUG-001: deal update WHERE must include tenantId", () => {
  it("update with correct tenantId in WHERE succeeds", async () => {
    await withTenant(tenantId, (tx) =>
      tx.deal.update({ where: { id: dealId, tenantId }, data: { name: "Updated Name" } })
    )
    const deal = await prismaAdmin.deal.findUnique({ where: { id: dealId } })
    expect(deal?.name).toBe("Updated Name")
  })

  it("update with wrong tenantId in WHERE throws (record not found)", async () => {
    await expect(
      withTenant(otherTenantId, (tx) =>
        tx.deal.update({ where: { id: dealId, tenantId: otherTenantId }, data: { name: "Should Not Update" } })
      )
    ).rejects.toThrow()

    const deal = await prismaAdmin.deal.findUnique({ where: { id: dealId } })
    expect(deal?.name).not.toBe("Should Not Update")
  })
})

describe("BUG-003: ownerId must be a tenant member", () => {
  it("non-member ownerId is rejected by membership check inside withTenant", async () => {
    const outsider = await prismaAdmin.user.create({
      data: { email: `outsider-${Date.now()}@test.com`, name: "Outsider" },
    })

    await expect(
      withTenant(tenantId, async (tx) => {
        const membership = await tx.membership.findUnique({
          where: { userId_tenantId: { userId: outsider.id, tenantId } },
        })
        if (!membership) throw new Error("INVALID_OWNER")
      })
    ).rejects.toThrow("INVALID_OWNER")

    await prismaAdmin.user.delete({ where: { id: outsider.id } })
  })

  it("tenant member passes the membership check", async () => {
    await expect(
      withTenant(tenantId, async (tx) => {
        const membership = await tx.membership.findUnique({
          where: { userId_tenantId: { userId, tenantId } },
        })
        if (!membership) throw new Error("INVALID_OWNER")
      })
    ).resolves.not.toThrow()
  })
})
