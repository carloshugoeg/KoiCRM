"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { createDealAction } from "@/features/deals/actions"
import type { CatalogItem } from "@prisma/client"

interface ClientFormModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: (dealId: string) => void
  tenantId: string
  tenantSlug: string
  members: { id: string; name: string | null; email: string }[]
  channels: CatalogItem[]
  equipment: CatalogItem[]
  statuses: CatalogItem[]
  prefill?: { name?: string | null; company?: string | null; phone?: string | null; whatsapp?: string | null; email?: string | null }
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
  prefill,
}: ClientFormModalProps) {
  const [loading, setLoading] = useState(false)
  const [ownerId, setOwnerId] = useState(members[0]?.id ?? "")
  const [channelKey, setChannelKey] = useState(channels[0]?.key ?? "")
  const [name, setName] = useState(prefill?.name ?? "")
  const [company, setCompany] = useState(prefill?.company ?? "")
  const [phone, setPhone] = useState(prefill?.phone ?? "")
  const [whatsapp, setWhatsapp] = useState(prefill?.whatsapp ?? "")
  const [email, setEmail] = useState(prefill?.email ?? "")
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])
  const [equipmentCustom, setEquipmentCustom] = useState("")
  const [value, setValue] = useState("")
  const [statusKey, setStatusKey] = useState(statuses[0]?.key ?? "activo")

  function toggleEquipment(key: string) {
    setSelectedEquipment((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const result = await createDealAction({
      tenantId,
      tenantSlug,
      ownerId,
      channelKey,
      name,
      company: company || null,
      phone: phone || null,
      whatsapp: whatsapp || null,
      email: email || null,
      equipment: selectedEquipment,
      equipmentCustom: equipmentCustom || null,
      value: parseFloat(value) || 0,
      statusKey,
    })
    setLoading(false)
    if (!result.ok) {
      toast.error(result.error ?? "Error al crear la oportunidad.")
      return
    }
    toast.success("Oportunidad creada.")
    onClose()
    if (result.dealId && onSuccess) onSuccess(result.dealId)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva oportunidad</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Left column */}
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="ownerId">Asesor *</Label>
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger id="ownerId">
                    <SelectValue placeholder="Selecciona asesor" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name ?? m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="channelKey">Canal *</Label>
                <Select value={channelKey} onValueChange={setChannelKey}>
                  <SelectTrigger id="channelKey">
                    <SelectValue placeholder="Selecciona canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="name">Nombre del cliente *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="space-y-1">
                <Label htmlFor="company">Empresa</Label>
                <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>

              <div className="space-y-1">
                <Label htmlFor="phone">Teléfono *</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="XXXX-XXXX" required />
              </div>

              <div className="space-y-1">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input id="whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+502 XXXX-XXXX" />
              </div>

              <div className="space-y-1">
                <Label>Equipos</Label>
                <div className="flex flex-wrap gap-2">
                  {equipment.map((eq) => (
                    <button
                      key={eq.key}
                      type="button"
                      onClick={() => toggleEquipment(eq.key)}
                      className={`px-3 py-1 rounded-full border text-xs transition-colors ${
                        selectedEquipment.includes(eq.key)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-input hover:bg-accent"
                      }`}
                    >
                      {eq.label}
                    </button>
                  ))}
                </div>
                <Input
                  value={equipmentCustom}
                  onChange={(e) => setEquipmentCustom(e.target.value)}
                  placeholder="Otro equipo (texto libre)"
                  className="mt-2"
                />
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="value">Valor estimado (GTQ)</Label>
                <Input
                  id="value"
                  type="number"
                  min={0}
                  step={0.01}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="statusKey">Estado</Label>
                <Select value={statusKey} onValueChange={setStatusKey}>
                  <SelectTrigger id="statusKey">
                    <SelectValue placeholder="Selecciona estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
