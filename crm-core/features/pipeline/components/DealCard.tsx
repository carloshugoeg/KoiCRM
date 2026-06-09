"use client"

import { useState } from "react"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { UserAvatar } from "@/components/ui/user-avatar"
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
  ownerImage?: string | null
  createdById?: string | null
  createdByName?: string | null
  createdByImage?: string | null
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
  hasPaymentWithFile?: boolean
  stageKey: string
  quoteCount: number
  paymentCount: number
  latestQuoteNumber?: string | null
  latestPaymentNumber?: string | null
}

interface DealCardProps {
  deal: DealCardData
  settings: IntlSettings
  equipmentLabels?: Record<string, string>
  onClick: () => void
  stageColor?: string
  isCompact?: boolean       // column-driven compact mode; undefined = legacy internal-toggle
  isHighlighted?: boolean   // column-driven highlight glow
  onOpenDetail?: () => void // separate callback for opening the modal
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

// Convert hex to rgba for subdued backgrounds
function hex2rgba(hex: string, alpha = 0.15) {
  let h = hex.replace("#", "")
  if (h.length === 3) h = h.split("").map(c => c + c).join("")
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${isNaN(r) ? 0 : r},${isNaN(g) ? 0 : g},${isNaN(b) ? 0 : b},${alpha})`
}

function equipmentLabel(
  key: string,
  labels?: Record<string, string>,
): string {
  return labels?.[key] ?? key
}

export function DealCard({
  deal,
  settings,
  equipmentLabels,
  onClick,
  stageColor,
  isCompact,
  isHighlighted,
  onOpenDetail,
}: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id })
  const [isExpanded, setIsExpanded] = useState(false)

  const sc = stageColor ?? "#6366f1"

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
  const missingDoc = hasQuoteAlert || hasPaymentAlert

  const statusColor = STATUS_COLORS[deal.statusKey] ?? "#64748b"

  // Expanded view is shown when: parent explicitly says not-compact (column-controlled),
  // or when internally toggled (legacy uncontrolled mode).
  const showExpanded = isCompact === false || (isCompact === undefined && isExpanded)

  const boxShadow = isDragging
    ? `0 8px 30px ${hex2rgba(sc, 0.4)}, 0 0 0 2px ${sc}`
    : isHighlighted
      ? `0 0 0 2px ${sc}, 0 8px 30px ${hex2rgba(sc, 0.4)}`
      : missingDoc
        ? `0 0 0 2px #ef444450, 0 4px 15px rgba(239,68,68,0.15)`
        : "none"

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        background: "#ffffff",
        borderColor: sc,
        boxShadow,
      }}
      {...listeners}
      {...attributes}
      className="relative w-full max-w-full min-w-0 box-border rounded-xl border cursor-grab active:cursor-grabbing select-none overflow-hidden focus-visible:outline-none transition-shadow duration-300 hover:-translate-y-0.5"
      onMouseEnter={(e) => {
        if (!isDragging && !isHighlighted) {
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            `0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px ${sc}55`
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging && !isHighlighted) {
          (e.currentTarget as HTMLDivElement).style.boxShadow = missingDoc
            ? `0 0 0 2px #ef444450, 0 4px 15px rgba(239,68,68,0.15)`
            : "none"
        }
      }}
      onClick={() => {
        if (isDragging) return
        if (isCompact !== undefined) {
          // Column-controlled mode: delegate click to parent
          onClick()
        } else {
          // Uncontrolled mode: toggle inline expand
          setIsExpanded(p => !p)
        }
      }}
    >
      {/* Alert dot for missing documents */}
      {(hasQuoteAlert || hasPaymentAlert) && (
        <div
          className="absolute top-3 right-3 z-10"
          title={[
            hasQuoteAlert ? "Falta Cotización" : null,
            hasPaymentAlert ? "Falta Pago" : null,
          ].filter(Boolean).join(" · ")}
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-sfPing" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
          </span>
        </div>
      )}

      <div className={`${isCompact ? "p-2.5 space-y-1.5" : "p-3.5 space-y-3"}`}>
        {/* Header: Assigned user avatar + Client Name */}
        <div className="flex items-center gap-2.5">
          <UserAvatar
            userId={deal.ownerId}
            name={deal.ownerName}
            imageUrl={deal.ownerImage}
            size={32}
            className="shadow-sm"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight truncate text-slate-900">{deal.name}</p>
            {deal.company && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{deal.company}</p>
            )}
          </div>
        </div>

        {/* Value and Equipment */}
        <div className="flex min-w-0 items-center justify-between mt-1 gap-2">
          <p className="text-[13px] font-black truncate min-w-0 shrink" style={{ color: sc }}>
            {formatCurrency(deal.value, settings)}
          </p>
          <div className="flex min-w-0 shrink gap-1 justify-end overflow-hidden">
             {(chips.length > 0 || customEq) && (
                <div className="flex gap-1 items-center flex-wrap justify-end">
                  {chips.map((e) => (
                    <span
                      key={e.equipmentKey}
                      className="text-[10px] font-medium text-slate-500 truncate max-w-[80px]"
                    >
                      {equipmentLabel(e.equipmentKey, equipmentLabels)}
                    </span>
                  ))}
                  {customEq && (
                    <span className="text-[10px] font-medium text-slate-500 truncate max-w-[80px]">
                      {customEq.customLabel}
                    </span>
                  )}
                  {overflow > 0 && (
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-50 text-blue-600 text-[9px] font-bold border border-blue-100 ml-1 shrink-0">
                      +{overflow}
                    </span>
                  )}
                </div>
              )}
          </div>
        </div>

        {/* Footer: Status Pill and Days */}
        <div className="flex min-w-0 items-center justify-between gap-1 pt-1">
          <div className="flex min-w-0 shrink gap-1.5 overflow-hidden">
            <span
              className="max-w-full truncate px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink"
              style={{
                background: hex2rgba(statusColor, 0.15),
                color: statusColor,
                border: `1px solid ${hex2rgba(statusColor, 0.3)}`,
              }}
            >
              {deal.statusKey}
            </span>
            {deal.hasOverdueFollowUp && (
               <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                 style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5" }}>
                 Vencido
               </span>
            )}
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              {daysTotal}d
            </span>
            <UserAvatar
              userId={deal.ownerId}
              name={deal.ownerName}
              imageUrl={deal.ownerImage}
              size={18}
              className="border-white shadow-sm"
            />
          </div>
        </div>

        {showExpanded && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2 animate-in slide-in-from-top-2 fade-in duration-200">
            {deal.phone && (
              <div className="flex justify-between items-center text-xs gap-2">
                <span className="text-slate-500 font-medium shrink-0">Teléfono:</span>
                <a href={`tel:${deal.phone}`} className="text-slate-800 font-bold hover:underline truncate text-right" onClick={e => e.stopPropagation()}>{deal.phone}</a>
              </div>
            )}
            {deal.whatsapp && (
              <div className="flex justify-between items-center text-xs gap-2">
                <span className="text-slate-500 font-medium shrink-0">WhatsApp:</span>
                <a href={`https://wa.me/${deal.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-slate-800 font-bold hover:underline truncate text-right" onClick={e => e.stopPropagation()}>{deal.whatsapp}</a>
              </div>
            )}
            {deal.latestQuoteNumber && (
              <div className="flex justify-between items-center text-xs gap-2">
                <span className="text-slate-500 font-medium shrink-0">Cotización:</span>
                <span className="text-slate-800 font-bold truncate text-right">{deal.latestQuoteNumber}</span>
              </div>
            )}
            {deal.latestPaymentNumber && (
              <div className="flex justify-between items-center text-xs gap-2">
                <span className="text-slate-500 font-medium shrink-0">Doc. de Pago:</span>
                <span className="text-slate-800 font-bold truncate text-right">{deal.latestPaymentNumber}</span>
              </div>
            )}
            {hasQuoteAlert && (
              <span className="text-[10px] font-semibold text-red-600">⚠ Falta cotización</span>
            )}
            {hasPaymentAlert && (
              <span className="text-[10px] font-semibold text-red-600">⚠ Falta doc. de pago</span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                ;(onOpenDetail ?? onClick)()
              }}
              className="mt-2 w-full py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md text-xs font-bold transition-colors cursor-pointer"
            >
              Ver detalle
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

