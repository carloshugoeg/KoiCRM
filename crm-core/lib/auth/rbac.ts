// crm-core/lib/auth/rbac.ts
import type { Role } from "@prisma/client"
import type { Session } from "next-auth"
import { prisma } from "@/lib/db/client"

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

const ROLE_RANK: Record<Role, number> = { OWNER: 4, ADMIN: 3, MEMBER: 2, VIEWER: 1 }

function atLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min]
}

export const canCreateDeal    = (r: Role) => atLeast(r, "MEMBER")
export const canEditDeal      = (r: Role) => atLeast(r, "MEMBER")
export const canDeleteDeal    = (r: Role) => atLeast(r, "ADMIN")
export const canManageMembers  = (r: Role) => atLeast(r, "ADMIN")
export const canManageSettings = (r: Role) => atLeast(r, "ADMIN")
