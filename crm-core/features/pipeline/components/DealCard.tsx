"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { avatarColor } from "@/lib/utils/avatar-color"
import { formatCurrency } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"

export interface DealCardData {
  id: string
  name: string
  company: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  value: number
  ownerId: string
  ownerName: string | null
  stageId: string
  statusKey: string
  createdAt: Date
  stageEnteredAt: Date
  equipment: { equipmentKey: string; customLabel: string | null }[]
  hasActiveQuote: boolean
  hasActivePayment: boolean
  hasOverdueFollowUp: boolean
  stageKey: string
  quoteCount: number
  paymentCount: number
}

interface DealCardProps {
  deal: DealCardData
  settings: IntlSettings
  onClick: () => void
}

function diffDays(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

export function DealCard({ deal, settings, onClick }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  const now = new Date()
  const daysTotal = diffDays(deal.createdAt, now)
  const daysStage = diffDays(deal.stageEnteredAt, now)
  const color = avatarColor(deal.ownerId)

  const chips = deal.equipment
    .filter((e) => e.equipmentKey !== "__custom__")
    .slice(0, 2)
  const customEq = deal.equipment.find((e) => e.equipmentKey === "__custom__")
  const overflow = deal.equipment.filter((e) => e.equipmentKey !== "__custom__").length - 2

  const missingQuoteAlert =
    !deal.hasActiveQuote && deal.stageKey !== "prospecto" && deal.stageKey !== "perdido"
  const missingPaymentAlert = !deal.hasActivePayment && deal.stageKey === "ganado"

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="bg-card border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing select-none"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        <div
          className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
          style={{ backgroundColor: color }}
          title={deal.ownerName ?? ""}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{deal.name}</p>
          {deal.company && (
            <p className="text-xs text-muted-foreground truncate">{deal.company}</p>
          )}
        </div>
      </div>

      {/* Value */}
      <p className="text-sm font-semibold mb-2">
        {formatCurrency(deal.value, settings)}
      </p>

      {/* Equipment chips */}
      {(chips.length > 0 || customEq) && (
        <div className="flex flex-wrap gap-1 mb-2">
          {chips.map((e) => (
            <span key={e.equipmentKey} className="px-1.5 py-0.5 bg-muted rounded text-xs">
              {e.equipmentKey}
            </span>
          ))}
          {customEq && (
            <span className="px-1.5 py-0.5 bg-muted rounded text-xs truncate max-w-[100px]">
              {customEq.customLabel}
            </span>
          )}
          {overflow > 0 && (
            <span className="px-1.5 py-0.5 bg-muted rounded text-xs">+{overflow}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {daysTotal}d / {daysStage}d etapa
        </span>
        <div className="flex items-center gap-1">
          {deal.hasOverdueFollowUp && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Seguimiento vencido" />
          )}
          {missingQuoteAlert && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Falta cotización" />
          )}
          {missingPaymentAlert && (
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" title="Falta pago" />
          )}
          {deal.statusKey !== "activo" && (
            <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">
              {deal.statusKey}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
