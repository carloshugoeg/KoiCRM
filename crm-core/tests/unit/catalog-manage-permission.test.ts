import { describe, it, expect } from "vitest"
import {
  PERMISSION_KEYS,
  PERMISSION_DEFS,
  defaultPermission,
  isPermissionKey,
  LOCKED_ROLES,
} from "@/lib/permissions/defaults"

/**
 * Behaviour contract for `catalog.manage` ("Gestionar catálogo"):
 * OWNER/ADMIN always allowed; lower roles denied by default; lower roles allowed
 * once the effective permission is true. Asserts the catalogue entry, not private helpers.
 */
describe("catalog.manage permission", () => {
  it("is a known catalogue key labelled Gestionar catálogo", () => {
    expect(PERMISSION_KEYS as readonly string[]).toContain("catalog.manage")
    expect(isPermissionKey("catalog.manage")).toBe(true)
    const def = PERMISSION_DEFS.find((d) => d.key === "catalog.manage")
    expect(def?.label).toBe("Gestionar catálogo")
  })

  it("allows OWNER and ADMIN by default", () => {
    for (const role of LOCKED_ROLES) {
      expect(defaultPermission(role, "catalog.manage" as never)).toBe(true)
    }
  })

  it("denies SUPERVISOR, MEMBER, and VIEWER by default", () => {
    expect(defaultPermission("SUPERVISOR", "catalog.manage" as never)).toBe(false)
    expect(defaultPermission("MEMBER", "catalog.manage" as never)).toBe(false)
    expect(defaultPermission("VIEWER", "catalog.manage" as never)).toBe(false)
  })
})
