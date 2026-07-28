import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { permissionsFor } from "@/lib/permissions/resolve"
import { getCanalStats, getStatsFilterOptions } from "@/features/stats/queries"
import { loadPanelData, readPanelFilters, toStatsFilters } from "@/features/stats/panel-filters"
import type { PanelFilterKey } from "@/features/stats/panel-filters"
import { StatsPanel } from "@/features/stats/components/StatsPanel"
import { prisma } from "@/lib/db/client"
import { formatCurrency, parseDate } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"
import { BarChart } from "@/components/charts/BarChart"
import { PieChart } from "@/components/charts/PieChart"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

// Canal is the panel's own axis, so the useful cuts are asesor, categoría de equipo y estado.
const CANAL_FILTERS: PanelFilterKey[] = ["owner", "category", "status"]

export default async function CanalStatsPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant, membership } = resolved
  const tenantId = tenant.id

  const range = { from: parseDate(searchParams.from), to: parseDate(searchParams.to) }
  const dealsValues = readPanelFilters(searchParams, "dealsCanal", CANAL_FILTERS)
  const valorValues = readPanelFilters(searchParams, "valorCanal", CANAL_FILTERS)
  const detalleValues = readPanelFilters(searchParams, "detalleCanal", CANAL_FILTERS)

  // permissionsFor and getStatsFilterOptions each open a tenant transaction — keep them
  // sequential so we never hold two open at once on a small connection pool.
  const [settings, perms] = await Promise.all([
    prisma.tenantSettings.findUnique({ where: { tenantId } }),
    permissionsFor(tenantId, membership.role, session.user.id),
  ])
  const options = await getStatsFilterOptions(tenantId)
  const canSeeTotals = perms["stats.viewTotals"]

  const [dealsChannels, valorChannels, detalleChannels] = await loadPanelData(
    [
      toStatsFilters(range, dealsValues),
      toStatsFilters(range, valorValues),
      toStatsFilters(range, detalleValues),
    ],
    (filters) => getCanalStats(tenantId, filters),
  )

  const intl: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
  }
  const pieData = dealsChannels.map((c) => ({ label: c.channelLabel, value: c.dealsCount }))
  const barData = valorChannels.map((c) => ({ label: c.channelLabel, value: c.totalValue }))

  const headers = canSeeTotals
    ? ["Canal", "Deals", "Valor total", "Ganados", "Valor ganado"]
    : ["Canal", "Deals", "Ganados"]

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
      <div className={`grid gap-6 ${canSeeTotals ? "md:grid-cols-2" : ""}`}>
        <StatsPanel
          title="Deals por canal"
          panelId="dealsCanal"
          filterKeys={CANAL_FILTERS}
          options={options}
          values={dealsValues}
        >
          <PieChart data={pieData} />
        </StatsPanel>
        {canSeeTotals && (
          <StatsPanel
            title="Valor por canal"
            panelId="valorCanal"
            filterKeys={CANAL_FILTERS}
            options={options}
            values={valorValues}
          >
            <BarChart data={barData} intl={intl} />
          </StatsPanel>
        )}
      </div>

      <StatsPanel
        title="Detalle por canal"
        panelId="detalleCanal"
        filterKeys={CANAL_FILTERS}
        options={options}
        values={detalleValues}
        variant="plain"
      >
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {headers.map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detalleChannels.length === 0 ? (
                <tr>
                  <td colSpan={headers.length} className="px-3 py-8 text-center text-xs text-muted-foreground">
                    Sin deals para este filtro
                  </td>
                </tr>
              ) : (
                detalleChannels.map((c) => (
                  <tr key={c.channelKey} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{c.channelLabel}</td>
                    <td className="px-3 py-2">{c.dealsCount}</td>
                    {canSeeTotals && <td className="px-3 py-2">{formatCurrency(c.totalValue, intl)}</td>}
                    <td className="px-3 py-2">{c.wonCount}</td>
                    {canSeeTotals && (
                      <td className="px-3 py-2 font-medium text-green-600">{formatCurrency(c.wonValue, intl)}</td>
                    )}
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
