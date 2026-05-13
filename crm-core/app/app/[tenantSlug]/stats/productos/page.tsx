import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { getProductosStats } from "@/features/stats/queries"
import { prisma } from "@/lib/db/client"
import { formatCurrency } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"
import { BarChart } from "@/components/charts/BarChart"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

export default async function ProductosStatsPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant } = resolved
  const from = searchParams.from ? new Date(searchParams.from as string) : undefined
  const to = searchParams.to ? new Date(searchParams.to as string) : undefined

  const [products, settings] = await Promise.all([
    getProductosStats(tenant.id, { from, to }),
    prisma.tenantSettings.findUnique({ where: { tenantId: tenant.id } }),
  ])

  const intl: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
  }
  const fmt = (n: number) => formatCurrency(n, intl)

  const barData = products.map((p) => ({
    label: p.equipmentLabel,
    value: p.demandCount + p.soldCount,
  }))

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
      <div className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold mb-4">Demanda por producto</h2>
        <BarChart data={barData} />
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3">Detalle por producto</h2>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {["Producto", "Demanda", "Vendidos", "Valor pendiente", "Valor vendido"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-xs text-muted-foreground">Sin productos en este rango</td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.equipmentKey} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{p.equipmentLabel}</td>
                    <td className="px-3 py-2">{p.demandCount}</td>
                    <td className="px-3 py-2">{p.soldCount}</td>
                    <td className="px-3 py-2">{fmt(p.pendingValue)}</td>
                    <td className="px-3 py-2 font-medium text-green-600">{fmt(p.soldValue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
