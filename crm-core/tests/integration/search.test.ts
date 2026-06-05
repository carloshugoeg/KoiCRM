import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, disconnectAll, withTenant } from "@/tests/integration/helpers"
import { globalSearch } from "@/features/search/queries"
import { generateDealId } from "@/lib/id/deal-id"

describe("globalSearch", () => {
  let tenantId: string
  let userId: string
  let pipelineId: string
  let stageId: string
  let dealId: string
  let clientId: string

  beforeAll(async () => {
    const tenant = await prismaAdmin.tenant.create({
      data: {
        name: "SearchTest",
        slug: `search-test-${Date.now()}`,
        settings: {
          create: {
            locale: "es-GT",
            currency: "GTQ",
            dealIdPrefix: "SRC",
            dealIdYearDigits: 2,
          },
        },
      },
    })
    tenantId = tenant.id

    const user = await prismaAdmin.user.create({
      data: { email: `search-${Date.now()}@test.com`, name: "Asesor Search" },
    })
    userId = user.id

    await prismaAdmin.membership.create({
      data: { userId, tenantId, role: "MEMBER" },
    })

    const pipeline = await prismaAdmin.pipeline.create({
      data: { tenantId, name: "Default", isDefault: true },
    })
    pipelineId = pipeline.id

    const stage = await prismaAdmin.pipelineStage.create({
      data: {
        tenantId,
        pipelineId,
        key: "prospecto",
        label: "Prospecto",
        color: "#6366f1",
        iconKey: "circle",
        order: 0,
      },
    })
    stageId = stage.id

    const client = await prismaAdmin.client.create({
      data: {
        tenantId,
        name: "Cliente Único Búsqueda",
        company: "Empresa XYZ",
        phone: "5555-SEARCH",
      },
    })
    clientId = client.id

    await withTenant(tenantId, async (tx) => {
      dealId = await generateDealId(tx, tenantId, "SB")
      await tx.deal.create({
        data: {
          id: dealId,
          tenantId,
          pipelineId,
          stageId,
          clientId,
          ownerId: userId,
          channelKey: "web",
          statusKey: "activo",
          name: "Cliente Único Búsqueda",
          company: "Empresa XYZ",
          value: 12500,
        },
      })
    })

    await prismaAdmin.quote.create({
      data: {
        tenantId,
        dealId,
        number: "COT-SEARCH-99",
        date: new Date(),
      },
    })
  })

  afterAll(async () => {
    await prismaAdmin.$transaction([
      prismaAdmin.quote.deleteMany({ where: { tenantId } }),
      prismaAdmin.deal.deleteMany({ where: { tenantId } }),
      prismaAdmin.client.deleteMany({ where: { tenantId } }),
      prismaAdmin.pipelineStage.deleteMany({ where: { tenantId } }),
      prismaAdmin.pipeline.deleteMany({ where: { tenantId } }),
      prismaAdmin.membership.deleteMany({ where: { tenantId } }),
      prismaAdmin.tenantSettings.deleteMany({ where: { tenantId } }),
      prismaAdmin.tenant.delete({ where: { id: tenantId } }),
      prismaAdmin.user.delete({ where: { id: userId } }),
    ])
    await disconnectAll()
  })

  it("finds deals by name", async () => {
    const results = await globalSearch(tenantId, "Único Búsqueda")
    const deal = results.find((r) => r.type === "deal" && r.id === dealId)
    expect(deal).toBeDefined()
    expect(deal?.meta.stageLabel).toBe("Prospecto")
    expect(deal?.meta.ownerName).toBe("Asesor Search")
    expect(deal?.meta.valueFormatted).toMatch(/12/)
  })

  it("finds deals by quote number", async () => {
    const results = await globalSearch(tenantId, "COT-SEARCH-99")
    const deal = results.find((r) => r.type === "deal")
    expect(deal?.id).toBe(dealId)
    expect(deal?.meta.matchedVia).toBe("quote")
    expect(deal?.meta.matchedQuoteNumber).toBe("COT-SEARCH-99")
  })

  it("finds clients by phone", async () => {
    const results = await globalSearch(tenantId, "5555-SEARCH")
    const client = results.find((r) => r.type === "client" && r.id === clientId)
    expect(client).toBeDefined()
    expect(client?.title).toContain("Cliente Único")
  })

  it("returns empty for blank query", async () => {
    const results = await globalSearch(tenantId, "   ")
    expect(results).toEqual([])
  })
})
