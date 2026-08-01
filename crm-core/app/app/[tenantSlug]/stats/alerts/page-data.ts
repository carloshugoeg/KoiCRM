import "server-only"
import type { Role } from "@prisma/client"
import { withTenant } from "@/lib/db/rls"
import { permissionsForInTx, scopeFromPermissions } from "@/lib/permissions/resolve"
import { getFollowUpAlertsInTx } from "@/features/follow-ups/queries"

type AlertBuckets = Awaited<ReturnType<typeof getFollowUpAlertsInTx>>

export interface AlertsOwnerParams {
  vencidos?: string
  hoy?: string
  proximos?: string
}

export interface AlertsPageData {
  /** False pins every bucket to the caller's own scope; the owner filter must not render. */
  canSeeAll: boolean
  vencidos: AlertBuckets
  hoy: AlertBuckets
  proximos: AlertBuckets
}

/**
 * app/app/[tenantSlug]/stats/alerts/page.tsx's data load, pulled into a plain `.ts` module so
 * it can be unit-tested directly — the node test runner has no JSX transform, so a test can't
 * import page.tsx itself (it transitively pulls in "use client" .tsx components, the same
 * constraint documented on loadTenantLayoutData in ../../layout-data.ts).
 *
 * stats/listado already scopes its row-level table by pipeline.viewAll; this page carries the
 * same shape of row-level data (deal.name, deal.company, deal.stage, plus the follow-up's
 * free-text note), so it must too — aggregates may stay tenant-wide for a Supervisor+ view,
 * but a list of named opportunities is the funnel by another name.
 *
 * One transaction for the whole load, the same pattern loadTenantLayoutData and
 * permissionsForInTx already use: the permission read and all three bucket queries share one
 * pooled connection instead of opening up to four (one per distinct owner filter, plus one for
 * the permission read) — see 15889e3 for what fanning those out across a small connection pool
 * costs in production.
 *
 * A restricted caller's owner params are discarded outright, not merely narrowed:
 * `scope.visibleToUserId` always wins over a hand-crafted `?<panel>.owner=` naming a colleague,
 * the same rule stats/listado applies via `dealVisibilityWhere`.
 */
export async function loadAlertsPageData(
  tenantId: string,
  role: Role,
  userId: string,
  ownerParams: AlertsOwnerParams,
  dateRange: { from?: Date; to?: Date } = {},
): Promise<AlertsPageData> {
  return withTenant(tenantId, async (tx) => {
    const perms = await permissionsForInTx(tx, tenantId, role, userId)
    const scope = scopeFromPermissions(perms, userId)
    const canSeeAll = scope.visibleToUserId === null

    const cache = new Map<string, AlertBuckets>()
    async function alertsFor(paramOwner?: string): Promise<AlertBuckets> {
      const ownerId = canSeeAll ? paramOwner : (scope.visibleToUserId ?? undefined)
      const key = ownerId ?? ""
      if (!cache.has(key)) {
        cache.set(key, await getFollowUpAlertsInTx(tx, tenantId, ownerId, dateRange))
      }
      return cache.get(key)!
    }

    return {
      canSeeAll,
      vencidos: await alertsFor(ownerParams.vencidos),
      hoy: await alertsFor(ownerParams.hoy),
      proximos: await alertsFor(ownerParams.proximos),
    }
  })
}
