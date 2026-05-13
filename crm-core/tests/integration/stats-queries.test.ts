import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, cleanDatabase, disconnectAll } from "./helpers"
import {
  getResumenStats,
  getEmbudoStats,
  getEquipoStats,
  getCanalStats,
  getProductosStats,
} from "../../features/stats/queries"

let tenantId: string
let userId: string
let userId2: string
let pipelineId: string
let prospectoId: string
let ganadoId: string
let perdidoId: string

beforeAll(async () => {
  await cleanDatabase()

  const tenant = await prismaAdmin.tenant.create({
    data: { slug: "stats-test", name: "Stats Test", settings: { create: { dealIdPrefix: "STA" } } },
  })
  tenantId = tenant.id

  const [u1, u2] = await Promise.all([
    prismaAdmin.user.create({ data: { email: "asesor1@test.com", name: "Asesor Uno" } }),
    prismaAdmin.user.create({ data: { email: "asesor2@test.com", name: "Asesor Dos" } }),
  ])
  userId = u1.id
  userId2 = u2.id

  await prismaAdmin.membership.createMany({
    data: [
      { tenantId, userId, role: "OWNER" },
      { tenantId, userId: userId2, role: "MEMBER" },
    ],
  })

  const pipeline = await prismaAdmin.pipeline.create({
    data: {
      tenantId,
      name: "Main",
      isDefault: true,
      stages: {
        create: [
          { tenantId, order: 0, key: "prospecto", label: "Prospecto", color: "#6366f1", iconKey: "circle" },
          { tenantId, order: 3, key: "ganado", label: "Ganado", color: "#22c55e", iconKey: "check" },
          { tenantId, order: 4, key: "perdido", label: "Perdido", color: "#ef4444", iconKey: "x" },
        ],
      },
    },
    include: { stages: true },
  })
  pipelineId = pipeline.id
  prospectoId = pipeline.stages.find((s) => s.key === "prospecto")!.id
  ganadoId = pipeline.stages.find((s) => s.key === "ganado")!.id
  perdidoId = pipeline.stages.find((s) => s.key === "perdido")!.id

  await prismaAdmin.catalogItem.createMany({
    data: [
      { tenantId, catalogKey: "salesChannel", key: "whatsapp", label: "WhatsApp" },
      { tenantId, catalogKey: "salesChannel", key: "sala", label: "Sala" },
      { tenantId, catalogKey: "equipment", key: "bomba", label: "Bomba" },
      { tenantId, catalogKey: "equipment", key: "jacuzzi", label: "Jacuzzi" },
    ],
  })

  // 2 active deals (userId), 1 won (userId2), 1 lost (userId)
  await prismaAdmin.deal.createMany({
    data: [
      { id: "STA-0001", tenantId, pipelineId, stageId: prospectoId, ownerId: userId, channelKey: "whatsapp", statusKey: "active", name: "Deal 1", value: 1000 },
      { id: "STA-0002", tenantId, pipelineId, stageId: prospectoId, ownerId: userId, channelKey: "sala", statusKey: "active", name: "Deal 2", value: 2000 },
      { id: "STA-0003", tenantId, pipelineId, stageId: ganadoId, ownerId: userId2, channelKey: "whatsapp", statusKey: "active", name: "Deal 3 (won)", value: 3000 },
      { id: "STA-0004", tenantId, pipelineId, stageId: perdidoId, ownerId: userId, channelKey: "sala", statusKey: "active", name: "Deal 4 (lost)", value: 500 },
    ],
  })

  await prismaAdmin.dealEquipment.createMany({
    data: [
      { dealId: "STA-0001", equipmentKey: "bomba" },
      { dealId: "STA-0002", equipmentKey: "bomba" },
      { dealId: "STA-0003", equipmentKey: "jacuzzi" },
    ],
  })
})

afterAll(async () => {
  await cleanDatabase()
  await disconnectAll()
})

describe("T8.1 — Stats aggregation queries", () => {
  it("getResumenStats: computes KPIs correctly", async () => {
    const stats = await getResumenStats(tenantId, {})
    expect(stats.totalEmbudo).toBe(3000)   // deal1(1000) + deal2(2000) — not won/lost
    expect(stats.ganado).toBe(3000)         // deal3
    expect(stats.perdido).toBe(500)         // deal4
    // tasaCierre = wonCount(1) / activeCount(4) * 100 = 25
    expect(stats.tasaCierre).toBeCloseTo(25)
    // ticketPromedio = totalEmbudo(3000) / activeCountOpen(2)
    expect(stats.ticketPromedio).toBe(1500)
    expect(stats.topPerformers.length).toBeGreaterThan(0)
  })

  it("getEmbudoStats: returns per-stage counts and values", async () => {
    const stages = await getEmbudoStats(tenantId, {})
    const prospecto = stages.find((s) => s.stageKey === "prospecto")
    expect(prospecto?.count).toBe(2)
    expect(prospecto?.value).toBe(3000)
    const ganado = stages.find((s) => s.stageKey === "ganado")
    expect(ganado?.count).toBe(1)
    expect(ganado?.value).toBe(3000)
  })

  it("getEquipoStats: returns per-owner aggregates", async () => {
    const team = await getEquipoStats(tenantId, {})
    const a1 = team.find((r) => r.ownerId === userId)
    expect(a1?.dealsCount).toBe(3) // deal1, deal2, deal4
    expect(a1?.wonCount).toBe(0)
    expect(a1?.lostCount).toBe(1)
    const a2 = team.find((r) => r.ownerId === userId2)
    expect(a2?.dealsCount).toBe(1)
    expect(a2?.wonCount).toBe(1)
    expect(a2?.wonValue).toBe(3000)
  })

  it("getCanalStats: returns per-channel aggregates", async () => {
    const channels = await getCanalStats(tenantId, {})
    const wa = channels.find((c) => c.channelKey === "whatsapp")
    expect(wa?.dealsCount).toBe(2) // deal1, deal3
    expect(wa?.wonCount).toBe(1)
  })

  it("getProductosStats: returns per-equipment demand/sold counts", async () => {
    const products = await getProductosStats(tenantId, {})
    const bomba = products.find((p) => p.equipmentKey === "bomba")
    expect(bomba?.demandCount).toBe(2) // deal1, deal2 (not won)
    expect(bomba?.soldCount).toBe(0)
    const jacuzzi = products.find((p) => p.equipmentKey === "jacuzzi")
    expect(jacuzzi?.soldCount).toBe(1) // deal3 is won
    expect(jacuzzi?.soldValue).toBe(3000)
  })

  it("getResumenStats: date filter excludes deals outside range", async () => {
    const future = new Date(Date.now() + 86400000 * 365)
    const stats = await getResumenStats(tenantId, { from: future })
    expect(stats.totalEmbudo).toBe(0)
    expect(stats.ganado).toBe(0)
  })
})
