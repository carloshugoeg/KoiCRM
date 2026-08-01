// crm-core/tests/unit/rbac.test.ts
import { describe, it, expect } from "vitest"
import {
  canCreateDeal, canEditDeal, canDeleteDeal,
  canArchiveDeal, canSeeAllDeals,
  canManageMembers, canManageSettings,
} from "@/lib/auth/rbac"
import type { Role } from "@prisma/client"

const matrix: [Role, boolean, boolean, boolean, boolean, boolean, boolean, boolean][] = [
  // role,         create  edit    delete  members settings archive seeAll
  ["OWNER",      true,   true,   true,   true,   true,    true,   true],
  ["ADMIN",      true,   true,   true,   true,   true,    true,   true],
  ["SUPERVISOR", true,   true,   false,  false,  false,   true,   true],
  ["MEMBER",     true,   true,   false,  false,  false,   false,  false],
  ["VIEWER",     false,  false,  false,  false,  false,   false,  false],
]

describe("RBAC policy matrix", () => {
  it.each(matrix)(
    "%s: create=%s edit=%s delete=%s members=%s settings=%s archive=%s seeAll=%s",
    (role, create, edit, del, members, settings, archive, seeAll) => {
      expect(canCreateDeal(role)).toBe(create)
      expect(canEditDeal(role)).toBe(edit)
      expect(canDeleteDeal(role)).toBe(del)
      expect(canManageMembers(role)).toBe(members)
      expect(canManageSettings(role)).toBe(settings)
      expect(canArchiveDeal(role)).toBe(archive)
      expect(canSeeAllDeals(role)).toBe(seeAll)
    },
  )
})
