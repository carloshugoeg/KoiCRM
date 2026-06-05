"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  BadgeCheck,
  CalendarCheck,
  ChevronDown,
  Clock,
  FileText,
  Paperclip,
  Plus,
  Save,
  User,
  X,
} from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { createDealAction } from "@/features/deals/actions"
import { addNoteAction } from "@/features/notes/actions"
import { addFollowUpAction } from "@/features/follow-ups/actions"
import { createQuote } from "@/features/quotes/actions"
import { createPayment } from "@/features/payments/actions"
import { confirmUpload } from "@/features/attachments/actions"
import { uploadDealFile } from "@/features/attachments/upload-deal-file"
import { formatPhone } from "@/lib/deals/phone-format"
import { getChannelColor, getChannelIcon } from "@/lib/deals/channel-icons"
import { equipmentIcon } from "@/lib/settings/constants"
import { toastMessages, toastErrorFromResult } from "@/lib/ui/toast-messages"
import { avatarColor } from "@/lib/utils/avatar-color"
import { UserAvatar } from "@/components/ui/user-avatar"
import { hex2rgba } from "@/lib/utils/color"
import type { CatalogItem } from "@prisma/client"

export interface ClientFormMember {
  id: string
  name: string | null
  email: string
  image?: string | null
}

interface ClientFormModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: (dealId: string) => void
  tenantId: string
  tenantSlug: string
  members: ClientFormMember[]
  channels: CatalogItem[]
  equipment: CatalogItem[]
  statuses: CatalogItem[]
  followUpReasons: CatalogItem[]
  /** Asesores can't choose the owner — the deal is always assigned to them. */
  canChooseOwner?: boolean
  currentUserId?: string
  prefill?: {
    name?: string | null
    company?: string | null
    phone?: string | null
    whatsapp?: string | null
    email?: string | null
  }
}

type PendingDoc = { id: string; number: string; file: File; fileName: string }

type FormErrors = {
  owner?: boolean
  channel?: boolean
  name?: boolean
  phone?: boolean
  equipment?: boolean
}

function nowStamp(): string {
  return new Date().toLocaleString("es-GT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function fieldClass(err?: boolean) {
  return `w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-colors bg-muted/40 ${
    err ? "border-red-400" : "border-border focus:border-indigo-500"
  }`
}

export function ClientFormModal({
  open,
  onClose,
  onSuccess,
  tenantId,
  tenantSlug,
  members,
  channels,
  equipment,
  statuses,
  followUpReasons,
  canChooseOwner = true,
  currentUserId,
  prefill,
}: ClientFormModalProps) {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  const [ownerId, setOwnerId] = useState("")
  const [channelKey, setChannelKey] = useState("")
  const [name, setName] = useState(prefill?.name ?? "")
  const [company, setCompany] = useState(prefill?.company ?? "")
  const [phone, setPhone] = useState(prefill?.phone ?? "")
  const [whatsapp, setWhatsapp] = useState(prefill?.whatsapp ?? "")
  const [email, setEmail] = useState(prefill?.email ?? "")
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])
  const [equipmentCustom, setEquipmentCustom] = useState("")
  const [valueDisplay, setValueDisplay] = useState("")
  const [value, setValue] = useState(0)
  const [statusKey, setStatusKey] = useState(statuses[0]?.key ?? "activo")
  const [followUpDate, setFollowUpDate] = useState("")
  const [notes, setNotes] = useState<{ text: string; ts: string }[]>([])
  const [newNote, setNewNote] = useState("")

  const [pendingQuotes, setPendingQuotes] = useState<PendingDoc[]>([])
  const [pendingPayments, setPendingPayments] = useState<PendingDoc[]>([])
  const [addingQuote, setAddingQuote] = useState(false)
  const [addingPayment, setAddingPayment] = useState(false)
  const [newQuoteNumber, setNewQuoteNumber] = useState("")
  const [newQuoteFile, setNewQuoteFile] = useState<File | null>(null)
  const [newPayNumber, setNewPayNumber] = useState("")
  const [newPayFile, setNewPayFile] = useState<File | null>(null)

  useEffect(() => {
    if (!open) return
    setOwnerId(canChooseOwner ? (members[0]?.id ?? "") : (currentUserId ?? ""))
    setChannelKey(channels[0]?.key ?? "")
    setName(prefill?.name ?? "")
    setCompany(prefill?.company ?? "")
    setPhone(prefill?.phone ?? "")
    setWhatsapp(prefill?.whatsapp ?? "")
    setEmail(prefill?.email ?? "")
    setSelectedEquipment([])
    setEquipmentCustom("")
    setValueDisplay("")
    setValue(0)
    setStatusKey(statuses[0]?.key ?? "activo")
    setFollowUpDate("")
    setNotes([])
    setNewNote("")
    setPendingQuotes([])
    setPendingPayments([])
    setErrors({})
  }, [open, prefill, members, channels, statuses, canChooseOwner, currentUserId])

  function toggleEquipment(key: string) {
    setSelectedEquipment((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  function validate(): boolean {
    const e: FormErrors = {}
    if (!ownerId) e.owner = true
    if (!channelKey) e.channel = true
    if (!name.trim()) e.name = true
    if (!phone.trim()) e.phone = true
    if (selectedEquipment.length === 0 && !equipmentCustom.trim()) e.equipment = true
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function addNote() {
    if (!newNote.trim()) return
    setNotes((prev) => [...prev, { text: newNote.trim(), ts: nowStamp() }])
    setNewNote("")
  }

  function addPendingQuote() {
    if (!newQuoteNumber.trim()) {
      toast.error(toastMessages.attachment.quoteNumberRequired)
      return
    }
    if (!newQuoteFile) {
      toast.error(toastMessages.attachment.fileRequired)
      return
    }
    setPendingQuotes((prev) => [
      ...prev,
      {
        id: `q-${Date.now()}`,
        number: newQuoteNumber.trim(),
        file: newQuoteFile,
        fileName: newQuoteFile.name,
      },
    ])
    setNewQuoteNumber("")
    setNewQuoteFile(null)
    setAddingQuote(false)
  }

  function addPendingPayment() {
    if (!newPayNumber.trim()) {
      toast.error(toastMessages.attachment.paymentNumberRequired)
      return
    }
    if (!newPayFile) {
      toast.error(toastMessages.attachment.fileRequired)
      return
    }
    setPendingPayments((prev) => [
      ...prev,
      {
        id: `p-${Date.now()}`,
        number: newPayNumber.trim(),
        file: newPayFile,
        fileName: newPayFile.name,
      },
    ])
    setNewPayNumber("")
    setNewPayFile(null)
    setAddingPayment(false)
  }

  async function persistDocument(
    dealId: string,
    doc: PendingDoc,
    kind: "quote" | "payment",
  ) {
    const uploaded = await uploadDealFile(tenantId, dealId, doc.file)
    if ("error" in uploaded) {
      toast.error(uploaded.error)
      return
    }
    const confirmed = await confirmUpload(tenantId, {
      dealId,
      key: uploaded.key,
      url: uploaded.url,
      mimeType: uploaded.mimeType,
      size: uploaded.size,
    })
    if (!confirmed.ok) {
      toast.error(toastMessages.attachment.errorConfirm)
      return
    }
    const date = new Date()
    if (kind === "quote") {
      await createQuote(tenantId, {
        dealId,
        number: doc.number,
        date,
        fileUrl: uploaded.url,
      })
    } else {
      await createPayment(tenantId, {
        dealId,
        number: doc.number,
        date,
        fileUrl: uploaded.url,
      })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) {
      toast.error(toastMessages.deal.requiredFields)
      return
    }

    setLoading(true)
    const result = await createDealAction({
      tenantId,
      tenantSlug,
      ownerId,
      channelKey,
      name,
      company: company || null,
      phone,
      whatsapp: whatsapp || null,
      email: email || null,
      equipment: selectedEquipment,
      equipmentCustom: equipmentCustom || null,
      value,
      statusKey,
    })
    setLoading(false)

    if (!result.ok || !result.dealId) {
      toast.error(toastErrorFromResult(result.error, toastMessages.deal.errorCreate))
      return
    }

    const dealId = result.dealId

    if (followUpDate) {
      await addFollowUpAction({
        tenantId,
        tenantSlug,
        dealId,
        date: followUpDate,
        reasonKey: followUpReasons[0]?.key ?? "otro",
      })
    }

    for (const note of notes) {
      await addNoteAction({ tenantId, tenantSlug, dealId, body: note.text })
    }

    for (const q of pendingQuotes) {
      await persistDocument(dealId, q, "quote")
    }
    for (const p of pendingPayments) {
      await persistDocument(dealId, p, "payment")
    }

    toast.success(toastMessages.deal.created)
    onClose()
    onSuccess?.(dealId)
  }

  function DocList({
    items,
    accentColor,
    onRemove,
  }: {
    items: PendingDoc[]
    accentColor: string
    onRemove: (id: string) => void
  }) {
    if (items.length === 0) {
      return (
        <p className="text-xs italic opacity-40 text-muted-foreground py-1">Sin documentos</p>
      )
    }
    return (
      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 bg-muted/30 border border-border/80"
          >
            <Paperclip size={11} style={{ color: accentColor }} className="shrink-0" />
            <span className="text-xs font-semibold flex-1 truncate">{item.number}</span>
            <span className="text-[10px] truncate max-w-[100px] opacity-60 text-muted-foreground">
              {item.fileName}
            </span>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="text-muted-foreground hover:text-red-400"
              aria-label="Quitar documento"
            >
              <X size={11} />
            </button>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden border-indigo-500/35 max-h-[90vh] flex flex-col [&>button.absolute]:hidden">
        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between shrink-0 border-b bg-indigo-500/5">
          <div>
            <DialogTitle className="font-bold text-lg">Nueva Oportunidad</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Completa la información del prospecto
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:opacity-70"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {/* ── LEFT ── */}
              <div className="space-y-4">
                {canChooseOwner && (
                <div>
                  <p
                    className={`text-xs font-bold mb-1.5 uppercase tracking-wider flex items-center gap-1.5 ${
                      errors.owner ? "text-red-400" : "text-muted-foreground"
                    }`}
                  >
                    <User size={11} />
                    Asignado a
                    {errors.owner && (
                      <span className="normal-case font-normal">— selecciona uno</span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m) => {
                      const sel = ownerId === m.id
                      const color = avatarColor(m.id)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setOwnerId(m.id)}
                          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border transition-all text-left"
                          style={{
                            background: sel ? `${color}18` : undefined,
                            borderColor: sel ? color : errors.owner ? "rgba(248,113,113,0.4)" : undefined,
                            boxShadow: sel ? `0 0 0 1px ${hex2rgba(color, 0.25)}` : "none",
                          }}
                        >
                          <UserAvatar
                            userId={m.id}
                            name={m.name}
                            email={m.email}
                            imageUrl={m.image}
                            size={24}
                          />
                          <span
                            className="font-semibold text-xs"
                            style={{ color: sel ? color : undefined }}
                          >
                            {m.name ?? m.email}
                          </span>
                          {sel && (
                            <BadgeCheck size={11} className="shrink-0" style={{ color }} />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
                )}

                <div>
                  <p
                    className={`text-xs font-bold mb-1.5 uppercase tracking-wider ${
                      errors.channel ? "text-red-400" : "text-muted-foreground"
                    }`}
                  >
                    ¿Cómo llegó?
                    {errors.channel && (
                      <span className="normal-case font-normal"> — selecciona uno</span>
                    )}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {channels.map((ch) => {
                      const sel = channelKey === ch.key
                      const color = getChannelColor(ch.color)
                      const Icon = getChannelIcon(ch.key)
                      return (
                        <button
                          key={ch.key}
                          type="button"
                          onClick={() => setChannelKey(ch.key)}
                          className="flex-1 min-w-[90px] flex flex-col items-center gap-1.5 rounded-xl py-3 border transition-all"
                          style={{
                            background: sel ? `${color}15` : undefined,
                            borderColor: sel
                              ? color
                              : errors.channel
                                ? "rgba(248,113,113,0.4)"
                                : undefined,
                            boxShadow: sel ? `0 0 0 1px ${hex2rgba(color, 0.3)}` : "none",
                          }}
                        >
                          <Icon
                            size={16}
                            style={{ color: sel ? color : undefined }}
                            className={sel ? "" : "text-muted-foreground"}
                          />
                          <span
                            className="text-xs font-semibold"
                            style={{ color: sel ? color : undefined }}
                          >
                            {ch.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="col-span-2">
                    <label
                      htmlFor="name"
                      className={`text-xs font-bold uppercase tracking-wider block mb-1 ${
                        errors.name ? "text-red-400" : "text-muted-foreground"
                      }`}
                    >
                      Nombre
                      {errors.name && (
                        <span className="normal-case font-normal"> — requerido</span>
                      )}
                    </label>
                    <input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej. Carlos Mendoza"
                      className={fieldClass(errors.name)}
                    />
                  </div>
                  <div className="col-span-2">
                    <label
                      htmlFor="company"
                      className="text-xs font-bold uppercase tracking-wider block mb-1 text-muted-foreground"
                    >
                      Empresa
                    </label>
                    <input
                      id="company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Ej. Hotel Quetzal"
                      className={fieldClass()}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="phone"
                      className={`text-xs font-bold uppercase tracking-wider block mb-1 ${
                        errors.phone ? "text-red-400" : "text-muted-foreground"
                      }`}
                    >
                      Teléfono
                      {errors.phone && (
                        <span className="normal-case font-normal"> — requerido</span>
                      )}
                    </label>
                    <input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value, false))}
                      placeholder="5500-0000"
                      className={fieldClass(errors.phone)}
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="whatsapp"
                      className="text-xs font-bold uppercase tracking-wider block mb-1 text-muted-foreground"
                    >
                      WhatsApp
                    </label>
                    <input
                      id="whatsapp"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(formatPhone(e.target.value, true))}
                      onFocus={() => {
                        if (!whatsapp.trim()) setWhatsapp("+502 ")
                      }}
                      placeholder="+502 5500-0000"
                      className={fieldClass()}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className={`text-xs font-bold uppercase tracking-wider block mb-1.5 ${
                      errors.equipment ? "text-red-400" : "text-muted-foreground"
                    }`}
                  >
                    Equipo de interés
                    {errors.equipment && (
                      <span className="normal-case font-normal">
                        {" "}
                        — selecciona al menos uno
                      </span>
                    )}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {equipment.map((eq) => {
                      const sel = selectedEquipment.includes(eq.key)
                      const Icon = equipmentIcon(eq.label)
                      return (
                        <button
                          key={eq.key}
                          type="button"
                          onClick={() => toggleEquipment(eq.key)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition-all"
                          style={{
                            background: sel ? hex2rgba("#818cf8", 0.18) : undefined,
                            borderColor: sel
                              ? "#818cf8"
                              : errors.equipment
                                ? "rgba(248,113,113,0.4)"
                                : undefined,
                            color: sel ? "#a5b4fc" : undefined,
                            boxShadow: sel ? "0 0 0 1px #818cf840" : "none",
                          }}
                        >
                          <Icon
                            size={11}
                            className={sel ? "text-indigo-400" : "text-muted-foreground"}
                          />
                          {eq.label}
                        </button>
                      )
                    })}
                  </div>
                  <input
                    id="equipment-custom"
                    value={equipmentCustom}
                    onChange={(e) => setEquipmentCustom(e.target.value)}
                    placeholder="Otro equipo..."
                    className={`${fieldClass()} mt-2 text-xs`}
                  />
                </div>
              </div>

              {/* ── RIGHT ── */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Cotizaciones
                    </span>
                    {!addingQuote && (
                      <button
                        type="button"
                        onClick={() => setAddingQuote(true)}
                        className="text-[10px] font-bold flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                      >
                        <Plus size={10} /> Nueva Cotización
                      </button>
                    )}
                  </div>
                  <DocList
                    items={pendingQuotes}
                    accentColor="#818cf8"
                    onRemove={(id) =>
                      setPendingQuotes((prev) => prev.filter((x) => x.id !== id))
                    }
                  />
                  {addingQuote && (
                    <div className="mt-2 p-3 rounded-xl space-y-2 bg-indigo-500/5 border border-indigo-500/25">
                      <input
                        value={newQuoteNumber}
                        onChange={(e) => setNewQuoteNumber(e.target.value)}
                        placeholder="Número de cotización *"
                        className={`${fieldClass()} text-xs`}
                      />
                      <label className="cursor-pointer flex items-center gap-1.5 text-[11px] font-semibold px-3 py-2 rounded-lg border justify-center hover:bg-muted/50">
                        <Paperclip size={11} />
                        {newQuoteFile ? newQuoteFile.name : "Adjuntar PDF/Imagen *"}
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,image/*"
                          onChange={(e) => setNewQuoteFile(e.target.files?.[0] ?? null)}
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={addPendingQuote}
                          className="flex-1 text-xs font-bold py-1.5 rounded-lg bg-indigo-500 text-white"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddingQuote(false)}
                          className="px-3 text-xs font-bold py-1.5 rounded-lg border"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Documentos de Pago
                    </span>
                    {!addingPayment && (
                      <button
                        type="button"
                        onClick={() => setAddingPayment(true)}
                        className="text-[10px] font-bold flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/12 text-emerald-500 border border-emerald-500/30"
                      >
                        <Plus size={10} /> Nuevo Pago
                      </button>
                    )}
                  </div>
                  <DocList
                    items={pendingPayments}
                    accentColor="#34d399"
                    onRemove={(id) =>
                      setPendingPayments((prev) => prev.filter((x) => x.id !== id))
                    }
                  />
                  {addingPayment && (
                    <div className="mt-2 p-3 rounded-xl space-y-2 bg-emerald-500/5 border border-emerald-500/25">
                      <input
                        value={newPayNumber}
                        onChange={(e) => setNewPayNumber(e.target.value)}
                        placeholder="Número de documento *"
                        className={`${fieldClass()} text-xs`}
                      />
                      <label className="cursor-pointer flex items-center gap-1.5 text-[11px] font-semibold px-3 py-2 rounded-lg border justify-center hover:bg-muted/50">
                        <Paperclip size={11} />
                        {newPayFile ? newPayFile.name : "Adjuntar PDF/Imagen *"}
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,image/*"
                          onChange={(e) => setNewPayFile(e.target.files?.[0] ?? null)}
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={addPendingPayment}
                          className="flex-1 text-xs font-bold py-1.5 rounded-lg bg-emerald-500 text-white"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddingPayment(false)}
                          className="px-3 text-xs font-bold py-1.5 rounded-lg border"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="col-span-2">
                    <label
                      htmlFor="value"
                      className="text-xs font-bold uppercase tracking-wider block mb-1 text-muted-foreground"
                    >
                      Valor estimado (Q)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground pointer-events-none">
                        Q
                      </span>
                      <input
                        id="value"
                        value={valueDisplay}
                        onChange={(e) => {
                          const r = e.target.value.replace(/[^0-9.]/g, "")
                          setValueDisplay(r)
                          setValue(parseFloat(r) || 0)
                        }}
                        onBlur={() => {
                          const n = parseFloat(String(value).replace(/,/g, ""))
                          if (!Number.isNaN(n)) {
                            setValueDisplay(
                              n.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }),
                            )
                            setValue(n)
                          }
                        }}
                        placeholder="0.00"
                        className={`${fieldClass()} pl-7`}
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="followUp"
                      className="text-xs font-bold uppercase tracking-wider block mb-1 text-muted-foreground"
                    >
                      <CalendarCheck size={10} className="inline mr-1" />
                      Seguimiento
                    </label>
                    <input
                      id="followUp"
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className={fieldClass()}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="statusKey"
                      className="text-xs font-bold uppercase tracking-wider block mb-1 text-muted-foreground"
                    >
                      Estatus
                    </label>
                    <div className="relative">
                      <select
                        id="statusKey"
                        value={statusKey}
                        onChange={(e) => setStatusKey(e.target.value)}
                        className={`${fieldClass()} appearance-none pr-8`}
                      >
                        {statuses.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={13}
                        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block mb-1.5 text-muted-foreground">
                    <FileText size={10} className="inline mr-1" />
                    Observaciones
                  </label>
                  {notes.length > 0 && (
                    <div className="space-y-1.5 mb-2 max-h-32 overflow-y-auto pr-1">
                      {notes.map((n, i) => (
                        <div
                          key={i}
                          className="group rounded-xl p-2.5 relative bg-muted/30 border border-border/80"
                        >
                          <p className="text-[10px] font-semibold mb-0.5 flex items-center gap-1 text-indigo-400">
                            <Clock size={9} />
                            {n.ts}
                          </p>
                          <p className="text-xs leading-relaxed">{n.text}</p>
                          <button
                            type="button"
                            onClick={() => setNotes((prev) => prev.filter((_, j) => j !== i))}
                            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-muted-foreground"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          addNote()
                        }
                      }}
                      placeholder="Observación... (Enter para agregar)"
                      rows={2}
                      className={`${fieldClass()} resize-none flex-1`}
                    />
                    <button
                      type="button"
                      onClick={addNote}
                      className="px-3 rounded-xl text-xs font-bold flex-shrink-0 flex flex-col items-center justify-center gap-1 min-w-[48px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/40"
                    >
                      <Plus size={14} />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 shrink-0 border-t">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-3 rounded-xl border text-sm font-semibold hover:bg-muted/50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 rounded-xl text-white font-bold shadow-md shadow-indigo-500/20 hover:bg-[#4338ca] flex items-center justify-center gap-1.5 bg-[#4f46e5]"
              >
                <Save size={16} />
                {loading ? "Creando…" : "Crear oportunidad"}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
