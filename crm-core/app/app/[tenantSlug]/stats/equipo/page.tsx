import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { getEquipoStats } from "@/features/stats/queries"
import { prisma } from "@/lib/db/client"
import { formatCurrency, parseDate } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"
import { BarChart } from "@/components/charts/BarChart"
import { PieChart } from "@/components/charts/PieChart"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

export default async function EquipoStatsPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant } = resolved
  const from = parseDate(searchParams.from)
  const to = parseDate(searchParams.to)

  const [team, settings] = await Promise.all([
    getEquipoStats(tenant.id, { from, to }),
    prisma.tenantSettings.findUnique({ where: { tenantId: tenant.id } }),
  ])

  const intl: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
  }
  const fmt = (n: number) => formatCurrency(n, intl)

  const pieData = team.map((r) => ({ label: r.ownerName, value: r.dealsCount }))
  const barData = team.map((r) => ({ label: r.ownerName, value: r.wonValue }))

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold mb-4">Deals por asesor</h2>
          <PieChart data={pieData} />
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold mb-4">Valor ganado por asesor</h2>
          <BarChart data={barData} formatter={fmt} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3">Detalle por asesor</h2>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {["Asesor", "Deals", "Ganados", "Perdidos", "Tasa cierre", "Valor total", "Valor ganado"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {team.map((r) => (
                <tr key={r.ownerId} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{r.ownerName}</td>
                  <td className="px-3 py-2">{r.dealsCount}</td>
                  <td className="px-3 py-2">{r.wonCount}</td>
                  <td className="px-3 py-2">{r.lostCount}</td>
                  <td className="px-3 py-2">{r.closingRate}%</td>
                  <td className="px-3 py-2">{fmt(r.totalValue)}</td>
                  <td className="px-3 py-2 font-medium text-green-600">{fmt(r.wonValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
