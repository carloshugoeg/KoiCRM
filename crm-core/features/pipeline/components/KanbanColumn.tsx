"use client"

import { useDroppable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import { DealCard, type DealCardData } from "@/features/pipeline/components/DealCard"
import type { IntlSettings } from "@/lib/intl/format"
import type { PipelineStage } from "@prisma/client"
import { ScrollArea } from "@/components/ui/scroll-area"

interface KanbanColumnProps {
  stage: PipelineStage
  deals: DealCardData[]
  settings: IntlSettings
  onDealClick: (dealId: string) => void
  movingDealId?: string | null
}

export function KanbanColumn({ stage, deals, settings, onDealClick, movingDealId }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <div className="flex flex-col w-64 shrink-0">
      {/* Column header */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-lg mb-1"
        style={{ backgroundColor: stage.color + "20", borderBottom: `2px solid ${stage.color}` }}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: stage.color }}
        />
        <span className="text-sm font-semibold truncate">{stage.label}</span>
        {stage.locked && (
          <span
            className="ml-auto text-xs text-muted-foreground"
            aria-label="Etapa bloqueada"
            title="Etapa bloqueada"
          >
            🔒
          </span>
        )}
        <span className="ml-auto text-xs font-medium text-muted-foreground">{deals.length}</span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        role="region"
        aria-label={stage.label}
        className={cn(
          "flex-1 rounded-b-lg p-2 min-h-[200px] transition-colors",
          isOver && !stage.locked ? "bg-accent/50 ring-2 ring-primary/30" : "bg-muted/30",
          isOver && stage.locked ? "bg-destructive/10 ring-2 ring-destructive/30" : ""
        )}
      >
        {isOver && stage.locked && (
          <div className="text-xs text-destructive text-center py-2 font-medium">
            Etapa bloqueada
          </div>
        )}
        <ScrollArea className="h-full">
          <div className="space-y-2 pb-2">
            {deals.map((deal) => (
              <div
                key={deal.id}
                className={deal.id === movingDealId ? "opacity-40 pointer-events-none" : undefined}
              >
                <DealCard
                  deal={deal}
                  settings={settings}
                  onClick={() => onDealClick(deal.id)}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
