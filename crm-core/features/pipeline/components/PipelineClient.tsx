"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Plus, Printer, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { KanbanBoard } from "@/features/pipeline/components/KanbanBoard"
import { FilterBar } from "@/features/pipeline/components/FilterBar"
import { KpiBar } from "@/features/pipeline/components/KpiBar"
import { ClientFormModal } from "@/features/deals/components/ClientFormModal"
import { DealDetailModal } from "@/features/deals/components/DealDetailModal"
import { getDealSummaryAction } from "@/features/deals/actions"
import { PinProvider } from "@/features/auth/pin-gate"
import { toastMessages, toastErrorFromResult } from "@/lib/ui/toast-messages"
import type { PipelineStage, CatalogItem } from "@prisma/client"
import type { EquipmentCategory } from "@/features/catalogs/queries"
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
  equipmentHierarchy: EquipmentCategory[]
  statuses: CatalogItem[]
  currentFilters: PipelineFiltersParams
  intlSettings: IntlSettings
  currentUserId: string
  /** False hides aggregate money (stage totals + KPIs); each card keeps its own value. */
  canSeeTotals: boolean
  /** Non-null when the member only sees their own deals (pipeline.viewAll off). */
  restrictedOwnerId: string | null
  canCreate: boolean
  canEdit: boolean
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
    ownerImage: deal.ownerImage ?? null,
    createdById: deal.createdById ?? null,
    createdByName: deal.createdByName ?? null,
    createdByImage: deal.createdByImage ?? null,
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
  equipmentHierarchy,
  statuses,
  currentFilters,
  intlSettings,
  currentUserId,
  canSeeTotals,
  restrictedOwnerId,
  canCreate,
  canEdit,
  canArchive,
  canDelete,
}: PipelineClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [newDealOpen, setNewDealOpen] = useState(false)
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)
  const [fetchedDeal, setFetchedDeal] = useState<DealSummary | null>(null)
  const [loadingDeal, setLoadingDeal] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Deep-link bookkeeping: the id already consumed, and the one opened from the URL
  // (a bad deep link closes quietly instead of shouting at the user).
  const consumedDealParam = useRef<string | null>(null)
  const deepLinkedDealId = useRef<string | null>(null)

  const dealCards: DealCardData[] = useMemo(() => deals.map((d) => ({
    ...d,
    createdAt: new Date(d.createdAt),
    stageEnteredAt: new Date(d.stageEnteredAt),
  })), [deals])

  const equipmentLabels = useMemo(
    () =>
      Object.fromEntries(
        equipmentHierarchy.flatMap((h) => [
          [h.category.key, h.category.label] as const,
          ...h.subcategories.map((s) => [s.key, s.label] as const),
        ]),
      ),
    [equipmentHierarchy],
  )

  const clearDealParam = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (!params.has("deal")) return
    params.delete("deal")
    const qs = params.toString()
    router.replace(`/app/${tenantSlug}/pipeline${qs ? `?${qs}` : ""}`)
  }, [router, searchParams, tenantSlug])

  // `?deal=<id>` deep link: open that deal once, then drop the param so closing the
  // modal cannot re-open it. Unknown or out-of-scope ids simply open nothing.
  const dealParam = searchParams.get("deal")
  useEffect(() => {
    if (!dealParam) return
    if (consumedDealParam.current === dealParam) return
    consumedDealParam.current = dealParam
    deepLinkedDealId.current = dealParam
    setSelectedDealId(dealParam)
    clearDealParam()
  }, [dealParam, clearDealParam])

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
    // The server is the source of truth for scope (getDealSummaryAction resolves it against
    // pipelineScopeFor, "owned or ceded"); a deal outside the caller's scope simply comes
    // back !ok, indistinguishable from a missing one.
    void getDealSummaryAction({ tenantId, dealId: selectedDealId }).then((res) => {
      if (cancelled) return
      setLoadingDeal(false)
      if (res.ok && res.deal) {
        setFetchedDeal(res.deal)
      } else {
        // A stale deep link just resolves to nothing; a click inside the board is a real error.
        if (deepLinkedDealId.current !== selectedDealId) {
          toast.error(toastErrorFromResult(res.error, toastMessages.deal.notFound))
        }
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
    <PinProvider>
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-[#f8faff]">
      <div className="flex items-center gap-3 px-3 py-3 border-b border-indigo-500/10 bg-white/80 backdrop-blur-sm sticky top-0 z-10 flex-wrap md:gap-5 md:px-6 md:py-4">
        <div className="hidden items-center gap-3 md:flex">
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

        {/* Mobile: filters collapse behind a toggle so the board keeps the screen. */}
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={filtersOpen}
          className="h-11 rounded-full border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 shadow-sm md:hidden"
          onClick={() => setFiltersOpen((p) => !p)}
        >
          <SlidersHorizontal className="mr-1.5 h-4 w-4" />
          Filtros
        </Button>

        <div className={cn("w-full md:block md:w-auto", filtersOpen ? "block" : "hidden")}>
          <FilterBar
            members={members}
            channels={channels}
            equipmentHierarchy={equipmentHierarchy}
            currentFilters={currentFilters}
            tenantSlug={tenantSlug}
            showOwnerFilter={restrictedOwnerId === null}
          />
        </div>

        {canSeeTotals && (
          <div className="ml-auto">
            <KpiBar totalPipeline={totalPipeline} totalWon={totalWon} settings={intlSettings} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 overflow-hidden pt-3 px-0 md:pt-4 md:px-2">
        <KanbanBoard
          tenantId={tenantId}
          tenantSlug={tenantSlug}
          stages={stages}
          initialDeals={dealCards}
          settings={intlSettings}
          equipmentLabels={equipmentLabels}
          canSeeTotals={canSeeTotals}
          onDealClick={(dealId) => setSelectedDealId(dealId)}
        />
      </div>

      {/* Quick add — thumb-reachable on phones; desktop keeps the header button. */}
      {canCreate && (
        <button
          type="button"
          onClick={() => setNewDealOpen(true)}
          aria-label="Nueva oportunidad"
          className="fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#4f46e5] text-white shadow-lg shadow-indigo-500/30 transition-colors active:bg-[#4338ca] md:hidden"
          style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

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
          equipmentHierarchy={equipmentHierarchy}
          statuses={statuses}
          canChooseOwner={canEdit}
          currentUserId={currentUserId}
        />
      )}

      {modalDeal && (
        <DealDetailModal
          deal={modalDeal}
          stages={stages}
          tenantId={tenantId}
          tenantSlug={tenantSlug}
          settings={intlSettings}
          canEdit={canEdit}
          canArchive={canArchive}
          canDelete={canDelete}
          members={members}
          equipmentHierarchy={equipmentHierarchy}
          onClose={closeDealModal}
          onAction={() => {
            closeDealModal()
            router.refresh()
          }}
        />
      )}
    </div>
    </PinProvider>
  )
}
