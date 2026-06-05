"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  createCatalogItemAction,
  deleteCatalogItemAction,
} from "@/features/catalogs/actions"
import {
  SettingsRowCard,
  SettingsSectionTitle,
} from "@/components/settings/settings-section"
import { catalogKeyFromLabel, equipmentIcon } from "@/lib/settings/constants"
import { toastMessages, toastErrorFromResult } from "@/lib/ui/toast-messages"
import type { CatalogItem, Tenant } from "@prisma/client"

interface Props {
  tenant: Tenant
  items: CatalogItem[]
  canManage: boolean
}

function optimisticItem(tenantId: string, key: string, label: string, order: number): CatalogItem {
  return {
    id: `optimistic-${key}`,
    tenantId,
    catalogKey: "equipment",
    key,
    label,
    color: null,
    iconKey: null,
    metadata: null,
    order,
    active: true,
  }
}

export function EquipmentSettings({ tenant, items: initialItems, canManage }: Props) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])
  const [newEquip, setNewEquip] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  async function handleAdd(label?: string) {
    const name = (label ?? newEquip).trim()
    if (!name) return
    setAdding(true)
    setError(null)
    const key = catalogKeyFromLabel(name)
    const result = await createCatalogItemAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      catalogKey: "equipment",
      key,
      label: name,
      order: items.length,
    })
    setAdding(false)
    if (!result.ok) {
      const msg = toastErrorFromResult(result.error, toastMessages.equipment.errorAdd)
      setError(msg)
      toast.error(msg)
      return
    }
    setNewEquip("")
    setItems((prev) => {
      if (prev.some((i) => i.key === key)) return prev
      return [...prev, optimisticItem(tenant.id, key, name, prev.length)]
    })
    toast.success(toastMessages.equipment.added)
    router.refresh()
  }

  async function handleDelete(item: CatalogItem) {
    const result = await deleteCatalogItemAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      id: item.id,
    })
    if (!result.ok) {
      toast.error(toastErrorFromResult(result.error, toastMessages.equipment.errorRemove))
      return
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    toast.success(toastMessages.equipment.removed)
    router.refresh()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 space-y-3">
        <SettingsSectionTitle>Tipos de equipo</SettingsSectionTitle>
        {error && <p className="text-sm text-destructive">{error}</p>}

        {canManage && (
          <>
            <div className="flex gap-2">
              <Input
                value={newEquip}
                onChange={(e) => setNewEquip(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    void handleAdd()
                  }
                }}
                placeholder="Ej. Bomba sumergible, Caldera..."
                className="flex-1 text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                disabled={adding || !newEquip.trim()}
                className="border border-indigo-500/40 bg-indigo-500/15 px-4 text-indigo-400 hover:bg-indigo-500/25"
                onClick={() => void handleAdd()}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Presiona Enter o el botón + para agregar.
            </p>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="space-y-2 py-2">
          {items.map((item) => {
            const Icon = equipmentIcon(item.label)
            return (
              <SettingsRowCard key={item.id}>
                <Icon className="h-[15px] w-[15px] shrink-0 text-indigo-400" />
                <span className="flex-1 text-sm font-semibold">{item.label}</span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(item)}
                    className="text-red-400 transition-opacity hover:opacity-70"
                    aria-label={`Eliminar ${item.label}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </SettingsRowCard>
            )
          })}
        </div>
      </div>
    </div>
  )
}
