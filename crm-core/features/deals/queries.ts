import { prisma } from "@/lib/db/client"
import { withTenant } from "@/lib/db/rls"
import type { Prisma } from "@prisma/client"

export interface PipelineFilters {
  ownerId?: string
  channelKey?: string
  equipmentKey?: string
  alerts?: "missingQuote" | "missingPayment" | "overdueFollowUp"
  from?: Date
  to?: Date
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

export async function getPipelineDeals(tenantId: string, filters: PipelineFilters = {}) {
  const where: Prisma.DealWhereInput = { tenantId, isArchived: false }

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

  const now = new Date()

  const deals = await withTenant(tenantId, (tx) =>
    tx.deal.findMany({
      where,
      include: {
        stage: true,
        owner: { select: { id: true, name: true, email: true } },
        client: true,
        equipment: true,
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
  )

  // Map alert flags and counts
  const mapped = deals.map((d) => ({
    ...d,
    hasActiveQuote: d._count.quotes > 0,
    hasActivePayment: d._count.payments > 0,
    hasOverdueFollowUp: d._count.followUps > 0,
    quoteCount: d._count.quotes,
    paymentCount: d._count.payments,
    hasQuoteAlert: d.stage.requiresQuote && d._count.quotes === 0,
    hasPaymentAlert: d.stage.requiresPayment && d._count.payments === 0,
  }))

  // Apply alert filter after fetch (simpler than SQL subquery)
  if (filters.alerts === "missingQuote") {
    return mapped.filter(
      (d) => !d.hasActiveQuote && d.stage.key !== "prospecto" && d.stage.key !== "perdido"
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

export async function getDeal(tenantId: string, dealId: string) {
  const now = new Date()
  return withTenant(tenantId, (tx) =>
    tx.deal.findUnique({
      where: { id: dealId, tenantId },
      include: {
        stage: true,
        owner: { select: { id: true, name: true, email: true } },
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

export async function getArchivedDeals(tenantId: string, cursor?: string, limit = 10) {
  const where: Prisma.DealWhereInput = { tenantId, isArchived: true }
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
