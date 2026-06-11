"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { toastMessages, toastErrorFromResult } from "@/lib/ui/toast-messages"
import { PAYMENT_DOC_REQUIRED_FOR_WON } from "@/lib/pipeline/stage-block-message"
import { X, Phone, MessageCircle, Mail, Trash2, Lock, Pencil } from "lucide-react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { DialogPortal, DialogOverlay, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog } from "@/components/ui/alert-dialog"
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
import { DealAttachmentsSection } from "@/features/attachments/components/DealAttachmentsSection"
import { updateDealFieldAction, moveDealAction, archiveDealAction, transferDealAction, deleteDealAction } from "@/features/deals/actions"
import { addFollowUpAction, completeFollowUpAction, deleteFollowUpAction } from "@/features/follow-ups/actions"
import { getDealActivityAction, getDealFollowUpsAction, getQuotesForDealAction, getPaymentsForDealAction } from "@/features/deals/actions"
import { PinProvider, useActionPin } from "@/features/auth/pin-gate"
import type { ActivityEntry } from "@/features/activity/queries"
import { UserAvatar } from "@/components/ui/user-avatar"
import { formatPhone } from "@/lib/deals/phone-format"
import { formatCurrency, formatDate } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"
import type { PipelineStage, FollowUp, Quote, Payment } from "@prisma/client"

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
  ownerImage?: string | null
  createdById?: string | null
  createdByName?: string | null
  createdByImage?: string | null
  equipment: { equipmentKey: string; customLabel: string | null }[]
  quoteCount: number
  paymentCount: number
}

interface DealDetailModalProps {
  deal: DealDetailData
  stages: PipelineStage[]
  tenantId: string
  tenantSlug: string
  settings: IntlSettings
  /** Whether the current user can edit THIS deal (owner or supervisor+). */
  canEdit?: boolean
  /** Whether the current user can archive (supervisor+). */
  canArchive?: boolean
  /** Whether the current user can permanently delete (superadmin). */
  canDelete?: boolean
  /** Team members for the cesión / reassignment selector. */
  members?: { id: string; name: string | null; email: string }[]
  onClose: () => void
  onAction?: () => void
}

function diffDays(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

function FieldEditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-primary"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Pencil className="h-3 w-3" />
    </Button>
  )
}

/** Follow-ups from server actions arrive with ISO date strings, not Date instances. */
type FollowUpRow = Omit<FollowUp, "date" | "completedAt" | "createdAt"> & {
  date: Date | string
  completedAt: Date | string | null
  createdAt: Date | string
}

function DealDetailModalContent({
  deal,
  stages,
  tenantId,
  tenantSlug,
  settings,
  canEdit = true,
  canArchive = false,
  canDelete = false,
  members = [],
  onClose,
  onAction,
}: DealDetailModalProps) {
  const router = useRouter()
  const { guard } = useActionPin()
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [activityCursor, setActivityCursor] = useState<string | null>(null)
  const [loadingMoreAct, setLoadingMoreAct] = useState(false)
  const [followUps, setFollowUps] = useState<FollowUpRow[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loadingAct, setLoadingAct] = useState(true)
  const [moving, setMoving] = useState(false)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [deleteFollowUpId, setDeleteFollowUpId] = useState<string | null>(null)

  // Inline edit state
  const [editField, setEditField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")

  // Follow-up add form
  const [fuDate, setFuDate] = useState("")
  const [fuNote, setFuNote] = useState("")
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
      setActivities(acts.items)
      setActivityCursor(acts.nextCursor)
      setFollowUps(fus)
      setQuotes(qs)
      setPayments(ps)
      setLoadingAct(false)
    })
  }, [tenantId, deal.id])

  async function refreshQuotesAndPayments() {
    const [qs, ps, acts] = await Promise.all([
      getQuotesForDealAction(tenantId, deal.id),
      getPaymentsForDealAction(tenantId, deal.id),
      getDealActivityAction(tenantId, deal.id),
    ])
    setQuotes(qs)
    setPayments(ps)
    setActivities(acts.items)
    setActivityCursor(acts.nextCursor)
    router.refresh()
  }

  async function handleLoadMoreActivity() {
    if (loadingMoreAct || !activityCursor) return
    setLoadingMoreAct(true)
    try {
      const { items, nextCursor } = await getDealActivityAction(tenantId, deal.id, activityCursor)
      setActivities((prev) => [...prev, ...items])
      setActivityCursor(nextCursor)
    } finally {
      setLoadingMoreAct(false)
    }
  }

  async function saveField(field: string, value: string | number) {
    const result = await guard((pin) => updateDealFieldAction({ tenantId, tenantSlug, dealId: deal.id, field, value, pin }))
    if (!result.ok) {
      if (!result.requiresPin) toast.error(toastErrorFromResult(result.error, toastMessages.deal.errorSave))
    } else {
      toast.success(toastMessages.deal.saved, { onAutoClose: () => onAction?.() })
      setEditField(null)
    }
  }

  async function handleMove(toStageId: string, force = false) {
    if (moving) return
    setMoving(true)
    try {
      const result = await guard((pin) => moveDealAction({ tenantId, tenantSlug, dealId: deal.id, toStageId, force, pin }))
      if (!result.ok) {
        if (!result.requiresPin) toast.error(toastErrorFromResult(result.error, toastMessages.deal.errorMove))
      } else {
        toast.success(toastMessages.deal.stageUpdated, { onAutoClose: () => onAction?.() })
        onClose()
      }
    } finally {
      setMoving(false)
    }
  }

  async function handleArchive() {
    if (moving) return
    setMoving(true)
    try {
      const result = await guard((pin) => archiveDealAction({ tenantId, tenantSlug, dealId: deal.id, pin }))
      if (!result.ok) {
        if (!result.requiresPin) toast.error(toastErrorFromResult(result.error, toastMessages.deal.errorArchive))
      } else {
        toast.success(toastMessages.deal.archived, { onAutoClose: () => onAction?.() })
        onClose()
      }
    } finally {
      setMoving(false)
    }
  }

  async function handleTransfer(toUserId: string) {
    if (transferring || toUserId === deal.ownerId) {
      setEditField(null)
      return
    }
    setTransferring(true)
    try {
      const result = await guard((pin) => transferDealAction({ tenantId, tenantSlug, dealId: deal.id, toUserId, pin }))
      if (!result.ok) {
        if (!result.requiresPin) toast.error(toastErrorFromResult(result.error, toastMessages.deal.errorSave))
      } else {
        toast.success(toastMessages.deal.transferred, { onAutoClose: () => onAction?.() })
        setEditField(null)
      }
    } finally {
      setTransferring(false)
    }
  }

  async function handleDelete() {
    if (moving) return
    setMoving(true)
    try {
      const result = await guard((pin) => deleteDealAction({ tenantId, tenantSlug, dealId: deal.id, pin }))
      if (!result.ok) {
        if (!result.requiresPin) toast.error(toastErrorFromResult(result.error, toastMessages.deal.errorDelete))
      } else {
        toast.success(toastMessages.deal.deleted, { onAutoClose: () => onAction?.() })
        onClose()
      }
    } finally {
      setMoving(false)
    }
  }

  async function handleAddFollowUp() {
    if (!fuDate) {
      toast.error("Selecciona una fecha para el seguimiento.")
      return
    }
    setFuLoading(true)
    try {
      const result = await guard((pin) =>
        addFollowUpAction({ tenantId, tenantSlug, dealId: deal.id, date: fuDate, note: fuNote.trim() || undefined, pin }),
      )
      if (!result.ok) {
        if (!result.requiresPin) toast.error(toastErrorFromResult(result.error, toastMessages.deal.errorFollowUp))
      } else {
        toast.success(toastMessages.deal.followUpAdded)
        const updated = await getDealFollowUpsAction(tenantId, deal.id)
        setFollowUps(updated)
        setFuDate("")
        setFuNote("")
        router.refresh()
      }
    } finally {
      setFuLoading(false)
    }
  }

  async function handleCompleteFollowUp(followUpId: string, result: string) {
    const res = await guard((pin) => completeFollowUpAction({ tenantId, tenantSlug, followUpId, result: result || undefined, pin }))
    if (!res.ok) {
      if (!res.requiresPin) toast.error(toastErrorFromResult(res.error, toastMessages.deal.errorFollowUp))
    } else {
      toast.success(toastMessages.deal.followUpCompleted)
      setCompletingId(null)
      setCompletingResult("")
      const updated = await getDealFollowUpsAction(tenantId, deal.id)
      setFollowUps(updated)
      router.refresh()
    }
  }

  async function handleDeleteFollowUp(followUpId: string) {
    const res = await guard((pin) => deleteFollowUpAction({ tenantId, tenantSlug, followUpId, pin }))
    if (!res.ok) {
      if (!res.requiresPin) toast.error(toastErrorFromResult(res.error, toastMessages.deal.errorFollowUp))
    } else {
      toast.success(toastMessages.deal.followUpRemoved)
      const updated = await getDealFollowUpsAction(tenantId, deal.id)
      setFollowUps(updated)
      router.refresh()
    }
  }

  const now = new Date()
  const daysTotal = diffDays(new Date(deal.createdAt), now)
  const daysStage = diffDays(new Date(deal.stageEnteredAt), now)

  const unlockedStages = stages.filter((s) => !s.locked && s.id !== deal.stageId)
  const wonStage = stages.find((s) => s.key === "ganado")
  const lostStage = stages.find((s) => s.key === "perdido")
  const hasPaymentDoc = payments.some((p) => !p.isVoid && !!p.fileUrl)

  const pendingFUs = followUps.filter((f) => !f.completed)
  const completedFUs = followUps.filter((f) => f.completed)

  return (
    <>
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] w-full max-w-5xl max-h-[90vh] bg-background rounded-xl shadow-2xl flex flex-col focus:outline-none"
          aria-describedby={undefined}
        >
        <DialogTitle className="sr-only">{deal.name}</DialogTitle>
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

        {!canEdit && (
          <div className="flex items-center gap-2 px-6 py-2 border-b bg-amber-50 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            <Lock className="h-3 w-3 shrink-0" />
            Solo lectura — no tienes permisos para editar esta oportunidad.
          </div>
        )}

        {/* Three-panel body */}
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden divide-y md:flex-row md:divide-x md:divide-y-0">
          {/* LEFT PANEL – Deal data */}
          <ScrollArea className="h-auto max-h-[45vh] w-full shrink-0 md:h-full md:max-h-none md:w-80">
            <div className="min-w-0 w-full max-w-full space-y-4 p-4">
            {/* Asignado a / Creado por */}
            <div className="mb-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <UserAvatar userId={deal.ownerId} name={deal.ownerName} imageUrl={deal.ownerImage} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground leading-none">Asignado a</p>
                    {canEdit && members.length > 1 && editField !== "owner" && (
                      <FieldEditButton
                        label="Cambiar asesor asignado"
                        onClick={() => setEditField("owner")}
                      />
                    )}
                  </div>
                  {editField === "owner" ? (
                    <div className="mt-1 space-y-1">
                      <Select
                        value={deal.ownerId}
                        onValueChange={handleTransfer}
                        disabled={transferring}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Elegir asesor…" />
                        </SelectTrigger>
                        <SelectContent>
                          {members.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.name ?? m.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setEditField(null)}
                        disabled={transferring}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm font-medium truncate">{deal.ownerName ?? "Sin asesor"}</p>
                  )}
                </div>
              </div>
              {deal.createdById && (
                <div className="flex items-center gap-2">
                  <UserAvatar userId={deal.createdById} name={deal.createdByName} imageUrl={deal.createdByImage} size={32} />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground leading-none">Creado por</p>
                    <p className="text-sm font-medium truncate">{deal.createdByName ?? "—"}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Value */}
            <div className="mb-3">
              <div className="flex items-center justify-between gap-1 mb-1">
                <p className="text-xs text-muted-foreground">Valor</p>
                {canEdit && editField !== "value" && (
                  <FieldEditButton
                    label="Editar valor"
                    onClick={() => { setEditField("value"); setEditValue(String(deal.value)) }}
                  />
                )}
              </div>
              {editField === "value" ? (
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
              ) : (
                <p className="text-base font-bold">{formatCurrency(deal.value, settings)}</p>
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
              {(deal.phone || canEdit) && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
                  {editField === "phone" ? (
                    <Input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(formatPhone(e.target.value, false))}
                      className="h-7 flex-1 text-sm"
                      placeholder="XXXX-XXXX"
                      onBlur={() => saveField("phone", editValue)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur()
                        if (e.key === "Escape") setEditField(null)
                      }}
                    />
                  ) : deal.phone ? (
                    <a href={`tel:${deal.phone}`} className="flex-1 text-sm hover:text-primary truncate">
                      {deal.phone}
                    </a>
                  ) : (
                    <span className="flex-1 text-sm text-muted-foreground italic">Sin teléfono</span>
                  )}
                  {canEdit && editField !== "phone" && (
                    <FieldEditButton
                      label="Editar teléfono"
                      onClick={() => { setEditField("phone"); setEditValue(deal.phone ?? "") }}
                    />
                  )}
                </div>
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
                onRefresh={refreshQuotesAndPayments}
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
                onRefresh={refreshQuotesAndPayments}
              />
            </div>

            {/* Files & images (screenshots, product photos, etc.) */}
            <div className="border-t pt-4 mt-3">
              <DealAttachmentsSection
                dealId={deal.id}
                tenantId={tenantId}
                canEdit={canEdit}
                excludeUrls={[...quotes.map((q) => q.fileUrl), ...payments.map((p) => p.fileUrl)].filter(
                  (u): u is string => !!u,
                )}
              />
            </div>
            </div>
          </ScrollArea>

          {/* CENTER PANEL – Operations */}
          <ScrollArea className="min-h-0 min-w-0 flex-1">
            <div className="min-w-0 w-full p-4">
            {/* Action buttons */}
            {wonStage && deal.stageKey !== "ganado" && !hasPaymentDoc && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-950 dark:text-amber-100"
              >
                <p className="font-semibold text-amber-800 dark:text-amber-200">
                  Etapa «Ganado» bloqueada para esta oportunidad
                </p>
                <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">{PAYMENT_DOC_REQUIRED_FOR_WON}</p>
              </div>
            )}

            {(canEdit || canArchive || canDelete) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {canEdit && unlockedStages.length > 0 && (
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
                {canEdit && wonStage && deal.stageKey !== "ganado" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs text-emerald-600 border-emerald-300"
                    onClick={() => {
                      if (!hasPaymentDoc) {
                        toast.error(toastMessages.deal.paymentDocRequiredForWon, { duration: 8000 })
                        return
                      }
                      void handleMove(wonStage.id, true)
                    }}
                    disabled={loadingAct || moving}
                    title={!hasPaymentDoc ? PAYMENT_DOC_REQUIRED_FOR_WON : undefined}
                  >
                    Marcar como ganado
                  </Button>
                )}
                {canEdit && lostStage && deal.stageKey !== "perdido" && (
                  <Button size="sm" variant="outline" className="h-8 text-xs text-red-600 border-red-300" onClick={() => handleMove(lostStage.id, true)} disabled={moving}>
                    Marcar como perdido
                  </Button>
                )}
                {canArchive && (
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setArchiveConfirmOpen(true)} disabled={moving}>
                    Archivar
                  </Button>
                )}
                {canDelete && (
                  <Button size="sm" variant="outline" className="h-8 text-xs text-red-600 border-red-300" onClick={() => setDeleteConfirmOpen(true)} disabled={moving}>
                    <Trash2 className="h-3 w-3 mr-1" />
                    Eliminar
                  </Button>
                )}
              </div>
            )}

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
                  return (
                    <div key={fu.id} className="p-2 bg-muted/40 rounded space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          {fu.note && <p className="text-xs font-medium">{fu.note}</p>}
                          <p className="text-xs text-muted-foreground">{formatDate(fu.date, settings)}</p>
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
                            onClick={() => setDeleteFollowUpId(fu.id)}
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
                  <Input
                    type="text"
                    placeholder="Texto del seguimiento (opcional)"
                    maxLength={500}
                    value={fuNote}
                    onChange={(e) => setFuNote(e.target.value)}
                    className="h-7 text-xs flex-1"
                  />
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleAddFollowUp}
                    disabled={fuLoading || !fuDate}
                  >
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
                        {fu.note && <p className="text-xs line-through">{fu.note}</p>}
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
                canEdit={canEdit}
              />
            </div>
            </div>
          </ScrollArea>

          {/* RIGHT PANEL – History */}
          <ScrollArea className="h-auto max-h-[35vh] w-full shrink-0 md:h-full md:max-h-none md:w-64">
            <div className="min-w-0 w-full p-4">
            <h3 className="text-sm font-semibold mb-3">Historial</h3>
            {loadingAct ? (
              <p className="text-xs text-muted-foreground">Cargando...</p>
            ) : (
              <>
                <HistoryPanel activities={activities} settings={settings} />
                {activityCursor && (
                  <div className="mt-3 flex justify-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={handleLoadMoreActivity}
                      disabled={loadingMoreAct}
                    >
                      {loadingMoreAct ? "Cargando..." : "Cargar más"}
                    </Button>
                  </div>
                )}
              </>
            )}
            </div>
          </ScrollArea>
        </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>

    <AlertDialog
      open={archiveConfirmOpen}
      onOpenChange={setArchiveConfirmOpen}
      title="¿Archivar oportunidad?"
      description="La oportunidad se moverá al archivo y no aparecerá en el pipeline."
      confirmLabel="Archivar"
      cancelLabel="Cancelar"
      destructive
      onConfirm={handleArchive}
    />

    <AlertDialog
      open={deleteConfirmOpen}
      onOpenChange={setDeleteConfirmOpen}
      title="¿Eliminar oportunidad?"
      description="La oportunidad se eliminará de forma permanente, junto con sus cotizaciones, pagos, seguimientos y archivos. Esta acción no se puede deshacer."
      confirmLabel="Eliminar"
      cancelLabel="Cancelar"
      destructive
      onConfirm={handleDelete}
    />

    <AlertDialog
      open={deleteFollowUpId !== null}
      onOpenChange={(open) => { if (!open) setDeleteFollowUpId(null) }}
      title="¿Eliminar seguimiento?"
      description="Esta acción no se puede deshacer."
      confirmLabel="Eliminar"
      cancelLabel="Cancelar"
      destructive
      onConfirm={() => { if (deleteFollowUpId) handleDeleteFollowUp(deleteFollowUpId) }}
    />
    </>
  )
}

export function DealDetailModal(props: DealDetailModalProps) {
  return (
    <PinProvider>
      <DealDetailModalContent {...props} />
    </PinProvider>
  )
}
