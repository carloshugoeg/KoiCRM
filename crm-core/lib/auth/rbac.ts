// crm-core/lib/auth/rbac.ts
import type { Role } from "@prisma/client"
import type { Session } from "next-auth"
import { prisma } from "@/lib/db/client"

export {
  canCreateDeal,
  canEditDeal,
  canDeleteDeal,
  canArchiveDeal,
  canSeeAllDeals,
  canManageMembers,
  canManageSettings,
  canEditDealRow,
  ROLE_LABELS,
  ASSIGNABLE_ROLES,
} from "@/lib/auth/permissions"

export class UnauthorizedError extends Error {
  constructor(message = "Acceso denegado.") {
    super(message)
    this.name = "UnauthorizedError"
  }
}

export async function requireRole(
  session: Session | null,
  tenantId: string,
  allowed: Role[],
): Promise<void> {
  if (!session?.user?.id) throw new UnauthorizedError()
  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
    select: { role: true },
  })
  if (!membership || !allowed.includes(membership.role)) throw new UnauthorizedError()
}

/** Resolve the current user's role within a tenant, or null if not a member. */
export async function getUserRole(session: Session | null, tenantId: string): Promise<Role | null> {
  if (!session?.user?.id) return null
  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
    select: { role: true },
  })
  return membership?.role ?? null
}
