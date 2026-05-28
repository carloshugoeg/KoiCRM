import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db/client", () => ({
  prisma: { $queryRaw: vi.fn() },
}))

import { prisma } from "@/lib/db/client"

const loadModule = async () => {
  vi.resetModules()
  return import("@/lib/auth/rate-limit")
}

describe("rateLimit", () => {
  beforeEach(() => vi.clearAllMocks())

  it("allows request when count is within limit", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ count: 2 }])
    const { rateLimit } = await loadModule()
    expect(await rateLimit("key1", 3, 60_000)).toBe(true)
  })

  it("blocks request when count exceeds limit", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ count: 4 }])
    const { rateLimit } = await loadModule()
    expect(await rateLimit("key1", 3, 60_000)).toBe(false)
  })

  it("allows request when count equals limit (last allowed request)", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ count: 3 }])
    const { rateLimit } = await loadModule()
    expect(await rateLimit("key1", 3, 60_000)).toBe(true)
  })

  it("fails open when DB throws", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("DB down"))
    const { rateLimit } = await loadModule()
    expect(await rateLimit("key1", 3, 60_000)).toBe(true)
  })
})
