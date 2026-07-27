import { withTenant, type PrismaTx } from "@/lib/db/rls"

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
  return withTenant(tenantId, (tx) => getFollowUpAlertsInTx(tx, tenantId, ownerId, opts))
}

/**
 * Runs inside the caller's tenant transaction, so the three bucket queries share one pooled
 * connection instead of opening three.
 *
 * This is rendered by the /app layout on every page, so the previous shape (three separate
 * withTenant() calls in a Promise.all) put three concurrent interactive transactions on every
 * single request before the page itself ran — the dominant contributor to the P2028
 * "Unable to start a transaction in the given time" failures on /pipeline and /clients.
 */
export async function getFollowUpAlertsInTx(
  tx: PrismaTx,
  tenantId: string,
  ownerId?: string,
  opts: { from?: Date; to?: Date } = {}
) {
  const now = new Date()
  const todayMidnight    = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const tomorrowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
  const in8DaysMidnight  = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8, 0, 0, 0, 0)

  // opts.from/to filter the parent deals by createdAt (which deals to include),
  // not the follow-up dates (overdue/today/next7 logic remains date-relative to now)
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
    tx.followUp.findMany({
      where: { tenantId, completed: false, date: { lt: todayMidnight }, ...ownerFilter },
      include: alertDealSelect,
      orderBy: { date: "asc" },
    }),
    tx.followUp.findMany({
      where: { tenantId, completed: false, date: { gte: todayMidnight, lt: tomorrowMidnight }, ...ownerFilter },
      include: alertDealSelect,
      orderBy: { date: "asc" },
    }),
    tx.followUp.findMany({
      where: { tenantId, completed: false, date: { gte: tomorrowMidnight, lt: in8DaysMidnight }, ...ownerFilter },
      include: alertDealSelect,
      orderBy: { date: "asc" },
    }),
  ])

  return { overdue, today, next7 }
}

export type FollowUpAlert = Awaited<ReturnType<typeof getFollowUpAlerts>>["overdue"][number]
