import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDate } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"
import type { OpenOpportunity } from "@/features/reports/queries"

interface ReportsTableProps {
  deals: OpenOpportunity[]
  settings: IntlSettings
}

export function ReportsTable({ deals, settings }: ReportsTableProps) {
  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="text-left px-4 py-2 font-medium text-muted-foreground whitespace-nowrap">Fecha de creación</th>
            <th className="text-right px-4 py-2 font-medium text-muted-foreground whitespace-nowrap">Días abierta</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Oportunidad</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Cliente</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Asesor</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Etapa</th>
            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Valor</th>
          </tr>
        </thead>
        <tbody>
          {deals.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center py-12 text-muted-foreground">
                Sin oportunidades abiertas.
              </td>
            </tr>
          ) : (
            deals.map((d) => (
              <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {formatDate(d.createdAt, settings)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{d.daysOpen}</td>
                <td className="px-4 py-3 font-medium max-w-[220px] truncate">{d.name}</td>
                <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate">
                  {d.clientName ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{d.ownerName}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Badge variant="outline" className="text-xs">
                    {d.stageLabel}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                  {formatCurrency(d.value, settings)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
