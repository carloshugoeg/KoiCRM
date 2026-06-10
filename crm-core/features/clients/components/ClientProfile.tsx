"use client"

import { useState } from "react"
import { toast } from "sonner"
import { toastMessages, toastErrorFromResult } from "@/lib/ui/toast-messages"
import { Phone, MessageCircle, Mail, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { NotesSection } from "@/features/notes/components/NotesSection"
import { ClientFormModal } from "@/features/deals/components/ClientFormModal"
import { PinProvider } from "@/features/auth/pin-gate"
import { updateClientAction } from "@/features/clients/actions"
import { avatarColor, avatarInitials } from "@/lib/utils/avatar-color"
import { formatCurrency } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"
import type { PipelineStage, CatalogItem } from "@prisma/client"

interface ClientDeal {
  id: string
  name: string
  value: number
  stageKey: string
  stageLabel: string
  ownerName: string | null
  createdAt: Date
}

interface ClientProfileData {
  id: string
  name: string
  company: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
}

interface ClientKpis {
  totalOpps: number
  activeOpps: number
  wonCount: number
  totalValue: number
}

interface ClientProfileProps {
  tenantId: string
  tenantSlug: string
  client: ClientProfileData
  deals: ClientDeal[]
  kpis: ClientKpis
  stages: PipelineStage[]
  members: { id: string; name: string | null; email: string; image?: string | null }[]
  channels: CatalogItem[]
  equipment: CatalogItem[]
  statuses: CatalogItem[]
  settings: IntlSettings
  canEdit: boolean
}

export function ClientProfile({
  tenantId,
  tenantSlug,
  client,
  deals,
  kpis,
  stages: _stages,
  members,
  channels,
  equipment,
  statuses,
  settings,
  canEdit,
}: ClientProfileProps) {
  const [editField, setEditField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [newDealOpen, setNewDealOpen] = useState(false)
  const color = avatarColor(client.id)

  async function saveField(field: string, value: string) {
    const result = await updateClientAction({
      tenantId,
      tenantSlug,
      id: client.id,
      name: field === "name" ? value : client.name,
      company: field === "company" ? value || null : client.company,
      phone: field === "phone" ? value || null : client.phone,
      whatsapp: field === "whatsapp" ? value || null : client.whatsapp,
      email: field === "email" ? value || null : client.email,
    })
    if (!result.ok) toast.error(toastErrorFromResult(result.error, toastMessages.client.errorSave))
    else {
      toast.success(toastMessages.client.saved)
      setEditField(null)
    }
  }

  function EditableField({ field, value, placeholder }: { field: string; value: string | null; placeholder: string }) {
    if (editField === field) {
      return (
        <Input
          autoFocus
          className="h-7 text-sm"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => saveField(field, editValue)}
          onKeyDown={(e) => { if (e.key === "Enter") saveField(field, editValue); if (e.key === "Escape") setEditField(null) }}
        />
      )
    }
    return (
      <p
        className={`text-sm cursor-pointer hover:text-primary truncate ${!value ? "text-muted-foreground italic" : ""}`}
        onClick={() => { setEditField(field); setEditValue(value ?? "") }}
      >
        {value ?? placeholder}
      </p>
    )
  }

  return (
    <PinProvider>
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0"
          style={{ backgroundColor: color }}
        >
          {avatarInitials(client.name)}
        </div>
        <div className="flex-1 min-w-0">
          <EditableField field="name" value={client.name} placeholder="Nombre" />
          <EditableField field="company" value={client.company} placeholder="Empresa" />
        </div>
        <Button size="sm" onClick={() => setNewDealOpen(true)} disabled={!canEdit}>
          <Plus className="h-4 w-4 mr-1" />
          Nueva oportunidad
        </Button>
      </div>

      {/* Contact */}
      <div className="space-y-2 mb-6">
        {client.phone ? (
          <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-sm hover:text-primary">
            <Phone className="h-3.5 w-3.5 shrink-0" />{client.phone}
          </a>
        ) : (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <EditableField field="phone" value={client.phone} placeholder="Teléfono" />
          </div>
        )}
        {client.whatsapp ? (
          <a
            href={`https://wa.me/${client.whatsapp.replace(/[^0-9]/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm hover:text-primary"
          >
            <MessageCircle className="h-3.5 w-3.5 shrink-0" />{client.whatsapp}
          </a>
        ) : (
          <div className="flex items-center gap-2">
            <MessageCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <EditableField field="whatsapp" value={client.whatsapp} placeholder="WhatsApp" />
          </div>
        )}
        {client.email ? (
          <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm hover:text-primary">
            <Mail className="h-3.5 w-3.5 shrink-0" />{client.email}
          </a>
        ) : (
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <EditableField field="email" value={client.email} placeholder="Email" />
          </div>
        )}
      </div>

      <Separator className="mb-6" />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Oportunidades", value: kpis.totalOpps },
          { label: "Activas", value: kpis.activeOpps },
          { label: "Ganadas", value: kpis.wonCount },
          { label: "Valor ganado", value: formatCurrency(kpis.totalValue, settings) },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-muted/40 rounded-lg p-3 text-center">
            <p className="text-lg font-bold">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      <Separator className="mb-6" />

      {/* Deal history */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold mb-3">Oportunidades</h3>
        {deals.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin oportunidades.</p>
        ) : (
          <div className="space-y-2">
            {deals.map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.ownerName ?? "Sin asesor"}</p>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">{d.stageLabel}</Badge>
                <p className="text-sm font-semibold shrink-0">{formatCurrency(d.value, settings)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator className="mb-6" />

      {/* Notes */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Notas</h3>
        <NotesSection
          tenantId={tenantId}
          tenantSlug={tenantSlug}
          clientId={client.id}
          settings={settings}
        />
      </div>

      {newDealOpen && (
        <ClientFormModal
          open={newDealOpen}
          onClose={() => setNewDealOpen(false)}
          tenantId={tenantId}
          tenantSlug={tenantSlug}
          members={members}
          channels={channels}
          equipment={equipment}
          statuses={statuses}
          prefill={{
            name: client.name,
            company: client.company,
            phone: client.phone,
            whatsapp: client.whatsapp,
            email: client.email,
          }}
        />
      )}
    </div>
    </PinProvider>
  )
}
