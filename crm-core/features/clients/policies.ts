import type { Role } from "@prisma/client"

const ROLE_RANK: Record<Role, number> = { OWNER: 5, ADMIN: 4, SUPERVISOR: 3, MEMBER: 2, VIEWER: 1 }
const atLeast = (r: Role, min: Role) => ROLE_RANK[r] >= ROLE_RANK[min]

export const canCreateClient = (r: Role) => atLeast(r, "MEMBER")
export const canEditClient   = (r: Role) => atLeast(r, "MEMBER")
export const canDeleteClient = (r: Role) => atLeast(r, "ADMIN")
