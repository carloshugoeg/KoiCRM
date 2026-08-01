import "server-only"
import type { Role } from "@prisma/client"
import type { Session } from "next-auth"
import { withTenant, type PrismaTx } from "@/lib/db/rls"
import { getUserRole, UnauthorizedError } from "@/lib/auth/rbac"
import { permissionsForInTx, scopeFromPermissions } from "@/lib/permissions/resolve"
import { LOCKED_ROLES } from "@/lib/permissions/defaults"
import { dealVisibilityWhere } from "@/features/deals/queries"

/**
 * `tenantId` arrives from the client and is what withTenant() feeds to
 * set_config('app.tenant_id'), so RLS cannot vouch for it — every reader below must
 * confirm the caller is actually a member of that tenant first. Without this a removed
 * member keeps read access to the workspace they were offboarded from.
 */
export const DEAL_READER_ROLES = ["OWNER", "ADMIN", "SUPERVISOR", "MEMBER", "VIEWER"] as const

/**
 * Same check as assertDealInScope, run on a transaction the caller already holds open. Exists
 * so a write action that already pays for its own withTenant() (the mutation itself, or an
 * existence lookup it needs anyway) can fold the scope check into that transaction instead of
 * opening a second one — the same reasoning as permissionsForInTx, and the same fix pattern as
 * 15889e3. assertDealInScope is a thin wrapper around this so there is exactly one
 * implementation of the check, shared by every read and write guard.
 */
export async function assertDealInScopeInTx(
  tx: PrismaTx,
  tenantId: string,
  role: Role,
  userId: string,
  dealId: string,
): Promise<boolean> {
  if (LOCKED_ROLES.includes(role)) return true

  const perms = await permissionsForInTx(tx, tenantId, role, userId)
  const scope = scopeFromPermissions(perms, userId)
  if (!scope.visibleToUserId) return true

  const found = await tx.deal.findFirst({
    where: { id: dealId, tenantId, ...dealVisibilityWhere(scope.visibleToUserId) },
    select: { id: true },
  })
  return !!found
}

/**
 * Resolves the caller's pipeline scope and reports whether `dealId` is reachable under it —
 * their own deal, one ceded to them via DealViewer, or (when pipeline.viewAll is granted)
 * any deal in the tenant. The single guard every deal-read action funnels through (deal
 * summary, activity, follow-ups, quotes, payments, notes, attachments), so a restricted
 * member can't read a colleague's data just by supplying a foreign dealId — these are server
 * actions, directly invokable, and several of them print deal ids into the client profile's
 * markup. Deal-write actions that don't already hold a transaction open use this too; ones
 * that do should call assertDealInScopeInTx directly on their own tx instead.
 *
 * Runs the permission read and the deal lookup on one transaction, not two — this used to open
 * pipelineScopeFor's own withTenant() and then a second withTenant() for the deal lookup, so a
 * single guarded action paid for two interactive transactions and the four actions
 * DealDetailModal fires on open paid for eight just for authorization, on top of the four the
 * underlying reads still need. LOCKED_ROLES (OWNER/ADMIN) short-circuits ahead of that
 * transaction entirely, for the same reason permissionsFor does — an administrator's guard
 * check should cost zero database work, not a BEGIN/COMMIT for a scope that was always going
 * to be "everything."
 */
export async function assertDealInScope(
  tenantId: string,
  role: Role,
  userId: string,
  dealId: string,
): Promise<boolean> {
  if (LOCKED_ROLES.includes(role)) return true
  return withTenant(tenantId, (tx) => assertDealInScopeInTx(tx, tenantId, role, userId, dealId))
}

/**
 * Membership alone isn't enough — `dealId` is caller-supplied, and DEAL_READER_ROLES admits
 * every role, so without a scope check any tenant member could read any other member's deal
 * data by supplying a foreign id. Resolves the caller's role once (rather than requireRole
 * followed by a separate getUserRole call for the same Membership row) and reuses it both to
 * check tenant membership and to run assertDealInScope, so this guard costs one
 * Membership.findUnique instead of two. Fails the same way — UnauthorizedError — whether the
 * caller isn't a member of the tenant or is a member whose scope doesn't reach this deal, so
 * the two "no access" paths are indistinguishable to the caller.
 */
export async function requireDealReaderInScope(
  session: Session | null,
  userId: string,
  tenantId: string,
  dealId: string,
): Promise<void> {
  const role = await getUserRole(session, tenantId)
  if (!role || !(DEAL_READER_ROLES as readonly Role[]).includes(role)) throw new UnauthorizedError()
  if (!(await assertDealInScope(tenantId, role, userId, dealId))) throw new UnauthorizedError()
}
