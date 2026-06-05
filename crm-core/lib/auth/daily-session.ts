/** Calendar day boundary for auth sessions (matches app default intl timezone). */
export const AUTH_SESSION_TIMEZONE = "America/Guatemala"

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: AUTH_SESSION_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** YYYY-MM-DD in the auth session timezone. */
export function getAuthDayKey(date = new Date()): string {
  return dayKeyFormatter.format(date)
}

export function isAuthDayValid(authDay: string | undefined, now = new Date()): boolean {
  if (!authDay) return false
  return authDay === getAuthDayKey(now)
}

/** Seconds from `now` until the next calendar day in the auth session timezone. */
export function secondsUntilNextAuthDay(now = new Date()): number {
  const todayKey = getAuthDayKey(now)
  let probe = now.getTime() + 60_000
  const maxProbeMs = now.getTime() + 48 * 60 * 60 * 1000

  while (probe < maxProbeMs) {
    if (getAuthDayKey(new Date(probe)) !== todayKey) {
      return Math.max(60, Math.ceil((probe - now.getTime()) / 1000))
    }
    probe += 60_000
  }

  return 24 * 60 * 60
}
