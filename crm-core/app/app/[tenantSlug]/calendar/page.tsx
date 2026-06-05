import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { canSeeAllDeals, canArchiveDeal, canDeleteDeal } from "@/lib/auth/rbac"
import { getCalendarFollowUps } from "@/features/calendar/queries"
import { getDefaultPipeline } from "@/features/pipeline/queries"
import { withTenant } from "@/lib/db/rls"
import { getTenantMembers } from "@/features/tenants/queries"
import { getCatalogItems } from "@/features/catalogs/queries"
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
  const canSeeAll = canSeeAllDeals(membership.role)

  const now = new Date()
  const year = searchParams.year ? parseInt(searchParams.year as string, 10) : now.getFullYear()
  const month =
    searchParams.month !== undefined ? parseInt(searchParams.month as string, 10) : now.getMonth()
  // Asesores only see their own calendar; supervisors/superadmins may filter by advisor.
  const ownerId = canSeeAll ? (searchParams.owner as string | undefined) : session.user.id

  const [followUps, members, pipeline, followUpReasons, settings] = await Promise.all([
    getCalendarFollowUps(tenantId, year, month, ownerId),
    getTenantMembers(tenantId),
    withTenant(tenantId, (tx) => getDefaultPipeline(tx, tenantId)),
    getCatalogItems(tenantId, "followupReason", { activeOnly: true }),
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
      followUpReasons={followUpReasons}
      currentOwnerId={canSeeAll ? ownerId : undefined}
      settings={intlSettings}
      currentUserId={session.user.id}
      canSeeAll={canSeeAll}
      canArchive={canArchiveDeal(membership.role)}
      canDelete={canDeleteDeal(membership.role)}
    />
  )
}
