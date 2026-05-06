import { describe, it, expect } from "vitest"
import { hashPassword, verifyPassword } from "@/lib/auth/password"

describe("password utils", () => {
  it("hashes a password and verifies it correctly", async () => {
    const hash = await hashPassword("secret123")
    expect(hash).not.toBe("secret123")
    expect(await verifyPassword("secret123", hash)).toBe(true)
  })

  it("rejects wrong password", async () => {
    const hash = await hashPassword("secret123")
    expect(await verifyPassword("wrong", hash)).toBe(false)
  })
})
