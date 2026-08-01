import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { permissionsFor } from "@/lib/permissions/resolve"
import { getEquipoStats, getStatsFilterOptions } from "@/features/stats/queries"
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

// Everything here is already broken down by asesor — canal, categoría y estado are the useful cuts.
const EQUIPO_FILTERS: PanelFilterKey[] = ["channel", "category", "status"]

export default async function EquipoStatsPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant, membership } = resolved
  const tenantId = tenant.id

  const range = { from: parseDate(searchParams.from), to: parseDate(searchParams.to) }
  const dealsValues = readPanelFilters(searchParams, "dealsAsesor", EQUIPO_FILTERS)
  const valorValues = readPanelFilters(searchParams, "valorAsesor", EQUIPO_FILTERS)
  const detalleValues = readPanelFilters(searchParams, "detalleAsesor", EQUIPO_FILTERS)

  // permissionsFor and getStatsFilterOptions each open a tenant transaction — keep them
  // sequential so we never hold two open at once on a small connection pool.
  const [settings, perms] = await Promise.all([
    prisma.tenantSettings.findUnique({ where: { tenantId } }),
    permissionsFor(tenantId, membership.role, session.user.id),
  ])
  const options = await getStatsFilterOptions(tenantId)
  const canSeeTotals = perms["stats.viewTotals"]

  const [dealsTeam, valorTeam, detalleTeam] = await loadPanelData(
    [
      toStatsFilters(range, dealsValues),
      toStatsFilters(range, valorValues),
      toStatsFilters(range, detalleValues),
    ],
    (filters) => getEquipoStats(tenantId, filters),
  )

  const intl: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
  }
  const pieData = dealsTeam.map((r) => ({ label: r.ownerName, value: r.dealsCount }))
  const barData = valorTeam.map((r) => ({ label: r.ownerName, value: r.wonValue }))

  const headers = canSeeTotals
    ? ["Asesor", "Deals", "Ganados", "Perdidos", "Tasa cierre", "Valor total", "Valor ganado"]
    : ["Asesor", "Deals", "Ganados", "Perdidos", "Tasa cierre"]

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
      <div className={`grid gap-6 ${canSeeTotals ? "md:grid-cols-2" : ""}`}>
        <StatsPanel
          title="Deals por asesor"
          panelId="dealsAsesor"
          filterKeys={EQUIPO_FILTERS}
          options={options}
          values={dealsValues}
        >
          <PieChart data={pieData} />
        </StatsPanel>
        {canSeeTotals && (
          <StatsPanel
            title="Valor ganado por asesor"
            panelId="valorAsesor"
            filterKeys={EQUIPO_FILTERS}
            options={options}
            values={valorValues}
          >
            <BarChart data={barData} intl={intl} />
          </StatsPanel>
        )}
      </div>

      <StatsPanel
        title="Detalle por asesor"
        panelId="detalleAsesor"
        filterKeys={EQUIPO_FILTERS}
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
              {detalleTeam.length === 0 ? (
                <tr>
                  <td colSpan={headers.length} className="px-3 py-8 text-center text-xs text-muted-foreground">
                    Sin deals para este filtro
                  </td>
                </tr>
              ) : (
                detalleTeam.map((r) => (
                  <tr key={r.ownerId} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{r.ownerName}</td>
                    <td className="px-3 py-2">{r.dealsCount}</td>
                    <td className="px-3 py-2">{r.wonCount}</td>
                    <td className="px-3 py-2">{r.lostCount}</td>
                    <td className="px-3 py-2">{r.closingRate}%</td>
                    {canSeeTotals && (
                      <>
                        <td className="px-3 py-2">{formatCurrency(r.totalValue, intl)}</td>
                        <td className="px-3 py-2 font-medium text-green-600">{formatCurrency(r.wonValue, intl)}</td>
                      </>
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
