"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Plus, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { KanbanBoard } from "@/features/pipeline/components/KanbanBoard"
import { FilterBar } from "@/features/pipeline/components/FilterBar"
import { KpiBar } from "@/features/pipeline/components/KpiBar"
import { ClientFormModal } from "@/features/deals/components/ClientFormModal"
import { DealDetailModal } from "@/features/deals/components/DealDetailModal"
import { getDealSummaryAction } from "@/features/deals/actions"
import { toastMessages, toastErrorFromResult } from "@/lib/ui/toast-messages"
import type { PipelineStage, CatalogItem } from "@prisma/client"
import type { PipelineFiltersParams } from "@/features/pipeline/schemas"
import type { IntlSettings } from "@/lib/intl/format"
import type { DealCardData } from "@/features/pipeline/components/DealCard"

type DealSummary = NonNullable<Awaited<ReturnType<typeof getDealSummaryAction>>["deal"]>

interface PipelineClientProps {
  tenantId: string
  tenantSlug: string
  stages: PipelineStage[]
  deals: (Omit<DealCardData, "createdAt" | "stageEnteredAt"> & { createdAt: string; stageEnteredAt: string })[]
  members: { id: string; name: string | null; email: string; image?: string | null }[]
  channels: CatalogItem[]
  equipment: CatalogItem[]
  statuses: CatalogItem[]
  followUpReasons: CatalogItem[]
  currentFilters: PipelineFiltersParams
  intlSettings: IntlSettings
  currentUserId: string
  canCreate: boolean
  canSeeAll: boolean
  canArchive: boolean
  canDelete: boolean
}

function cardToModalDeal(deal: DealCardData): DealSummary {
  return {
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
  }
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
  currentUserId,
  canCreate,
  canSeeAll,
  canArchive,
  canDelete,
}: PipelineClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [newDealOpen, setNewDealOpen] = useState(false)
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)
  const [fetchedDeal, setFetchedDeal] = useState<DealSummary | null>(null)
  const [loadingDeal, setLoadingDeal] = useState(false)

  const dealCards: DealCardData[] = useMemo(() => deals.map((d) => ({
    ...d,
    createdAt: new Date(d.createdAt),
    stageEnteredAt: new Date(d.stageEnteredAt),
  })), [deals])

  const equipmentLabels = useMemo(
    () => Object.fromEntries(equipment.map((e) => [e.key, e.label])),
    [equipment],
  )

  const clearDealParam = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (!params.has("deal")) return
    params.delete("deal")
    const qs = params.toString()
    router.replace(`/app/${tenantSlug}/pipeline${qs ? `?${qs}` : ""}`)
  }, [router, searchParams, tenantSlug])

  useEffect(() => {
    const dealId = searchParams.get("deal")
    if (dealId) setSelectedDealId(dealId)
  }, [searchParams])

  useEffect(() => {
    if (!selectedDealId) {
      setFetchedDeal(null)
      setLoadingDeal(false)
      return
    }

    const local = dealCards.find((d) => d.id === selectedDealId)
    if (local) {
      setFetchedDeal(null)
      setLoadingDeal(false)
      return
    }

    let cancelled = false
    setLoadingDeal(true)
    void getDealSummaryAction({ tenantId, dealId: selectedDealId }).then((res) => {
      if (cancelled) return
      setLoadingDeal(false)
      if (res.ok && res.deal) {
        setFetchedDeal(res.deal)
      } else {
        toast.error(toastErrorFromResult(res.error, toastMessages.deal.notFound))
        setSelectedDealId(null)
        clearDealParam()
      }
    })

    return () => {
      cancelled = true
    }
  }, [selectedDealId, dealCards, tenantId, clearDealParam])

  const closeDealModal = useCallback(() => {
    setSelectedDealId(null)
    setFetchedDeal(null)
    clearDealParam()
  }, [clearDealParam])

  const modalDeal: DealSummary | null = useMemo(() => {
    if (!selectedDealId) return null
    const local = dealCards.find((d) => d.id === selectedDealId)
    if (local) return cardToModalDeal(local)
    return fetchedDeal
  }, [selectedDealId, dealCards, fetchedDeal])

  const closedKeys = ["ganado", "perdido"]
  const totalPipeline = dealCards
    .filter((d) => !closedKeys.includes(d.stageKey))
    .reduce((sum, d) => sum + d.value, 0)
  const totalWon = dealCards
    .filter((d) => d.stageKey === "ganado")
    .reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-[#f8faff]">
      <div className="flex items-center gap-5 px-6 py-4 border-b border-indigo-500/10 bg-white/80 backdrop-blur-sm sticky top-0 z-10 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            className="rounded-full bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-md shadow-indigo-500/20 px-6 h-10 font-bold tracking-wide"
            onClick={() => setNewDealOpen(true)}
            disabled={!canCreate}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nueva oportunidad
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full h-10 w-10 text-slate-500 hover:text-slate-900 border border-slate-200 shadow-sm bg-white"
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

      <div className="min-w-0 flex-1 overflow-hidden pt-4 px-2">
        <KanbanBoard
          tenantId={tenantId}
          tenantSlug={tenantSlug}
          stages={stages}
          initialDeals={dealCards}
          settings={intlSettings}
          equipmentLabels={equipmentLabels}
          onDealClick={(dealId) => setSelectedDealId(dealId)}
        />
      </div>

      {loadingDeal && selectedDealId && !modalDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <p className="rounded-md bg-background px-4 py-2 text-sm shadow-md">Cargando oportunidad...</p>
        </div>
      )}

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
          followUpReasons={followUpReasons}
          canChooseOwner={canSeeAll}
          currentUserId={currentUserId}
        />
      )}

      {modalDeal && (
        <DealDetailModal
          deal={modalDeal}
          stages={stages}
          followUpReasons={followUpReasons}
          tenantId={tenantId}
          tenantSlug={tenantSlug}
          settings={intlSettings}
          canEdit={canSeeAll || modalDeal.ownerId === currentUserId}
          canArchive={canArchive}
          canDelete={canDelete}
          members={members}
          onClose={closeDealModal}
          onAction={() => {
            closeDealModal()
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
