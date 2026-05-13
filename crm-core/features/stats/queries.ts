import { prisma } from "@/lib/db/client"
import { withTenant } from "@/lib/db/rls"
import type { Prisma } from "@prisma/client"
import type { PipelineFilters } from "@/features/deals/queries"

export interface StatsFilters {
  from?: Date
  to?: Date
  ownerId?: string
}

// ── Shared helper ────────────────────────────────────────────────────────────

async function getStageKeys(tenantId: string) {
  const stages = await prisma.pipelineStage.findMany({
    where: { tenantId },
    select: { id: true, key: true, label: true, color: true, order: true },
    orderBy: { order: "asc" },
  })
  return {
    stages,
    wonIds: stages.filter((s) => s.key === "ganado").map((s) => s.id),
    lostIds: stages.filter((s) => s.key === "perdido").map((s) => s.id),
    closedIds: stages.filter((s) => s.key === "ganado" || s.key === "perdido").map((s) => s.id),
  }
}

function dateFilter(filters: StatsFilters): Prisma.DealWhereInput {
  if (!filters.from && !filters.to) return {}
  return {
    createdAt: {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    },
  }
}

// ── T5.4 — Pipeline header KPIs (keep existing) ──────────────────────────────

export async function getPipelineKpis(tenantId: string, filters: PipelineFilters = {}) {
  const baseWhere: Prisma.DealWhereInput = { tenantId, isArchived: false }
  if (filters.ownerId) baseWhere.ownerId = filters.ownerId
  if (filters.channelKey) baseWhere.channelKey = filters.channelKey
  if (filters.from || filters.to) {
    baseWhere.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    }
  }
  if (filters.equipmentKey) {
    baseWhere.equipment = { some: { equipmentKey: filters.equipmentKey } }
  }

  const stages = await prisma.pipelineStage.findMany({
    where: { tenantId },
    select: { id: true, key: true },
  })
  const wonStageIds = stages.filter((s) => s.key === "ganado").map((s) => s.id)
  const closedStageIds = stages.filter((s) => s.key === "ganado" || s.key === "perdido").map((s) => s.id)

  const [pipelineAgg, wonAgg] = await Promise.all([
    prisma.deal.aggregate({
      where: { ...baseWhere, stageId: { notIn: closedStageIds.length ? closedStageIds : ["__none__"] } },
      _sum: { value: true },
    }),
    prisma.deal.aggregate({
      where: { ...baseWhere, stageId: { in: wonStageIds.length ? wonStageIds : ["__none__"] } },
      _sum: { value: true },
    }),
  ])

  return {
    totalPipeline: Number(pipelineAgg._sum.value ?? 0),
    totalWon: Number(wonAgg._sum.value ?? 0),
  }
}

// ── T8.1 — Stats aggregations ─────────────────────────────────────────────────

export async function getResumenStats(tenantId: string, filters: StatsFilters) {
  const { wonIds, lostIds, closedIds } = await getStageKeys(tenantId)
  const df = dateFilter(filters)
  const ownerFilter = filters.ownerId ? { ownerId: filters.ownerId } : {}
  const base: Prisma.DealWhereInput = { tenantId, isArchived: false, ...df, ...ownerFilter }
  const openWhere = { ...base, stageId: { notIn: closedIds.length ? closedIds : ["__none__"] } }
  const wonWhere = { ...base, stageId: { in: wonIds.length ? wonIds : ["__none__"] } }
  const lostWhere = { ...base, stageId: { in: lostIds.length ? lostIds : ["__none__"] } }

  const [allCount, openSum, wonAgg, lostAgg, topPerformersRaw] = await withTenant(
    tenantId,
    (tx) =>
      Promise.all([
        tx.deal.count({ where: base }),
        tx.deal.aggregate({ where: openWhere, _sum: { value: true }, _count: { id: true } }),
        tx.deal.aggregate({ where: wonWhere, _sum: { value: true }, _count: { id: true } }),
        tx.deal.aggregate({ where: lostWhere, _sum: { value: true }, _count: { id: true } }),
        tx.deal.groupBy({
          by: ["ownerId"],
          where: wonWhere,
          _sum: { value: true },
          _count: { id: true },
          orderBy: { _sum: { value: "desc" } },
          take: 5,
        }),
      ])
  )

  const ownerIds = topPerformersRaw.map((r) => r.ownerId)
  const owners = ownerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, name: true, email: true },
      })
    : []

  const topPerformers = topPerformersRaw.map((r) => {
    const u = owners.find((o) => o.id === r.ownerId)
    return {
      ownerId: r.ownerId,
      ownerName: u?.name ?? u?.email ?? r.ownerId,
      wonValue: Number(r._sum.value ?? 0),
      wonCount: r._count.id,
    }
  })

  const activeCount = allCount
  const wonCount = wonAgg._count.id
  const activeCountOpen = openSum._count.id
  const totalEmbudo = Number(openSum._sum.value ?? 0)

  return {
    totalEmbudo,
    ganado: Number(wonAgg._sum.value ?? 0),
    perdido: Number(lostAgg._sum.value ?? 0),
    tasaCierre: Math.round((wonCount / Math.max(activeCount, 1)) * 100 * 10) / 10,
    ticketPromedio: activeCountOpen > 0 ? Math.round(totalEmbudo / activeCountOpen) : 0,
    topPerformers,
  }
}

export type ResumenStats = Awaited<ReturnType<typeof getResumenStats>>

export async function getEmbudoStats(tenantId: string, filters: StatsFilters) {
  const { stages } = await getStageKeys(tenantId)
  const df = dateFilter(filters)
  const ownerFilter = filters.ownerId ? { ownerId: filters.ownerId } : {}

  const byStage = await withTenant(tenantId, (tx) =>
    tx.deal.groupBy({
      by: ["stageId"],
      where: { tenantId, isArchived: false, ...df, ...ownerFilter },
      _sum: { value: true },
      _count: { id: true },
    })
  )

  return stages.map((stage) => {
    const row = byStage.find((r) => r.stageId === stage.id)
    return {
      stageId: stage.id,
      stageKey: stage.key,
      stageLabel: stage.label,
      stageColor: stage.color,
      stageOrder: stage.order,
      count: row?._count.id ?? 0,
      value: Number(row?._sum.value ?? 0),
    }
  })
}

export type EmbudoStats = Awaited<ReturnType<typeof getEmbudoStats>>

export async function getEquipoStats(tenantId: string, filters: StatsFilters) {
  const { wonIds, lostIds } = await getStageKeys(tenantId)
  const df = dateFilter(filters)
  const base: Prisma.DealWhereInput = { tenantId, isArchived: false, ...df }

  const [allByOwner, wonByOwner, lostByOwner] = await withTenant(tenantId, (tx) =>
    Promise.all([
      tx.deal.groupBy({
        by: ["ownerId"],
        where: base,
        _sum: { value: true },
        _count: { id: true },
      }),
      tx.deal.groupBy({
        by: ["ownerId"],
        where: { ...base, stageId: { in: wonIds.length ? wonIds : ["__none__"] } },
        _sum: { value: true },
        _count: { id: true },
      }),
      tx.deal.groupBy({
        by: ["ownerId"],
        where: { ...base, stageId: { in: lostIds.length ? lostIds : ["__none__"] } },
        _count: { id: true },
      }),
    ])
  )

  const ownerIds = [...new Set(allByOwner.map((r) => r.ownerId))]
  const owners = ownerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, name: true, email: true },
      })
    : []

  return allByOwner.map((row) => {
    const u = owners.find((o) => o.id === row.ownerId)
    const won = wonByOwner.find((r) => r.ownerId === row.ownerId)
    const lost = lostByOwner.find((r) => r.ownerId === row.ownerId)
    const dealsCount = row._count.id
    const wonCount = won?._count.id ?? 0
    const lostCount = lost?._count.id ?? 0
    return {
      ownerId: row.ownerId,
      ownerName: u?.name ?? u?.email ?? row.ownerId,
      dealsCount,
      wonCount,
      lostCount,
      closingRate: Math.round((wonCount / Math.max(dealsCount, 1)) * 100 * 10) / 10,
      totalValue: Number(row._sum.value ?? 0),
      wonValue: Number(won?._sum.value ?? 0),
    }
  })
}

export type EquipoStats = Awaited<ReturnType<typeof getEquipoStats>>

export async function getCanalStats(tenantId: string, filters: StatsFilters) {
  const { wonIds } = await getStageKeys(tenantId)
  const df = dateFilter(filters)
  const ownerFilter = filters.ownerId ? { ownerId: filters.ownerId } : {}
  const base: Prisma.DealWhereInput = { tenantId, isArchived: false, ...df, ...ownerFilter }

  const [allByChannel, wonByChannel, channelCatalog] = await Promise.all([
    withTenant(tenantId, (tx) =>
      tx.deal.groupBy({
        by: ["channelKey"],
        where: base,
        _sum: { value: true },
        _count: { id: true },
      })
    ),
    withTenant(tenantId, (tx) =>
      tx.deal.groupBy({
        by: ["channelKey"],
        where: { ...base, stageId: { in: wonIds.length ? wonIds : ["__none__"] } },
        _sum: { value: true },
        _count: { id: true },
      })
    ),
    prisma.catalogItem.findMany({
      where: { tenantId, catalogKey: "salesChannel" },
      select: { key: true, label: true },
    }),
  ])

  return allByChannel.map((row) => {
    const won = wonByChannel.find((r) => r.channelKey === row.channelKey)
    const cat = channelCatalog.find((c) => c.key === row.channelKey)
    return {
      channelKey: row.channelKey,
      channelLabel: cat?.label ?? row.channelKey,
      dealsCount: row._count.id,
      totalValue: Number(row._sum.value ?? 0),
      wonCount: won?._count.id ?? 0,
      wonValue: Number(won?._sum.value ?? 0),
    }
  })
}

export type CanalStats = Awaited<ReturnType<typeof getCanalStats>>

export async function getProductosStats(tenantId: string, filters: StatsFilters) {
  const { wonIds, closedIds } = await getStageKeys(tenantId)
  const df = dateFilter(filters)
  const ownerFilter = filters.ownerId ? { ownerId: filters.ownerId } : {}
  const base: Prisma.DealWhereInput = { tenantId, isArchived: false, ...df, ...ownerFilter }

  const [demandDeals, wonDeals, equipmentCatalog] = await Promise.all([
    withTenant(tenantId, (tx) =>
      tx.deal.findMany({
        where: { ...base, stageId: { notIn: closedIds.length ? closedIds : ["__none__"] } },
        select: { value: true, equipment: { select: { equipmentKey: true } } },
      })
    ),
    withTenant(tenantId, (tx) =>
      tx.deal.findMany({
        where: { ...base, stageId: { in: wonIds.length ? wonIds : ["__none__"] } },
        select: { value: true, equipment: { select: { equipmentKey: true } } },
      })
    ),
    prisma.catalogItem.findMany({
      where: { tenantId, catalogKey: "equipment" },
      select: { key: true, label: true },
    }),
  ])

  const map = new Map<string, { demandCount: number; soldCount: number; pendingValue: number; soldValue: number }>()

  for (const deal of demandDeals) {
    for (const eq of deal.equipment) {
      const e = map.get(eq.equipmentKey) ?? { demandCount: 0, soldCount: 0, pendingValue: 0, soldValue: 0 }
      e.demandCount++
      e.pendingValue += Number(deal.value)
      map.set(eq.equipmentKey, e)
    }
  }
  for (const deal of wonDeals) {
    for (const eq of deal.equipment) {
      const e = map.get(eq.equipmentKey) ?? { demandCount: 0, soldCount: 0, pendingValue: 0, soldValue: 0 }
      e.soldCount++
      e.soldValue += Number(deal.value)
      map.set(eq.equipmentKey, e)
    }
  }

  return Array.from(map.entries())
    .map(([equipmentKey, data]) => {
      const cat = equipmentCatalog.find((c) => c.key === equipmentKey)
      return { equipmentKey, equipmentLabel: cat?.label ?? equipmentKey, ...data }
    })
    .sort((a, b) => b.demandCount + b.soldCount - (a.demandCount + a.soldCount))
}

export type ProductosStats = Awaited<ReturnType<typeof getProductosStats>>
