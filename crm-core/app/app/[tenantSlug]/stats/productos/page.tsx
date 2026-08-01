import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { permissionsFor } from "@/lib/permissions/resolve"
import { getProductosStats, getStatsFilterOptions } from "@/features/stats/queries"
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

// Rows are subcategorías, so the categoría filter narrows the taxonomy instead of duplicating it.
const PRODUCTOS_FILTERS: PanelFilterKey[] = ["owner", "channel", "category", "status"]

export default async function ProductosStatsPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant, membership } = resolved
  const tenantId = tenant.id

  const range = { from: parseDate(searchParams.from), to: parseDate(searchParams.to) }
  const demandaValues = readPanelFilters(searchParams, "demanda", PRODUCTOS_FILTERS)
  const detalleValues = readPanelFilters(searchParams, "detalleProducto", PRODUCTOS_FILTERS)

  // permissionsFor and getStatsFilterOptions each open a tenant transaction — keep them
  // sequential so we never hold two open at once on a small connection pool.
  const [settings, perms] = await Promise.all([
    prisma.tenantSettings.findUnique({ where: { tenantId } }),
    permissionsFor(tenantId, membership.role, session.user.id),
  ])
  const options = await getStatsFilterOptions(tenantId)
  const canSeeTotals = perms["stats.viewTotals"]

  const [demandaProducts, detalleProducts] = await loadPanelData(
    [toStatsFilters(range, demandaValues), toStatsFilters(range, detalleValues)],
    (filters) => getProductosStats(tenantId, filters),
  )

  const intl: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
  }
  const fmt = (n: number) => formatCurrency(n, intl)

  const barData = demandaProducts.map((p) => ({
    label: p.equipmentLabel,
    value: p.demandCount + p.soldCount,
  }))

  const headers = canSeeTotals
    ? ["Producto", "Demanda", "Vendidos", "Valor pendiente", "Valor vendido"]
    : ["Producto", "Demanda", "Vendidos"]

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
      <StatsPanel
        title="Demanda por producto"
        panelId="demanda"
        filterKeys={PRODUCTOS_FILTERS}
        options={options}
        values={demandaValues}
      >
        <BarChart data={barData} />
      </StatsPanel>

      <StatsPanel
        title="Detalle por producto"
        panelId="detalleProducto"
        filterKeys={PRODUCTOS_FILTERS}
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
              {detalleProducts.length === 0 ? (
                <tr>
                  <td colSpan={headers.length} className="px-3 py-8 text-center text-xs text-muted-foreground">
                    Sin productos para este filtro
                  </td>
                </tr>
              ) : (
                detalleProducts.map((p) => (
                  <tr key={p.equipmentKey} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{p.equipmentLabel}</td>
                    <td className="px-3 py-2">{p.demandCount}</td>
                    <td className="px-3 py-2">{p.soldCount}</td>
                    {canSeeTotals && (
                      <>
                        <td className="px-3 py-2">{fmt(p.pendingValue)}</td>
                        <td className="px-3 py-2 font-medium text-green-600">{fmt(p.soldValue)}</td>
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
