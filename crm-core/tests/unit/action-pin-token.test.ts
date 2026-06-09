import { describe, it, expect, beforeAll } from "vitest"
import {
  hashActionPin,
  isValidPinFormat,
  signActorToken,
  readActorToken,
  actorTokenIsFresh,
  type ActorToken,
} from "@/lib/auth/action-pin-token"
import { canEditDealRow } from "@/lib/auth/permissions"

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-pin"
})

describe("hashActionPin", () => {
  it("is deterministic for the same PIN", () => {
    expect(hashActionPin("1234")).toBe(hashActionPin("1234"))
  })

  it("produces different hashes for different PINs (so they stay unique per workspace)", () => {
    expect(hashActionPin("1234")).not.toBe(hashActionPin("5678"))
  })

  it("does not store the PIN in clear", () => {
    expect(hashActionPin("1234")).not.toContain("1234")
  })
})

describe("isValidPinFormat", () => {
  it("accepts exactly 4 digits", () => {
    expect(isValidPinFormat("0042")).toBe(true)
  })
  it("rejects non-4-digit input", () => {
    expect(isValidPinFormat("123")).toBe(false)
    expect(isValidPinFormat("12345")).toBe(false)
    expect(isValidPinFormat("12a4")).toBe(false)
    expect(isValidPinFormat("")).toBe(false)
  })
})

describe("actor unlock token", () => {
  const payload: ActorToken = { uid: "user-1", t: "tenant-1", exp: 9_999_999_999 }

  it("round-trips a signed token", () => {
    expect(readActorToken(signActorToken(payload))).toEqual(payload)
  })

  it("rejects a tampered payload", () => {
    const token = signActorToken(payload)
    const [body, sig] = token.split(".")
    const forged = Buffer.from(JSON.stringify({ ...payload, uid: "attacker" })).toString("base64url")
    expect(readActorToken(`${forged}.${sig}`)).toBeNull()
    expect(readActorToken(`${body}.deadbeef`)).toBeNull()
  })

  it("rejects malformed tokens", () => {
    expect(readActorToken(undefined)).toBeNull()
    expect(readActorToken("")).toBeNull()
    expect(readActorToken("nodot")).toBeNull()
  })

  it("is fresh only for the matching tenant and before expiry", () => {
    const now = 1_000
    expect(actorTokenIsFresh({ uid: "u", t: "tenant-1", exp: 2_000 }, "tenant-1", now)).toBe(true)
    expect(actorTokenIsFresh({ uid: "u", t: "tenant-1", exp: 500 }, "tenant-1", now)).toBe(false)
    expect(actorTokenIsFresh({ uid: "u", t: "tenant-2", exp: 2_000 }, "tenant-1", now)).toBe(false)
  })
})

describe("canEditDealRow (embudo abierto)", () => {
  it("lets any editor edit any deal regardless of ownership", () => {
    expect(canEditDealRow("MEMBER", "someone-else", "me")).toBe(true)
    expect(canEditDealRow("SUPERVISOR", "someone-else", "me")).toBe(true)
  })
  it("still denies read-only viewers", () => {
    expect(canEditDealRow("VIEWER", "me", "me")).toBe(false)
  })
})
