import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, disconnectAll } from "./helpers"

// Run with: pnpm test:perf
// NOT in default CI — run manually to validate performance.

const DEAL_COUNT = 1000

describe("Performance benchmarks", () => {
  let tenantId: string
  let pipelineId: string
  let stageIds: string[]

  beforeAll(async () => {
    const tenant = await prismaAdmin.tenant.create({
      data: { slug: `bench-${Date.now()}`, name: "Bench Tenant" },
    })
    tenantId = tenant.id

    const pipeline = await prismaAdmin.pipeline.create({
      data: {
        tenantId,
        name: "Bench Pipeline",
        isDefault: true,
        stages: {
          create: [
            { tenantId, key: "s1", label: "Stage 1", color: "#6366f1", iconKey: "circle", order: 0, locked: false, requiresQuote: false, requiresPayment: false },
            { tenantId, key: "s2", label: "Stage 2", color: "#f59e0b", iconKey: "circle", order: 1, locked: false, requiresQuote: false, requiresPayment: false },
            { tenantId, key: "s3", label: "Stage 3", color: "#22c55e", iconKey: "circle", order: 2, locked: false, requiresQuote: false, requiresPayment: false },
          ],
        },
      },
      include: { stages: true },
    })
    pipelineId = pipeline.id
    stageIds = pipeline.stages.map((s) => s.id)

    await prismaAdmin.tenantSettings.create({
      data: { tenantId, defaultPipelineId: pipelineId },
    })

    const user = await prismaAdmin.user.create({
      data: { email: `bench-${Date.now()}@bench.local`, name: "Bench User", emailVerified: new Date() },
    })
    await prismaAdmin.membership.create({ data: { tenantId, userId: user.id, role: "OWNER" } })

    // Create clients
    await prismaAdmin.client.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({
        tenantId,
        name: `Bench Client ${i}`,
        company: `Bench Co ${i}`,
      })),
    })
    const clients = await prismaAdmin.client.findMany({
      where: { tenantId },
      select: { id: true },
      take: 50,
    })

    const channels = ["sala", "whatsapp", "facebook", "telefono", "instagram"]

    // Create 1000 deals in batches of 100
    for (let b = 0; b < DEAL_COUNT / 100; b++) {
      await prismaAdmin.deal.createMany({
        data: Array.from({ length: 100 }, (_, j) => {
          const i = b * 100 + j
          return {
            id: `BN-${String(i + 1).padStart(5, "0")}`,
            tenantId,
            pipelineId,
            stageId: stageIds[i % 3],
            clientId: clients[i % 50].id,
            ownerId: user.id,
            channelKey: channels[i % 5],
            statusKey: "activo",
            name: `Bench Deal ${i + 1}`,
            value: 10000 + (i * 1337) % 90000,
          }
        }),
      })
    }
  }, 120_000)

  afterAll(async () => {
    await prismaAdmin.tenant.deleteMany({ where: { id: tenantId } })
    await disconnectAll()
  })

  it("pipeline list with 1000 deals loads in < 500ms", async () => {
    const start = Date.now()
    await prismaAdmin.deal.findMany({
      where: { tenantId, isArchived: false },
      select: {
        id: true,
        name: true,
        company: true,
        value: true,
        stageId: true,
        ownerId: true,
        channelKey: true,
        statusKey: true,
        createdAt: true,
        stageEnteredAt: true,
        equipment: { select: { equipmentKey: true, customLabel: true } },
      },
    })
    const elapsed = Date.now() - start
    console.log(`Pipeline list 1000 deals: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(500)
  })

  it("stage count aggregation < 200ms", async () => {
    const start = Date.now()
    await prismaAdmin.deal.groupBy({
      by: ["stageId"],
      where: { tenantId, isArchived: false },
      _count: { id: true },
      _sum: { value: true },
    })
    const elapsed = Date.now() - start
    console.log(`Stage count aggregation: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(200)
  })

  it("channel groupBy aggregation < 200ms", async () => {
    const start = Date.now()
    await prismaAdmin.deal.groupBy({
      by: ["channelKey"],
      where: { tenantId, isArchived: false },
      _count: { id: true },
      _sum: { value: true },
    })
    const elapsed = Date.now() - start
    console.log(`Channel aggregation: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(200)
  })

  it("search ILIKE on name < 200ms with 1000 deals", async () => {
    const start = Date.now()
    await prismaAdmin.deal.findMany({
      where: {
        tenantId,
        isArchived: false,
        OR: [
          { name: { contains: "Deal 5", mode: "insensitive" } },
          { company: { contains: "Deal 5", mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true },
      take: 20,
    })
    const elapsed = Date.now() - start
    console.log(`Search ILIKE: ${elapsed}ms`)
    expect(elapsed).toBeLessThan(200)
  })
}, 180_000)
