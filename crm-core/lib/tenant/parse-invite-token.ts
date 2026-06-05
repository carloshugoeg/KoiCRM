/** Extract join/invite token from pasted URL or raw token string (safe for client bundles). */
export function parseInviteToken(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const url = new URL(trimmed)
      const token = url.searchParams.get("token")
      if (token) return token
      const parts = url.pathname.split("/").filter(Boolean)
      const joinIdx = parts.indexOf("join")
      const inviteIdx = parts.indexOf("invite")
      const acceptIdx = parts.indexOf("accept")
      if (joinIdx >= 0 && parts[joinIdx + 1] === "accept") {
        /* token in query */
      } else if ((inviteIdx >= 0 || joinIdx >= 0) && acceptIdx >= 0 && parts[acceptIdx + 1]) {
        return parts[acceptIdx + 1]
      }
    }
  } catch {
    /* not a URL */
  }
  if (/^[a-f0-9]+$/i.test(trimmed) && trimmed.length >= 16) return trimmed
  return null
}
