import { describe, it, expect } from "vitest"
import {
  AUTH_SESSION_TIMEZONE,
  getAuthDayKey,
  isAuthDayValid,
  secondsUntilNextAuthDay,
} from "@/lib/auth/daily-session"

describe("daily session", () => {
  it("uses America/Guatemala as the auth day boundary", () => {
    expect(AUTH_SESSION_TIMEZONE).toBe("America/Guatemala")
  })

  it("returns YYYY-MM-DD day keys", () => {
    const key = getAuthDayKey(new Date("2026-06-03T15:00:00.000Z"))
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("invalidates sessions from a previous calendar day", () => {
    expect(isAuthDayValid("2020-01-01", new Date("2026-06-03T12:00:00.000Z"))).toBe(false)
  })

  it("accepts sessions from the current calendar day", () => {
    const now = new Date("2026-06-03T12:00:00.000Z")
    expect(isAuthDayValid(getAuthDayKey(now), now)).toBe(true)
  })

  it("returns a positive TTL until the next auth day", () => {
    expect(secondsUntilNextAuthDay(new Date("2026-06-03T12:00:00.000Z"))).toBeGreaterThan(0)
    expect(secondsUntilNextAuthDay(new Date("2026-06-03T12:00:00.000Z"))).toBeLessThanOrEqual(
      24 * 60 * 60,
    )
  })
})
