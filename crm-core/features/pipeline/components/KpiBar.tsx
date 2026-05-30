import { formatCurrency } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"

interface KpiBarProps {
  totalPipeline: number
  totalWon: number
  settings: IntlSettings
}

export function KpiBar({ totalPipeline, totalWon, settings }: KpiBarProps) {
  return (
    <div className="flex gap-3">
      <div
        className="rounded-xl px-4 py-2.5 min-w-[140px]"
        style={{
          background: "var(--kpi-card-bg)",
          border: "1px solid var(--kpi-card-border)",
        }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
          Total Embudo
        </p>
        <p className="text-lg font-black" style={{ color: "#38bdf8" }}>
          {formatCurrency(totalPipeline, settings)}
        </p>
      </div>
      <div
        className="rounded-xl px-4 py-2.5 min-w-[140px]"
        style={{
          background: "var(--kpi-card-bg)",
          border: "1px solid var(--kpi-card-border)",
        }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
          Ganado
        </p>
        <p className="text-lg font-black" style={{ color: "#34d399" }}>
          {formatCurrency(totalWon, settings)}
        </p>
      </div>
    </div>
  )
}
