import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { getEmbudoStats } from "@/features/stats/queries"
import { prisma } from "@/lib/db/client"
import { formatCurrency, parseDate } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"
import { BarChart } from "@/components/charts/BarChart"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

export default async function EmbudoStatsPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant } = resolved
  const from = parseDate(searchParams.from)
  const to = parseDate(searchParams.to)

  const [stages, settings] = await Promise.all([
    getEmbudoStats(tenant.id, { from, to }),
    prisma.tenantSettings.findUnique({ where: { tenantId: tenant.id } }),
  ])

  const intl: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
  }
  const fmt = (n: number) => formatCurrency(n, intl)

  const chartData = stages.map((s) => ({ label: s.stageLabel, value: s.count, color: s.stageColor }))
  const valueData = stages.map((s) => ({ label: s.stageLabel, value: s.value, color: s.stageColor }))

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold mb-4">Deals por etapa</h2>
          <BarChart data={chartData} />
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold mb-4">Valor por etapa</h2>
          <BarChart data={valueData} formatter={fmt} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3">Detalle por etapa</h2>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {["Etapa", "Deals", "Valor"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stages.map((s) => (
                <tr key={s.stageId} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.stageColor }} />
                      {s.stageLabel}
                    </span>
                  </td>
                  <td className="px-3 py-2">{s.count}</td>
                  <td className="px-3 py-2">{fmt(s.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
