import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { getArchivedDeals } from "@/features/deals/queries"
import { getDefaultPipeline } from "@/features/pipeline/queries"
import { withTenant } from "@/lib/db/rls"
import { getCatalogItems } from "@/features/catalogs/queries"
import { ArchiveTable } from "@/features/deals/components/ArchiveTable"
import { prisma } from "@/lib/db/client"
import type { IntlSettings } from "@/lib/intl/format"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

export default async function ArchivePage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant } = resolved
  const tenantId = tenant.id
  const tenantSlug = params.tenantSlug

  const cursor = searchParams.cursor as string | undefined

  const [{ deals, nextCursor }, pipeline, followUpReasons, settings] = await Promise.all([
    getArchivedDeals(tenantId, cursor, 10),
    withTenant(tenantId, (tx) => getDefaultPipeline(tx, tenantId)),
    getCatalogItems(tenantId, "followupReason"),
    prisma.tenantSettings.findUnique({ where: { tenantId } }),
  ])

  const intlSettings: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
    timezone: settings?.timezone ?? "America/Guatemala",
  }

  const serializedDeals = deals.map((d) => ({
    id: d.id,
    name: d.name,
    company: d.company,
    phone: d.client?.phone ?? null,
    whatsapp: d.client?.whatsapp ?? null,
    email: d.client?.email ?? null,
    value: Number(d.value),
    stageLabel: d.stage.label,
    stageKey: d.stage.key,
    stageId: d.stageId,
    statusKey: d.statusKey,
    ownerName: d.owner.name,
    ownerId: d.ownerId,
    equipment: [] as { equipmentKey: string; customLabel: string | null }[],
    createdAt: d.createdAt.toISOString(),
    stageEnteredAt: d.stageEnteredAt.toISOString(),
    quoteCount: 0,
    paymentCount: 0,
  }))

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b">
        <h1 className="text-lg font-bold">Archivo</h1>
        <p className="text-sm text-muted-foreground">Oportunidades archivadas</p>
      </div>
      <ArchiveTable
        tenantId={tenantId}
        tenantSlug={tenantSlug}
        deals={serializedDeals}
        nextCursor={nextCursor}
        hasPrev={!!cursor}
        stages={pipeline?.stages ?? []}
        followUpReasons={followUpReasons}
        settings={intlSettings}
      />
    </div>
  )
}
