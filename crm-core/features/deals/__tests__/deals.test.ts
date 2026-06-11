import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, disconnectAll } from "@/tests/integration/helpers"
import { withTenant } from "@/lib/db/rls"
import { findOrCreateClient } from "@/features/clients/queries"
import { generateDealId } from "@/lib/id/deal-id"
import { recordActivity } from "@/features/activity/queries"
import { getPipelineDeals, getArchivedDeals, getDeal } from "@/features/deals/queries"

describe("Deal CRUD", () => {
  let tenantId: string
  let userId: string
  let pipelineId: string
  let stageId: string
  let lockedStageId: string

  beforeAll(async () => {
    const tenant = await prismaAdmin.tenant.create({
      data: {
        name: "DealTest",
        slug: `deal-test-${Date.now()}`,
        settings: { create: { dealIdPrefix: "TST", dealIdYearDigits: 2 } },
      },
    })
    tenantId = tenant.id

    const user = await prismaAdmin.user.create({
      data: { email: `deal-${Date.now()}@test.com`, name: "Roberto Ortiz", emailVerified: new Date() },
    })
    userId = user.id

    await prismaAdmin.membership.create({
      data: { userId, tenantId, role: "MEMBER" },
    })

    const pipeline = await prismaAdmin.pipeline.create({
      data: { tenantId, name: "Default", isDefault: true },
    })
    pipelineId = pipeline.id

    const [stage, locked] = await Promise.all([
      prismaAdmin.pipelineStage.create({
        data: { tenantId, pipelineId, key: "prospecto", label: "Prospecto", color: "#6366f1", iconKey: "circle", order: 0 },
      }),
      prismaAdmin.pipelineStage.create({
        data: { tenantId, pipelineId, key: "ganado", label: "Ganado", color: "#10b981", iconKey: "check", order: 5, locked: true },
      }),
    ])
    stageId = stage.id
    lockedStageId = locked.id
  })

  afterAll(async () => {
    await prismaAdmin.tenant.delete({ where: { id: tenantId } })
    await disconnectAll()
  })

  it("createDeal with findOrCreateClient and recordActivity", async () => {
    let dealId: string

    await withTenant(tenantId, async (tx) => {
      const id = await generateDealId(tx, tenantId, "RO")
      const client = await findOrCreateClient(tx, tenantId, { name: "Carlos Test", company: "ACME" })

      await tx.deal.create({
        data: {
          id,
          tenantId,
          pipelineId,
          stageId,
          clientId: client.id,
          ownerId: userId,
          channelKey: "telefono",
          statusKey: "activo",
          name: "Carlos Test",
          company: "ACME",
          value: 5000,
        },
      })

      await tx.dealEquipment.createMany({
        data: [{ dealId: id, categoryKey: "bombas", subcategoryKey: "bombas__sumergible" }],
      })

      await recordActivity(tx, {
        tenantId,
        entity: "Deal",
        entityId: id,
        type: "created",
        payload: { name: "Carlos Test" },
        userId,
      })

      dealId = id
    })

    const deal = await prismaAdmin.deal.findUnique({ where: { id: dealId! } })
    expect(deal).toBeTruthy()
    expect(deal?.name).toBe("Carlos Test")
    expect(deal?.clientId).toBeTruthy()

    const equipment = await prismaAdmin.dealEquipment.findMany({ where: { dealId: dealId! } })
    expect(equipment).toHaveLength(1)
    expect(equipment[0]?.subcategoryKey).toBe("bombas__sumergible")

    const activity = await prismaAdmin.activity.findMany({ where: { tenantId, entity: "Deal", entityId: dealId! } })
    expect(activity).toHaveLength(1)
    expect(activity[0]?.type).toBe("created")
  })

  it("detect-or-create reuses existing client when creating a second deal", async () => {
    let clientId1: string | undefined
    let clientId2: string | undefined

    await withTenant(tenantId, async (tx) => {
      const c1 = await findOrCreateClient(tx, tenantId, { name: "Reuse Client", company: "Corp" })
      clientId1 = c1.id
    })

    await withTenant(tenantId, async (tx) => {
      const c2 = await findOrCreateClient(tx, tenantId, { name: "reuse client", company: "corp" })
      clientId2 = c2.id
    })

    expect(clientId1).toBe(clientId2)
  })

  it("getPipelineDeals returns only non-archived deals", async () => {
    // Create an archived deal
    const id = `arch-${Date.now()}`
    await prismaAdmin.deal.create({
      data: { id, tenantId, pipelineId, stageId, ownerId: userId, channelKey: "telefono", statusKey: "activo", name: "Archived Deal", value: 0, isArchived: true },
    })

    const deals = await getPipelineDeals(tenantId)
    expect(deals.every((d) => !d.isArchived)).toBe(true)
    expect(deals.find((d) => d.id === id)).toBeUndefined()
  })

  it("getArchivedDeals returns only archived deals with cursor pagination", async () => {
    // Ensure at least one archived deal exists
    const id = `arch2-${Date.now()}`
    await prismaAdmin.deal.create({
      data: { id, tenantId, pipelineId, stageId, ownerId: userId, channelKey: "telefono", statusKey: "activo", name: "Archived2", value: 0, isArchived: true },
    })

    const { deals, nextCursor } = await getArchivedDeals(tenantId, undefined, 10)
    expect(deals.every((d) => d.isArchived)).toBe(true)
    expect(deals.length).toBeGreaterThan(0)
    // nextCursor is null when fewer than limit+1 results
    expect(typeof nextCursor === "string" || nextCursor === null).toBe(true)
  })

  it("getDeal returns deal with relations", async () => {
    const deals = await getPipelineDeals(tenantId)
    if (deals.length === 0) return

    const full = await getDeal(tenantId, deals[0]!.id)
    expect(full).toBeTruthy()
    expect(full?.stage).toBeTruthy()
    expect(full?.owner).toBeTruthy()
  })
})
