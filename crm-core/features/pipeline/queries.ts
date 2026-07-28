import { withTenant, type PrismaTx } from "@/lib/db/rls"
import { getCatalogItemsInTx, getEquipmentHierarchyInTx } from "@/features/catalogs/queries"
import {
  fetchPipelineDealsInTx,
  mapPipelineDeals,
  type PipelineFilters,
} from "@/features/deals/queries"
import type { PipelineScope } from "@/lib/permissions/resolve"

export async function getDefaultPipeline(tx: PrismaTx, tenantId: string) {
  return tx.pipeline.findFirst({
    where: { tenantId, isDefault: true },
    include: {
      stages: { orderBy: { order: "asc" } },
    },
  })
}

/**
 * Loads all pipeline/kanban page data in a single DB transaction.
 * Avoids opening many parallel pool connections (Supabase session pooler limit: 15).
 *
 * `scope` comes from `pipelineScopeFor()`. When `scope.visibleToUserId` is set the query is pinned
 * to what that user may see — their own deals plus anything ceded to them. `visibleToUserId` and a
 * caller-supplied `ownerId` compose as AND in the where clause, so a member without
 * `pipeline.viewAll` can only ever narrow the result with `?owner=`, never widen it.
 */
export async function loadPipelineKanbanData(
  tenantId: string,
  dealFilters: PipelineFilters,
  scope?: PipelineScope,
) {
  const effectiveFilters: PipelineFilters = scope?.visibleToUserId
    ? { ...dealFilters, visibleToUserId: scope.visibleToUserId }
    : dealFilters

  return withTenant(
    tenantId,
    async (tx) => {
    const [pipeline, members, settings, channels, equipmentHierarchy, statuses] =
      await Promise.all([
        getDefaultPipeline(tx, tenantId),
        tx.membership.findMany({
          where: { tenantId },
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
        }),
        tx.tenantSettings.findUnique({ where: { tenantId } }),
        getCatalogItemsInTx(tx, tenantId, "salesChannel", true),
        getEquipmentHierarchyInTx(tx, tenantId, true),
        getCatalogItemsInTx(tx, tenantId, "dealStatus", true),
      ])

    const rawDeals = pipeline ? await fetchPipelineDealsInTx(tx, tenantId, effectiveFilters) : []
    const deals = mapPipelineDeals(rawDeals, effectiveFilters)

    return { pipeline, members, settings, channels, equipmentHierarchy, statuses, deals }
    },
    // Kanban loads many deals + relations; Supabase pooler latency can exceed Prisma's 5s default.
    { timeout: 30_000 },
  )
}
