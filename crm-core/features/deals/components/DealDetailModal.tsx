"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { X, Phone, MessageCircle, Mail, ChevronDown, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { HistoryPanel } from "@/features/deals/components/HistoryPanel"
import { NotesSection } from "@/features/notes/components/NotesSection"
import { QuoteSection } from "@/features/quotes/components/QuoteSection"
import { PaymentSection } from "@/features/payments/components/PaymentSection"
import { updateDealFieldAction, moveDealAction, archiveDealAction } from "@/features/deals/actions"
import { addFollowUpAction, completeFollowUpAction, deleteFollowUpAction } from "@/features/follow-ups/actions"
import { getDealActivityAction, getDealFollowUpsAction, getQuotesForDealAction, getPaymentsForDealAction } from "@/features/deals/actions"
import type { ActivityEntry } from "@/features/activity/queries"
import { avatarColor, avatarInitials } from "@/lib/utils/avatar-color"
import { formatCurrency, formatDate } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"
import type { PipelineStage, CatalogItem, FollowUp, Quote, Payment } from "@prisma/client"

interface DealDetailData {
  id: string
  name: string
  company: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  value: number
  statusKey: string
  stageId: string
  stageKey: string
  createdAt: string
  stageEnteredAt: string
  ownerId: string
  ownerName: string | null
  equipment: { equipmentKey: string; customLabel: string | null }[]
  quoteCount: number
  paymentCount: number
}

interface DealDetailModalProps {
  deal: DealDetailData
  stages: PipelineStage[]
  followUpReasons: CatalogItem[]
  tenantId: string
  tenantSlug: string
  settings: IntlSettings
  canEdit?: boolean
  canDelete?: boolean
  onClose: () => void
  onAction?: () => void
}

function diffDays(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

export function DealDetailModal({
  deal,
  stages,
  followUpReasons,
  tenantId,
  tenantSlug,
  settings,
  canEdit = true,
  canDelete = false,
  onClose,
  onAction,
}: DealDetailModalProps) {
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loadingAct, setLoadingAct] = useState(true)
  const [moving, setMoving] = useState(false)

  // Inline edit state
  const [editField, setEditField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")

  // Follow-up add form
  const [fuDate, setFuDate] = useState("")
  const [fuReason, setFuReason] = useState(followUpReasons[0]?.key ?? "")
  const [fuLoading, setFuLoading] = useState(false)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [completingResult, setCompletingResult] = useState("")

  useEffect(() => {
    Promise.all([
      getDealActivityAction(tenantId, deal.id),
      getDealFollowUpsAction(tenantId, deal.id),
      getQuotesForDealAction(tenantId, deal.id),
      getPaymentsForDealAction(tenantId, deal.id),
    ]).then(([acts, fus, qs, ps]) => {
      setActivities(acts)
      setFollowUps(fus)
      setQuotes(qs)
      setPayments(ps)
      setLoadingAct(false)
    })
  }, [tenantId, deal.id])

  async function saveField(field: string, value: string | number) {
    const result = await updateDealFieldAction({ tenantId, tenantSlug, dealId: deal.id, field, value })
    if (!result.ok) toast.error(result.error ?? "Error al guardar.")
    else {
      toast.success("Guardado.", { onAutoClose: () => onAction?.() })
      setEditField(null)
    }
  }

  async function handleMove(toStageId: string, force = false) {
    if (moving) return
    setMoving(true)
    try {
      const result = await moveDealAction({ tenantId, tenantSlug, dealId: deal.id, toStageId, force })
      if (!result.ok) toast.error(result.error ?? "Error al mover.")
      else {
        toast.success("Etapa actualizada.", { onAutoClose: () => onAction?.() })
        onClose()
      }
    } finally {
      setMoving(false)
    }
  }

  async function handleArchive() {
    if (!confirm("¿Archivar esta oportunidad?")) return
    const result = await archiveDealAction({ tenantId, tenantSlug, dealId: deal.id })
    if (!result.ok) toast.error(result.error ?? "Error al archivar.")
    else {
      toast.success("Archivado.")
      onClose()
      onAction?.()
    }
  }

  async function handleAddFollowUp() {
    if (!fuDate || !fuReason) return
    setFuLoading(true)
    const result = await addFollowUpAction({ tenantId, tenantSlug, dealId: deal.id, date: fuDate, reasonKey: fuReason })
    setFuLoading(false)
    if (!result.ok) toast.error(result.error ?? "Error al agregar seguimiento.")
    else {
      toast.success("Seguimiento agregado.")
      const updated = await getDealFollowUpsAction(tenantId, deal.id)
      setFollowUps(updated)
      setFuDate("")
    }
  }

  async function handleCompleteFollowUp(followUpId: string, result: string) {
    const res = await completeFollowUpAction({ tenantId, tenantSlug, followUpId, result: result || undefined })
    if (!res.ok) toast.error(res.error ?? "Error.")
    else {
      setCompletingId(null)
      setCompletingResult("")
      const updated = await getDealFollowUpsAction(tenantId, deal.id)
      setFollowUps(updated)
    }
  }

  async function handleDeleteFollowUp(followUpId: string) {
    if (!confirm("¿Eliminar este seguimiento?")) return
    const res = await deleteFollowUpAction({ tenantId, tenantSlug, followUpId })
    if (!res.ok) toast.error(res.error ?? "Error.")
    else {
      const updated = await getDealFollowUpsAction(tenantId, deal.id)
      setFollowUps(updated)
    }
  }

  const now = new Date()
  const daysTotal = diffDays(new Date(deal.createdAt), now)
  const daysStage = diffDays(new Date(deal.stageEnteredAt), now)
  const color = avatarColor(deal.ownerId)

  const unlockedStages = stages.filter((s) => !s.locked && s.id !== deal.stageId)
  const wonStage = stages.find((s) => s.key === "ganado")
  const lostStage = stages.find((s) => s.key === "perdido")
  const hasPaymentDoc = payments.some((p) => !p.isVoid && !!p.fileUrl)

  const pendingFUs = followUps.filter((f) => !f.completed)
  const completedFUs = followUps.filter((f) => f.completed)

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-bold">{deal.name}</h2>
            {deal.company && <p className="text-sm text-muted-foreground">{deal.company}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{deal.id}</Badge>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Three-panel body */}
        <div className="flex flex-1 overflow-hidden divide-x">
          {/* LEFT PANEL – Deal data */}
          <ScrollArea className="w-72 shrink-0 p-4 space-y-4">
            {/* Owner */}
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: color }}
              >
                {avatarInitials(deal.ownerName)}
              </div>
              <span className="text-sm font-medium">{deal.ownerName ?? "Sin asesor"}</span>
            </div>

            {/* Value */}
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-1">Valor</p>
              {editField === "value" ? (
                <div className="flex gap-1">
                  <Input
                    autoFocus
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-7 text-sm"
                    onBlur={() => saveField("value", parseFloat(editValue) || 0)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur()
                      if (e.key === "Escape") setEditField(null)
                    }}
                  />
                </div>
              ) : (
                <p
                  className="text-base font-bold cursor-pointer hover:text-primary"
                  onClick={() => { setEditField("value"); setEditValue(String(deal.value)) }}
                >
                  {formatCurrency(deal.value, settings)}
                </p>
              )}
            </div>

            {/* Equipment chips */}
            {deal.equipment.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-muted-foreground mb-1">Equipos</p>
                <div className="flex flex-wrap gap-1">
                  {deal.equipment.map((e) => (
                    <Badge key={e.equipmentKey} variant="secondary" className="text-xs">
                      {e.equipmentKey === "__custom__" ? e.customLabel : e.equipmentKey}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Contact info */}
            <div className="space-y-2 mb-3">
              {deal.phone && (
                <a href={`tel:${deal.phone}`} className="flex items-center gap-2 text-sm hover:text-primary">
                  <Phone className="h-3 w-3" />
                  {deal.phone}
                </a>
              )}
              {deal.whatsapp && (
                <a
                  href={`https://wa.me/${deal.whatsapp.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm hover:text-primary"
                >
                  <MessageCircle className="h-3 w-3" />
                  {deal.whatsapp}
                </a>
              )}
              {deal.email && (
                <a href={`mailto:${deal.email}`} className="flex items-center gap-2 text-sm hover:text-primary">
                  <Mail className="h-3 w-3" />
                  {deal.email}
                </a>
              )}
            </div>

            <Separator />

            {/* Time metrics */}
            <div className="text-xs text-muted-foreground space-y-1 mt-3">
              <p>Creado: {formatDate(deal.createdAt, settings)}</p>
              <p>{daysTotal}d totales · {daysStage}d en etapa</p>
            </div>

            <Separator />

            {/* Quotes */}
            <div className="border-t pt-4 mt-3">
              <QuoteSection
                dealId={deal.id}
                tenantId={tenantId}
                quotes={quotes}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            </div>

            {/* Payments */}
            <div className="border-t pt-4 mt-3">
              <PaymentSection
                dealId={deal.id}
                tenantId={tenantId}
                payments={payments}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            </div>
          </ScrollArea>

          {/* CENTER PANEL – Operations */}
          <ScrollArea className="flex-1 p-4">
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              {unlockedStages.length > 0 && (
                <Select onValueChange={(v) => handleMove(v)}>
                  <SelectTrigger className="w-40 h-8 text-xs" disabled={moving}>
                    <SelectValue placeholder="Mover a..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unlockedStages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {wonStage && deal.stageKey !== "ganado" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs text-emerald-600 border-emerald-300"
                  onClick={() => handleMove(wonStage.id, true)}
                  disabled={loadingAct || !hasPaymentDoc || moving}
                  title={!hasPaymentDoc ? "Adjunta un documento de pago antes de marcar como ganado" : undefined}
                >
                  Marcar como ganado
                </Button>
              )}
              {lostStage && deal.stageKey !== "perdido" && (
                <Button size="sm" variant="outline" className="h-8 text-xs text-red-600 border-red-300" onClick={() => handleMove(lostStage.id, true)} disabled={moving}>
                  Marcar como perdido
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleArchive} disabled={moving}>
                Archivar
              </Button>
            </div>

            <Separator className="mb-4" />

            {/* Follow-ups */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-3">Seguimientos</h3>

              {pendingFUs.length === 0 && (
                <p className="text-xs text-muted-foreground mb-3">Sin seguimientos pendientes.</p>
              )}

              <div className="space-y-2 mb-3">
                {pendingFUs.map((fu) => {
                  const isCompleting = completingId === fu.id
                  const reasonLabel = followUpReasons.find((r) => r.key === fu.reasonKey)?.label ?? fu.reasonKey
                  return (
                    <div key={fu.id} className="p-2 bg-muted/40 rounded space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">{reasonLabel}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(fu.date.toISOString(), settings)}</p>
                        </div>
                        {canEdit && (
                          <Button
                            size="sm" variant="outline" className="h-6 text-xs shrink-0"
                            onClick={() => { setCompletingId(fu.id); setCompletingResult("") }}
                          >
                            Completar
                          </Button>
                        )}
                        {canEdit && (
                          <Button
                            size="icon" variant="ghost" className="h-6 w-6 shrink-0"
                            onClick={() => handleDeleteFollowUp(fu.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {canEdit && isCompleting && (
                        <div className="flex gap-2 items-center">
                          <Input
                            placeholder="Resultado (opcional)"
                            value={completingResult}
                            onChange={(e) => setCompletingResult(e.target.value)}
                            className="h-6 text-xs flex-1"
                          />
                          <Button
                            size="sm" className="h-6 text-xs"
                            onClick={() => handleCompleteFollowUp(fu.id, completingResult)}
                          >
                            Confirmar
                          </Button>
                          <button className="text-xs text-muted-foreground" onClick={() => setCompletingId(null)}>
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Add follow-up form */}
              {canEdit && (
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input
                      type="date"
                      value={fuDate}
                      onChange={(e) => setFuDate(e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                  <Select value={fuReason} onValueChange={setFuReason}>
                    <SelectTrigger className="w-36 h-7 text-xs">
                      <SelectValue placeholder="Motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {followUpReasons.map((r) => (
                        <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="h-7 text-xs" onClick={handleAddFollowUp} disabled={fuLoading || !fuDate}>
                    {fuLoading ? "..." : "Agregar"}
                  </Button>
                </div>
              )}

              {completedFUs.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs text-muted-foreground cursor-pointer">
                    {completedFUs.length} completado(s)
                  </summary>
                  <div className="space-y-1 mt-2">
                    {completedFUs.map((fu) => (
                      <div key={fu.id} className="p-2 bg-muted/20 rounded opacity-60">
                        <p className="text-xs line-through">{followUpReasons.find((r) => r.key === fu.reasonKey)?.label ?? fu.reasonKey}</p>
                        {fu.result && <p className="text-xs text-muted-foreground">{fu.result}</p>}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>

            <Separator className="mb-4" />

            <div>
              <h3 className="text-sm font-semibold mb-2">Notas</h3>
              <NotesSection
                tenantId={tenantId}
                tenantSlug={tenantSlug}
                dealId={deal.id}
                settings={settings}
              />
            </div>
          </ScrollArea>

          {/* RIGHT PANEL – History */}
          <ScrollArea className="w-64 shrink-0 p-4">
            <h3 className="text-sm font-semibold mb-3">Historial</h3>
            {loadingAct ? (
              <p className="text-xs text-muted-foreground">Cargando...</p>
            ) : (
              <HistoryPanel activities={activities} settings={settings} />
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
