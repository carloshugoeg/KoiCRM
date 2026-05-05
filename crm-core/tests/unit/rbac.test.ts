// crm-core/tests/unit/rbac.test.ts
import { describe, it, expect } from "vitest"
import {
  canCreateDeal, canEditDeal, canDeleteDeal,
  canManageMembers, canManageSettings,
} from "@/lib/auth/rbac"
import type { Role } from "@prisma/client"

const matrix: [Role, boolean, boolean, boolean, boolean, boolean][] = [
  // role,       create  edit    delete  members settings
  ["OWNER",   true,   true,   true,   true,   true],
  ["ADMIN",   true,   true,   true,   true,   true],
  ["MEMBER",  true,   true,   false,  false,  false],
  ["VIEWER",  false,  false,  false,  false,  false],
]

describe("RBAC policy matrix", () => {
  it.each(matrix)(
    "%s: create=%s edit=%s delete=%s members=%s settings=%s",
    (role, create, edit, del, members, settings) => {
      expect(canCreateDeal(role)).toBe(create)
      expect(canEditDeal(role)).toBe(edit)
      expect(canDeleteDeal(role)).toBe(del)
      expect(canManageMembers(role)).toBe(members)
      expect(canManageSettings(role)).toBe(settings)
    },
  )
})
