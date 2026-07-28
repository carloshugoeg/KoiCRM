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
import {
  getDealSummaryAction,
  getDealActivityAction,
  getDealFollowUpsAction,
  getQuotesForDealAction,
  getPaymentsForDealAction,
} from "@/features/deals/actions"
import { globalSearchAction } from "@/features/search/actions"
import { auth } from "@/lib/auth/auth"
import { loadPipelineKanbanData } from "@/features/pipeline/queries"
import { pipelineScopeFor, permissionsForInTx, scopeFromPermissions } from "@/lib/permissions/resolve"
import { getFollowUpAlertsInTx } from "@/features/follow-ups/queries"
import { withTenant as withTenantRls } from "@/lib/db/rls"
import { getClientKpis, loadClientDetailPageData, loadClientsPageData } from "@/features/clients/queries"

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>

function makeCuid(): string {
  return "c" + randomBytes(12).toString("hex")
}

let tenantId: string
let memberId: string
let otherId: string
let supervisorId: string
let ownDealId: string
let foreignDealId: string
let cededDealId: string
let clientId: string

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

  const supervisor = await prismaAdmin.user.create({ data: { email: `valeria-${Date.now()}@test.com` } })
  supervisorId = supervisor.id
  await prismaAdmin.membership.create({
    data: { userId: supervisorId, tenantId, role: "SUPERVISOR", status: "ACTIVE" },
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
  const wonStage = await prismaAdmin.pipelineStage.create({
    data: {
      tenantId,
      pipelineId: pipeline.id,
      order: 1,
      key: "ganado",
      label: "Ganado",
      color: "#22c55e",
      iconKey: "check",
    },
  })

  const client = await prismaAdmin.client.create({
    data: { tenantId, name: "Cliente Scope" },
  })
  clientId = client.id

  const own = await prismaAdmin.deal.create({
    data: {
      id: makeCuid(),
      tenantId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      clientId,
      ownerId: memberId,
      name: "Propia",
      channelKey: "web",
      statusKey: "active",
      value: 100,
    },
  })
  ownDealId = own.id

  // In the "won" stage (not `stage`/"nuevo") so it doubles as the fixture proving the client
  // KPI won-count/won-total leak, without adding a fourth deal that would perturb every other
  // test in this file that asserts on the exact set of tenant deals.
  const foreign = await prismaAdmin.deal.create({
    data: {
      id: makeCuid(),
      tenantId,
      pipelineId: pipeline.id,
      stageId: wonStage.id,
      clientId,
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
      clientId,
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

/**
 * FINDING-1 fix: getDealActivityAction, getDealFollowUpsAction, getQuotesForDealAction and
 * getPaymentsForDealAction previously gated on tenant membership only — a restricted member
 * could read a colleague's quotes, payments, follow-ups or activity log by supplying a
 * foreign dealId, since the underlying queries filter on {tenantId, dealId} alone. They now
 * funnel through the same assertDealInScope guard as getDealSummaryAction.
 */
describe("deal-read actions honour the caller's scope", () => {
  it("getDealActivityAction refuses a deal outside the caller's scope", async () => {
    await expect(getDealActivityAction(tenantId, foreignDealId)).rejects.toThrow()
  })

  it("getDealActivityAction still serves the caller's own deal", async () => {
    await expect(getDealActivityAction(tenantId, ownDealId)).resolves.toHaveProperty("items")
  })

  it("getDealActivityAction still serves a deal ceded to the caller", async () => {
    await expect(getDealActivityAction(tenantId, cededDealId)).resolves.toHaveProperty("items")
  })

  it("getDealFollowUpsAction refuses a deal outside the caller's scope", async () => {
    await expect(getDealFollowUpsAction(tenantId, foreignDealId)).rejects.toThrow()
  })

  it("getDealFollowUpsAction still serves a deal ceded to the caller", async () => {
    await expect(getDealFollowUpsAction(tenantId, cededDealId)).resolves.toBeInstanceOf(Array)
  })

  it("getQuotesForDealAction refuses a deal outside the caller's scope", async () => {
    await expect(getQuotesForDealAction(tenantId, foreignDealId)).rejects.toThrow()
  })

  it("getQuotesForDealAction still serves a deal ceded to the caller", async () => {
    await expect(getQuotesForDealAction(tenantId, cededDealId)).resolves.toBeInstanceOf(Array)
  })

  it("getPaymentsForDealAction refuses a deal outside the caller's scope", async () => {
    await expect(getPaymentsForDealAction(tenantId, foreignDealId)).rejects.toThrow()
  })

  it("getPaymentsForDealAction still serves a deal ceded to the caller", async () => {
    await expect(getPaymentsForDealAction(tenantId, cededDealId)).resolves.toBeInstanceOf(Array)
  })

  it("all four resolve the foreign deal once the role is granted pipeline.viewAll", async () => {
    await withTenant(tenantId, (tx) =>
      tx.rolePermission.create({
        data: { tenantId, role: "MEMBER", key: "pipeline.viewAll", allowed: true },
      }),
    )
    await expect(getDealActivityAction(tenantId, foreignDealId)).resolves.toHaveProperty("items")
    await expect(getDealFollowUpsAction(tenantId, foreignDealId)).resolves.toBeInstanceOf(Array)
    await expect(getQuotesForDealAction(tenantId, foreignDealId)).resolves.toBeInstanceOf(Array)
    await expect(getPaymentsForDealAction(tenantId, foreignDealId)).resolves.toBeInstanceOf(Array)
  })
})

/**
 * FINDING-3 fix: archive, calendar, stats/listado and global search gated deal visibility on
 * canSeeAllDeals(role) (atLeast(role, "SUPERVISOR")) instead of the pipeline.viewAll
 * permission. For a SUPERVISOR whose pipeline.viewAll has been switched off, that was a
 * straight bypass — the funnel narrows but these surfaces kept returning every deal in the
 * tenant. globalSearchAction is the cheapest of the four to drive here: it is already a
 * plain "use server" action reachable with the same auth-mock harness as the tests above, no
 * page render or router mocking required.
 */
describe("global search honours pipeline.viewAll for every role, not just MEMBER", () => {
  it("a SUPERVISOR without pipeline.viewAll cannot search up a colleague's deal", async () => {
    await withTenant(tenantId, (tx) =>
      tx.rolePermission.create({
        data: { tenantId, role: "SUPERVISOR", key: "pipeline.viewAll", allowed: false },
      }),
    )
    mockAuth.mockResolvedValue({ user: { id: supervisorId } } as Session)

    const res = await globalSearchAction(tenantId, "Ajena")
    expect(res.ok).toBe(true)
    expect(res.results?.some((r) => r.id === foreignDealId)).toBe(false)
  })

  it("a SUPERVISOR with pipeline.viewAll (the default) can still find it", async () => {
    mockAuth.mockResolvedValue({ user: { id: supervisorId } } as Session)

    const res = await globalSearchAction(tenantId, "Ajena")
    expect(res.ok).toBe(true)
    expect(res.results?.some((r) => r.id === foreignDealId)).toBe(true)
  })
})

/**
 * FINDING-A fix: the `/app` layout derived its follow-up-alert owner filter from
 * canSeeAllDeals(role) rather than the pipeline.viewAll permission — the same bypass fixed for
 * archive/calendar/stats/listado/search above, but on the surface that runs on every single
 * page. A SUPERVISOR whose pipeline.viewAll was switched off still got a banner alert for a
 * deal they cannot open.
 *
 * layout.tsx itself can't be imported here — it (transitively) pulls in "use client" .tsx
 * component files, and this harness's vitest config has no JSX transform for the node
 * environment (tsconfig's "jsx": "preserve" is meant for Next.js's own SWC build). So this
 * drives the exact transaction body the fixed layout now runs — one withTenant() holding
 * permissionsForInTx + scopeFromPermissions + getFollowUpAlertsInTx — rather than the page
 * component. Before the fix this composition didn't exist in the layout at all (it read
 * canSeeAllDeals(role) instead), so reproducing it here and asserting on the result still
 * pins the exact behaviour the layout must have.
 */
describe("layout follow-up alerts honour pipeline.viewAll scope", () => {
  async function alertDealIdsForLayout(role: "SUPERVISOR" | "MEMBER", userId: string) {
    return withTenantRls(tenantId, async (tx) => {
      const perms = await permissionsForInTx(tx, tenantId, role, userId)
      const scope = scopeFromPermissions(perms, userId)
      const alerts = await getFollowUpAlertsInTx(tx, tenantId, scope.visibleToUserId ?? undefined)
      return [...alerts.overdue, ...alerts.today, ...alerts.next7].map((fu) => fu.deal.id)
    })
  }

  beforeAll(async () => {
    const now = new Date()
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 9, 0, 0, 0)
    await prismaAdmin.followUp.create({
      data: { tenantId, dealId: foreignDealId, date: yesterday, completed: false },
    })
  })

  it("a SUPERVISOR without pipeline.viewAll does not get the alert for a foreign deal", async () => {
    await withTenant(tenantId, (tx) =>
      tx.rolePermission.create({
        data: { tenantId, role: "SUPERVISOR", key: "pipeline.viewAll", allowed: false },
      }),
    )

    const dealIds = await alertDealIdsForLayout("SUPERVISOR", supervisorId)
    expect(dealIds).not.toContain(foreignDealId)
  })

  it("a SUPERVISOR with pipeline.viewAll (the default) still gets the alert", async () => {
    const dealIds = await alertDealIdsForLayout("SUPERVISOR", supervisorId)
    expect(dealIds).toContain(foreignDealId)
  })
})

/**
 * FINDING-B fix: getClientKpisInTx counted every deal a client ever had with no visibility
 * filter, even though getClientWithDealsInTx already scoped the deal list right below it on
 * the same screen. A restricted member saw a KPI card ("Oportunidades"/"Ganadas"/"Valor
 * ganado") counting a colleague's deals — including won totals — while the list underneath
 * showed only what they could open.
 */
describe("client KPI cards honour pipeline.viewAll scope", () => {
  beforeEach(async () => {
    await withTenant(tenantId, (tx) => tx.rolePermission.deleteMany({ where: { tenantId } }))
  })

  it("getClientKpis scoped to a restricted member matches the visible deal list, ceded deal included", async () => {
    const scope = await pipelineScopeFor(tenantId, "MEMBER", memberId)
    expect(scope.visibleToUserId).toBe(memberId)

    const kpis = await getClientKpis(tenantId, clientId, undefined, scope.visibleToUserId ?? undefined)

    // Visible to memberId: ownDealId (100) + cededDealId (300). foreignDealId (won, 200) belongs
    // to otherId and was never ceded — it must not be counted, including in wonCount/totalValue.
    expect(kpis.totalOpps).toBe(2)
    expect(kpis.activeOpps).toBe(2)
    expect(kpis.wonCount).toBe(0)
    expect(kpis.totalValue).toBe(0)
  })

  it("counts every deal, including the won one, once pipeline.viewAll is granted", async () => {
    await withTenant(tenantId, (tx) =>
      tx.rolePermission.create({
        data: { tenantId, role: "MEMBER", key: "pipeline.viewAll", allowed: true },
      }),
    )
    const scope = await pipelineScopeFor(tenantId, "MEMBER", memberId)
    expect(scope.visibleToUserId).toBeNull()

    const kpis = await getClientKpis(tenantId, clientId, undefined, scope.visibleToUserId ?? undefined)
    expect(kpis.totalOpps).toBe(3)
    expect(kpis.wonCount).toBe(1)
    expect(kpis.totalValue).toBe(200)
  })

  it("loadClientDetailPageData wires visibleToUserId into the KPI card, not just the deal list", async () => {
    const scope = await pipelineScopeFor(tenantId, "MEMBER", memberId)
    const { client, kpis } = await loadClientDetailPageData(tenantId, clientId, scope.visibleToUserId ?? undefined)

    expect(client?.deals.map((d) => d.id).sort()).toEqual([ownDealId, cededDealId].sort())
    expect(kpis.totalOpps).toBe(client?.deals.length)
    expect(kpis.wonCount).toBe(0)
  })

  it("loadClientsPageData's selected-client KPI card is scoped the same way as its deal list", async () => {
    const scope = await pipelineScopeFor(tenantId, "MEMBER", memberId)
    const { selectedClient, selectedClientKpis } = await loadClientsPageData(tenantId, {
      selectedClientId: clientId,
      visibleToUserId: scope.visibleToUserId ?? undefined,
    })

    expect(selectedClient?.deals.map((d) => d.id).sort()).toEqual([ownDealId, cededDealId].sort())
    expect(selectedClientKpis?.totalOpps).toBe(selectedClient?.deals.length)
  })
})
