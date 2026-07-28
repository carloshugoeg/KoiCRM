import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { pipelineScopeFor } from "@/lib/permissions/resolve"
import { loadClientDetailPageData } from "@/features/clients/queries"
import { ClientProfile } from "@/features/clients/components/ClientProfile"
import type { IntlSettings } from "@/lib/intl/format"

interface Props {
  params: { tenantSlug: string; clientId: string }
}

export default async function ClientDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant, membership } = resolved
  const tenantId = tenant.id
  const tenantSlug = params.tenantSlug
  const canEdit = membership.role !== "VIEWER"

  // Sequenced ahead of loadClientDetailPageData's single transaction rather than alongside it,
  // so this route still opens its queries one at a time (matches the fan-out fix in 15889e3).
  const scope = await pipelineScopeFor(tenantId, membership.role, session.user.id)

  const {
    client: clientData,
    kpis,
    pipeline,
    members,
    channels,
    equipmentHierarchy,
    statuses,
    settings,
  } = await loadClientDetailPageData(tenantId, params.clientId, scope.visibleToUserId ?? undefined)

  if (!clientData) notFound()

  const intlSettings: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
    timezone: settings?.timezone ?? "America/Guatemala",
  }

  const memberList = members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    image: m.user.image,
  }))

  const stages = pipeline?.stages ?? []

  const dealsList = clientData.deals.map((d) => ({
    id: d.id,
    name: d.name,
    value: Number(d.value),
    stageKey: d.stage.key,
    stageLabel: d.stage.label,
    ownerName: d.owner.name,
    createdAt: d.createdAt,
  }))

  return (
    <div className="flex h-full overflow-hidden">
      <ClientProfile
        tenantId={tenantId}
        tenantSlug={tenantSlug}
        client={{
          id: clientData.id,
          name: clientData.name,
          company: clientData.company,
          phone: clientData.phone,
          whatsapp: clientData.whatsapp,
          email: clientData.email,
        }}
        deals={dealsList}
        kpis={kpis}
        stages={stages}
        members={memberList}
        channels={channels}
        equipmentHierarchy={equipmentHierarchy}
        statuses={statuses}
        settings={intlSettings}
        canEdit={canEdit}
      />
    </div>
  )
}
