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
  hasQuoteAlert: boolean
  hasPaymentAlert: boolean
  stageKey: string
  quoteCount: number
  paymentCount: number
}

interface DealCardProps {
  deal: DealCardData
  settings: IntlSettings
  onClick: () => void
  stageColor?: string
}

const STATUS_COLORS: Record<string, string> = {
  activo:      "#059669",
  seguimiento: "#d97706",
  esperando:   "#4f46e5",
  frio:        "#475569",
  urgente:     "#dc2626",
}

function diffDays(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

export function DealCard({ deal, settings, onClick, stageColor }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id })

  const sc = stageColor ?? "#6366f1"
  const ownerColor = avatarColor(deal.ownerId)

  const now = new Date()
  const daysTotal = diffDays(deal.createdAt, now)
  const daysStage = diffDays(deal.stageEnteredAt, now)

  const chips = deal.equipment
    .filter((e) => e.equipmentKey !== "__custom__")
    .slice(0, 2)
  const customEq = deal.equipment.find((e) => e.equipmentKey === "__custom__")
  const overflow = deal.equipment.filter((e) => e.equipmentKey !== "__custom__").length - 2

  const hasQuoteAlert = deal.hasQuoteAlert ?? false
  const hasPaymentAlert = deal.hasPaymentAlert ?? false

  const statusColor = STATUS_COLORS[deal.statusKey] ?? "#64748b"

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        background: "var(--card-bg)",
        border: `1px solid ${sc}4d`,
      }}
      {...listeners}
      {...attributes}
      className="relative rounded-xl cursor-grab active:cursor-grabbing select-none overflow-hidden
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                 focus-visible:ring-offset-1 transition-all duration-300 hover:-translate-y-0.5"
      onMouseEnter={(e) => {
        if (!isDragging) {
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            `0 6px 22px rgba(0,0,0,0.18), 0 0 0 1px ${sc}55`
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none"
      }}
      onClick={onClick}
    >
      {/* Stage-color top gradient bar */}
      <div
        className="h-0.5 w-full shrink-0"
        style={{ background: `linear-gradient(90deg, ${sc}cc, transparent)` }}
      />

      {/* Card body */}
      <div className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-start gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
            style={{ backgroundColor: ownerColor }}
            title={deal.ownerName ?? ""}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight truncate">{deal.name}</p>
            {deal.company && (
              <p className="text-xs text-muted-foreground truncate">{deal.company}</p>
            )}
          </div>
        </div>

        {/* Value */}
        <p className="text-sm font-black" style={{ color: sc }}>
          {formatCurrency(deal.value, settings)}
        </p>

        {/* Equipment chips */}
        {(chips.length > 0 || customEq) && (
          <div className="flex flex-wrap gap-1">
            {chips.map((e) => (
              <span
                key={e.equipmentKey}
                className="px-1.5 py-0.5 rounded-md text-xs"
                style={{
                  background: "var(--tag-bg)",
                  border: "1px solid var(--tag-border)",
                }}
              >
                {e.equipmentKey}
              </span>
            ))}
            {customEq && (
              <span
                className="px-1.5 py-0.5 rounded-md text-xs truncate max-w-[100px]"
                style={{
                  background: "var(--tag-bg)",
                  border: "1px solid var(--tag-border)",
                }}
              >
                {customEq.customLabel}
              </span>
            )}
            {overflow > 0 && (
              <span
                className="px-1.5 py-0.5 rounded-md text-xs"
                style={{
                  background: "var(--tag-bg)",
                  border: "1px solid var(--tag-border)",
                }}
              >
                +{overflow}
              </span>
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
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ background: "#dc262618", color: "#dc2626", border: "1px solid #dc262640" }}>
                Vencido
              </span>
            )}
            {deal.statusKey !== "activo" && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{
                  background: `${statusColor}18`,
                  color: statusColor,
                  border: `1px solid ${statusColor}40`,
                }}
              >
                {deal.statusKey}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Alert dot */}
      {(hasQuoteAlert || hasPaymentAlert) && (
        <div
          className="absolute top-2 right-2"
          role="img"
          aria-label={[
            hasQuoteAlert ? "Falta Cotización" : null,
            hasPaymentAlert ? "Falta Pago" : null,
          ]
            .filter(Boolean)
            .join(", ")}
          title={[
            hasQuoteAlert ? "Falta Cotización" : null,
            hasPaymentAlert ? "Falta Pago" : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{
                background: "#ef4444",
                animation: "sfPing 1.2s cubic-bezier(0,0,0.2,1) infinite",
              }}
            />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
        </div>
      )}
    </div>
  )
}
