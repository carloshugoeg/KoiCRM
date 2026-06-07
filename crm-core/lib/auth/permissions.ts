import type { Role } from "@prisma/client"

const ROLE_RANK: Record<Role, number> = { OWNER: 5, ADMIN: 4, SUPERVISOR: 3, MEMBER: 2, VIEWER: 1 }

function atLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min]
}

export const canCreateDeal = (r: Role) => atLeast(r, "MEMBER")
export const canEditDeal = (r: Role) => atLeast(r, "MEMBER")
export const canDeleteDeal = (r: Role) => atLeast(r, "ADMIN")
export const canArchiveDeal = (r: Role) => atLeast(r, "SUPERVISOR")
export const canSeeAllDeals = (r: Role) => atLeast(r, "SUPERVISOR")
export const canManageMembers = (r: Role) => atLeast(r, "ADMIN")
export const canManageSettings = (r: Role) => atLeast(r, "ADMIN")

export function canEditDealRow(role: Role, dealOwnerId: string, userId: string): boolean {
  if (!canEditDeal(role)) return false
  return canSeeAllDeals(role) || dealOwnerId === userId
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Superadministrador",
  ADMIN: "Superadministrador",
  SUPERVISOR: "Supervisor",
  MEMBER: "Asesor",
  VIEWER: "Solo lectura",
}

export const ASSIGNABLE_ROLES: Role[] = ["ADMIN", "SUPERVISOR", "MEMBER", "VIEWER"]
