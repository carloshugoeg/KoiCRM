import crypto from "node:crypto"

const PIN_RE = /^\d{4}$/

/** Signed payload stored in the unlock cookie. Keeps the PIN author active for the window. */
export interface ActorToken {
  /** actor user id (the member who owns the entered PIN) */
  uid: string
  /** tenant id the unlock is scoped to */
  t: string
  /** expiry, epoch seconds */
  exp: number
}

function secret(): string {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error("AUTH_SECRET is required for action PIN hashing.")
  return s
}

export function isValidPinFormat(pin: string): boolean {
  return PIN_RE.test(pin)
}

/**
 * Deterministic keyed hash of a 4-digit PIN. Deterministic so it is both indexable
 * (resolve the author from the PIN) and unique per workspace via a DB unique index.
 * The AUTH_SECRET pepper keeps it from being trivially reversed if the table leaks.
 */
export function hashActionPin(pin: string): string {
  return crypto.createHmac("sha256", secret()).update(pin).digest("hex")
}

export function signActorToken(payload: ActorToken): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url")
  return `${body}.${sig}`
}

export function readActorToken(token: string | undefined | null): ActorToken | null {
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
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as ActorToken
    if (typeof parsed.uid !== "string" || typeof parsed.t !== "string" || typeof parsed.exp !== "number") {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function actorTokenIsFresh(
  payload: ActorToken,
  tenantId: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  return payload.t === tenantId && payload.exp > nowSeconds
}
