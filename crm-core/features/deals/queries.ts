import { withTenant, type PrismaTx } from "@/lib/db/rls"
import type { Prisma } from "@prisma/client"

export interface PipelineFilters {
  ownerId?: string
  channelKey?: string
  equipmentKey?: string
  alerts?: "missingQuote" | "missingPayment" | "overdueFollowUp"
  from?: Date
  to?: Date
  /** When true, includes deals marked isArchived on the kanban (demo: sf-showArchived). */
  includeArchived?: boolean
  /**
   * When set, restricts results to deals the user owns or has been granted read-only
   * access to (via cesión). Pass for asesores; omit for supervisors/superadmins who see all.
   */
  visibleToUserId?: string
}

/** Prisma `where` fragment that limits deals to those a user can see (owned or ceded to them). */
function dealVisibilityWhere(userId: string): Prisma.DealWhereInput {
  return {
    OR: [{ ownerId: userId }, { viewers: { some: { userId } } }],
  }
}

const dealWithRelations = {
  stage: true,
  owner: { select: { id: true, name: true, email: true } },
  client: true,
  equipment: true,
  quotes: { where: { isVoid: false }, select: { id: true } },
  payments: { where: { isVoid: false }, select: { id: true } },
  _count: {
    select: {
      quotes: { where: { isVoid: false } },
      payments: { where: { isVoid: false } },
      followUps: { where: { completed: false, date: { lt: new Date() } } },
    },
  },
} as const

export type DealWithRelations = Awaited<ReturnType<typeof getPipelineDeals>>[number]

function buildPipelineDealsWhere(tenantId: string, filters: PipelineFilters): Prisma.DealWhereInput {
  const where: Prisma.DealWhereInput = {
    tenantId,
    ...(filters.includeArchived ? {} : { isArchived: false }),
  }

  if (filters.visibleToUserId) Object.assign(where, dealVisibilityWhere(filters.visibleToUserId))
  if (filters.ownerId) where.ownerId = filters.ownerId
  if (filters.channelKey) where.channelKey = filters.channelKey
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    }
  }
  if (filters.equipmentKey) {
    where.equipment = { some: { equipmentKey: filters.equipmentKey } }
  }

  return where
}

export function mapPipelineDeals(
  deals: Awaited<ReturnType<typeof fetchPipelineDealsInTx>>,
  filters: PipelineFilters,
) {
  const mapped = deals.map((d) => ({
    ...d,
    hasActiveQuote: d._count.quotes > 0,
    hasActivePayment: d._count.payments > 0,
    hasOverdueFollowUp: d._count.followUps > 0,
    quoteCount: d._count.quotes,
    paymentCount: d._count.payments,
    hasQuoteAlert: d.stage.requiresQuote && d._count.quotes === 0,
    hasPaymentAlert: d.stage.requiresPayment && d._count.payments === 0,
    hasPaymentWithFile: d.payments.some((p) => !!p.fileUrl),
  }))

  if (filters.alerts === "missingQuote") {
    return mapped.filter(
      (d) => !d.hasActiveQuote && d.stage.key !== "prospecto" && d.stage.key !== "perdido",
    )
  }
  if (filters.alerts === "missingPayment") {
    return mapped.filter((d) => !d.hasActivePayment && d.stage.key === "ganado")
  }
  if (filters.alerts === "overdueFollowUp") {
    return mapped.filter((d) => d.hasOverdueFollowUp)
  }

  return mapped
}

/** Fetch pipeline deals inside an existing tenant transaction (one pool connection). */
export async function fetchPipelineDealsInTx(
  tx: PrismaTx,
  tenantId: string,
  filters: PipelineFilters = {},
) {
  const now = new Date()
  return tx.deal.findMany({
    where: buildPipelineDealsWhere(tenantId, filters),
    include: {
      stage: true,
      owner: { select: { id: true, name: true, email: true, image: true } },
      createdBy: { select: { id: true, name: true, image: true } },
      client: true,
      equipment: true,
      quotes: { where: { isVoid: false }, take: 1, orderBy: { createdAt: "desc" }, select: { number: true } },
      payments: {
        where: { isVoid: false },
        orderBy: { createdAt: "desc" },
        select: { number: true, fileUrl: true },
      },
      notes: { take: 1, orderBy: { createdAt: "desc" }, select: { text: true } },
      _count: {
        select: {
          quotes: { where: { isVoid: false } },
          payments: { where: { isVoid: false } },
          followUps: { where: { completed: false, date: { lt: now } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function getPipelineDeals(tenantId: string, filters: PipelineFilters = {}) {
  const deals = await withTenant(tenantId, (tx) => fetchPipelineDealsInTx(tx, tenantId, filters))
  return mapPipelineDeals(deals, filters)
}

export async function getDeal(tenantId: string, dealId: string, visibleToUserId?: string) {
  const now = new Date()
  return withTenant(tenantId, (tx) =>
    tx.deal.findFirst({
      where: { id: dealId, tenantId, ...(visibleToUserId ? dealVisibilityWhere(visibleToUserId) : {}) },
      include: {
        stage: true,
        owner: { select: { id: true, name: true, email: true, image: true } },
        createdBy: { select: { id: true, name: true, image: true } },
        client: true,
        equipment: true,
        quotes: { orderBy: { createdAt: "desc" } },
        payments: { orderBy: { createdAt: "desc" } },
        followUps: { orderBy: { date: "asc" } },
        notes: { orderBy: { createdAt: "desc" } },
        _count: {
          select: {
            quotes: { where: { isVoid: false } },
            payments: { where: { isVoid: false } },
            followUps: { where: { completed: false, date: { lt: now } } },
          },
        },
      },
    })
  )
}

export async function getArchivedDeals(tenantId: string, cursor?: string, limit = 10, visibleToUserId?: string) {
  const where: Prisma.DealWhereInput = { tenantId, isArchived: true }
  if (visibleToUserId) Object.assign(where, dealVisibilityWhere(visibleToUserId))
  if (cursor) {
    const cursorDate = new Date(cursor)
    if (isNaN(cursorDate.getTime())) throw new Error("Invalid cursor: expected ISO 8601 date string")
    where.createdAt = { lt: cursorDate }
  }

  const deals = await withTenant(tenantId, (tx) =>
    tx.deal.findMany({
      where,
      include: {
        stage: true,
        owner: { select: { id: true, name: true, email: true } },
        client: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    })
  )

  const hasMore = deals.length > limit
  const items = hasMore ? deals.slice(0, limit) : deals
  const nextCursor = hasMore ? items[items.length - 1]!.createdAt.toISOString() : null

  return { deals: items, nextCursor }
}

export async function getDealsByClient(tenantId: string, clientId: string) {
  return withTenant(tenantId, (tx) =>
    tx.deal.findMany({
      where: { tenantId, clientId },
      include: {
        stage: true,
        owner: { select: { id: true, name: true, email: true } },
        equipment: true,
      },
      orderBy: { createdAt: "desc" },
    })
  )
}
