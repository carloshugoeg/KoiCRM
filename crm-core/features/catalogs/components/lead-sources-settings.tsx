"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  createCatalogItemAction,
  updateCatalogItemAction,
  deleteCatalogItemAction,
  reorderCatalogItemsAction,
} from "@/features/catalogs/actions"
import {
  SettingsRowCard,
  SettingsSectionTitle,
} from "@/components/settings/settings-section"
import { PRESET_COLORS, catalogKeyFromLabel } from "@/lib/settings/constants"
import { getChannelColor, getChannelIcon } from "@/lib/deals/channel-icons"
import { toastMessages, toastErrorFromResult } from "@/lib/ui/toast-messages"
import type { CatalogItem, Tenant } from "@prisma/client"

interface Props {
  tenant: Tenant
  items: CatalogItem[]
  canManage: boolean
}

export function LeadSourcesSettings({ tenant, items: initialItems, canManage }: Props) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [newLabel, setNewLabel] = useState("")
  const [newColor, setNewColor] = useState<string>(PRESET_COLORS[0])
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState("")
  const [editColor, setEditColor] = useState<string>(PRESET_COLORS[0])
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  function startEdit(item: CatalogItem) {
    setEditingId(item.id)
    setEditLabel(item.label)
    setEditColor(getChannelColor(item.color))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditLabel("")
  }

  async function handleAdd() {
    const name = newLabel.trim()
    if (!name) return
    setAdding(true)
    setError(null)
    const key = catalogKeyFromLabel(name)
    const result = await createCatalogItemAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      catalogKey: "salesChannel",
      key,
      label: name,
      color: newColor,
      order: items.length,
    })
    setAdding(false)
    if (!result.ok) {
      const msg = toastErrorFromResult(result.error, toastMessages.leadSource.errorAdd)
      setError(msg)
      toast.error(msg)
      return
    }
    setNewLabel("")
    setNewColor(PRESET_COLORS[items.length % PRESET_COLORS.length] ?? PRESET_COLORS[0])
    toast.success(toastMessages.leadSource.added)
    router.refresh()
  }

  async function handleSaveEdit(item: CatalogItem) {
    const label = editLabel.trim()
    if (!label) return
    setSavingEdit(true)
    const result = await updateCatalogItemAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      id: item.id,
      label,
      color: editColor,
      active: item.active,
    })
    setSavingEdit(false)
    if (!result.ok) {
      toast.error(toastErrorFromResult(result.error, toastMessages.leadSource.errorUpdate))
      return
    }
    toast.success(toastMessages.leadSource.updated)
    cancelEdit()
    router.refresh()
  }

  async function handleDelete(item: CatalogItem) {
    if (!confirm(`¿Eliminar el origen «${item.label}»?`)) return
    const result = await deleteCatalogItemAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      id: item.id,
    })
    if (!result.ok) {
      toast.error(toastErrorFromResult(result.error, toastMessages.leadSource.errorRemove))
      return
    }
    toast.success(toastMessages.leadSource.removed)
    router.refresh()
  }

  async function moveItem(index: number, dir: -1 | 1) {
    const ni = index + dir
    if (ni < 0 || ni >= items.length) return
    const newOrder = [...items]
    ;[newOrder[index], newOrder[ni]] = [newOrder[ni]!, newOrder[index]!]
    setItems(newOrder)
    const result = await reorderCatalogItemsAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      catalogKey: "salesChannel",
      orderedIds: newOrder.map((i) => i.id),
    })
    if (!result.ok) {
      toast.error(toastErrorFromResult(result.error, toastMessages.leadSource.errorUpdate))
      setItems(initialItems)
      return
    }
    toast.success(toastMessages.leadSource.orderUpdated)
    router.refresh()
  }

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain">
      <SettingsSectionTitle>Origen de los leads</SettingsSectionTitle>
      <p className="text-xs text-muted-foreground -mt-2 mb-2">
        Estas opciones aparecen al crear oportunidades («¿Cómo llegó?») y en los filtros del embudo.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        {items.map((item, idx) => {
          const Icon = getChannelIcon(item.key)
          const color = getChannelColor(item.color)
          const isEditing = editingId === item.id

          if (isEditing) {
            return (
              <div
                key={item.id}
                className="rounded-xl p-3 border bg-muted/20 border-border/80 space-y-3"
              >
                <Input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="text-sm"
                  autoFocus
                />
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        background: c,
                        borderColor: editColor === c ? "white" : "transparent",
                        boxShadow: editColor === c ? `0 0 0 2px ${c}` : undefined,
                      }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingEdit || !editLabel.trim()}
                    onClick={() => void handleSaveEdit(item)}
                  >
                    Guardar
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={cancelEdit}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )
          }

          return (
            <SettingsRowCard key={item.id}>
              <Icon className="h-[15px] w-[15px] shrink-0" style={{ color }} />
              <span
                className={`text-sm font-semibold flex-1 ${!item.active ? "line-through text-muted-foreground" : ""}`}
              >
                {item.label}
              </span>
              {canManage && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveItem(idx, -1)}
                    disabled={idx === 0}
                    className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Subir"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(idx, 1)}
                    disabled={idx === items.length - 1}
                    className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Bajar"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="p-1 text-indigo-400 hover:opacity-70"
                    aria-label={`Editar ${item.label}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item)}
                    className="p-1 text-red-400 hover:opacity-70"
                    aria-label={`Eliminar ${item.label}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </SettingsRowCard>
          )
        })}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No hay orígenes configurados. Agrega el primero abajo.
          </p>
        )}
      </div>

      {canManage && (
        <>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  background: c,
                  borderColor: newColor === c ? "white" : "transparent",
                  boxShadow: newColor === c ? `0 0 0 2px ${c}` : undefined,
                }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void handleAdd()
                }
              }}
              placeholder="Ej. Sala, Referido, Página web..."
              className="flex-1 text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              disabled={adding || !newLabel.trim()}
              className="px-4 text-indigo-400 bg-indigo-500/15 border border-indigo-500/40 hover:bg-indigo-500/25"
              onClick={() => void handleAdd()}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Presiona Enter o + para agregar. No se puede eliminar un origen usado en oportunidades.
          </p>
        </>
      )}
    </div>
  )
}
