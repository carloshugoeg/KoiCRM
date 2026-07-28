import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest"
import type { Session } from "next-auth"
import { randomBytes } from "crypto"
import { prismaAdmin, withTenant, cleanDatabase, disconnectAll } from "./helpers"

/**
 * Deal visibility must be enforced on the server, not only in the UI. The pipeline
 * `?deal=<id>` deep link calls getDealSummaryAction with a caller-supplied id, so a
 * restricted member could otherwise read a colleague's opportunity by editing the URL.
 */

process.env.AUTH_SECRET ??= "test-pipeline-scope-secret"

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

// Import AFTER mocks.
import { getDealSummaryAction } from "@/features/deals/actions"
import { auth } from "@/lib/auth/auth"
import { loadPipelineKanbanData } from "@/features/pipeline/queries"
import { pipelineScopeFor } from "@/lib/permissions/resolve"

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>

function makeCuid(): string {
  return "c" + randomBytes(12).toString("hex")
}

let tenantId: string
let memberId: string
let otherId: string
let ownDealId: string
let foreignDealId: string
let cededDealId: string

beforeAll(async () => {
  await cleanDatabase()

  const tenant = await prismaAdmin.tenant.create({
    data: { slug: `scope-${Date.now()}`, name: "Scope" },
  })
  tenantId = tenant.id

  const member = await prismaAdmin.user.create({ data: { email: `sofia-${Date.now()}@test.com` } })
  memberId = member.id
  await prismaAdmin.membership.create({
    data: { userId: memberId, tenantId, role: "MEMBER", status: "ACTIVE" },
  })

  const other = await prismaAdmin.user.create({ data: { email: `karla-${Date.now()}@test.com` } })
  otherId = other.id
  await prismaAdmin.membership.create({
    data: { userId: otherId, tenantId, role: "MEMBER", status: "ACTIVE" },
  })

  const pipeline = await prismaAdmin.pipeline.create({
    data: { tenantId, name: "P", isDefault: true },
  })
  const stage = await prismaAdmin.pipelineStage.create({
    data: {
      tenantId,
      pipelineId: pipeline.id,
      order: 0,
      key: "nuevo",
      label: "Nuevo",
      color: "#6366f1",
      iconKey: "circle",
    },
  })

  const own = await prismaAdmin.deal.create({
    data: {
      id: makeCuid(),
      tenantId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      ownerId: memberId,
      name: "Propia",
      channelKey: "web",
      statusKey: "active",
      value: 100,
    },
  })
  ownDealId = own.id

  const foreign = await prismaAdmin.deal.create({
    data: {
      id: makeCuid(),
      tenantId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      ownerId: otherId,
      name: "Ajena",
      channelKey: "web",
      statusKey: "active",
      value: 200,
    },
  })
  foreignDealId = foreign.id

  // Owned by someone else but ceded to the member through DealViewer. It must behave
  // like one of their own — the same way archive, search and stats/listado treat it.
  const ceded = await prismaAdmin.deal.create({
    data: {
      id: makeCuid(),
      tenantId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      ownerId: otherId,
      name: "Cedida",
      channelKey: "web",
      statusKey: "active",
      value: 300,
    },
  })
  cededDealId = ceded.id
  await prismaAdmin.dealViewer.create({
    data: { tenantId, dealId: cededDealId, userId: memberId },
  })
})

afterAll(async () => {
  await cleanDatabase()
  await disconnectAll()
})

beforeEach(async () => {
  mockAuth.mockReset()
  mockAuth.mockResolvedValue({ user: { id: memberId } } as Session)
  await withTenant(tenantId, (tx) => tx.rolePermission.deleteMany({ where: { tenantId } }))
})

describe("getDealSummaryAction deep-link authorization", () => {
  it("returns the caller's own deal", async () => {
    const res = await getDealSummaryAction({ tenantId, dealId: ownDealId })
    expect(res.ok).toBe(true)
  })

  it("refuses a deal owned by someone else", async () => {
    const res = await getDealSummaryAction({ tenantId, dealId: foreignDealId })
    expect(res.ok).toBe(false)
  })

  it("returns a deal ceded to the caller through DealViewer", async () => {
    const res = await getDealSummaryAction({ tenantId, dealId: cededDealId })
    expect(res.ok).toBe(true)
  })

  it("does not distinguish a foreign deal from a missing one", async () => {
    const foreign = await getDealSummaryAction({ tenantId, dealId: foreignDealId })
    const missing = await getDealSummaryAction({ tenantId, dealId: makeCuid() })
    expect(foreign.ok).toBe(false)
    expect(missing.ok).toBe(false)
    expect(foreign.error).toBe(missing.error)
  })

  it("returns the foreign deal once the role is granted pipeline.viewAll", async () => {
    await withTenant(tenantId, (tx) =>
      tx.rolePermission.create({
        data: { tenantId, role: "MEMBER", key: "pipeline.viewAll", allowed: true },
      }),
    )
    const res = await getDealSummaryAction({ tenantId, dealId: foreignDealId })
    expect(res.ok).toBe(true)
  })
})

describe("loadPipelineKanbanData scope enforcement", () => {
  it("returns the member's own deals plus what was ceded to them, and nothing else", async () => {
    const scope = await pipelineScopeFor(tenantId, "MEMBER", memberId)
    const { deals } = await loadPipelineKanbanData(tenantId, {}, scope)
    expect(deals.map((d) => d.id).sort()).toEqual([ownDealId, cededDealId].sort())
  })

  it("cannot be widened by a hand-crafted ?owner= naming someone else", async () => {
    const scope = await pipelineScopeFor(tenantId, "MEMBER", memberId)
    const { deals } = await loadPipelineKanbanData(tenantId, { ownerId: otherId }, scope)
    const ids = deals.map((d) => d.id)
    expect(ids).not.toContain(foreignDealId)
    // ownerId narrows within the visible set: the ceded deal is owned by otherId.
    expect(ids).toEqual([cededDealId])
  })

  it("returns the whole funnel once pipeline.viewAll is granted", async () => {
    await withTenant(tenantId, (tx) =>
      tx.rolePermission.create({
        data: { tenantId, role: "MEMBER", key: "pipeline.viewAll", allowed: true },
      }),
    )
    const scope = await pipelineScopeFor(tenantId, "MEMBER", memberId)
    const { deals } = await loadPipelineKanbanData(tenantId, {}, scope)
    expect(deals.map((d) => d.id).sort()).toEqual([ownDealId, foreignDealId, cededDealId].sort())
  })

  it("still honours an explicit ?owner= for an unrestricted role", async () => {
    const scope = await pipelineScopeFor(tenantId, "SUPERVISOR", memberId)
    const { deals } = await loadPipelineKanbanData(tenantId, { ownerId: otherId }, scope)
    expect(deals.map((d) => d.id).sort()).toEqual([foreignDealId, cededDealId].sort())
  })
})
