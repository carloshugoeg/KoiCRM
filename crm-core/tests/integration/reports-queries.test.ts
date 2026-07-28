import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { randomBytes } from "crypto"
import { prismaAdmin, cleanDatabase, disconnectAll } from "./helpers"
import { getOpenOpportunities } from "@/features/reports/queries"

function makeCuid(): string {
  return "c" + randomBytes(12).toString("hex")
}

let tenantId: string
let mineId: string
let theirsId: string
let openMine: string
let openTheirs: string
let wonId: string
let archivedId: string

beforeAll(async () => {
  await cleanDatabase()

  const tenant = await prismaAdmin.tenant.create({
    data: { slug: `reports-${Date.now()}`, name: "Reports" },
  })
  tenantId = tenant.id

  const mine = await prismaAdmin.user.create({ data: { email: `mine-${Date.now()}@test.com` } })
  mineId = mine.id
  const theirs = await prismaAdmin.user.create({ data: { email: `theirs-${Date.now()}@test.com` } })
  theirsId = theirs.id
  for (const userId of [mineId, theirsId]) {
    await prismaAdmin.membership.create({
      data: { userId, tenantId, role: "MEMBER", status: "ACTIVE" },
    })
  }

  const pipeline = await prismaAdmin.pipeline.create({
    data: { tenantId, name: "P", isDefault: true },
  })
  const stages: Record<string, string> = {}
  let order = 0
  for (const key of ["nuevo", "ganado", "perdido"]) {
    const s = await prismaAdmin.pipelineStage.create({
      data: {
        tenantId,
        pipelineId: pipeline.id,
        order: order++,
        key,
        label: key,
        color: "#6366f1",
        iconKey: "circle",
      },
    })
    stages[key] = s.id
  }

  async function deal(opts: {
    ownerId: string
    stageId: string
    name: string
    createdAt: Date
    isArchived?: boolean
  }) {
    const d = await prismaAdmin.deal.create({
      data: {
        id: makeCuid(),
        tenantId,
        pipelineId: pipeline.id,
        stageId: opts.stageId,
        ownerId: opts.ownerId,
        name: opts.name,
        channelKey: "web",
        statusKey: "active",
        value: 100,
        createdAt: opts.createdAt,
        isArchived: opts.isArchived ?? false,
      },
    })
    return d.id
  }

  openMine = await deal({
    ownerId: mineId,
    stageId: stages.nuevo,
    name: "Abierta mía",
    createdAt: new Date("2026-01-01T00:00:00Z"),
  })
  openTheirs = await deal({
    ownerId: theirsId,
    stageId: stages.nuevo,
    name: "Abierta ajena",
    createdAt: new Date("2026-02-01T00:00:00Z"),
  })
  wonId = await deal({
    ownerId: mineId,
    stageId: stages.ganado,
    name: "Ganada",
    createdAt: new Date("2026-01-15T00:00:00Z"),
  })
  archivedId = await deal({
    ownerId: mineId,
    stageId: stages.nuevo,
    name: "Archivada",
    createdAt: new Date("2026-01-20T00:00:00Z"),
    isArchived: true,
  })
})

afterAll(async () => {
  await cleanDatabase()
  await disconnectAll()
})

describe("getOpenOpportunities", () => {
  it("excludes won, lost and archived deals", async () => {
    const rows = await getOpenOpportunities({ tenantId })
    const ids = rows.map((r) => r.id)
    expect(ids).toContain(openMine)
    expect(ids).toContain(openTheirs)
    expect(ids).not.toContain(wonId)
    expect(ids).not.toContain(archivedId)
  })

  it("sorts oldest first by default", async () => {
    const rows = await getOpenOpportunities({ tenantId })
    expect(rows[0].id).toBe(openMine)
  })

  it("sorts newest first on request", async () => {
    const rows = await getOpenOpportunities({ tenantId, sort: "newest" })
    expect(rows[0].id).toBe(openTheirs)
  })

  it("pins the report to one advisor when ownerId is given", async () => {
    const rows = await getOpenOpportunities({ tenantId, ownerId: mineId })
    expect(rows.map((r) => r.id)).toEqual([openMine])
  })

  it("computes days open from the creation date", async () => {
    const rows = await getOpenOpportunities({ tenantId, ownerId: mineId })
    expect(rows[0].daysOpen).toBeGreaterThan(0)
  })
})
