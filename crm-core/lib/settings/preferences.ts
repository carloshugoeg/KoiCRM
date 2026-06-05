export const SHOW_ARCHIVED_KEY = "koi-showArchived"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function readShowArchivedPreference(): boolean {
  if (typeof window === "undefined") return false
  try {
    const raw = localStorage.getItem(SHOW_ARCHIVED_KEY)
    return raw !== null ? JSON.parse(raw) === true : false
  } catch {
    return false
  }
}

export function readShowArchivedFromCookieHeader(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false
  const match = cookieHeader.match(/(?:^|;\s*)koi-showArchived=([^;]+)/)
  return match?.[1] === "true"
}

export function writeShowArchivedPreference(value: boolean): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(SHOW_ARCHIVED_KEY, JSON.stringify(value))
    document.cookie = `${SHOW_ARCHIVED_KEY}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
  } catch {
    /* ignore quota */
  }
}
