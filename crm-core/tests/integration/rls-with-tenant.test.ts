import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, disconnectAll } from "./helpers"
import { withTenant } from "@/lib/db/rls"

let tenantAId: string
let tenantBId: string
let userAId: string
let userBId: string

beforeAll(async () => {
  const suffix = Date.now()
  const [tA, tB] = await Promise.all([
    prismaAdmin.tenant.create({ data: { name: "RLS Tenant A", slug: `rls-a-${suffix}` } }),
    prismaAdmin.tenant.create({ data: { name: "RLS Tenant B", slug: `rls-b-${suffix}` } }),
  ])
  const [uA, uB] = await Promise.all([
    prismaAdmin.user.create({ data: { email: `rls-a-${suffix}@test.com`, emailVerified: new Date() } }),
    prismaAdmin.user.create({ data: { email: `rls-b-${suffix}@test.com`, emailVerified: new Date() } }),
  ])
  tenantAId = tA.id
  tenantBId = tB.id
  userAId = uA.id
  userBId = uB.id

  const pipelineA = await prismaAdmin.pipeline.create({ data: { tenantId: tenantAId, name: "P-A", isDefault: true } })
  const pipelineB = await prismaAdmin.pipeline.create({ data: { tenantId: tenantBId, name: "P-B", isDefault: true } })

  const [stageA] = await Promise.all([
    prismaAdmin.pipelineStage.create({ data: { tenantId: tenantAId, pipelineId: pipelineA.id, key: "new", label: "New", color: "#000", iconKey: "circle", order: 0 } }),
  ])
  const [stageB] = await Promise.all([
    prismaAdmin.pipelineStage.create({ data: { tenantId: tenantBId, pipelineId: pipelineB.id, key: "new", label: "New", color: "#000", iconKey: "circle", order: 0 } }),
  ])

  await Promise.all([
    prismaAdmin.deal.create({ data: { id: `deal-a-${suffix}`, tenantId: tenantAId, pipelineId: pipelineA.id, stageId: stageA.id, ownerId: userAId, name: "Deal A", channelKey: "web", statusKey: "active", value: 100 } }),
    prismaAdmin.deal.create({ data: { id: `deal-b-${suffix}`, tenantId: tenantBId, pipelineId: pipelineB.id, stageId: stageB.id, ownerId: userBId, name: "Deal B", channelKey: "web", statusKey: "active", value: 200 } }),
  ])
})

afterAll(async () => {
  // Delete in FK-safe order: deals → stages → pipelines → users → tenants
  await prismaAdmin.deal.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } })
  await prismaAdmin.pipelineStage.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } })
  await prismaAdmin.pipeline.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } })
  await prismaAdmin.user.deleteMany({ where: { id: { in: [userAId, userBId] } } })
  await prismaAdmin.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } })
  await disconnectAll()
})

describe("withTenant RLS isolation", () => {
  it("deals for tenant A are isolated", async () => {
    const deals = await withTenant(tenantAId, (tx) => tx.deal.findMany())
    expect(deals.every((d) => d.tenantId === tenantAId)).toBe(true)
  })

  it("deals for tenant B are isolated", async () => {
    const deals = await withTenant(tenantBId, (tx) => tx.deal.findMany())
    expect(deals.every((d) => d.tenantId === tenantBId)).toBe(true)
  })

  it("pipelines are isolated per tenant", async () => {
    const [pipesA, pipesB] = await Promise.all([
      withTenant(tenantAId, (tx) => tx.pipeline.findMany()),
      withTenant(tenantBId, (tx) => tx.pipeline.findMany()),
    ])
    expect(pipesA.every((p) => p.tenantId === tenantAId)).toBe(true)
    expect(pipesB.every((p) => p.tenantId === tenantBId)).toBe(true)
  })

  it("catalog items are isolated per tenant", async () => {
    const [catA, catB] = await Promise.all([
      withTenant(tenantAId, (tx) => tx.catalogItem.findMany()),
      withTenant(tenantBId, (tx) => tx.catalogItem.findMany()),
    ])
    expect(catA.every((c) => c.tenantId === tenantAId)).toBe(true)
    expect(catB.every((c) => c.tenantId === tenantBId)).toBe(true)
  })

  it("memberships are isolated per tenant", async () => {
    const members = await withTenant(tenantAId, (tx) => tx.membership.findMany())
    expect(members.every((m) => m.tenantId === tenantAId)).toBe(true)
  })
})
