import { formatCurrency, formatDate } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"

interface PrintDeal {
  id: string
  name: string
  company: string | null
  ownerName: string | null
  stageKey: string
  value: number
  createdAt: string | Date
}

interface PrintReportProps {
  deals: PrintDeal[]
  settings: IntlSettings
  productName: string
}

export function PrintReport({ deals, settings, productName }: PrintReportProps) {
  const activeDealCount = deals.filter(
    (d) => d.stageKey !== "ganado" && d.stageKey !== "perdido",
  ).length
  const totalPipeline = deals
    .filter((d) => d.stageKey !== "ganado" && d.stageKey !== "perdido")
    .reduce((sum, d) => sum + d.value, 0)
  const totalWon = deals
    .filter((d) => d.stageKey === "ganado")
    .reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="hidden print:block p-8 font-sans text-sm">
      <div className="flex items-center justify-between mb-6 border-b pb-4">
        <h1 className="text-xl font-bold">{productName} — Reporte de Embudo</h1>
        <p className="text-xs text-gray-500">{new Date().toLocaleDateString(settings.locale)}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border rounded p-3">
          <p className="text-xs text-gray-500">Oportunidades activas</p>
          <p className="text-lg font-bold">{activeDealCount}</p>
        </div>
        <div className="border rounded p-3">
          <p className="text-xs text-gray-500">Total Embudo</p>
          <p className="text-lg font-bold">{formatCurrency(totalPipeline, settings)}</p>
        </div>
        <div className="border rounded p-3">
          <p className="text-xs text-gray-500">Ganado</p>
          <p className="text-lg font-bold">{formatCurrency(totalWon, settings)}</p>
        </div>
      </div>

      {/* Table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-600">ID</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-600">Oportunidad</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-600">Empresa</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-600">Asesor</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-600">Etapa</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-600">Fecha</th>
            <th className="text-right py-2 px-3 text-xs font-medium text-gray-600">Valor</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((d) => (
            <tr key={d.id} className="border-b">
              <td className="py-2 px-3 text-xs text-gray-400">{d.id}</td>
              <td className="py-2 px-3">{d.name}</td>
              <td className="py-2 px-3 text-gray-600">{d.company ?? "—"}</td>
              <td className="py-2 px-3 text-gray-600">{d.ownerName ?? "—"}</td>
              <td className="py-2 px-3 text-gray-600">{d.stageKey}</td>
              <td className="py-2 px-3 text-gray-600">{formatDate(d.createdAt, settings)}</td>
              <td className="py-2 px-3 text-right font-semibold">{formatCurrency(d.value, settings)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 text-xs text-gray-400 text-right">
        {deals.length} oportunidad(es) · Generado por {productName}
      </div>
    </div>
  )
}
