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
  moveDealAction,
} from "@/features/deals/actions"
import { globalSearchAction } from "@/features/search/actions"
import { getDealNotesAction, addNoteAction } from "@/features/notes/actions"
import { updateQuote } from "@/features/quotes/actions"
import { getDealAttachmentsAction } from "@/features/attachments/actions"
import { auth } from "@/lib/auth/auth"
import { loadPipelineKanbanData } from "@/features/pipeline/queries"
import { getArchivedDeals, getPipelineDeals } from "@/features/deals/queries"
import { getCalendarFollowUps } from "@/features/calendar/queries"
import { pipelineScopeFor } from "@/lib/permissions/resolve"
import { getClientKpis, loadClientDetailPageData, loadClientsPageData, listClients } from "@/features/clients/queries"
import { loadTenantLayoutData } from "@/app/app/[tenantSlug]/layout-data"
import { loadAlertsPageData } from "@/app/app/[tenantSlug]/stats/alerts/page-data"

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
 * FINDING-1 fix (this wave): getDealNotesAction and getDealAttachmentsAction had the identical
 * shape as the four actions above — gated on tenant membership only, with the underlying
 * queries filtering {tenantId, dealId} alone — but were missed by the previous wave. A
 * restricted member could read a colleague's free-text sales notes (with author names) or
 * attachment list (including file `url`s) by supplying a foreign dealId. Both now funnel
 * through the same requireDealReaderInScope guard.
 *
 * Fixture notes/attachments are created on foreignDealId (not the caller's) and cededDealId
 * (ceded to the caller) so the assertions prove data is actually withheld/served, not just
 * that an empty result happens to come back either way.
 */
describe("notes and attachments honour the caller's scope", () => {
  beforeAll(async () => {
    await prismaAdmin.note.create({
      data: { tenantId, dealId: foreignDealId, text: "Nota ajena" },
    })
    await prismaAdmin.note.create({
      data: { tenantId, dealId: cededDealId, text: "Nota cedida" },
    })
    await prismaAdmin.attachment.create({
      data: {
        tenantId,
        dealId: foreignDealId,
        key: `${tenantId}/deals/${foreignDealId}/ajeno.pdf`,
        url: `/api/media/${tenantId}/deals/${foreignDealId}/ajeno.pdf`,
        mimeType: "application/pdf",
        size: 100,
      },
    })
    await prismaAdmin.attachment.create({
      data: {
        tenantId,
        dealId: cededDealId,
        key: `${tenantId}/deals/${cededDealId}/cedido.pdf`,
        url: `/api/media/${tenantId}/deals/${cededDealId}/cedido.pdf`,
        mimeType: "application/pdf",
        size: 100,
      },
    })
  })

  it("getDealNotesAction refuses a deal outside the caller's scope", async () => {
    await expect(getDealNotesAction(tenantId, foreignDealId)).rejects.toThrow()
  })

  it("getDealNotesAction still serves notes for a deal ceded to the caller", async () => {
    const notes = await getDealNotesAction(tenantId, cededDealId)
    expect(notes.map((n) => n.text)).toContain("Nota cedida")
  })

  it("getDealAttachmentsAction withholds attachments for a deal outside the caller's scope", async () => {
    const rows = await getDealAttachmentsAction(tenantId, foreignDealId)
    expect(rows).toEqual([])
  })

  it("getDealAttachmentsAction still serves attachments for a deal ceded to the caller", async () => {
    const rows = await getDealAttachmentsAction(tenantId, cededDealId)
    expect(rows.some((r) => r.url.includes("cedido.pdf"))).toBe(true)
  })

  it("both resolve the foreign deal's data once the role is granted pipeline.viewAll", async () => {
    await withTenant(tenantId, (tx) =>
      tx.rolePermission.create({
        data: { tenantId, role: "MEMBER", key: "pipeline.viewAll", allowed: true },
      }),
    )
    const notes = await getDealNotesAction(tenantId, foreignDealId)
    expect(notes.map((n) => n.text)).toContain("Nota ajena")

    const rows = await getDealAttachmentsAction(tenantId, foreignDealId)
    expect(rows.some((r) => r.url.includes("ajeno.pdf"))).toBe(true)
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
 * layout.tsx itself still can't be imported here — it (transitively) pulls in "use client" .tsx
 * component files, and this harness's vitest config has no JSX transform for the node
 * environment (tsconfig's "jsx": "preserve" is meant for Next.js's own SWC build). But its data
 * load is a plain .ts module (app/app/[tenantSlug]/layout-data.ts) that both the layout and
 * this test import, so this now drives the real function instead of a reproduction of its
 * body — reverting the layout's scope wiring back to canSeeAllDeals(role) lives entirely
 * inside loadTenantLayoutData, so that revert makes this test fail directly (verified by hand
 * — see the finding-5 section of the final report for what reverting to canSeeAllDeals(role)
 * does to these two tests).
 */
describe("layout follow-up alerts honour pipeline.viewAll scope", () => {
  async function alertDealIdsForLayout(role: "SUPERVISOR" | "MEMBER", userId: string) {
    const { followUpAlerts: alerts } = await loadTenantLayoutData(tenantId, role, userId)
    return [...alerts.overdue, ...alerts.today, ...alerts.next7].map((fu) => fu.deal.id)
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

  /**
   * FINDING-3 (this wave): listClientsInTx counted every deal with no visibility filter at
   * all, even though the KPI card and deal list right next to it on the same screen (tested
   * above) were already scoped. A restricted member saw "N oportunidades" in the sidebar for
   * a client whose opened profile showed a smaller number for that same client.
   */
  it("listClients' sidebar _count.deals matches the visible deal list, not every deal the client has", async () => {
    const scope = await pipelineScopeFor(tenantId, "MEMBER", memberId)
    const { items } = await listClients(tenantId, { visibleToUserId: scope.visibleToUserId ?? undefined })
    const row = items.find((c) => c.id === clientId)
    // Visible to memberId: ownDealId + cededDealId. foreignDealId belongs to otherId and was
    // never ceded, so it must not be counted even though the client has 3 deals total.
    expect(row?._count.deals).toBe(2)
  })

  it("listClients' sidebar _count.deals counts every deal once pipeline.viewAll is granted", async () => {
    await withTenant(tenantId, (tx) =>
      tx.rolePermission.create({
        data: { tenantId, role: "MEMBER", key: "pipeline.viewAll", allowed: true },
      }),
    )
    const scope = await pipelineScopeFor(tenantId, "MEMBER", memberId)
    const { items } = await listClients(tenantId, { visibleToUserId: scope.visibleToUserId ?? undefined })
    const row = items.find((c) => c.id === clientId)
    expect(row?._count.deals).toBe(3)
  })
})

/**
 * FINDING-6 test coverage: the previous wave's Finding 3 (archive/calendar/stats-listado/search
 * bypassing pipeline.viewAll via canSeeAllDeals instead of the permission) was exercised only
 * through globalSearchAction. These cover the other two query paths directly —
 * getArchivedDeals (archive) and getPipelineDeals (stats/listado reuses the funnel's own
 * query). Calendar is covered too: getCalendarFollowUps is cheap to call directly, no page
 * render needed. Its cesión coverage (a *ceded* deal's follow-up must surface, not just a
 * foreign one being withheld) lives in the "cesión" describe block below, alongside the same
 * check for the layout's follow-up alerts — this block only checks what FINDING-6 is about,
 * that a foreign deal's follow-up does not leak.
 */
describe("archive, listado and calendar query paths honour pipeline.viewAll", () => {
  let archivedForeignDealId: string

  beforeAll(async () => {
    const stage = await prismaAdmin.pipelineStage.findFirstOrThrow({ where: { tenantId, key: "nuevo" } })
    const archived = await prismaAdmin.deal.create({
      data: {
        id: makeCuid(),
        tenantId,
        pipelineId: stage.pipelineId,
        stageId: stage.id,
        clientId,
        ownerId: otherId,
        name: "Archivada ajena",
        channelKey: "web",
        statusKey: "active",
        value: 400,
        isArchived: true,
      },
    })
    archivedForeignDealId = archived.id

    // Dated "now" rather than a fixed offset so it always lands in the current month's
    // window, regardless of which day of the month the suite happens to run on.
    await prismaAdmin.followUp.create({
      data: { tenantId, dealId: foreignDealId, date: new Date(), completed: false },
    })
  })

  it("getArchivedDeals excludes a foreign deal for a SUPERVISOR without pipeline.viewAll", async () => {
    await withTenant(tenantId, (tx) =>
      tx.rolePermission.create({
        data: { tenantId, role: "SUPERVISOR", key: "pipeline.viewAll", allowed: false },
      }),
    )
    const scope = await pipelineScopeFor(tenantId, "SUPERVISOR", supervisorId)
    const { deals } = await getArchivedDeals(tenantId, undefined, 50, scope.visibleToUserId ?? undefined)
    expect(deals.map((d) => d.id)).not.toContain(archivedForeignDealId)
  })

  it("getArchivedDeals includes it once pipeline.viewAll is restored (the default)", async () => {
    const scope = await pipelineScopeFor(tenantId, "SUPERVISOR", supervisorId)
    const { deals } = await getArchivedDeals(tenantId, undefined, 50, scope.visibleToUserId ?? undefined)
    expect(deals.map((d) => d.id)).toContain(archivedForeignDealId)
  })

  it("getPipelineDeals (stats/listado's query path) excludes a foreign deal for a SUPERVISOR without pipeline.viewAll", async () => {
    await withTenant(tenantId, (tx) =>
      tx.rolePermission.create({
        data: { tenantId, role: "SUPERVISOR", key: "pipeline.viewAll", allowed: false },
      }),
    )
    const scope = await pipelineScopeFor(tenantId, "SUPERVISOR", supervisorId)
    const deals = await getPipelineDeals(tenantId, { visibleToUserId: scope.visibleToUserId ?? undefined })
    const ids = deals.map((d) => d.id)
    // supervisorId owns nothing and nothing was ceded to them, so a correctly scoped call
    // returns none of the tenant's deals — not just a filtered subset. That is what
    // distinguishes this from the pre-fix bug, which ignored the scope value entirely for
    // SUPERVISOR and returned every deal regardless of pipeline.viewAll.
    expect(ids).not.toContain(foreignDealId)
    expect(ids).toEqual([])
  })

  it("getPipelineDeals includes the foreign deal once pipeline.viewAll is restored (the default)", async () => {
    const scope = await pipelineScopeFor(tenantId, "SUPERVISOR", supervisorId)
    const deals = await getPipelineDeals(tenantId, { visibleToUserId: scope.visibleToUserId ?? undefined })
    expect(deals.map((d) => d.id)).toContain(foreignDealId)
  })

  it("getCalendarFollowUps does not surface a foreign deal's follow-up for a SUPERVISOR without pipeline.viewAll", async () => {
    await withTenant(tenantId, (tx) =>
      tx.rolePermission.create({
        data: { tenantId, role: "SUPERVISOR", key: "pipeline.viewAll", allowed: false },
      }),
    )
    const now = new Date()
    const scope = await pipelineScopeFor(tenantId, "SUPERVISOR", supervisorId)
    const followUps = await getCalendarFollowUps(
      tenantId,
      now.getFullYear(),
      now.getMonth(),
      scope.visibleToUserId ?? undefined,
    )
    expect(followUps.map((fu) => fu.deal.id)).not.toContain(foreignDealId)
  })

  it("getCalendarFollowUps surfaces it once pipeline.viewAll is restored (the default)", async () => {
    const now = new Date()
    const scope = await pipelineScopeFor(tenantId, "SUPERVISOR", supervisorId)
    const followUps = await getCalendarFollowUps(
      tenantId,
      now.getFullYear(),
      now.getMonth(),
      scope.visibleToUserId ?? undefined,
    )
    expect(followUps.map((fu) => fu.deal.id)).toContain(foreignDealId)
  })
})

/**
 * Product decision: cesión transfers the work, so the follow-up should follow the deal.
 * Before this fix, getCalendarFollowUps and getFollowUpAlertsInTx filtered on strict
 * deal.ownerId instead of dealVisibilityWhere (owned or ceded) — a follow-up on a deal ceded
 * to memberId (cededDealId, owned by otherId) appeared on otherId's calendar/alert banner and
 * never on memberId's, even though memberId is the one who can open, edit and act on it
 * everywhere else in the app.
 */
describe("cesión — follow-ups and the calendar follow the deal, not the owner", () => {
  beforeAll(async () => {
    // Dated "now" so it lands in both getCalendarFollowUps' current-month window and
    // getFollowUpAlertsInTx' "today" bucket — the same shape as the pre-existing foreignDealId
    // follow-up created above, so the two fixtures are directly comparable.
    await prismaAdmin.followUp.create({
      data: { tenantId, dealId: cededDealId, date: new Date(), completed: false },
    })
  })

  it("getCalendarFollowUps surfaces a ceded deal's follow-up to the member it was ceded to", async () => {
    const now = new Date()
    const scope = await pipelineScopeFor(tenantId, "MEMBER", memberId)
    expect(scope.visibleToUserId).toBe(memberId)

    const followUps = await getCalendarFollowUps(
      tenantId,
      now.getFullYear(),
      now.getMonth(),
      scope.visibleToUserId ?? undefined,
    )
    const dealIds = followUps.map((fu) => fu.deal.id)
    expect(dealIds).toContain(cededDealId)
    // otherId owns foreignDealId; it was never ceded to memberId, so it must stay out of
    // memberId's calendar even though both follow-ups fall in the same month.
    expect(dealIds).not.toContain(foreignDealId)
  })

  it("the layout's follow-up alerts surface a ceded deal's follow-up to the member it was ceded to", async () => {
    const { followUpAlerts: alerts } = await loadTenantLayoutData(tenantId, "MEMBER", memberId)
    const dealIds = [...alerts.overdue, ...alerts.today, ...alerts.next7].map((fu) => fu.deal.id)
    expect(dealIds).toContain(cededDealId)
    expect(dealIds).not.toContain(foreignDealId)
  })
})

/**
 * Decision 2: WRITE paths must respect the same visibility scope as reads. Before this change,
 * canEditDealRow said explicitly that "any editor (MEMBER+) may edit any deal, regardless of
 * ownership" — true when everyone saw the whole funnel, but once an admin can switch off
 * pipeline.viewAll for a person, that made write access strictly wider than read access: a
 * restricted advisor could not open a colleague's opportunity anywhere in the app, but could
 * still move it, add a note to it, or edit one of its quotes just by supplying the id.
 *
 * moveDealAction (the kanban drag) and addNoteAction (a direct dealId write) cover the "direct"
 * shape; updateQuote covers the "indirect" shape — it takes a bare quote id and has to resolve
 * the owning deal itself before the scope check applies.
 */
describe("deal write actions honour the caller's scope", () => {
  let moveTargetStageId: string
  let foreignQuoteId: string
  let ownQuoteId: string
  let cededQuoteId: string

  beforeAll(async () => {
    const nuevoStage = await prismaAdmin.pipelineStage.findFirstOrThrow({ where: { tenantId, key: "nuevo" } })
    const moveTargetStage = await prismaAdmin.pipelineStage.create({
      data: {
        tenantId,
        pipelineId: nuevoStage.pipelineId,
        order: 2,
        key: "contactado",
        label: "Contactado",
        color: "#f59e0b",
        iconKey: "circle",
      },
    })
    moveTargetStageId = moveTargetStage.id

    const foreignQuote = await prismaAdmin.quote.create({
      data: { tenantId, dealId: foreignDealId, number: "Q-FOREIGN", date: new Date() },
    })
    foreignQuoteId = foreignQuote.id
    const ownQuote = await prismaAdmin.quote.create({
      data: { tenantId, dealId: ownDealId, number: "Q-OWN", date: new Date() },
    })
    ownQuoteId = ownQuote.id
    const cededQuote = await prismaAdmin.quote.create({
      data: { tenantId, dealId: cededDealId, number: "Q-CEDED", date: new Date() },
    })
    cededQuoteId = cededQuote.id
  })

  // moveDealAction mutates stageId — put the caller's own deals back in "nuevo" before every
  // test so each move test starts from the same known state.
  beforeEach(async () => {
    const nuevoStage = await prismaAdmin.pipelineStage.findFirstOrThrow({ where: { tenantId, key: "nuevo" } })
    await prismaAdmin.deal.updateMany({
      where: { id: { in: [ownDealId, cededDealId, foreignDealId] } },
      data: { stageId: nuevoStage.id },
    })
  })

  describe("a MEMBER without pipeline.viewAll (restricted — the case this decision changes)", () => {
    it("moveDealAction rejects a foreign deal", async () => {
      const res = await moveDealAction({
        tenantId, tenantSlug: "scope", dealId: foreignDealId, toStageId: moveTargetStageId,
      })
      expect(res.ok).toBe(false)
    })

    it("moveDealAction succeeds for the caller's own deal", async () => {
      const res = await moveDealAction({
        tenantId, tenantSlug: "scope", dealId: ownDealId, toStageId: moveTargetStageId,
      })
      expect(res.ok).toBe(true)
    })

    it("moveDealAction succeeds for a deal ceded to the caller — the case a naive strict-ownership fix would break", async () => {
      const res = await moveDealAction({
        tenantId, tenantSlug: "scope", dealId: cededDealId, toStageId: moveTargetStageId,
      })
      expect(res.ok).toBe(true)
    })

    it("moveDealAction does not distinguish a foreign deal from a missing one", async () => {
      const foreign = await moveDealAction({
        tenantId, tenantSlug: "scope", dealId: foreignDealId, toStageId: moveTargetStageId,
      })
      const missing = await moveDealAction({
        tenantId, tenantSlug: "scope", dealId: makeCuid(), toStageId: moveTargetStageId,
      })
      expect(foreign.ok).toBe(false)
      expect(missing.ok).toBe(false)
      expect(foreign.error).toBe(missing.error)
    })

    it("addNoteAction rejects a foreign deal", async () => {
      const res = await addNoteAction({ tenantId, tenantSlug: "scope", body: "Nota", dealId: foreignDealId })
      expect(res.ok).toBe(false)
    })

    it("addNoteAction succeeds for the caller's own deal", async () => {
      const res = await addNoteAction({ tenantId, tenantSlug: "scope", body: "Nota propia", dealId: ownDealId })
      expect(res.ok).toBe(true)
    })

    it("addNoteAction succeeds for a deal ceded to the caller — the case a naive strict-ownership fix would break", async () => {
      const res = await addNoteAction({ tenantId, tenantSlug: "scope", body: "Nota cedida", dealId: cededDealId })
      expect(res.ok).toBe(true)
    })

    it("addNoteAction does not distinguish a foreign deal from a missing one", async () => {
      const foreign = await addNoteAction({ tenantId, tenantSlug: "scope", body: "Nota", dealId: foreignDealId })
      const missing = await addNoteAction({ tenantId, tenantSlug: "scope", body: "Nota", dealId: makeCuid() })
      expect(foreign.ok).toBe(false)
      expect(missing.ok).toBe(false)
      expect(foreign.error).toBe(missing.error)
    })

    it("updateQuote (indirect: resolves the deal from the quote) rejects a quote on a foreign deal", async () => {
      const res = await updateQuote(tenantId, { id: foreignQuoteId, number: "Q-FOREIGN-2" })
      expect(res.ok).toBe(false)
    })

    it("updateQuote succeeds for a quote on the caller's own deal", async () => {
      const res = await updateQuote(tenantId, { id: ownQuoteId, number: "Q-OWN-2" })
      expect(res.ok).toBe(true)
    })

    it("updateQuote succeeds for a quote on a deal ceded to the caller — the case a naive strict-ownership fix would break", async () => {
      const res = await updateQuote(tenantId, { id: cededQuoteId, number: "Q-CEDED-2" })
      expect(res.ok).toBe(true)
    })

    it("updateQuote does not distinguish a foreign deal's quote from a missing quote id", async () => {
      const foreign = await updateQuote(tenantId, { id: foreignQuoteId, number: "Q-X" })
      const missing = await updateQuote(tenantId, { id: makeCuid(), number: "Q-X" })
      expect(foreign.ok).toBe(false)
      expect(missing.ok).toBe(false)
      expect((foreign as { error: string }).error).toBe((missing as { error: string }).error)
    })
  })

  describe("a MEMBER with pipeline.viewAll (the default backfilled for every existing tenant)", () => {
    beforeEach(async () => {
      await withTenant(tenantId, (tx) =>
        tx.rolePermission.create({
          data: { tenantId, role: "MEMBER", key: "pipeline.viewAll", allowed: true },
        }),
      )
    })

    it("moveDealAction still succeeds for a colleague's deal — regression guard for today's customers", async () => {
      const res = await moveDealAction({
        tenantId, tenantSlug: "scope", dealId: foreignDealId, toStageId: moveTargetStageId,
      })
      expect(res.ok).toBe(true)
    })

    it("addNoteAction still succeeds for a colleague's deal — regression guard for today's customers", async () => {
      const res = await addNoteAction({ tenantId, tenantSlug: "scope", body: "Nota sin restricción", dealId: foreignDealId })
      expect(res.ok).toBe(true)
    })

    it("updateQuote still succeeds for a colleague's deal's quote — regression guard for today's customers", async () => {
      const res = await updateQuote(tenantId, { id: foreignQuoteId, number: "Q-REGRESSION" })
      expect(res.ok).toBe(true)
    })
  })
})

/**
 * stats/alerts passed the raw ?<panel>.owner= search parameter straight to getFollowUpAlerts
 * and never resolved pipelineScopeFor, so with no owner filter it applied no visibility
 * predicate and returned every follow-up in the tenant — deal name, company, stage and the
 * follow-up's free-text note. That is row-level data (the same reasoning that scopes
 * stats/listado), so it must respect pipeline.viewAll too.
 *
 * loadAlertsPageData is page.tsx's data load pulled into a plain `.ts` module, the same
 * reason layout-data.ts exists (see loadTenantLayoutData above) — the node test runner has no
 * JSX transform, so a test can't import page.tsx itself.
 */
describe("stats/alerts page data honours pipeline.viewAll scope", () => {
  beforeAll(async () => {
    await prismaAdmin.followUp.create({
      data: { tenantId, dealId: foreignDealId, date: new Date(), note: "Alerta ajena", completed: false },
    })
    await prismaAdmin.followUp.create({
      data: { tenantId, dealId: cededDealId, date: new Date(), note: "Alerta cedida", completed: false },
    })
  })

  function todayNotes(data: Awaited<ReturnType<typeof loadAlertsPageData>>) {
    return data.hoy.today.map((fu) => fu.note)
  }

  it("a member without pipeline.viewAll does not receive an alert for a foreign deal", async () => {
    const data = await loadAlertsPageData(tenantId, "MEMBER", memberId, {}, {})
    expect(todayNotes(data)).not.toContain("Alerta ajena")
  })

  it("a member without pipeline.viewAll still receives an alert for a deal ceded to them", async () => {
    const data = await loadAlertsPageData(tenantId, "MEMBER", memberId, {}, {})
    expect(todayNotes(data)).toContain("Alerta cedida")
  })

  it("cannot widen the result with a hand-crafted owner parameter naming a colleague", async () => {
    const data = await loadAlertsPageData(
      tenantId,
      "MEMBER",
      memberId,
      { vencidos: otherId, hoy: otherId, proximos: otherId },
      {},
    )
    expect(data.canSeeAll).toBe(false)
    expect(todayNotes(data)).not.toContain("Alerta ajena")
    // The crafted param is discarded outright, not merely narrowed — the caller's own scope
    // still surfaces their ceded deal's alert even though they asked for someone else's.
    expect(todayNotes(data)).toContain("Alerta cedida")
  })

  it("returns the foreign deal's alert once pipeline.viewAll is granted", async () => {
    await withTenant(tenantId, (tx) =>
      tx.rolePermission.create({
        data: { tenantId, role: "MEMBER", key: "pipeline.viewAll", allowed: true },
      }),
    )
    const data = await loadAlertsPageData(tenantId, "MEMBER", memberId, {}, {})
    expect(data.canSeeAll).toBe(true)
    expect(todayNotes(data)).toContain("Alerta ajena")
  })
})
