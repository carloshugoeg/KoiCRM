import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { listClients, getClientWithDeals, getClientKpis } from "@/features/clients/queries"
import { getDefaultPipeline } from "@/features/pipeline/queries"
import { withTenant } from "@/lib/db/rls"
import { getCatalogItems } from "@/features/catalogs/queries"
import { getTenantMembers } from "@/features/tenants/queries"
import { ClientSidebar } from "@/features/clients/components/ClientSidebar"
import { ClientProfile } from "@/features/clients/components/ClientProfile"
import { prisma } from "@/lib/db/client"
import type { IntlSettings } from "@/lib/intl/format"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

export default async function ClientsPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant, membership } = resolved
  const tenantId = tenant.id
  const tenantSlug = params.tenantSlug
  const canEdit = membership.role !== "VIEWER"

  const q = searchParams.q as string | undefined
  const sort = (searchParams.sort as "name" | "recent" | undefined) ?? "name"
  const selectedClientId = searchParams.client as string | undefined

  const [clients, pipeline, members, channels, equipment, statuses, settings] = await Promise.all([
    listClients(tenantId, { search: q, sort }),
    withTenant(tenantId, (tx) => getDefaultPipeline(tx, tenantId)),
    getTenantMembers(tenantId),
    getCatalogItems(tenantId, "salesChannel"),
    getCatalogItems(tenantId, "equipment"),
    getCatalogItems(tenantId, "dealStatus"),
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

  const stages = pipeline?.stages ?? []

  // Resolve selected client data
  let profileContent: React.ReactNode = (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      Selecciona un cliente para ver su perfil.
    </div>
  )

  if (selectedClientId) {
    const [clientData, kpis] = await Promise.all([
      getClientWithDeals(tenantId, selectedClientId),
      getClientKpis(tenantId, selectedClientId),
    ])

    if (clientData) {
      const dealsList = clientData.deals.map((d) => ({
        id: d.id,
        name: d.name,
        value: Number(d.value),
        stageKey: d.stage.key,
        stageLabel: d.stage.label,
        ownerName: d.owner.name,
        createdAt: d.createdAt,
      }))

      profileContent = (
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
          equipment={equipment}
          statuses={statuses}
          settings={intlSettings}
          canEdit={canEdit}
        />
      )
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      <ClientSidebar
        tenantSlug={tenantSlug}
        clients={clients}
        selectedClientId={selectedClientId}
      />
      {profileContent}
    </div>
  )
}
