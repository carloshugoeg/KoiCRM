import { withTenant } from "@/lib/db/rls"
import { dealVisibilityWhere } from "@/features/deals/queries"

export async function getCalendarFollowUps(
  tenantId: string,
  year: number,
  month: number,    // 0-indexed (0=Jan, 4=May, 11=Dec) — matches JS Date.getMonth()
  // Cesión transfers the work, so the calendar must show what a person can see (owned or
  // ceded to them via DealViewer) — the same rule the funnel and every other read path use.
  visibleToUserId?: string,
) {
  const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0)
  const startOfNext  = new Date(year, month + 1, 1, 0, 0, 0, 0)  // exclusive upper bound

  return withTenant(tenantId, (tx) =>
    tx.followUp.findMany({
      where: {
        tenantId,
        date: { gte: startOfMonth, lt: startOfNext },
        deal: {
          isArchived: false,
          ...(visibleToUserId ? dealVisibilityWhere(visibleToUserId) : {}),
        },
      },
      include: {
        deal: {
          select: {
            id: true,
            name: true,
            statusKey: true,
            stage: { select: { key: true, label: true, color: true } },
            owner: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { date: "asc" },
    })
  )
}

export type CalendarFollowUp = Awaited<ReturnType<typeof getCalendarFollowUps>>[number]
