import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { canSeeAllDeals } from "@/lib/auth/rbac"
import { permissionsFor } from "@/lib/permissions/resolve"
import { getPipelineDeals } from "@/features/deals/queries"
import { getStatsFilterOptions } from "@/features/stats/queries"
import { readPanelFilters } from "@/features/stats/panel-filters"
import type { PanelFilterKey } from "@/features/stats/panel-filters"
import { StatsPanel } from "@/features/stats/components/StatsPanel"
import { prisma } from "@/lib/db/client"
import { formatCurrency, parseDate } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

// A flat list of deals: every dimension narrows it meaningfully.
const LISTADO_FILTERS: PanelFilterKey[] = ["owner", "channel", "category", "status"]

export default async function ListadoPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant, membership } = resolved
  const tenantId = tenant.id
  const canSeeAll = canSeeAllDeals(membership.role)

  const from = parseDate(searchParams.from)
  const to = parseDate(searchParams.to)
  const values = readPanelFilters(searchParams, "listado", LISTADO_FILTERS)

  // permissionsFor and getStatsFilterOptions each open a tenant transaction — keep them
  // sequential so we never hold two open at once on a small connection pool.
  const [settings, perms] = await Promise.all([
    prisma.tenantSettings.findUnique({ where: { tenantId } }),
    permissionsFor(tenantId, membership.role, session.user.id),
  ])
  const options = await getStatsFilterOptions(tenantId)
  const canSeeTotals = perms["stats.viewTotals"]

  const rows = await getPipelineDeals(tenantId, {
    from,
    to,
    ownerId: values.owner,
    channelKey: values.channel,
    equipmentCategoryKey: values.category,
    visibleToUserId: canSeeAll ? undefined : session.user.id,
  })
  // Estado lives on the deal itself and isn't part of PipelineFilters, so it is applied here.
  const deals = values.status ? rows.filter((d) => d.statusKey === values.status) : rows

  const intl: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
  }
  const fmt = (n: number) => formatCurrency(n, intl)

  const headers = canSeeTotals
    ? ["ID", "Nombre", "Empresa", "Asesor", "Etapa", "Canal", "Valor", "Fecha"]
    : ["ID", "Nombre", "Empresa", "Asesor", "Etapa", "Canal", "Fecha"]

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <StatsPanel
        title="Listado de deals"
        panelId="listado"
        filterKeys={LISTADO_FILTERS}
        options={options}
        values={values}
        variant="plain"
        aside={<span className="text-xs text-muted-foreground">{deals.length} registros</span>}
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
              {deals.length === 0 ? (
                <tr>
                  <td colSpan={headers.length} className="px-3 py-8 text-center text-xs text-muted-foreground">
                    Sin deals para este filtro
                  </td>
                </tr>
              ) : (
                deals.map((d) => (
                  <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-mono text-xs">{d.id}</td>
                    <td className="px-3 py-2 font-medium max-w-[160px] truncate">{d.name}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{d.company ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{d.owner?.name ?? d.owner?.email ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: d.stage.color + "22", color: d.stage.color }}>
                        {d.stage.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">{d.channelKey}</td>
                    {canSeeTotals && (
                      <td className="px-3 py-2 text-right font-medium">{fmt(Number(d.value))}</td>
                    )}
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {new Date(d.createdAt).toLocaleDateString(intl.locale)}
                    </td>
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
