import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { getDefaultPipeline } from "@/features/pipeline/queries"
import { withTenant } from "@/lib/db/rls"
import { getPipelineDeals } from "@/features/deals/queries"
import { getCatalogItems } from "@/features/catalogs/queries"
import { getTenantMembers } from "@/features/tenants/queries"
import { pipelineFiltersSchema } from "@/features/pipeline/schemas"
import { PipelineClient } from "@/features/pipeline/components/PipelineClient"
import { PrintReport } from "@/features/pipeline/components/PrintReport"
import { prisma } from "@/lib/db/client"
import type { IntlSettings } from "@/lib/intl/format"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

export default async function PipelinePage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant, membership } = resolved
  const tenantId = tenant.id
  const tenantSlug = params.tenantSlug

  const rawParams = {
    owner: searchParams.owner as string | undefined,
    channel: searchParams.channel as string | undefined,
    equipment: searchParams.equipment as string | undefined,
    alerts: searchParams.alerts as string | undefined,
    from: searchParams.from as string | undefined,
    to: searchParams.to as string | undefined,
  }
  const filters = pipelineFiltersSchema.parse(rawParams)

  const [pipeline, members, channels, equipment, statuses, followUpReasons, settings] = await Promise.all([
    withTenant(tenantId, (tx) => getDefaultPipeline(tx, tenantId)),
    getTenantMembers(tenantId),
    getCatalogItems(tenantId, "salesChannel"),
    getCatalogItems(tenantId, "equipment"),
    getCatalogItems(tenantId, "dealStatus"),
    getCatalogItems(tenantId, "followupReason"),
    prisma.tenantSettings.findUnique({ where: { tenantId } }),
  ])

  if (!pipeline) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No hay pipeline configurado. Ve a Configuración → Embudo.</p>
      </div>
    )
  }

  const deals = await getPipelineDeals(tenantId, {
    ownerId: filters.owner,
    channelKey: filters.channel,
    equipmentKey: filters.equipment,
    alerts: filters.alerts,
    from: filters.from ? new Date(filters.from) : undefined,
    to: filters.to ? new Date(filters.to) : undefined,
  })

  const intlSettings: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
    timezone: settings?.timezone ?? "America/Guatemala",
  }

  // Serialize deals for client (convert Decimal and Date to primitives)
  const serializedDeals = deals.map((d) => ({
    id: d.id,
    name: d.name,
    company: d.company,
    phone: d.client?.phone ?? null,
    whatsapp: d.client?.whatsapp ?? null,
    email: d.client?.email ?? null,
    value: Number(d.value),
    ownerId: d.ownerId,
    ownerName: d.owner.name,
    stageId: d.stageId,
    stageKey: d.stage.key,
    statusKey: d.statusKey,
    createdAt: d.createdAt.toISOString(),
    stageEnteredAt: d.stageEnteredAt.toISOString(),
    equipment: d.equipment,
    hasActiveQuote: d.hasActiveQuote,
    hasActivePayment: d.hasActivePayment,
    hasOverdueFollowUp: d.hasOverdueFollowUp,
    hasQuoteAlert: d.hasQuoteAlert,
    hasPaymentAlert: d.hasPaymentAlert,
    quoteCount: d.quoteCount ?? 0,
    paymentCount: d.paymentCount ?? 0,
  }))

  const memberList = members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
  }))

  const productName = tenant.branding?.productName ?? tenant.name

  return (
    <>
      <PipelineClient
        tenantId={tenantId}
        tenantSlug={tenantSlug}
        stages={pipeline.stages}
        deals={serializedDeals}
        members={memberList}
        channels={channels}
        equipment={equipment}
        statuses={statuses}
        currentFilters={filters}
        intlSettings={intlSettings}
        logoUrl={tenant.branding?.logoUrl ?? null}
        productName={productName}
        canEdit={membership.role !== "VIEWER"}
        canDelete={["OWNER", "ADMIN"].includes(membership.role)}
        followUpReasons={followUpReasons}
      />
      <PrintReport
        deals={serializedDeals}
        settings={intlSettings}
        productName={productName}
      />
    </>
  )
}
