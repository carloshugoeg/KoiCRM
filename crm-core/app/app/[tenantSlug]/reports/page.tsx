import { Suspense } from "react"
import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { permissionsFor } from "@/lib/permissions/resolve"
import { getTenantMembers } from "@/features/tenants/queries"
import { getOpenOpportunities, type ReportSort } from "@/features/reports/queries"
import { ReportsFilterBar, ALL_OWNERS } from "@/features/reports/components/ReportsFilterBar"
import { ReportsTable } from "@/features/reports/components/ReportsTable"
import { prisma } from "@/lib/db/client"
import type { IntlSettings } from "@/lib/intl/format"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

export default async function ReportsPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant, membership } = resolved
  const tenantId = tenant.id

  const perms = await permissionsFor(tenantId, membership.role, session.user.id)
  const canViewAll = perms["reports.viewAll"]

  const sort: ReportSort = searchParams.sort === "newest" ? "newest" : "oldest"

  const ownerParam = typeof searchParams.owner === "string" ? searchParams.owner : undefined
  // Without reports.viewAll the report is pinned to the member's own opportunities.
  const ownerId = canViewAll
    ? ownerParam && ownerParam !== ALL_OWNERS
      ? ownerParam
      : null
    : session.user.id

  const [deals, members, settings] = await Promise.all([
    getOpenOpportunities({ tenantId, ownerId, sort }),
    canViewAll ? getTenantMembers(tenantId) : Promise.resolve([]),
    prisma.tenantSettings.findUnique({ where: { tenantId } }),
  ])

  const intlSettings: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
    timezone: settings?.timezone ?? "America/Guatemala",
  }

  const memberList = members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
  }))

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b">
        <h1 className="text-lg font-bold">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Oportunidades abiertas — excluye ganadas, perdidas y archivadas
        </p>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Suspense>
            <ReportsFilterBar
              sort={sort}
              members={memberList}
              ownerId={ownerId}
              canFilterByOwner={canViewAll}
            />
          </Suspense>
          <span className="text-xs text-muted-foreground">{deals.length} oportunidad(es)</span>
        </div>

        <ReportsTable deals={deals} settings={intlSettings} />
      </div>
    </div>
  )
}
