import { headers } from "next/headers"

/**
 * Resolves the client IP used to bucket rate limits.
 *
 * `x-forwarded-for` is a client-appendable list: its LEFTMOST entry is whatever the caller
 * sent, so keying limits on it lets an attacker mint a fresh bucket per request and defeat
 * the signin/signup throttles entirely.
 *
 * Prefer the headers the platform sets itself and a client cannot forge. Vercel populates
 * `x-vercel-forwarded-for` (and `x-real-ip`) with the real peer address. Only when neither is
 * present do we fall back to the leftmost `x-forwarded-for` value — that keeps behaviour
 * identical to before off-platform, rather than risking every visitor collapsing into one
 * shared bucket (which would lock out logins) by guessing at the proxy chain.
 */
export function getClientIp(): string {
  const h = headers()

  const trusted = h.get("x-vercel-forwarded-for") ?? h.get("x-real-ip")
  const trustedFirst = trusted?.split(",")[0]?.trim()
  if (trustedFirst) return trustedFirst

  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim()
  if (forwarded) return forwarded

  return "unknown"
}
