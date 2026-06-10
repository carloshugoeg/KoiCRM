import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { randomBytes } from "crypto"
import { prismaAdmin, cleanDatabase, disconnectAll } from "./helpers"

function makeCuid(): string { return "c" + randomBytes(12).toString("hex") }

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/db/client", async () => {
  const { prismaAdmin } = await import("./helpers")
  return { prisma: prismaAdmin }
})

import { getFollowUpAlerts } from "@/features/follow-ups/queries"

let tenantId: string
let userId: string
let dealId: string

beforeAll(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-05-10T10:00:00"))

  await cleanDatabase()

  const tenant = await prismaAdmin.tenant.create({
    data: { slug: `alerts-${Date.now()}`, name: "Alerts Test", settings: { create: { storageUsedBytes: BigInt(0) } } },
  })
  tenantId = tenant.id

  const user = await prismaAdmin.user.create({ data: { email: `alerts-${Date.now()}@test.com` } })
  userId = user.id

  await prismaAdmin.membership.create({ data: { userId, tenantId, role: "MEMBER" } })

  const pipeline = await prismaAdmin.pipeline.create({ data: { tenantId, name: "Default", isDefault: true } })
  const stage = await prismaAdmin.pipelineStage.create({
    data: { tenantId, pipelineId: pipeline.id, key: "nuevo", label: "Nuevo", color: "#6366f1", iconKey: "circle", order: 0 },
  })

  const deal = await prismaAdmin.deal.create({
    data: { id: makeCuid(), tenantId, pipelineId: pipeline.id, stageId: stage.id, ownerId: userId, name: "Alert Deal", company: "ACME", channelKey: "web", statusKey: "active", value: 500 },
  })
  dealId = deal.id

  // Today is 2026-05-10 (set via vi.setSystemTime above)
  // past (overdue): 2026-05-08   today: 2026-05-10   near (next7): 2026-05-12   far: 2026-05-25
  await prismaAdmin.followUp.createMany({
    data: [
      { tenantId, dealId, createdById: userId, date: new Date("2026-05-08T12:00:00"), note: "No responde" },
      { tenantId, dealId, createdById: userId, date: new Date("2026-05-10T12:00:00"), note: "Pide información" },
      { tenantId, dealId, createdById: userId, date: new Date("2026-05-12T12:00:00"), note: "Agendar visita" },
      { tenantId, dealId, createdById: userId, date: new Date("2026-05-25T12:00:00"), note: "Otro seguimiento" },
      // Completed overdue — must NOT appear in any bucket
      { tenantId, dealId, createdById: userId, date: new Date("2026-05-07T12:00:00"), note: "Completado", completed: true },
    ],
  })
})

afterAll(async () => {
  vi.useRealTimers()
  await cleanDatabase()
  await disconnectAll()
})

describe("getFollowUpAlerts", () => {
  it("returns three buckets: overdue, today, next7", async () => {
    const result = await getFollowUpAlerts(tenantId)
    expect(result).toHaveProperty("overdue")
    expect(result).toHaveProperty("today")
    expect(result).toHaveProperty("next7")
  })

  it("overdue bucket never includes completed follow-ups", async () => {
    const { overdue } = await getFollowUpAlerts(tenantId)
    for (const fu of overdue) expect(fu.completed).toBe(false)
  })

  it("each item includes deal with stage label", async () => {
    const { overdue, today, next7 } = await getFollowUpAlerts(tenantId)
    for (const fu of [...overdue, ...today, ...next7]) {
      expect(fu.deal).toBeDefined()
      expect(fu.deal.stage.label).toBeTruthy()
    }
  })

  it("filters by ownerId when provided, returning empty buckets for unknown owner", async () => {
    const other = await prismaAdmin.user.create({ data: { email: `other-${Date.now()}@test.com` } })
    const { overdue, today, next7 } = await getFollowUpAlerts(tenantId, other.id)
    expect([...overdue, ...today, ...next7].length).toBe(0)
  })
})
