// crm-core/tests/unit/rbac.test.ts
import { describe, it, expect } from "vitest"
import {
  canCreateDeal, canEditDeal, canDeleteDeal,
  canArchiveDeal, canSeeAllDeals, canEditDealRow,
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

describe("canEditDealRow (embudo abierto)", () => {
  it("lets supervisors and above edit any deal regardless of owner", () => {
    expect(canEditDealRow("SUPERVISOR", "owner-1", "other-2")).toBe(true)
    expect(canEditDealRow("ADMIN", "owner-1", "other-2")).toBe(true)
    expect(canEditDealRow("OWNER", "owner-1", "other-2")).toBe(true)
  })

  it("lets an asesor edit any deal, not only their own (ownership no longer gates edits)", () => {
    expect(canEditDealRow("MEMBER", "user-1", "user-1")).toBe(true)
    expect(canEditDealRow("MEMBER", "owner-1", "user-2")).toBe(true)
  })

  it("never lets a viewer edit", () => {
    expect(canEditDealRow("VIEWER", "user-1", "user-1")).toBe(false)
  })
})
