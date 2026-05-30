"use client"

import { useState, useTransition, useEffect } from "react"
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { toast } from "sonner"
import { KanbanColumn } from "@/features/pipeline/components/KanbanColumn"
import { DealCard, type DealCardData } from "@/features/pipeline/components/DealCard"
import { moveDealAction } from "@/features/deals/actions"
import type { PipelineStage } from "@prisma/client"
import type { IntlSettings } from "@/lib/intl/format"

interface KanbanBoardProps {
  tenantId: string
  tenantSlug: string
  stages: PipelineStage[]
  initialDeals: DealCardData[]
  settings: IntlSettings
  onDealClick: (dealId: string) => void
}

export function KanbanBoard({
  tenantId,
  tenantSlug,
  stages,
  initialDeals,
  settings,
  onDealClick,
}: KanbanBoardProps) {
  const [deals, setDeals] = useState(initialDeals)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [movingDealId, setMovingDealId] = useState<string | null>(null)

  useEffect(() => {
    setDeals(initialDeals)
  }, [initialDeals])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

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
      toast.error(`La etapa "${targetStage.label}" está bloqueada. Usa las acciones del panel de detalle.`)
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
    startTransition(async () => {
      const result = await moveDealAction({ tenantId, tenantSlug, dealId, toStageId, force: false })
      if (!result.ok) {
        setDeals(previous)
        toast.error(result.error ?? "Error al mover la oportunidad.")
      }
      setMovingDealId(null)
    })
  }

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) : null
  const activeDealStageColor = activeDeal
    ? stages.find((s) => s.id === activeDeal.stageId)?.color ?? "#6366f1"
    : "#6366f1"

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 px-4 pt-2 min-h-[calc(100vh-180px)]">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            deals={deals.filter((d) => d.stageId === stage.id)}
            settings={settings}
            onDealClick={onDealClick}
            movingDealId={movingDealId}
          />
        ))}
      </div>

      <DragOverlay>
        {activeDeal && (
          <DealCard
            deal={activeDeal}
            settings={settings}
            stageColor={activeDealStageColor}
            onClick={() => {}}
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}
