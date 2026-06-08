/** Avatar object keys: `{tenantId}/avatars/{userId}/{file}` */
export const AVATAR_OBJECT_KEY_RE =
  /^[a-z0-9]+\/avatars\/[a-z0-9]+\/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp|gif)$/i

/** Deal attachment keys: `{tenantId}/deals/{dealId}/{file}` */
export const DEAL_OBJECT_KEY_RE =
  /^[a-z0-9]+\/deals\/[a-z0-9]+\/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp|gif|pdf)$/i

export function isAvatarObjectKey(key: string): boolean {
  return AVATAR_OBJECT_KEY_RE.test(key)
}

export function isDealObjectKey(key: string): boolean {
  return DEAL_OBJECT_KEY_RE.test(key)
}

export function isTenantMediaObjectKey(key: string): boolean {
  return isAvatarObjectKey(key) || isDealObjectKey(key)
}

export function buildMediaUrl(key: string): string {
  return `/api/media/${key.split("/").map(encodeURIComponent).join("/")}`
}

function objectKeyFromStoredUrl(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("/api/media/")) {
    return trimmed
      .slice("/api/media/".length)
      .split("/")
      .map((s) => decodeURIComponent(s))
      .join("/")
  }

  try {
    const path = trimmed.startsWith("http")
      ? new URL(trimmed).pathname.replace(/^\//, "")
      : trimmed.replace(/^\//, "")
    if (isTenantMediaObjectKey(path)) return path

    const publicBase = process.env.S3_PUBLIC_URL?.replace(/\/$/, "")
    if (publicBase && trimmed.startsWith(`${publicBase}/`)) {
      const key = trimmed.slice(publicBase.length + 1)
      if (isTenantMediaObjectKey(key)) return key
    }
  } catch {
    /* not a URL */
  }

  return null
}

function resolveStoredMediaUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  const key = objectKeyFromStoredUrl(url)
  if (key) return buildMediaUrl(key)
  return url.trim()
}

/**
 * Prefer same-origin media proxy for R2 avatars; keep external URLs (e.g. Google OAuth) as-is.
 */
export function resolveUserImageSrc(image: string | null | undefined): string | null {
  if (!image?.trim()) return null
  const trimmed = image.trim()
  if (trimmed.startsWith("/api/media/")) return trimmed

  const key = objectKeyFromStoredUrl(trimmed)
  if (key && isAvatarObjectKey(key)) return buildMediaUrl(key)

  return trimmed
}

/** Same-origin proxy for deal quotes/payments/attachments stored in R2. */
export function resolveDealFileUrl(fileUrl: string | null | undefined): string | null {
  return resolveStoredMediaUrl(fileUrl)
}
