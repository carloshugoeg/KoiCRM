import { withTenant, type PrismaTx } from "@/lib/db/rls"
import type { CatalogKey } from "@/features/catalogs/queries"
import {
  fetchPipelineDealsInTx,
  mapPipelineDeals,
  type PipelineFilters,
} from "@/features/deals/queries"

export async function getDefaultPipeline(tx: PrismaTx, tenantId: string) {
  return tx.pipeline.findFirst({
    where: { tenantId, isDefault: true },
    include: {
      stages: { orderBy: { order: "asc" } },
    },
  })
}

async function getCatalogItemsInTx(
  tx: PrismaTx,
  tenantId: string,
  catalogKey: CatalogKey,
  activeOnly: boolean,
) {
  return tx.catalogItem.findMany({
    where: {
      tenantId,
      catalogKey,
      ...(activeOnly ? { active: true } : {}),
    },
    orderBy: { order: "asc" },
  })
}

/**
 * Loads all pipeline/kanban page data in a single DB transaction.
 * Avoids opening many parallel pool connections (Supabase session pooler limit: 15).
 */
export async function loadPipelineKanbanData(tenantId: string, dealFilters: PipelineFilters) {
  return withTenant(
    tenantId,
    async (tx) => {
    const [pipeline, members, settings, channels, equipment, statuses] =
      await Promise.all([
        getDefaultPipeline(tx, tenantId),
        tx.membership.findMany({
          where: { tenantId },
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
        }),
        tx.tenantSettings.findUnique({ where: { tenantId } }),
        getCatalogItemsInTx(tx, tenantId, "salesChannel", true),
        getCatalogItemsInTx(tx, tenantId, "equipment", true),
        getCatalogItemsInTx(tx, tenantId, "dealStatus", true),
      ])

    const rawDeals = pipeline ? await fetchPipelineDealsInTx(tx, tenantId, dealFilters) : []
    const deals = mapPipelineDeals(rawDeals, dealFilters)

    return { pipeline, members, settings, channels, equipment, statuses, deals }
    },
    // Kanban loads many deals + relations; Supabase pooler latency can exceed Prisma's 5s default.
    { timeout: 30_000 },
  )
}
