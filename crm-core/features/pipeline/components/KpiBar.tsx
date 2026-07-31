import { formatCurrency } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"

interface KpiBarProps {
  totalPipeline: number
  totalWon: number
  settings: IntlSettings
}

export function KpiBar({ totalPipeline, totalWon, settings }: KpiBarProps) {
  return (
    // Short viewports (the funnel's landscape-tablet tier) tighten padding here — this and
    // the filter row are the two chrome elements that otherwise eat the most height.
    <div className="flex bg-white dark:bg-card rounded-full border border-slate-200 dark:border-border shadow-sm px-6 py-2 short:px-3 short:py-1">
      <div className="flex flex-col items-center justify-center px-4 short:px-2">
        <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-muted-foreground mb-0.5 short:mb-0">
          Total Embudo
        </p>
        <p className="text-[15px] font-black text-[#0ea5e9]">
          {formatCurrency(totalPipeline, settings)}
        </p>
      </div>
      <div className="w-px bg-slate-200 dark:bg-border mx-2 self-stretch my-1" />
      <div className="flex flex-col items-center justify-center px-4 short:px-2">
        <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-muted-foreground mb-0.5 short:mb-0">
          Ganado
        </p>
        <p className="text-[15px] font-black text-[#10b981]">
          {formatCurrency(totalWon, settings)}
        </p>
      </div>
    </div>
  )
}

