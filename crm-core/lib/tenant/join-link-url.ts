/** Build join URL; works in browser (uses current origin) and on server. */
export function buildJoinLinkUrl(token: string, baseUrl?: string): string {
  const origin =
    baseUrl ??
    (typeof window !== "undefined" ? window.location.origin : undefined) ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3000"
  return `${origin.replace(/\/$/, "")}/api/join/accept?token=${encodeURIComponent(token)}`
}
