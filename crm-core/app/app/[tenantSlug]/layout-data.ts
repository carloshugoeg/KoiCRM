import "server-only"
import type { Role } from "@prisma/client"
import { withTenant } from "@/lib/db/rls"
import { permissionsForInTx, scopeFromPermissions } from "@/lib/permissions/resolve"
import { countClientsInTx } from "@/features/clients/queries"
import { getFollowUpAlertsInTx } from "@/features/follow-ups/queries"

export interface TenantLayoutData {
  clientsCount: number
  followUpAlerts: Awaited<ReturnType<typeof getFollowUpAlertsInTx>>
}

/**
 * The `/app` layout's data load, pulled out of layout.tsx into a plain `.ts` module so it can
 * be unit-tested directly. The node test runner has no JSX transform, so a test can't import
 * layout.tsx itself (it transitively pulls in "use client" .tsx components) — before this, the
 * only coverage was a test that reproduced this transaction body inline, which meant reverting
 * the layout's scope wiring back to canSeeAllDeals left every test green. Importing this
 * function instead closes that gap: the test and the layout now run the same code.
 *
 * One transaction for the whole load. This runs on every /app page, so any fan-out here is
 * paid by every request before the page's own queries even start. permissionsForInTx runs on
 * this same connection rather than opening a second withTenant() — see permissionsFor's
 * docstring — so the alert owner filter can be derived from pipeline.viewAll instead of the
 * role-based canSeeAllDeals() bypass without doubling this route's transaction cost.
 */
export async function loadTenantLayoutData(
  tenantId: string,
  role: Role,
  userId: string,
): Promise<TenantLayoutData> {
  return withTenant(tenantId, async (tx) => {
    const perms = await permissionsForInTx(tx, tenantId, role, userId)
    const scope = scopeFromPermissions(perms, userId)
    return {
      clientsCount: await countClientsInTx(tx, tenantId),
      followUpAlerts: await getFollowUpAlertsInTx(tx, tenantId, scope.visibleToUserId ?? undefined),
    }
  })
}
