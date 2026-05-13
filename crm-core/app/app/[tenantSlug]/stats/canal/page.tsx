import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { getCanalStats } from "@/features/stats/queries"
import { prisma } from "@/lib/db/client"
import { formatCurrency } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"
import { BarChart } from "@/components/charts/BarChart"
import { PieChart } from "@/components/charts/PieChart"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

export default async function CanalStatsPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant } = resolved
  const from = searchParams.from ? new Date(searchParams.from as string) : undefined
  const to = searchParams.to ? new Date(searchParams.to as string) : undefined

  const [channels, settings] = await Promise.all([
    getCanalStats(tenant.id, { from, to }),
    prisma.tenantSettings.findUnique({ where: { tenantId: tenant.id } }),
  ])

  const intl: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
  }
  const fmt = (n: number) => formatCurrency(n, intl)

  const pieData = channels.map((c) => ({ label: c.channelLabel, value: c.dealsCount }))
  const barData = channels.map((c) => ({ label: c.channelLabel, value: c.totalValue }))

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold mb-4">Deals por canal</h2>
          <PieChart data={pieData} />
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold mb-4">Valor por canal</h2>
          <BarChart data={barData} formatter={fmt} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3">Detalle por canal</h2>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {["Canal", "Deals", "Valor total", "Ganados", "Valor ganado"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.channelKey} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{c.channelLabel}</td>
                  <td className="px-3 py-2">{c.dealsCount}</td>
                  <td className="px-3 py-2">{fmt(c.totalValue)}</td>
                  <td className="px-3 py-2">{c.wonCount}</td>
                  <td className="px-3 py-2 font-medium text-green-600">{fmt(c.wonValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
