import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { getPipelineDeals } from "@/features/deals/queries"
import { prisma } from "@/lib/db/client"
import { formatCurrency, parseDate } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"

interface Props {
  params: { tenantSlug: string }
  searchParams: Record<string, string | string[] | undefined>
}

export default async function ListadoPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant } = resolved
  const tenantId = tenant.id

  const from = parseDate(searchParams.from)
  const to = parseDate(searchParams.to)

  const [deals, settings] = await Promise.all([
    getPipelineDeals(tenantId, { from, to }),
    prisma.tenantSettings.findUnique({ where: { tenantId } }),
  ])

  const intl: IntlSettings = {
    locale: settings?.locale ?? "es-GT",
    currency: settings?.currency ?? "GTQ",
  }
  const fmt = (n: number) => formatCurrency(n, intl)

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">Listado de deals</h2>
        <span className="text-xs text-muted-foreground">{deals.length} registros</span>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {["ID", "Nombre", "Empresa", "Asesor", "Etapa", "Canal", "Valor", "Fecha"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deals.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-xs text-muted-foreground">Sin deals en este rango</td>
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
                  <td className="px-3 py-2 text-right font-medium">{fmt(Number(d.value))}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {new Date(d.createdAt).toLocaleDateString(intl.locale)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
