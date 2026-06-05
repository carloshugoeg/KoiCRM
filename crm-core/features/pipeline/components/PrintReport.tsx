import { Fragment } from "react"
import { formatCurrency } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"

export interface PrintDeal {
  id: string
  name: string
  company: string | null
  phone: string | null
  email: string | null
  ownerName: string | null
  channelKey: string
  channelLabel: string
  stageKey: string
  stageLabel: string
  stageColor: string
  value: number
  createdAt: string | Date
  stageEnteredAt: string | Date
  equipment: { equipmentKey: string; customLabel: string | null }[]
  hasQuoteAlert: boolean
  hasPaymentAlert: boolean
  hasOverdueFollowUp: boolean
  quoteCount: number
  paymentCount: number
  latestQuoteNumber: string | null
  latestPaymentNumber: string | null
  latestNote: string | null
}

interface PrintReportProps {
  deals: PrintDeal[]
  settings: IntlSettings
  productName: string
  logoUrl?: string | null
  filterSummary?: string | null
  equipmentLabels: Record<string, string>
}

function diffDays(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

function equipmentChipLabel(
  key: string,
  customLabel: string | null,
  labels: Record<string, string>,
): string {
  if (key === "__custom__") return customLabel ?? "Otro"
  return labels[key] ?? key
}

export function PrintReport({
  deals,
  settings,
  productName,
  logoUrl,
  filterSummary,
  equipmentLabels,
}: PrintReportProps) {
  const now = new Date()
  const dateStr = now.toLocaleDateString(settings.locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const sorted = [...deals].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return (
    <div className="hidden print:block font-sans text-black bg-white p-8 text-sm">
      <div className="flex justify-between items-center pb-6 mb-6 border-b-2 border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            Reporte de Oportunidades
          </h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">{dateStr}</p>
          {filterSummary && (
            <p className="text-xs text-slate-500 mt-2">Filtros: {filterSummary}</p>
          )}
        </div>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-12 object-contain" />
        ) : (
          <div className="text-right">
            <p className="font-black text-xl text-slate-800">{productName}</p>
          </div>
        )}
      </div>

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-100/80">
            <th className="px-4 py-3 font-bold text-slate-700 text-xs border-b-2 border-slate-300 w-[22%]">
              Cliente
            </th>
            <th className="px-4 py-3 font-bold text-slate-700 text-xs border-b-2 border-slate-300">
              Etapa actual
            </th>
            <th className="px-4 py-3 font-bold text-slate-700 text-xs border-b-2 border-slate-300 text-center">
              Alertas
            </th>
            <th className="px-4 py-3 font-bold text-slate-700 text-xs border-b-2 border-slate-300 text-center">
              Días en etapa
            </th>
            <th className="px-4 py-3 font-bold text-slate-700 text-xs border-b-2 border-slate-300 text-center">
              Días totales
            </th>
            <th className="px-4 py-3 font-bold text-slate-700 text-xs border-b-2 border-slate-300">
              Equipo
            </th>
            <th className="px-4 py-3 font-bold text-slate-700 text-xs border-b-2 border-slate-300 text-right">
              Valor estimado
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((d, i) => {
            const created = new Date(d.createdAt)
            const stageEntered = new Date(d.stageEnteredAt)
            const daysTotal = diffDays(created, now)
            const daysStage = diffDays(stageEntered, now)
            const bg = i % 2 === 1 ? "bg-slate-50/60" : ""
            const eqItems = d.equipment.filter((e) => e.equipmentKey !== "__custom__")
            const customEq = d.equipment.find((e) => e.equipmentKey === "__custom__")

            return (
              <Fragment key={d.id}>
                <tr className={bg}>
                  <td className="px-4 py-3 align-top">
                    <div className="font-bold text-slate-800">{d.name}</div>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {d.company && (
                        <span className="text-xs text-slate-500 font-medium">{d.company}</span>
                      )}
                      <span className="text-[10px] font-mono text-slate-400 font-bold">{d.id}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className="font-semibold text-xs px-2 py-1 rounded inline-block"
                      style={{
                        background: `${d.stageColor}18`,
                        color: d.stageColor,
                      }}
                    >
                      {d.stageLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-center text-[10px] font-semibold">
                    <div className="flex flex-col gap-0.5 items-center">
                      {d.hasQuoteAlert && <span className="text-amber-700">Sin Cotiz.</span>}
                      {d.hasPaymentAlert && <span className="text-red-700">Sin Pago</span>}
                      {d.hasOverdueFollowUp && <span className="text-purple-700">Seguim. vencido</span>}
                      {!d.hasQuoteAlert && !d.hasPaymentAlert && !d.hasOverdueFollowUp && (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums text-slate-600 font-medium align-top">
                    {daysStage}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums text-slate-600 font-medium align-top">
                    {daysTotal}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap gap-1">
                      {eqItems.map((e) => (
                        <span
                          key={e.equipmentKey}
                          className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200"
                        >
                          {equipmentChipLabel(e.equipmentKey, e.customLabel, equipmentLabels)}
                        </span>
                      ))}
                      {customEq && (
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                          {equipmentChipLabel("__custom__", customEq.customLabel, equipmentLabels)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-black text-slate-800 tabular-nums align-top">
                    {formatCurrency(d.value, settings)}
                  </td>
                </tr>
                <tr className={bg} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td colSpan={7} className="px-4 pb-3 pt-0 text-xs text-slate-500">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      {d.ownerName && (
                        <span className="font-semibold text-indigo-700">Asesor: {d.ownerName}</span>
                      )}
                      <span>Origen: {d.channelLabel}</span>
                      {d.phone && <span>Tel: {d.phone}</span>}
                      {d.email && <span>Email: {d.email}</span>}
                      {d.quoteCount > 0 && (
                        <span>
                          Cotizaciones: {d.quoteCount}
                          {d.latestQuoteNumber ? ` (${d.latestQuoteNumber})` : ""}
                        </span>
                      )}
                      {d.paymentCount > 0 && (
                        <span>
                          Pagos: {d.paymentCount}
                          {d.latestPaymentNumber ? ` (${d.latestPaymentNumber})` : ""}
                        </span>
                      )}
                    </div>
                    {d.latestNote && (
                      <p className="mt-1.5 text-slate-600 italic">
                        <span className="font-semibold not-italic">Última nota: </span>
                        &ldquo;{d.latestNote}&rdquo;
                      </p>
                    )}
                  </td>
                </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>

      <div className="mt-8 pt-6 flex justify-between text-xs text-slate-500 border-t-2 border-slate-200">
        <p>
          Total de registros mostrados:{" "}
          <span className="font-bold text-slate-700">{sorted.length}</span>
        </p>
        <p>Reporte generado automáticamente desde {productName}.</p>
      </div>
    </div>
  )
}
