import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, disconnectAll } from "@/tests/integration/helpers"
import { withTenant } from "@/lib/db/rls"
import { findOrCreateClient, listClients, getClientKpis } from "@/features/clients/queries"

describe("Client CRUD + detect-or-create", () => {
  let tenantId: string
  let userId: string
  let pipelineId: string
  let stageId: string

  beforeAll(async () => {
    const tenant = await prismaAdmin.tenant.create({
      data: { name: "ClientTest", slug: `cl-test-${Date.now()}` },
    })
    tenantId = tenant.id

    const user = await prismaAdmin.user.create({
      data: { email: `cl-${Date.now()}@test.com`, emailVerified: new Date() },
    })
    userId = user.id

    const pipeline = await prismaAdmin.pipeline.create({
      data: { tenantId, name: "Default", isDefault: true },
    })
    pipelineId = pipeline.id

    const stage = await prismaAdmin.pipelineStage.create({
      data: { tenantId, pipelineId, key: "prospecto", label: "Prospecto", color: "#6366f1", iconKey: "circle", order: 0 },
    })
    stageId = stage.id
  })

  afterAll(async () => {
    await prismaAdmin.tenant.delete({ where: { id: tenantId } })
    await disconnectAll()
  })

  it("findOrCreateClient creates a new client", async () => {
    const client = await withTenant(tenantId, (tx) =>
      findOrCreateClient(tx, tenantId, { name: "Juan Pérez", company: "ACME" })
    )
    expect(client.name).toBe("Juan Pérez")
    expect(client.company).toBe("ACME")
    expect(client.tenantId).toBe(tenantId)
  })

  it("findOrCreateClient returns existing client on exact match", async () => {
    const first = await withTenant(tenantId, (tx) =>
      findOrCreateClient(tx, tenantId, { name: "María López", company: "Corp" })
    )
    const second = await withTenant(tenantId, (tx) =>
      findOrCreateClient(tx, tenantId, { name: "María López", company: "Corp" })
    )
    expect(first.id).toBe(second.id)
  })

  it("findOrCreateClient returns existing client on case-insensitive match", async () => {
    const first = await withTenant(tenantId, (tx) =>
      findOrCreateClient(tx, tenantId, { name: "Roberto Gómez", company: "Tech" })
    )
    const second = await withTenant(tenantId, (tx) =>
      findOrCreateClient(tx, tenantId, { name: "ROBERTO GÓMEZ", company: "TECH" })
    )
    expect(first.id).toBe(second.id)
  })

  it("listClients filters by search term (name)", async () => {
    await prismaAdmin.client.create({
      data: { tenantId, name: "Búsqueda Test", company: "ABC" },
    })
    const results = await listClients(tenantId, { search: "Búsqueda" })
    expect(results.some((c) => c.name === "Búsqueda Test")).toBe(true)
  })

  it("listClients filters by search term (phone)", async () => {
    await prismaAdmin.client.create({
      data: { tenantId, name: "Telefono Test", phone: "5555-1234" },
    })
    const results = await listClients(tenantId, { search: "5555-1234" })
    expect(results.some((c) => c.phone === "5555-1234")).toBe(true)
  })

  it("getClientKpis returns correct counts", async () => {
    const client = await prismaAdmin.client.create({
      data: { tenantId, name: "KPI Client" },
    })
    // Create 2 deals for this client
    for (let i = 0; i < 2; i++) {
      await prismaAdmin.deal.create({
        data: {
          id: `kpi-deal-${i}-${Date.now()}`,
          tenantId,
          pipelineId,
          stageId,
          clientId: client.id,
          ownerId: userId,
          channelKey: "telefono",
          statusKey: "activo",
          name: `Deal ${i}`,
          value: 500,
        },
      })
    }
    const kpis = await getClientKpis(tenantId, client.id)
    expect(kpis.totalOpps).toBe(2)
    expect(kpis.activeOpps).toBe(2)
    expect(kpis.wonCount).toBe(0)
  })
})
