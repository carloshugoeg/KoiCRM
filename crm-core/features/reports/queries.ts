import { withTenant } from "@/lib/db/rls"
import type { Prisma } from "@prisma/client"

/** Sort direction for the open-opportunities report (by creation date). */
export type ReportSort = "oldest" | "newest"

export interface OpenOpportunitiesFilters {
  tenantId: string
  /** When set, the report is limited to that asesor. `null`/undefined means "todos". */
  ownerId?: string | null
  sort?: ReportSort
}

const MS_PER_DAY = 86_400_000

/**
 * Open opportunities = every deal that is neither won ("ganado"), lost ("perdido")
 * nor archived. Mirrors the "abiertas" definition used by the stats queries.
 */
export async function getOpenOpportunities({
  tenantId,
  ownerId,
  sort = "oldest",
}: OpenOpportunitiesFilters) {
  const deals = await withTenant(tenantId, async (tx) => {
    const stages = await tx.pipelineStage.findMany({
      where: { tenantId },
      select: { id: true, key: true },
    })
    const closedIds = stages.filter((s) => s.key === "ganado" || s.key === "perdido").map((s) => s.id)

    const where: Prisma.DealWhereInput = {
      tenantId,
      isArchived: false,
      stageId: { notIn: closedIds.length ? closedIds : ["__none__"] },
    }
    if (ownerId) where.ownerId = ownerId

    return tx.deal.findMany({
      where,
      select: {
        id: true,
        name: true,
        company: true,
        value: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, email: true } },
        stage: { select: { key: true, label: true, color: true } },
      },
      // Stable order: creation date + id tiebreaker.
      orderBy: [{ createdAt: sort === "oldest" ? "asc" : "desc" }, { id: "asc" }],
    })
  })

  const now = Date.now()

  return deals.map((d) => ({
    id: d.id,
    name: d.name,
    clientName: d.client?.name ?? d.company ?? null,
    ownerId: d.owner.id,
    ownerName: d.owner.name ?? d.owner.email,
    stageKey: d.stage.key,
    stageLabel: d.stage.label,
    stageColor: d.stage.color,
    value: Number(d.value),
    createdAt: d.createdAt.toISOString(),
    daysOpen: Math.max(0, Math.floor((now - d.createdAt.getTime()) / MS_PER_DAY)),
  }))
}

export type OpenOpportunity = Awaited<ReturnType<typeof getOpenOpportunities>>[number]
