import { prisma } from "@/lib/db/client"
import type { PipelineFilters } from "@/features/deals/queries"
import type { Prisma } from "@prisma/client"

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

  // Get stages with locked key "ganado"/"perdido" for this tenant's default pipeline
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
