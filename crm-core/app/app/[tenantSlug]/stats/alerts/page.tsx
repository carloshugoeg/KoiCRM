import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { getFollowUpAlerts, type FollowUpAlert } from "@/features/follow-ups/queries"
import { parseDate } from "@/lib/intl/format"
import { getStatsFilterOptions } from "@/features/stats/queries"
import { readPanelFilters } from "@/features/stats/panel-filters"
import type {
  PanelFilterKey,
  PanelFilterValues,
  StatsFilterOptions,
} from "@/features/stats/panel-filters"
import { PanelFilters } from "@/features/stats/components/PanelFilters"
import { Badge } from "@/components/ui/badge"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

// Follow-ups only carry an owner dimension, so asesor is the one meaningful cut per section.
const ALERT_FILTERS: PanelFilterKey[] = ["owner"]

function AlertRow({ fu }: { fu: FollowUpAlert }) {
  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{fu.deal.name}</p>
        {fu.deal.company && <p className="text-xs text-muted-foreground">{fu.deal.company}</p>}
        {fu.note && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{fu.note}</p>}
      </div>
      <Badge variant="secondary" className="text-xs shrink-0">{fu.deal.stage.label}</Badge>
      <span className="text-xs text-muted-foreground shrink-0">
        {new Date(fu.date).toLocaleDateString("es-GT")}
      </span>
    </div>
  )
}

function AlertSection({
  title, count, items, emptyText, countClass, panelId, options, values,
}: {
  title: string; count: number; items: FollowUpAlert[]
  emptyText: string; countClass: string
  panelId: string; options: StatsFilterOptions; values: PanelFilterValues
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${countClass}`}>{count}</span>
        </div>
        <PanelFilters panelId={panelId} keys={ALERT_FILTERS} options={options} values={values} />
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {items.map((fu) => (
            <AlertRow key={fu.id} fu={fu} />
          ))}
        </div>
      )}
    </section>
  )
}

export default async function AlertsPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant } = resolved
  const tenantId = tenant.id
  const from = parseDate(searchParams.from)
  const to = parseDate(searchParams.to)

  const vencidosValues = readPanelFilters(searchParams, "vencidos", ALERT_FILTERS)
  const hoyValues = readPanelFilters(searchParams, "hoy", ALERT_FILTERS)
  const proximosValues = readPanelFilters(searchParams, "proximos", ALERT_FILTERS)

  const options = await getStatsFilterOptions(tenantId)

  // Sections that share an asesor filter share a single round trip.
  const cache = new Map<string, Awaited<ReturnType<typeof getFollowUpAlerts>>>()
  async function alertsFor(ownerId?: string) {
    const key = ownerId ?? ""
    if (!cache.has(key)) cache.set(key, await getFollowUpAlerts(tenantId, ownerId, { from, to }))
    return cache.get(key)!
  }

  const vencidos = await alertsFor(vencidosValues.owner)
  const hoy = await alertsFor(hoyValues.owner)
  const proximos = await alertsFor(proximosValues.owner)

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      <div className="mb-6">
        <h1 className="text-lg font-bold">Alertas de seguimiento</h1>
        <p className="text-sm text-muted-foreground">Seguimientos vencidos, para hoy y próximos 7 días</p>
      </div>
      <div className="space-y-8">
        <AlertSection title="Vencidos" count={vencidos.overdue.length} items={vencidos.overdue}
          emptyText="No hay seguimientos vencidos." countClass="bg-red-100 text-red-700"
          panelId="vencidos" options={options} values={vencidosValues} />
        <AlertSection title="Para hoy" count={hoy.today.length} items={hoy.today}
          emptyText="No hay seguimientos programados para hoy." countClass="bg-orange-100 text-orange-700"
          panelId="hoy" options={options} values={hoyValues} />
        <AlertSection title="Próximos 7 días" count={proximos.next7.length} items={proximos.next7}
          emptyText="No hay seguimientos en los próximos 7 días." countClass="bg-blue-100 text-blue-700"
          panelId="proximos" options={options} values={proximosValues} />
      </div>
    </div>
  )
}
