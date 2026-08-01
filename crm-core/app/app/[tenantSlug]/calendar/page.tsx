import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { canArchiveDeal, canDeleteDeal } from "@/lib/auth/rbac"
import { pipelineScopeFor } from "@/lib/permissions/resolve"
import { getCalendarFollowUps } from "@/features/calendar/queries"
import { getDefaultPipeline } from "@/features/pipeline/queries"
import { getCatalogItemsInTx } from "@/features/catalogs/queries"
import { withTenant } from "@/lib/db/rls"
import { getTenantMembers } from "@/features/tenants/queries"
import { CalendarClient } from "@/features/calendar/components/CalendarClient"
import { prisma } from "@/lib/db/client"
import type { IntlSettings } from "@/lib/intl/format"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

export default async function CalendarPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant, membership } = resolved
  const tenantId = tenant.id

  // Resolved ahead of the Promise.all below rather than inside it: pipelineScopeFor opens its
  // own tenant transaction, and running it concurrently with the three below would raise this
  // route's peak concurrent-transaction count. Sequencing it first keeps the peak at 3.
  const scope = await pipelineScopeFor(tenantId, membership.role, session.user.id)
  const canSeeAll = scope.visibleToUserId === null

  const now = new Date()
  const year = searchParams.year ? parseInt(searchParams.year as string, 10) : now.getFullYear()
  const month =
    searchParams.month !== undefined ? parseInt(searchParams.month as string, 10) : now.getMonth()
  // Asesores (and any role with pipeline.viewAll off) only see their own calendar plus
  // anything ceded to them; supervisors/superadmins with the permission may filter by advisor.
  const ownerId = canSeeAll ? (searchParams.owner as string | undefined) : (scope.visibleToUserId ?? undefined)

  const [followUps, members, { pipeline, archiveReasons }, settings] = await Promise.all([
    getCalendarFollowUps(tenantId, year, month, ownerId),
    getTenantMembers(tenantId),
    // archiveReasons folded into the same transaction as the pipeline lookup rather than a
    // separate withTenant() call, so this route's concurrent-transaction count is unchanged.
    withTenant(tenantId, async (tx) => {
      const [pipeline, archiveReasons] = await Promise.all([
        getDefaultPipeline(tx, tenantId),
        getCatalogItemsInTx(tx, tenantId, "archiveReason", true),
      ])
      return { pipeline, archiveReasons }
    }),
    prisma.tenantSettings.findUnique({ where: { tenantId } }),
  ])

  const intlSettings: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
    timezone: settings?.timezone ?? "America/Guatemala",
  }

  const memberList = members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email }))

  return (
    <CalendarClient
      tenantId={tenantId}
      tenantSlug={params.tenantSlug}
      year={year}
      month={month}
      followUps={followUps}
      members={memberList}
      stages={pipeline?.stages ?? []}
      currentOwnerId={canSeeAll ? ownerId : undefined}
      settings={intlSettings}
      currentUserId={session.user.id}
      canSeeAll={canSeeAll}
      canArchive={canArchiveDeal(membership.role)}
      canDelete={canDeleteDeal(membership.role)}
      archiveReasons={archiveReasons}
    />
  )
}
