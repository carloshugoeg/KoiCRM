import { redirect, notFound } from "next/navigation"
import { cookies } from "next/headers"
import { readShowArchivedFromCookieHeader } from "@/lib/settings/preferences"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { loadPipelineKanbanData } from "@/features/pipeline/queries"
import { pipelineFiltersSchema } from "@/features/pipeline/schemas"
import { canSeeAllDeals, canArchiveDeal, canDeleteDeal, canCreateDeal } from "@/lib/auth/rbac"
import { PipelineClient } from "@/features/pipeline/components/PipelineClient"
import { PrintReport } from "@/features/pipeline/components/PrintReport"
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
  const canSeeAll = canSeeAllDeals(membership.role)

  const rawParams = {
    owner: searchParams.owner as string | undefined,
    channel: searchParams.channel as string | undefined,
    equipment: searchParams.equipment as string | undefined,
    alerts: searchParams.alerts as string | undefined,
    from: searchParams.from as string | undefined,
    to: searchParams.to as string | undefined,
  }
  const filters = pipelineFiltersSchema.parse(rawParams)
  const cookieStore = cookies()
  const includeArchived = readShowArchivedFromCookieHeader(cookieStore.toString())

  const { pipeline, members, channels, equipment, statuses, followUpReasons, settings, deals } =
    await loadPipelineKanbanData(tenantId, {
      visibleToUserId: canSeeAll ? undefined : session.user.id,
      ownerId: canSeeAll ? filters.owner : undefined,
      channelKey: filters.channel,
      equipmentKey: filters.equipment,
      alerts: filters.alerts,
      from: filters.from ? new Date(filters.from) : undefined,
      to: filters.to ? new Date(filters.to) : undefined,
      includeArchived,
    })

  if (!pipeline) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No hay pipeline configurado. Ve a Configuración → Embudo.</p>
      </div>
    )
  }

  const intlSettings: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
    timezone: settings?.timezone ?? "America/Guatemala",
  }

  const channelByKey = Object.fromEntries(channels.map((c) => [c.key, c.label]))
  const equipmentLabels = Object.fromEntries(equipment.map((e) => [e.key, e.label]))

  const filterParts: string[] = []
  if (filters.owner) {
    const m = members.find((x) => x.user.id === filters.owner)
    filterParts.push(`Asesor: ${m?.user.name ?? m?.user.email ?? filters.owner}`)
  }
  if (filters.channel) {
    filterParts.push(`Origen: ${channelByKey[filters.channel] ?? filters.channel}`)
  }
  if (filters.equipment) {
    filterParts.push(`Equipo: ${equipmentLabels[filters.equipment] ?? filters.equipment}`)
  }
  if (filters.alerts === "missingQuote") filterParts.push("Alerta: sin cotización")
  if (filters.alerts === "missingPayment") filterParts.push("Alerta: sin pago")
  if (filters.alerts === "overdueFollowUp") filterParts.push("Alerta: seguimiento vencido")
  const filterSummary = filterParts.length > 0 ? filterParts.join(" · ") : null

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
    stageLabel: d.stage.label,
    stageColor: d.stage.color,
    channelKey: d.channelKey,
    channelLabel: channelByKey[d.channelKey] ?? d.channelKey,
    statusKey: d.statusKey,
    createdAt: d.createdAt.toISOString(),
    stageEnteredAt: d.stageEnteredAt.toISOString(),
    equipment: d.equipment,
    hasActiveQuote: d.hasActiveQuote,
    hasActivePayment: d.hasActivePayment,
    hasOverdueFollowUp: d.hasOverdueFollowUp,
    hasQuoteAlert: d.hasQuoteAlert,
    hasPaymentAlert: d.hasPaymentAlert,
    hasPaymentWithFile: d.hasPaymentWithFile,
    quoteCount: d.quoteCount ?? 0,
    paymentCount: d.paymentCount ?? 0,
    latestQuoteNumber: d.quotes?.[0]?.number ?? null,
    latestPaymentNumber: d.payments?.[0]?.number ?? null,
    latestNote: d.notes?.[0]?.text ?? null,
  }))

  const memberList = members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    image: m.user.image,
  }))

  const productName = tenant.branding?.productName ?? tenant.name

  const logoUrl = tenant.branding?.logoUrl ?? null

  return (
    <>
      <div className="print:hidden h-full">
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
          logoUrl={logoUrl}
          productName={productName}
          currentUserId={session.user.id}
          canCreate={canCreateDeal(membership.role)}
          canSeeAll={canSeeAll}
          canArchive={canArchiveDeal(membership.role)}
          canDelete={canDeleteDeal(membership.role)}
          followUpReasons={followUpReasons}
        />
      </div>
      <PrintReport
        deals={serializedDeals}
        settings={intlSettings}
        productName={productName}
        logoUrl={logoUrl}
        filterSummary={filterSummary}
        equipmentLabels={equipmentLabels}
      />
    </>
  )
}
