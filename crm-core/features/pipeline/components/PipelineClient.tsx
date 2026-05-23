"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Plus, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { KanbanBoard } from "@/features/pipeline/components/KanbanBoard"
import { FilterBar } from "@/features/pipeline/components/FilterBar"
import { KpiBar } from "@/features/pipeline/components/KpiBar"
import { ClientFormModal } from "@/features/deals/components/ClientFormModal"
import { DealDetailModal } from "@/features/deals/components/DealDetailModal"
import type { PipelineStage, CatalogItem } from "@prisma/client"
import type { PipelineFiltersParams } from "@/features/pipeline/schemas"
import type { IntlSettings } from "@/lib/intl/format"
import type { DealCardData } from "@/features/pipeline/components/DealCard"

interface PipelineClientProps {
  tenantId: string
  tenantSlug: string
  stages: PipelineStage[]
  deals: (Omit<DealCardData, "createdAt" | "stageEnteredAt"> & { createdAt: string; stageEnteredAt: string })[]
  members: { id: string; name: string | null; email: string }[]
  channels: CatalogItem[]
  equipment: CatalogItem[]
  statuses: CatalogItem[]
  followUpReasons: CatalogItem[]
  currentFilters: PipelineFiltersParams
  intlSettings: IntlSettings
  logoUrl: string | null
  productName: string
  canEdit: boolean
  canDelete: boolean
}

export function PipelineClient({
  tenantId,
  tenantSlug,
  stages,
  deals,
  members,
  channels,
  equipment,
  statuses,
  followUpReasons,
  currentFilters,
  intlSettings,
  logoUrl,
  productName,
  canEdit,
  canDelete,
}: PipelineClientProps) {
  const router = useRouter()
  const [newDealOpen, setNewDealOpen] = useState(false)
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)

  // Convert serialized dates back to Date objects — memoized so the reference only
  // changes when the server sends fresh data (after router.refresh()), not on every render.
  const dealCards: DealCardData[] = useMemo(() => deals.map((d) => ({
    ...d,
    createdAt: new Date(d.createdAt),
    stageEnteredAt: new Date(d.stageEnteredAt),
  })), [deals])

  // Compute KPIs from local deal data
  const closedKeys = ["ganado", "perdido"]
  const totalPipeline = dealCards
    .filter((d) => !closedKeys.includes(d.stageKey))
    .reduce((sum, d) => sum + d.value, 0)
  const totalWon = dealCards
    .filter((d) => d.stageKey === "ganado")
    .reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="flex flex-col h-full">
      {/* Header row */}
      <div className="flex items-center gap-4 px-4 py-3 border-b flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setNewDealOpen(true)}
            disabled={!canEdit}
          >
            <Plus className="h-4 w-4" />
            Nueva oportunidad
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => window.print()}
            title="Imprimir reporte"
          >
            <Printer className="h-4 w-4" />
          </Button>
        </div>

        <FilterBar
          members={members}
          channels={channels}
          equipment={equipment}
          currentFilters={currentFilters}
          tenantSlug={tenantSlug}
        />

        <div className="ml-auto">
          <KpiBar totalPipeline={totalPipeline} totalWon={totalWon} settings={intlSettings} />
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-hidden">
        <KanbanBoard
          tenantId={tenantId}
          tenantSlug={tenantSlug}
          stages={stages}
          initialDeals={dealCards}
          settings={intlSettings}
          onDealClick={(dealId) => setSelectedDealId(dealId)}
        />
      </div>

      {/* Modals */}
      {newDealOpen && (
        <ClientFormModal
          open={newDealOpen}
          onClose={() => setNewDealOpen(false)}
          tenantId={tenantId}
          tenantSlug={tenantSlug}
          members={members}
          channels={channels}
          equipment={equipment}
          statuses={statuses}
        />
      )}

      {selectedDealId && (() => {
        const deal = dealCards.find((d) => d.id === selectedDealId)
        if (!deal) return null
        return (
          <DealDetailModal
            deal={{
              id: deal.id,
              name: deal.name,
              company: deal.company,
              phone: deal.phone,
              whatsapp: deal.whatsapp,
              email: deal.email,
              value: deal.value,
              statusKey: deal.statusKey,
              stageId: deal.stageId,
              stageKey: deal.stageKey,
              createdAt: deal.createdAt.toISOString(),
              stageEnteredAt: deal.stageEnteredAt.toISOString(),
              ownerId: deal.ownerId,
              ownerName: deal.ownerName,
              equipment: deal.equipment,
              quoteCount: deal.quoteCount,
              paymentCount: deal.paymentCount,
            }}
            stages={stages}
            followUpReasons={followUpReasons}
            tenantId={tenantId}
            tenantSlug={tenantSlug}
            settings={intlSettings}
            canEdit={canEdit}
            canDelete={canDelete}
            onClose={() => setSelectedDealId(null)}
            onAction={() => {
              setSelectedDealId(null)
              router.refresh()
            }}
          />
        )
      })()}
    </div>
  )
}
