import "server-only"
import { cookies } from "next/headers"
import crypto from "node:crypto"

const COOKIE_NAME = "koi_session_pin_lock"
const ACTOR_COOKIE_NAME = "koi_pin_actor"

export interface SessionLockToken {
  /** Logged-in user who owns this lock preference */
  uid: string
  /** Tenant scope */
  t: string
  locked: boolean
}

function secret(): string {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error("AUTH_SECRET is required for session PIN lock.")
  return s
}

function sign(payload: SessionLockToken): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url")
  return `${body}.${sig}`
}

function read(token: string | undefined | null): SessionLockToken | null {
  if (!token) return null
  const dot = token.indexOf(".")
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url")
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionLockToken
    if (typeof parsed.uid !== "string" || typeof parsed.t !== "string" || typeof parsed.locked !== "boolean") {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/** True when the logged-in user enabled personal PIN lock for this tenant. */
export function isSessionPinLocked(userId: string, tenantId: string): boolean {
  const token = read(cookies().get(COOKIE_NAME)?.value)
  return token?.uid === userId && token.t === tenantId && token.locked === true
}

export function getSessionPinLockState(userId: string, tenantId: string): boolean {
  return isSessionPinLocked(userId, tenantId)
}

export function setSessionPinLock(userId: string, tenantId: string, locked: boolean) {
  if (!locked) {
    cookies().delete(COOKIE_NAME)
    return
  }
  cookies().set(COOKIE_NAME, sign({ uid: userId, t: tenantId, locked: true }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
}

/** Clears the short-lived action unlock window when toggling session lock. */
export function clearActorUnlockCookie() {
  cookies().delete(ACTOR_COOKIE_NAME)
}
