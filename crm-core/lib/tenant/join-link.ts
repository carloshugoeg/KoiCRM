/** Build absolute URL for a workspace join link (server-side). */
export { buildJoinLinkUrl } from "@/lib/tenant/join-link-url"

export function isJoinLinkActive(link: {
  revokedAt: Date | null
  expiresAt: Date | null
}): boolean {
  if (link.revokedAt) return false
  if (link.expiresAt && link.expiresAt < new Date()) return false
  return true
}
