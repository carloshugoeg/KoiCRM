import type { Role } from "@prisma/client"

const EDITOR_ROLES: Role[] = ["OWNER", "ADMIN", "MEMBER"]
const ADMIN_ROLES: Role[] = ["OWNER", "ADMIN"]

export function canCreatePayment(role: Role) {
  return EDITOR_ROLES.includes(role)
}

export function canVoidPayment(role: Role) {
  return EDITOR_ROLES.includes(role)
}

export function canDeletePayment(role: Role) {
  return ADMIN_ROLES.includes(role)
}
