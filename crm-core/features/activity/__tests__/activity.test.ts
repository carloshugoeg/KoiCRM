import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, disconnectAll } from "@/tests/integration/helpers"
import { withTenant } from "@/lib/db/rls"
import { recordActivity, getDealActivity } from "@/features/activity/queries"

describe("Activity log", () => {
  let tenantId: string
  let dealId: string
  let userId: string

  beforeAll(async () => {
    const tenant = await prismaAdmin.tenant.create({
      data: { name: "ActivityTest", slug: `act-test-${Date.now()}` },
    })
    tenantId = tenant.id

    const user = await prismaAdmin.user.create({
      data: { email: `act-${Date.now()}@test.com`, emailVerified: new Date() },
    })
    userId = user.id

    const pipeline = await prismaAdmin.pipeline.create({
      data: { tenantId, name: "Default", isDefault: true },
    })
    const stage = await prismaAdmin.pipelineStage.create({
      data: { tenantId, pipelineId: pipeline.id, key: "prospecto", label: "Prospecto", color: "#6366f1", iconKey: "circle", order: 0 },
    })

    const deal = await prismaAdmin.deal.create({
      data: {
        id: `ACT-TEST-${Date.now()}`,
        tenantId,
        pipelineId: pipeline.id,
        stageId: stage.id,
        ownerId: user.id,
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
    await disconnectAll()
  })

  it("recordActivity creates an activity entry inside withTenant", async () => {
    await withTenant(tenantId, async (tx) => {
      await recordActivity(tx, {
        tenantId,
        entity: "Deal",
        entityId: dealId,
        type: "created",
        payload: { by: userId },
        userId,
      })
    })

    const entries = await prismaAdmin.activity.findMany({
      where: { tenantId, entity: "Deal", entityId: dealId },
    })
    expect(entries).toHaveLength(1)
    expect(entries[0]!.type).toBe("created")
    expect(entries[0]!.userId).toBe(userId)
  })

  it("getDealActivity returns entries in descending order", async () => {
    await withTenant(tenantId, async (tx) => {
      await recordActivity(tx, { tenantId, entity: "Deal", entityId: dealId, type: "valueChanged", payload: { old: 1000, new: 2000 }, userId })
      await recordActivity(tx, { tenantId, entity: "Deal", entityId: dealId, type: "stageChanged", payload: { from: "prospecto", to: "contactado" }, userId })
    })

    const entries = await getDealActivity(tenantId, dealId)
    expect(entries.length).toBeGreaterThanOrEqual(3)
    // Descending: first entry is the most recent
    const types = entries.map((e) => e.type)
    const stageIdx = types.indexOf("stageChanged")
    const valueIdx = types.indexOf("valueChanged")
    expect(stageIdx).toBeLessThan(valueIdx)
  })

  it("getDealActivity does not return activities from another tenant", async () => {
    const otherTenant = await prismaAdmin.tenant.create({
      data: { name: "Other", slug: `other-act-${Date.now()}` },
    })
    const entries = await getDealActivity(otherTenant.id, dealId)
    expect(entries).toHaveLength(0)
    await prismaAdmin.tenant.delete({ where: { id: otherTenant.id } })
  })
})
