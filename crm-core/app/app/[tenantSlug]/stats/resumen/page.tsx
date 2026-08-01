import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { permissionsFor } from "@/lib/permissions/resolve"
import { getResumenStats, getStatsFilterOptions } from "@/features/stats/queries"
import { loadPanelData, readPanelFilters, toStatsFilters } from "@/features/stats/panel-filters"
import type { PanelFilterKey } from "@/features/stats/panel-filters"
import { StatsPanel } from "@/features/stats/components/StatsPanel"
import { prisma } from "@/lib/db/client"
import { formatCurrency, parseDate } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

// KPIs summarise the whole tenant, so every dimension is a valid slice.
const KPI_FILTERS: PanelFilterKey[] = ["owner", "channel", "category", "status"]
// The ranking is already broken down by asesor — filtering by asesor would collapse it.
const TOP_FILTERS: PanelFilterKey[] = ["channel", "category", "status"]

export default async function ResumenPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant, membership } = resolved
  const tenantId = tenant.id

  const range = { from: parseDate(searchParams.from), to: parseDate(searchParams.to) }
  const kpiValues = readPanelFilters(searchParams, "kpis", KPI_FILTERS)
  const topValues = readPanelFilters(searchParams, "top", TOP_FILTERS)

  // permissionsFor and getStatsFilterOptions each open a tenant transaction — keep them
  // sequential so we never hold two open at once on a small connection pool.
  const [settings, perms] = await Promise.all([
    prisma.tenantSettings.findUnique({ where: { tenantId } }),
    permissionsFor(tenantId, membership.role, session.user.id),
  ])
  const options = await getStatsFilterOptions(tenantId)
  const canSeeTotals = perms["stats.viewTotals"]

  const [kpiStats, topStats] = await loadPanelData(
    [toStatsFilters(range, kpiValues), toStatsFilters(range, topValues)],
    (filters) => getResumenStats(tenantId, filters),
  )

  const intl: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
  }

  const fmt = (n: number) => formatCurrency(n, intl)

  // Without stats.viewTotals the money KPIs give way to their count equivalents.
  const kpis = canSeeTotals
    ? [
        { label: "Total Embudo", value: fmt(kpiStats.totalEmbudo) },
        { label: "Ganado", value: fmt(kpiStats.ganado) },
        { label: "Perdido", value: fmt(kpiStats.perdido) },
        { label: "Tasa de cierre", value: `${kpiStats.tasaCierre}%` },
        { label: "Ticket promedio", value: fmt(kpiStats.ticketPromedio) },
      ]
    : [
        { label: "Deals en proceso", value: String(kpiStats.abiertosCount) },
        { label: "Deals ganados", value: String(kpiStats.ganadosCount) },
        { label: "Deals perdidos", value: String(kpiStats.perdidosCount) },
        { label: "Tasa de cierre", value: `${kpiStats.tasaCierre}%` },
        { label: "Total de deals", value: String(kpiStats.dealsCount) },
      ]

  const topColumns = canSeeTotals ? 7 : 6

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
      <StatsPanel
        title="Indicadores"
        panelId="kpis"
        filterKeys={KPI_FILTERS}
        options={options}
        values={kpiValues}
        variant="plain"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
              <p className="text-lg font-bold">{k.value}</p>
            </div>
          ))}
        </div>
      </StatsPanel>

      <StatsPanel
        title="Top Asesores"
        panelId="top"
        filterKeys={TOP_FILTERS}
        options={options}
        values={topValues}
        variant="plain"
      >
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Asesor</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Deals creados</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Deals en proceso</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Deals ganados</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Deals perdidos</th>
                {canSeeTotals && (
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Valor ganado</th>
                )}
              </tr>
            </thead>
            <tbody>
              {topStats.topPerformers.length === 0 ? (
                <tr>
                  <td colSpan={topColumns} className="px-3 py-8 text-center text-xs text-muted-foreground">
                    Sin asesores con deals ganados en este filtro
                  </td>
                </tr>
              ) : (
                topStats.topPerformers.map((p, i) => (
                  <tr key={p.ownerId} className="border-b last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{p.ownerName}</td>
                    <td className="px-3 py-2 text-right">{p.dealsCount}</td>
                    <td className="px-3 py-2 text-right">{p.openCount}</td>
                    <td className="px-3 py-2 text-right">{p.wonCount}</td>
                    <td className="px-3 py-2 text-right">{p.lostCount}</td>
                    {canSeeTotals && <td className="px-3 py-2 text-right">{fmt(p.wonValue)}</td>}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </StatsPanel>
    </div>
  )
}
