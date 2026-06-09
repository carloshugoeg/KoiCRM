import type { getFollowUpAlerts } from "@/features/follow-ups/queries"

export type FollowUpBannerUrgency = "overdue" | "today" | "upcoming"

export type FollowUpBannerItem = {
  id: string
  dealId: string
  dealName: string
  company: string | null
  stageLabel: string
  reasonLabel: string
  dateIso: string
  urgency: FollowUpBannerUrgency
}

type Alerts = Awaited<ReturnType<typeof getFollowUpAlerts>>

function mapBucket(
  items: Alerts["overdue"],
  urgency: FollowUpBannerUrgency,
  reasonLabels: Record<string, string>,
): FollowUpBannerItem[] {
  return items.map((fu) => ({
    id: fu.id,
    dealId: fu.deal.id,
    dealName: fu.deal.name,
    company: fu.deal.company,
    stageLabel: fu.deal.stage.label,
    reasonLabel: reasonLabels[fu.reasonKey] ?? fu.reasonKey,
    dateIso: fu.date.toISOString(),
    urgency,
  }))
}

/** Flatten alert buckets into banner items (overdue → today → próximos 7 días). */
export function toFollowUpBannerItems(
  alerts: Alerts,
  reasonLabels: Record<string, string>,
  max = 5,
): FollowUpBannerItem[] {
  const all = [
    ...mapBucket(alerts.overdue, "overdue", reasonLabels),
    ...mapBucket(alerts.today, "today", reasonLabels),
    ...mapBucket(alerts.next7, "upcoming", reasonLabels),
  ]
  return all.slice(0, max)
}

export function countFollowUpBannerItems(alerts: Alerts): number {
  return alerts.overdue.length + alerts.today.length + alerts.next7.length
}
