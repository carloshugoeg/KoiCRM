import type { Session } from "next-auth"
import { withTenant } from "@/lib/db/rls"
import { getUserRole, canEditDeal, canEditDealRow } from "@/lib/auth/rbac"

/**
 * Server-side per-deal edit check, shared by the deal sub-resource actions
 * (notes, quotes, payments, follow-ups). Supervisors+ can edit any deal; an asesor
 * only their own. A read-only viewer (previous owner after a cesión) is denied.
 */
export async function userCanEditDeal(
  session: Session | null,
  tenantId: string,
  dealId: string,
): Promise<boolean> {
  if (!session?.user?.id) return false
  const role = await getUserRole(session, tenantId)
  if (!role || !canEditDeal(role)) return false

  const deal = await withTenant(tenantId, (tx) =>
    tx.deal.findUnique({ where: { id: dealId, tenantId }, select: { ownerId: true } }),
  )
  if (!deal) return false
  return canEditDealRow(role, deal.ownerId, session.user.id)
}
