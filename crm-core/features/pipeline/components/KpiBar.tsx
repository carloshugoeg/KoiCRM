import { formatCurrency } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"

interface KpiBarProps {
  totalPipeline: number
  totalWon: number
  settings: IntlSettings
}

export function KpiBar({ totalPipeline, totalWon, settings }: KpiBarProps) {
  return (
    <div className="flex bg-white rounded-full border border-slate-200 shadow-sm px-6 py-2">
      <div className="flex flex-col items-center justify-center px-4">
        <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-0.5">
          Total Embudo
        </p>
        <p className="text-[15px] font-black text-[#0ea5e9]">
          {formatCurrency(totalPipeline, settings)}
        </p>
      </div>
      <div className="w-px bg-slate-200 mx-2 self-stretch my-1" />
      <div className="flex flex-col items-center justify-center px-4">
        <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-0.5">
          Ganado
        </p>
        <p className="text-[15px] font-black text-[#10b981]">
          {formatCurrency(totalWon, settings)}
        </p>
      </div>
    </div>
  )
}

