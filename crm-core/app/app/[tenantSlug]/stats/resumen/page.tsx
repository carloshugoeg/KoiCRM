import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { getResumenStats } from "@/features/stats/queries"
import { prisma } from "@/lib/db/client"
import { formatCurrency, parseDate } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

export default async function ResumenPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant } = resolved
  const tenantId = tenant.id

  const from = parseDate(searchParams.from)
  const to = parseDate(searchParams.to)

  const [stats, settings] = await Promise.all([
    getResumenStats(tenantId, { from, to }),
    prisma.tenantSettings.findUnique({ where: { tenantId } }),
  ])

  const intl: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
  }

  const fmt = (n: number) => formatCurrency(n, intl)

  const kpis = [
    { label: "Total Embudo", value: fmt(stats.totalEmbudo) },
    { label: "Ganado", value: fmt(stats.ganado) },
    { label: "Perdido", value: fmt(stats.perdido) },
    { label: "Tasa de cierre", value: `${stats.tasaCierre}%` },
    { label: "Ticket promedio", value: fmt(stats.ticketPromedio) },
  ]

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
            <p className="text-lg font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      {stats.topPerformers.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Top Asesores</h2>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Asesor</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Deals ganados</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Valor ganado</th>
                </tr>
              </thead>
              <tbody>
                {stats.topPerformers.map((p, i) => (
                  <tr key={p.ownerId} className="border-b last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{p.ownerName}</td>
                    <td className="px-3 py-2 text-right">{p.wonCount}</td>
                    <td className="px-3 py-2 text-right">{fmt(p.wonValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
