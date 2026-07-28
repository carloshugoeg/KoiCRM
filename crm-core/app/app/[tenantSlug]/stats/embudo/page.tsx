import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { permissionsFor } from "@/lib/permissions/resolve"
import { getEmbudoStats, getStatsFilterOptions } from "@/features/stats/queries"
import { loadPanelData, readPanelFilters, toStatsFilters } from "@/features/stats/panel-filters"
import type { PanelFilterKey } from "@/features/stats/panel-filters"
import { StatsPanel } from "@/features/stats/components/StatsPanel"
import { prisma } from "@/lib/db/client"
import { formatCurrency, parseDate } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"
import { BarChart } from "@/components/charts/BarChart"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

// These panels break down by etapa, so asesor, canal, categoría and estado are all orthogonal.
const EMBUDO_FILTERS: PanelFilterKey[] = ["owner", "channel", "category", "status"]

export default async function EmbudoStatsPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant, membership } = resolved
  const tenantId = tenant.id

  const range = { from: parseDate(searchParams.from), to: parseDate(searchParams.to) }
  const conteoValues = readPanelFilters(searchParams, "etapas", EMBUDO_FILTERS)
  const valorValues = readPanelFilters(searchParams, "valorEtapa", EMBUDO_FILTERS)
  const detalleValues = readPanelFilters(searchParams, "detalleEtapa", EMBUDO_FILTERS)

  // permissionsFor and getStatsFilterOptions each open a tenant transaction — keep them
  // sequential so we never hold two open at once on a small connection pool.
  const [settings, perms] = await Promise.all([
    prisma.tenantSettings.findUnique({ where: { tenantId } }),
    permissionsFor(tenantId, membership.role, session.user.id),
  ])
  const options = await getStatsFilterOptions(tenantId)
  const canSeeTotals = perms["stats.viewTotals"]

  const [conteoStages, valorStages, detalleStages] = await loadPanelData(
    [
      toStatsFilters(range, conteoValues),
      toStatsFilters(range, valorValues),
      toStatsFilters(range, detalleValues),
    ],
    (filters) => getEmbudoStats(tenantId, filters),
  )

  const intl: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
  }
  const chartData = conteoStages.map((s) => ({ label: s.stageLabel, value: s.count, color: s.stageColor }))
  const valueData = valorStages.map((s) => ({ label: s.stageLabel, value: s.value, color: s.stageColor }))

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
      <div className={`grid gap-6 ${canSeeTotals ? "md:grid-cols-2" : ""}`}>
        <StatsPanel
          title="Deals por etapa"
          panelId="etapas"
          filterKeys={EMBUDO_FILTERS}
          options={options}
          values={conteoValues}
        >
          <BarChart data={chartData} />
        </StatsPanel>
        {canSeeTotals && (
          <StatsPanel
            title="Valor por etapa"
            panelId="valorEtapa"
            filterKeys={EMBUDO_FILTERS}
            options={options}
            values={valorValues}
          >
            <BarChart data={valueData} intl={intl} />
          </StatsPanel>
        )}
      </div>

      <StatsPanel
        title="Detalle por etapa"
        panelId="detalleEtapa"
        filterKeys={EMBUDO_FILTERS}
        options={options}
        values={detalleValues}
        variant="plain"
      >
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {(canSeeTotals ? ["Etapa", "Deals", "Valor"] : ["Etapa", "Deals"]).map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detalleStages.map((s) => (
                <tr key={s.stageId} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.stageColor }} />
                      {s.stageLabel}
                    </span>
                  </td>
                  <td className="px-3 py-2">{s.count}</td>
                  {canSeeTotals && <td className="px-3 py-2">{formatCurrency(s.value, intl)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </StatsPanel>
    </div>
  )
}
