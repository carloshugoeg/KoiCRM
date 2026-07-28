"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { toast } from "sonner"
import { KanbanColumn } from "@/features/pipeline/components/KanbanColumn"
import { DealCard, type DealCardData } from "@/features/pipeline/components/DealCard"
import { useNarrowViewport } from "@/features/pipeline/hooks/use-narrow-viewport"
import { moveDealAction } from "@/features/deals/actions"
import { useActionPin } from "@/features/auth/pin-gate"
import { toastMessages, toastErrorFromResult } from "@/lib/ui/toast-messages"
import { lockedStageDropMessage } from "@/lib/pipeline/stage-block-message"
import type { PipelineStage } from "@prisma/client"
import type { IntlSettings } from "@/lib/intl/format"

interface KanbanBoardProps {
  tenantId: string
  tenantSlug: string
  stages: PipelineStage[]
  initialDeals: DealCardData[]
  settings: IntlSettings
  equipmentLabels?: Record<string, string>
  onDealClick: (dealId: string) => void
  /** When false, per-stage money totals stay hidden (each card keeps its own value). */
  canSeeTotals?: boolean
}

export function KanbanBoard({
  tenantId,
  tenantSlug,
  stages,
  initialDeals,
  settings,
  equipmentLabels,
  onDealClick,
  // Fail closed: an omitted prop must hide totals, not reveal them.
  canSeeTotals = false,
}: KanbanBoardProps) {
  const { guard } = useActionPin()
  const [deals, setDeals] = useState(initialDeals)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [movingDealId, setMovingDealId] = useState<string | null>(null)
  const [activeStageIndex, setActiveStageIndex] = useState(0)
  const slidesRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const scrollRaf = useRef<number | null>(null)

  // Phones swipe between stages, so dnd-kit gets no sensors there: the two gestures
  // would otherwise fight over the same touch. Stage moves live in the deal modal.
  const isNarrow = useNarrowViewport()
  const pointerSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const noSensors = useSensors()
  const sensors = isNarrow ? noSensors : pointerSensors

  useEffect(() => {
    setDeals(initialDeals)
  }, [initialDeals])

  /** Scrolls `child` to the centre of its scroll container. */
  function centerChild(container: HTMLElement, child: HTMLElement, behavior: ScrollBehavior) {
    const box = container.getBoundingClientRect()
    const target = child.getBoundingClientRect()
    const delta = target.left + target.width / 2 - (box.left + box.width / 2)
    container.scrollBy({ left: delta, behavior })
  }

  /** Index of the slide currently filling the viewport (only ever scrolls on mobile). */
  const syncActiveStage = useCallback(() => {
    const el = slidesRef.current
    if (!el) return
    const slides = Array.from(el.children) as HTMLElement[]
    if (slides.length === 0) return
    const box = el.getBoundingClientRect()
    const center = box.left + box.width / 2
    const found = slides.findIndex((slide) => center < slide.getBoundingClientRect().right)
    const index = found === -1 ? slides.length - 1 : found
    setActiveStageIndex((prev) => (prev === index ? prev : index))
  }, [])

  // Every scroll frame otherwise calls getBoundingClientRect on every stage — on the phones
  // this carousel exists for, coalesce to at most one measurement per animation frame.
  const handleScroll = useCallback(() => {
    if (scrollRaf.current !== null) return
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = null
      syncActiveStage()
    })
  }, [syncActiveStage])

  useEffect(() => {
    return () => {
      if (scrollRaf.current !== null) cancelAnimationFrame(scrollRaf.current)
    }
  }, [])

  const goToStage = useCallback((index: number) => {
    const el = slidesRef.current
    const slide = el?.children[index] as HTMLElement | undefined
    if (!el || !slide) return
    centerChild(el, slide, "smooth")
    setActiveStageIndex(index)
  }, [])

  // Keep the selected pill in view as the user swipes through the stages.
  useEffect(() => {
    const rail = railRef.current
    const pill = rail?.children[activeStageIndex] as HTMLElement | undefined
    if (!rail || !pill) return
    centerChild(rail, pill, "smooth")
  }, [activeStageIndex])

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const dealId = active.id as string
    const toStageId = over.id as string

    const deal = deals.find((d) => d.id === dealId)
    if (!deal || deal.stageId === toStageId) return

    const targetStage = stages.find((s) => s.id === toStageId)
    if (!targetStage) return

    if (targetStage.locked) {
      toast.error(
        lockedStageDropMessage({
          stageKey: targetStage.key,
          stageLabel: targetStage.label,
          hasPaymentWithFile: deal.hasPaymentWithFile,
        }),
        { duration: 8000 },
      )
      return
    }

    // Optimistic update
    const previous = deals
    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId
          ? { ...d, stageId: toStageId, stageKey: targetStage.key, stageEnteredAt: new Date() }
          : d
      )
    )

    setMovingDealId(dealId)
    void (async () => {
      const result = await guard((pin) =>
        moveDealAction({ tenantId, tenantSlug, dealId, toStageId, force: false, pin }),
      )
      if (!result.ok) {
        // Revert the optimistic move on failure or when the user cancels the PIN prompt.
        setDeals(previous)
        if (!result.requiresPin) toast.error(toastErrorFromResult(result.error, toastMessages.deal.errorMove))
      } else {
        toast.success(toastMessages.deal.moved)
      }
      setMovingDealId(null)
    })()
  }

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) : null
  const activeDealStageColor = activeDeal
    ? stages.find((s) => s.id === activeDeal.stageId)?.color ?? "#6366f1"
    : "#6366f1"

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full min-w-0 flex-col">
        {/* Stage rail — mobile only: shows the current stage and jumps between them. */}
        <div
          ref={railRef}
          role="group"
          aria-label="Etapas del embudo"
          className="flex shrink-0 gap-2 overflow-x-auto px-3 pb-3 md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {stages.map((stage, index) => {
            const isActive = index === activeStageIndex
            const count = deals.filter((d) => d.stageId === stage.id).length
            return (
              <button
                key={stage.id}
                type="button"
                aria-current={isActive ? "true" : undefined}
                onClick={() => goToStage(index)}
                className="flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[11px] font-black uppercase tracking-wider transition-colors"
                style={
                  isActive
                    ? { background: stage.color, borderColor: stage.color, color: "#ffffff" }
                    : { background: "#ffffff", borderColor: "#e2e8f0", color: "#64748b" }
                }
              >
                <span className="max-w-[9rem] truncate">{stage.label}</span>
                <span
                  className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold"
                  style={
                    isActive
                      ? { background: "rgba(255,255,255,0.25)", color: "#ffffff" }
                      : { background: "#f1f5f9", color: "#475569" }
                  }
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div
          ref={slidesRef}
          onScroll={handleScroll}
          className="flex w-full min-w-0 flex-1 min-h-0 snap-x snap-mandatory overscroll-x-contain gap-2 overflow-x-auto overflow-y-hidden px-2 pb-4 pt-2 sm:gap-3 sm:px-3 md:h-full md:min-h-[calc(100vh-180px)] md:snap-none md:gap-4 md:overflow-hidden md:px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              deals={deals.filter((d) => d.stageId === stage.id)}
              settings={settings}
              equipmentLabels={equipmentLabels}
              onDealClick={onDealClick}
              movingDealId={movingDealId}
              draggingDeal={activeId ? deals.find((d) => d.id === activeId) : undefined}
              canSeeTotals={canSeeTotals}
              dragDisabled={isNarrow}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeDeal && (
          <DealCard
            deal={activeDeal}
            settings={settings}
            equipmentLabels={equipmentLabels}
            stageColor={activeDealStageColor}
            onClick={() => {}}
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}
