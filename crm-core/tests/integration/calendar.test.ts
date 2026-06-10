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

import { getCalendarFollowUps } from "@/features/calendar/queries"

let tenantId: string
let userId: string
let dealId: string
let fuMayAId: string
let fuMayBId: string

beforeAll(async () => {
  await cleanDatabase()

  const tenant = await prismaAdmin.tenant.create({
    data: { slug: `cal-test-${Date.now()}`, name: "Cal Test", settings: { create: { storageUsedBytes: BigInt(0) } } },
  })
  tenantId = tenant.id

  const user = await prismaAdmin.user.create({ data: { email: `cal-${Date.now()}@test.com`, name: "Cal User" } })
  userId = user.id

  await prismaAdmin.membership.create({ data: { userId, tenantId, role: "MEMBER" } })

  const pipeline = await prismaAdmin.pipeline.create({ data: { tenantId, name: "Default", isDefault: true } })
  const stage = await prismaAdmin.pipelineStage.create({
    data: { tenantId, pipelineId: pipeline.id, key: "nuevo", label: "Nuevo", color: "#6366f1", iconKey: "circle", order: 0 },
  })

  const deal = await prismaAdmin.deal.create({
    data: { id: makeCuid(), tenantId, pipelineId: pipeline.id, stageId: stage.id, ownerId: userId, name: "Cal Deal", channelKey: "web", statusKey: "active", value: 1000 },
  })
  dealId = deal.id

  // May 2026 (month index 4)
  const fuA = await prismaAdmin.followUp.create({ data: { tenantId, dealId, createdById: userId, date: new Date("2026-05-15T12:00:00"), note: "No responde" } })
  fuMayAId = fuA.id
  const fuB = await prismaAdmin.followUp.create({ data: { tenantId, dealId, createdById: userId, date: new Date("2026-05-05T12:00:00"), note: "Agendar visita" } })
  fuMayBId = fuB.id
  // June 2026 (month index 5) — should be excluded from May query
  await prismaAdmin.followUp.create({ data: { tenantId, dealId, createdById: userId, date: new Date("2026-06-01T12:00:00"), note: "Otro seguimiento" } })
})

afterAll(async () => { await cleanDatabase(); await disconnectAll() })

describe("getCalendarFollowUps", () => {
  it("returns follow-ups within the given month", async () => {
    const results = await getCalendarFollowUps(tenantId, 2026, 4)
    expect(results.length).toBe(2)
    const ids = results.map((r) => r.id)
    expect(ids).toContain(fuMayAId)
    expect(ids).toContain(fuMayBId)
  })

  it("each result includes deal with stage and owner info", async () => {
    const results = await getCalendarFollowUps(tenantId, 2026, 4)
    const first = results[0]!
    expect(first.deal.stage.key).toBe("nuevo")
    expect(first.deal.stage.label).toBe("Nuevo")
    expect(first.deal.owner.name).toBe("Cal User")
  })

  it("excludes out-of-month follow-ups", async () => {
    const results = await getCalendarFollowUps(tenantId, 2026, 5)
    expect(results.length).toBe(1)
    expect(results[0]!.note).toBe("Otro seguimiento")
  })

  it("filters by ownerId when provided", async () => {
    const other = await prismaAdmin.user.create({ data: { email: `cal-other-${Date.now()}@test.com` } })
    const results = await getCalendarFollowUps(tenantId, 2026, 4, other.id)
    expect(results.length).toBe(0)
  })
})
