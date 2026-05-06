import { describe, it, expect, vi, beforeEach } from "vitest"

let now = 1_000_000

beforeEach(() => {
  vi.spyOn(Date, "now").mockImplementation(() => now)
})

const loadModule = async () => {
  vi.resetModules()
  return import("@/lib/auth/rate-limit")
}

describe("rateLimit", () => {
  it("allows requests under the limit", async () => {
    const { rateLimit } = await loadModule()
    expect(rateLimit("key1", 3, 60_000)).toBe(true)
    expect(rateLimit("key1", 3, 60_000)).toBe(true)
    expect(rateLimit("key1", 3, 60_000)).toBe(true)
  })

  it("blocks when limit is exceeded", async () => {
    const { rateLimit } = await loadModule()
    rateLimit("key2", 2, 60_000)
    rateLimit("key2", 2, 60_000)
    expect(rateLimit("key2", 2, 60_000)).toBe(false)
  })

  it("resets after window expires", async () => {
    const { rateLimit } = await loadModule()
    rateLimit("key3", 1, 60_000)
    expect(rateLimit("key3", 1, 60_000)).toBe(false)
    now += 61_000
    expect(rateLimit("key3", 1, 60_000)).toBe(true)
  })
})
