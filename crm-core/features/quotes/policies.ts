import type { Role } from "@prisma/client"

const EDITOR_ROLES: Role[] = ["OWNER", "ADMIN", "MEMBER"]
const ADMIN_ROLES: Role[] = ["OWNER", "ADMIN"]

export function canCreateQuote(role: Role) {
  return EDITOR_ROLES.includes(role)
}

export function canVoidQuote(role: Role) {
  return EDITOR_ROLES.includes(role)
}

export function canDeleteQuote(role: Role) {
  return ADMIN_ROLES.includes(role)
}
