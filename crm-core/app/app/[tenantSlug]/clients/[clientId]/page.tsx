import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { getClientWithDeals, getClientKpis } from "@/features/clients/queries"
import { getDefaultPipeline } from "@/features/pipeline/queries"
import { withTenant } from "@/lib/db/rls"
import { getCatalogItems, getEquipmentHierarchy } from "@/features/catalogs/queries"
import { getTenantMembers } from "@/features/tenants/queries"
import { ClientProfile } from "@/features/clients/components/ClientProfile"
import { prisma } from "@/lib/db/client"
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

  const [clientData, kpis, pipeline, members, channels, equipmentHierarchy, statuses, settings] =
    await Promise.all([
      getClientWithDeals(tenantId, params.clientId),
      getClientKpis(tenantId, params.clientId),
      withTenant(tenantId, (tx) => getDefaultPipeline(tx, tenantId)),
      getTenantMembers(tenantId),
      getCatalogItems(tenantId, "salesChannel", { activeOnly: true }),
      getEquipmentHierarchy(tenantId, { activeOnly: true }),
      getCatalogItems(tenantId, "dealStatus", { activeOnly: true }),
      prisma.tenantSettings.findUnique({ where: { tenantId } }),
    ])

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
