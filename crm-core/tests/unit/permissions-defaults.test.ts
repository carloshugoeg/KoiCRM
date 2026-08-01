import { describe, it, expect } from "vitest"
import {
  PERMISSION_KEYS,
  PERMISSION_DEFS,
  ROLES,
  LOCKED_ROLES,
  defaultMatrix,
  defaultPermission,
  isPermissionKey,
} from "@/lib/permissions/defaults"
// ROLE_LABELS is authoritative in lib/auth/permissions (the Usuarios screen's source), not
// duplicated here — lib/permissions/defaults used to keep its own copy that disagreed with it
// (OWNER/ADMIN rendered differently on the Permisos screen than on the Usuarios screen right
// next to it in settings). This test now guards against that map reappearing out of sync.
import { ROLE_LABELS } from "@/lib/auth/permissions"

describe("permission catalogue integrity", () => {
  it("gives every key exactly one definition", () => {
    const defKeys = PERMISSION_DEFS.map((d) => d.key).sort()
    expect(defKeys).toEqual([...PERMISSION_KEYS].sort())
    expect(new Set(defKeys).size).toBe(defKeys.length)
  })

  it("gives every role a default for every key", () => {
    const matrix = defaultMatrix()
    for (const role of ROLES) {
      expect(Object.keys(matrix[role]).sort()).toEqual([...PERMISSION_KEYS].sort())
    }
  })

  it("labels every role", () => {
    for (const role of ROLES) expect(ROLE_LABELS[role]).toBeTruthy()
  })

  it("gives every locked role the identical label, since they resolve to identical access", () => {
    for (const role of LOCKED_ROLES) expect(ROLE_LABELS[role]).toBe("Superadministrador")
  })

  it("does not carry clients.viewAll, which has no consumer", () => {
    expect(PERMISSION_KEYS as readonly string[]).not.toContain("clients.viewAll")
  })

  it("gives locked roles every permission by default", () => {
    for (const role of LOCKED_ROLES) {
      for (const key of PERMISSION_KEYS) expect(defaultPermission(role, key)).toBe(true)
    }
  })

  it("restricts MEMBER from the shared funnel and its totals", () => {
    expect(defaultPermission("MEMBER", "pipeline.viewAll")).toBe(false)
    expect(defaultPermission("MEMBER", "pipeline.viewTotals")).toBe(false)
  })

  it("returns a fresh matrix each call, so callers cannot mutate the defaults", () => {
    const first = defaultMatrix()
    first.MEMBER["pipeline.viewAll"] = true
    expect(defaultMatrix().MEMBER["pipeline.viewAll"]).toBe(false)
  })

  it("narrows known keys and rejects unknown ones", () => {
    expect(isPermissionKey("pipeline.viewAll")).toBe(true)
    expect(isPermissionKey("pipeline.nonsense")).toBe(false)
    expect(isPermissionKey("")).toBe(false)
  })
})
