"use client"

import { useDroppable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import { DealCard, type DealCardData } from "@/features/pipeline/components/DealCard"
import { formatCurrency } from "@/lib/intl/format"
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

  const totalValue = deals.reduce((sum, d) => sum + d.value, 0)

  return (
    <div
      className="flex flex-col w-64 shrink-0 rounded-2xl overflow-hidden"
      style={{
        background: "var(--col-bg)",
        border: `1px solid ${stage.color}30`,
      }}
    >
      {/* Column header */}
      <div
        className="px-3 py-3 cursor-default"
        style={{
          background: `${stage.color}1a`,
          borderBottom: `2px solid ${stage.color}`,
        }}
      >
        {/* Row 1: label pill + deal count */}
        <div className="flex items-center gap-2">
          <span
            className="flex-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white truncate shadow-sm"
            style={{ background: stage.color }}
          >
            {stage.label}
          </span>
          <span
            className="text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shrink-0"
            style={{
              background: `${stage.color}1a`,
              color: stage.color,
              border: `1px solid ${stage.color}4d`,
            }}
          >
            {deals.length}
          </span>
          {stage.locked && (
            <span aria-label="Etapa bloqueada" title="Etapa bloqueada" className="text-sm shrink-0">
              🔒
            </span>
          )}
        </div>
        {/* Row 2: total value + sublabel */}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs font-black" style={{ color: stage.color }}>
            {formatCurrency(totalValue, settings)}
          </span>
          {stage.sublabel && (
            <span className="text-[10px] truncate ml-2 text-muted-foreground">{stage.sublabel}</span>
          )}
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        role="region"
        aria-label={stage.label}
        className={cn(
          "flex-1 p-2 min-h-[200px] transition-colors",
          isOver && stage.locked && "ring-2 ring-inset ring-destructive/30"
        )}
        style={{
          background: isOver && !stage.locked ? `${stage.color}1a` : "transparent",
        }}
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
                  stageColor={stage.color}
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
