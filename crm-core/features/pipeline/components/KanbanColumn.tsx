"use client"

import { useState, useRef, useEffect } from "react"
import { useDroppable } from "@dnd-kit/core"
import { PlusCircle, MinusCircle } from "lucide-react"
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

function hex2rgba(hex: string, alpha = 0.15) {
  let h = hex.replace("#", "")
  if (h.length === 3) h = h.split("").map(c => c + c).join("")
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${isNaN(r) ? 0 : r},${isNaN(g) ? 0 : g},${isNaN(b) ? 0 : b},${alpha})`
}

export function KanbanColumn({ stage, deals, settings, onDealClick, movingDealId }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  const [isCollapsed, setIsCollapsed] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [highlightedDealId, setHighlightedDealId] = useState<string | null>(null)
  const columnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (columnRef.current && !columnRef.current.contains(e.target as Node)) {
        setExpandedIds(new Set())
        setHighlightedDealId(null)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  function handleCardClick(deal: DealCardData) {
    if (isCollapsed) {
      if (expandedIds.has(deal.id)) {
        setExpandedIds(prev => { const next = new Set(prev); next.delete(deal.id); return next })
      } else {
        setExpandedIds(prev => new Set([...prev, deal.id]))
        setHighlightedDealId(deal.id)
      }
    } else {
      setHighlightedDealId(prev => prev === deal.id ? null : deal.id)
    }
  }

  const totalValue = deals.reduce((sum, d) => sum + d.value, 0)

  return (
    <div
      ref={columnRef}
      className={cn(
        "flex flex-col shrink-0 rounded-2xl transition-all duration-300 ring-1 ring-black/5",
        isCollapsed ? "flex-none w-[320px]" : "w-[400px]"
      )}
      style={{
        background: isOver ? hex2rgba(stage.color, 0.1) : "#ffffff",
        border: `1px solid ${hex2rgba(stage.color, 0.25)}`,
      }}
    >
      {/* Column header — click to toggle collapse */}
      <div
        className="px-4 py-3 cursor-pointer flex flex-col rounded-t-2xl"
        onClick={() => setIsCollapsed(p => !p)}
        style={{
          background: hex2rgba(stage.color, 0.08),
          borderBottom: `1px solid ${hex2rgba(stage.color, 0.15)}`,
        }}
      >
        {/* Row 1: label pill + deal count + collapse icon */}
        <div className="flex items-center gap-2">
          <span
            className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-sm"
            style={{ background: stage.color }}
          >
            {stage.label}
          </span>
          <span
            className="text-[11px] rounded-full w-5 h-5 flex items-center justify-center font-bold shrink-0"
            style={{
              background: hex2rgba(stage.color, 0.15),
              color: stage.color,
              border: `1px solid ${hex2rgba(stage.color, 0.3)}`,
            }}
          >
            {deals.length}
          </span>
          {stage.locked && (
            <span aria-label="Etapa bloqueada" title="Etapa bloqueada" className="text-sm shrink-0">
              🔒
            </span>
          )}
          <span className="ml-auto shrink-0" style={{ color: stage.color }}>
            {isCollapsed
              ? <PlusCircle size={15} />
              : <MinusCircle size={15} />}
          </span>
        </div>
        {/* Row 2: total value + sublabel */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-[13px] font-black" style={{ color: stage.color }}>
            {formatCurrency(totalValue, settings)}
          </span>
          {stage.sublabel && (
            <span className="text-[11px] truncate ml-2 text-slate-500 font-medium">{stage.sublabel}</span>
          )}
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        role="region"
        aria-label={stage.label}
        className={cn(
          "flex-1 p-3 min-h-[200px] transition-colors",
          isOver && stage.locked && "ring-2 ring-inset ring-destructive/30"
        )}
        style={{
          background: isOver && !stage.locked ? hex2rgba(stage.color, 0.05) : "transparent",
        }}
      >
        {isOver && stage.locked && (
          <div className="text-xs text-destructive text-center py-2 font-medium">
            Etapa bloqueada
          </div>
        )}
        <ScrollArea className="h-[calc(100vh-280px)] pr-3">
          <div className="flex flex-col gap-3 pb-4 pt-1">
            {deals.map((deal) => (
              <div
                key={deal.id}
                className={cn("w-full min-w-0 px-1", deal.id === movingDealId ? "opacity-40 pointer-events-none scale-95 transition-opacity" : "transition-opacity")}
              >
                <DealCard
                  deal={deal}
                  settings={settings}
                  stageColor={stage.color}
                  isCompact={isCollapsed && !expandedIds.has(deal.id)}
                  isHighlighted={highlightedDealId === deal.id}
                  onClick={() => handleCardClick(deal)}
                  onOpenDetail={() => onDealClick(deal.id)}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
