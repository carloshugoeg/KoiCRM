import * as Sentry from "@sentry/nextjs"
import { prisma } from "@/lib/db/client"

export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const now = new Date()
  const resetAt = new Date(now.getTime() + windowMs)

  try {
    type Row = { count: number }
    const rows = await prisma.$queryRaw<Row[]>`
      INSERT INTO rate_limit_entries (key, count, "resetAt")
      VALUES (${key}, 1, ${resetAt})
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limit_entries."resetAt" < ${now} THEN 1
          ELSE rate_limit_entries.count + 1
        END,
        "resetAt" = CASE
          WHEN rate_limit_entries."resetAt" < ${now} THEN ${resetAt}
          ELSE rate_limit_entries."resetAt"
        END
      RETURNING count
    `
    return (rows[0]?.count ?? 1) <= max
  } catch (e) {
    // Fail open: if DB is unavailable, don't block legitimate users
    Sentry.captureException(e)
    return true
  }
}
