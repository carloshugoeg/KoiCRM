import "server-only"
import type { Role } from "@prisma/client"
import type { Session } from "next-auth"
import { withTenant } from "@/lib/db/rls"
import { requireRole, getUserRole, UnauthorizedError } from "@/lib/auth/rbac"
import { pipelineScopeFor } from "@/lib/permissions/resolve"
import { dealVisibilityWhere } from "@/features/deals/queries"

/**
 * `tenantId` arrives from the client and is what withTenant() feeds to
 * set_config('app.tenant_id'), so RLS cannot vouch for it — every reader below must
 * confirm the caller is actually a member of that tenant first. Without this a removed
 * member keeps read access to the workspace they were offboarded from.
 */
export const DEAL_READER_ROLES = ["OWNER", "ADMIN", "SUPERVISOR", "MEMBER", "VIEWER"] as const

/**
 * Resolves the caller's pipeline scope and reports whether `dealId` is reachable under it —
 * their own deal, one ceded to them via DealViewer, or (when pipeline.viewAll is granted)
 * any deal in the tenant. The single guard every deal-read action funnels through (deal
 * summary, activity, follow-ups, quotes, payments, notes, attachments), so a restricted
 * member can't read a colleague's data just by supplying a foreign dealId — these are server
 * actions, directly invokable, and several of them print deal ids into the client profile's
 * markup.
 *
 * Pulled out of features/deals/actions.ts and exported so features/notes and
 * features/attachments can share it instead of re-implementing the same check — both had the
 * identical shape (a caller-supplied dealId gating a {tenantId, dealId}-only query) and were
 * missed when the other five deal-read actions were scoped.
 */
async function assertDealInScope(
  tenantId: string,
  role: Role,
  userId: string,
  dealId: string,
): Promise<boolean> {
  const scope = await pipelineScopeFor(tenantId, role, userId)
  if (!scope.visibleToUserId) return true

  const found = await withTenant(tenantId, (tx) =>
    tx.deal.findFirst({
      where: { id: dealId, tenantId, ...dealVisibilityWhere(scope.visibleToUserId!) },
      select: { id: true },
    }),
  )
  return !!found
}

/**
 * Membership alone isn't enough — `dealId` is caller-supplied, and DEAL_READER_ROLES admits
 * every role, so without a scope check any tenant member could read any other member's deal
 * data by supplying a foreign id. requireRole keeps its existing "Acceso denegado." failure
 * shape for a non-member; assertDealInScope fails the same way (UnauthorizedError) for a
 * member whose scope doesn't reach this deal, so the two "no access" paths are
 * indistinguishable to the caller.
 */
export async function requireDealReaderInScope(
  session: Session | null,
  userId: string,
  tenantId: string,
  dealId: string,
): Promise<void> {
  await requireRole(session, tenantId, [...DEAL_READER_ROLES])
  const role = await getUserRole(session, tenantId)
  if (!role || !(await assertDealInScope(tenantId, role, userId, dealId))) {
    throw new UnauthorizedError()
  }
}

export { assertDealInScope }
