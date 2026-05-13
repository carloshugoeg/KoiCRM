import { withTenant } from "@/lib/db/rls"

export async function getDealFollowUps(tenantId: string, dealId: string) {
  return withTenant(tenantId, (tx) =>
    tx.followUp.findMany({
      where: { tenantId, dealId },
      orderBy: { date: "asc" },
    })
  )
}

const alertDealSelect = {
  deal: {
    select: {
      id: true,
      name: true,
      company: true,
      stage: { select: { key: true, label: true, color: true } },
    },
  },
} as const

export async function getFollowUpAlerts(
  tenantId: string,
  ownerId?: string,
  opts: { from?: Date; to?: Date } = {}
) {
  const now = new Date()
  const todayMidnight    = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const tomorrowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
  const in8DaysMidnight  = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8, 0, 0, 0, 0)

  const dateRange = opts.from || opts.to
    ? {
        createdAt: {
          ...(opts.from ? { gte: opts.from } : {}),
          ...(opts.to ? { lte: opts.to } : {}),
        },
      }
    : {}

  const dealFilter = {
    ...(ownerId ? { ownerId } : {}),
    isArchived: false,
    ...dateRange,
  }
  const ownerFilter = { deal: dealFilter }

  const [overdue, today, next7] = await Promise.all([
    withTenant(tenantId, (tx) =>
      tx.followUp.findMany({
        where: { tenantId, completed: false, date: { lt: todayMidnight }, ...ownerFilter },
        include: alertDealSelect,
        orderBy: { date: "asc" },
      })
    ),
    withTenant(tenantId, (tx) =>
      tx.followUp.findMany({
        where: { tenantId, completed: false, date: { gte: todayMidnight, lt: tomorrowMidnight }, ...ownerFilter },
        include: alertDealSelect,
        orderBy: { date: "asc" },
      })
    ),
    withTenant(tenantId, (tx) =>
      tx.followUp.findMany({
        where: { tenantId, completed: false, date: { gte: tomorrowMidnight, lt: in8DaysMidnight }, ...ownerFilter },
        include: alertDealSelect,
        orderBy: { date: "asc" },
      })
    ),
  ])

  return { overdue, today, next7 }
}

export type FollowUpAlert = Awaited<ReturnType<typeof getFollowUpAlerts>>["overdue"][number]
