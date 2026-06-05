import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { isGoogleAuthEnabled } from "@/lib/auth/config"
import { signInErrorMessage } from "@/lib/auth/signin-errors"
import { slugifyName } from "@/lib/tenant/slugify"

describe("isGoogleAuthEnabled", () => {
  const prevId = process.env.GOOGLE_CLIENT_ID
  const prevSecret = process.env.GOOGLE_CLIENT_SECRET

  afterEach(() => {
    process.env.GOOGLE_CLIENT_ID = prevId
    process.env.GOOGLE_CLIENT_SECRET = prevSecret
  })

  it("is false when env vars are missing", () => {
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
    expect(isGoogleAuthEnabled()).toBe(false)
  })

  it("is true when both env vars are set", () => {
    process.env.GOOGLE_CLIENT_ID = "id"
    process.env.GOOGLE_CLIENT_SECRET = "secret"
    expect(isGoogleAuthEnabled()).toBe(true)
  })
})

describe("signInErrorMessage", () => {
  it("maps OAuthAccountNotLinked", () => {
    expect(signInErrorMessage("OAuthAccountNotLinked")).toMatch(/contraseña/i)
  })

  it("returns null for no error", () => {
    expect(signInErrorMessage(null)).toBeNull()
  })
})

describe("slugifyName", () => {
  it("slugifies company names", () => {
    expect(slugifyName("Mi Empresa S.A.")).toBe("mi-empresa-s-a")
  })
})
