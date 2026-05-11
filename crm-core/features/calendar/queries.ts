import { withTenant } from "@/lib/db/rls"

export async function getCalendarFollowUps(
  tenantId: string,
  year: number,
  month: number,    // 0-indexed (0=Jan, 4=May, 11=Dec) — matches JS Date.getMonth()
  ownerId?: string,
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
          ...(ownerId ? { ownerId } : {}),
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
