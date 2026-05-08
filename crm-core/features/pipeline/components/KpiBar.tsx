import { formatCurrency } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"

interface KpiBarProps {
  totalPipeline: number
  totalWon: number
  settings: IntlSettings
}

export function KpiBar({ totalPipeline, totalWon, settings }: KpiBarProps) {
  return (
    <div className="flex gap-4">
      <div className="bg-card border rounded-lg px-4 py-2 min-w-[140px]">
        <p className="text-xs text-muted-foreground">Total Embudo</p>
        <p className="text-lg font-bold">{formatCurrency(totalPipeline, settings)}</p>
      </div>
      <div className="bg-card border rounded-lg px-4 py-2 min-w-[140px]">
        <p className="text-xs text-muted-foreground">Ganado</p>
        <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalWon, settings)}</p>
      </div>
    </div>
  )
}
