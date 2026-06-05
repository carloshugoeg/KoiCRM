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

/** Resolve the current user's role within a tenant, or null if not a member. */
export async function getUserRole(session: Session | null, tenantId: string): Promise<Role | null> {
  if (!session?.user?.id) return null
  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
    select: { role: true },
  })
  return membership?.role ?? null
}

const ROLE_RANK: Record<Role, number> = { OWNER: 5, ADMIN: 4, SUPERVISOR: 3, MEMBER: 2, VIEWER: 1 }

function atLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min]
}

export const canCreateDeal    = (r: Role) => atLeast(r, "MEMBER")
export const canEditDeal      = (r: Role) => atLeast(r, "MEMBER")
export const canDeleteDeal    = (r: Role) => atLeast(r, "ADMIN")
export const canArchiveDeal    = (r: Role) => atLeast(r, "SUPERVISOR")
export const canSeeAllDeals    = (r: Role) => atLeast(r, "SUPERVISOR")
export const canManageMembers  = (r: Role) => atLeast(r, "ADMIN")
export const canManageSettings = (r: Role) => atLeast(r, "ADMIN")

/**
 * Per-row edit check. Supervisors and above edit any deal in the tenant; an asesor
 * (MEMBER) only edits deals they own. A read-only viewer (previous owner after a
 * cesión) is neither owner nor supervisor, so this returns false for them.
 */
export function canEditDealRow(role: Role, dealOwnerId: string, userId: string): boolean {
  if (!canEditDeal(role)) return false
  return canSeeAllDeals(role) || dealOwnerId === userId
}

/** Spanish business labels for roles, shown across the UI. */
export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Superadministrador",
  ADMIN: "Superadministrador",
  SUPERVISOR: "Supervisor",
  MEMBER: "Asesor",
  VIEWER: "Solo lectura",
}

/** Roles a superadmin can assign when inviting or editing members (excludes OWNER). */
export const ASSIGNABLE_ROLES: Role[] = ["ADMIN", "SUPERVISOR", "MEMBER", "VIEWER"]
