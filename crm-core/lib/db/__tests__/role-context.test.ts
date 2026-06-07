import { describe, it, expect } from "vitest"
import { isRoleEstablished, runWithEstablishedRole, runWithEstablishedRoleAsync } from "@/lib/db/role-context"

describe("role-context", () => {
  it("isRoleEstablished is false outside established scope", () => {
    expect(isRoleEstablished()).toBe(false)
  })

  it("runWithEstablishedRole marks scope for sync callbacks", () => {
    runWithEstablishedRole(() => {
      expect(isRoleEstablished()).toBe(true)
    })
    expect(isRoleEstablished()).toBe(false)
  })

  it("runWithEstablishedRoleAsync marks scope for async callbacks", async () => {
    await runWithEstablishedRoleAsync(async () => {
      expect(isRoleEstablished()).toBe(true)
      await Promise.resolve()
      expect(isRoleEstablished()).toBe(true)
    })
    expect(isRoleEstablished()).toBe(false)
  })
})
