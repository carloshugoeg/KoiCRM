import type { getFollowUpAlerts } from "@/features/follow-ups/queries"

export type FollowUpBannerUrgency = "overdue" | "today" | "upcoming"

export type FollowUpBannerItem = {
  id: string
  dealId: string
  dealName: string
  company: string | null
  stageLabel: string
  note: string
  dateIso: string
  dateLabel: string
  urgency: FollowUpBannerUrgency
}

type Alerts = Awaited<ReturnType<typeof getFollowUpAlerts>>

/**
 * Pure function, deliberately not using the runtime's local zone: the banner is rendered on the
 * server (tenant's configured timezone) and read verbatim on the client, so the same instant
 * must format identically no matter which zone the Node process happens to run in. Without an
 * explicit `timeZone`, this would format in the *server's* zone (UTC on Vercel) instead of the
 * tenant's — see the follow-up-banners fix report for why that broke every date in production.
 */
export function formatFollowUpBannerDate(iso: string, timezone: string): string {
  return new Date(iso).toLocaleDateString("es-GT", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function mapBucket(
  items: Alerts["overdue"],
  urgency: FollowUpBannerUrgency,
  timezone: string,
): FollowUpBannerItem[] {
  return items.map((fu) => ({
    id: fu.id,
    dealId: fu.deal.id,
    dealName: fu.deal.name,
    company: fu.deal.company,
    stageLabel: fu.deal.stage.label,
    note: fu.note ?? "",
    dateIso: fu.date.toISOString(),
    dateLabel: formatFollowUpBannerDate(fu.date.toISOString(), timezone),
    urgency,
  }))
}

/** Flatten alert buckets into banner items (overdue → today → próximos 7 días). */
export function toFollowUpBannerItems(
  alerts: Alerts,
  timezone: string,
  max = 5,
): FollowUpBannerItem[] {
  const all = [
    ...mapBucket(alerts.overdue, "overdue", timezone),
    ...mapBucket(alerts.today, "today", timezone),
    ...mapBucket(alerts.next7, "upcoming", timezone),
  ]
  return all.slice(0, max)
}

export function countFollowUpBannerItems(alerts: Alerts): number {
  return alerts.overdue.length + alerts.today.length + alerts.next7.length
}
