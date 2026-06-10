"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DealDetailModal } from "@/features/deals/components/DealDetailModal"
import { formatCurrency, formatDate } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"
import type { PipelineStage } from "@prisma/client"

interface ArchivedDeal {
  id: string
  name: string
  company: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  value: number
  stageLabel: string
  stageKey: string
  stageId: string
  statusKey: string
  ownerName: string | null
  ownerId: string
  equipment: { equipmentKey: string; customLabel: string | null }[]
  createdAt: string
  stageEnteredAt: string
  quoteCount: number
  paymentCount: number
}

interface ArchiveTableProps {
  tenantId: string
  tenantSlug: string
  deals: ArchivedDeal[]
  nextCursor: string | null
  hasPrev: boolean
  stages: PipelineStage[]
  settings: IntlSettings
}

export function ArchiveTable({
  tenantId,
  tenantSlug,
  deals,
  nextCursor,
  hasPrev,
  stages,
  settings,
}: ArchiveTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)

  function navigate(cursor: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (cursor) {
      params.set("cursor", cursor)
    } else {
      params.delete("cursor")
    }
    router.push(`/app/${tenantSlug}/archive?${params.toString()}`)
  }

  const selectedDeal = deals.find((d) => d.id === selectedDealId)

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Fecha</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Oportunidad</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Empresa</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Etapa</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Asesor</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Valor</th>
            </tr>
          </thead>
          <tbody>
            {deals.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  Sin oportunidades archivadas.
                </td>
              </tr>
            )}
            {deals.map((d) => (
              <tr
                key={d.id}
                className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => setSelectedDealId(d.id)}
              >
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(d.createdAt, settings)}
                </td>
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.company ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="text-xs">{d.stageLabel}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{d.ownerName ?? "—"}</td>
                <td className="px-4 py-3 text-right font-semibold">
                  {formatCurrency(d.value, settings)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPrev}
          onClick={() => navigate(null)}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Primera página
        </Button>
        <span className="text-xs text-muted-foreground">{deals.length} resultado(s)</span>
        <Button
          variant="outline"
          size="sm"
          disabled={!nextCursor}
          onClick={() => navigate(nextCursor)}
        >
          Siguiente
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {selectedDeal && (
        <DealDetailModal
          deal={{
            id: selectedDeal.id,
            name: selectedDeal.name,
            company: selectedDeal.company,
            phone: selectedDeal.phone,
            whatsapp: selectedDeal.whatsapp,
            email: selectedDeal.email,
            value: selectedDeal.value,
            statusKey: selectedDeal.statusKey,
            stageId: selectedDeal.stageId,
            stageKey: selectedDeal.stageKey,
            createdAt: selectedDeal.createdAt,
            stageEnteredAt: selectedDeal.stageEnteredAt,
            ownerId: selectedDeal.ownerId,
            ownerName: selectedDeal.ownerName,
            equipment: selectedDeal.equipment,
            quoteCount: selectedDeal.quoteCount,
            paymentCount: selectedDeal.paymentCount,
          }}
          stages={stages}
          tenantId={tenantId}
          tenantSlug={tenantSlug}
          settings={settings}
          onClose={() => setSelectedDealId(null)}
        />
      )}
    </div>
  )
}
