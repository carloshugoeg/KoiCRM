/** Avatar object keys: `{tenantId}/avatars/{userId}/{file}` */
export const AVATAR_OBJECT_KEY_RE =
  /^[a-z0-9]+\/avatars\/[a-z0-9]+\/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp|gif)$/i

export function isAvatarObjectKey(key: string): boolean {
  return AVATAR_OBJECT_KEY_RE.test(key)
}

export function buildMediaUrl(key: string): string {
  return `/api/media/${key.split("/").map(encodeURIComponent).join("/")}`
}

/**
 * Prefer same-origin media proxy for R2 avatars; keep external URLs (e.g. Google OAuth) as-is.
 */
export function resolveUserImageSrc(image: string | null | undefined): string | null {
  if (!image?.trim()) return null
  const trimmed = image.trim()
  if (trimmed.startsWith("/api/media/")) return trimmed

  try {
    const path = trimmed.startsWith("http")
      ? new URL(trimmed).pathname.replace(/^\//, "")
      : trimmed.replace(/^\//, "")
    if (isAvatarObjectKey(path)) return buildMediaUrl(path)

    const publicBase = process.env.S3_PUBLIC_URL?.replace(/\/$/, "")
    if (publicBase && trimmed.startsWith(`${publicBase}/`)) {
      const key = trimmed.slice(publicBase.length + 1)
      if (isAvatarObjectKey(key)) return buildMediaUrl(key)
    }
  } catch {
    /* not a URL */
  }

  return trimmed
}
