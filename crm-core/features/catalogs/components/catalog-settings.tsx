"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  createCatalogItemAction,
  updateCatalogItemAction,
  deleteCatalogItemAction,
  reorderCatalogItemsAction,
} from "@/features/catalogs/actions"
import { CATALOG_LABELS } from "@/features/catalogs/constants"
import type { CatalogItem, Tenant } from "@prisma/client"
import type { CatalogKey } from "@/features/catalogs/queries"

const CATALOG_KEYS: CatalogKey[] = ["equipment", "salesChannel", "dealStatus", "followupReason"]

interface Props {
  tenant: Tenant
  itemsByKey: Record<CatalogKey, CatalogItem[]>
  canManage: boolean
}

function CatalogTab({
  catalogKey,
  items: initialItems,
  tenant,
  canManage,
}: {
  catalogKey: CatalogKey
  items: CatalogItem[]
  tenant: Tenant
  canManage: boolean
}) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [newKey, setNewKey] = useState("")
  const [newLabel, setNewLabel] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setError(null)
    const result = await createCatalogItemAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      catalogKey,
      key: newKey,
      label: newLabel,
      order: items.length,
    })
    setAdding(false)
    if (!result.ok) { setError(result.error ?? "Error."); return }
    setNewKey("")
    setNewLabel("")
    router.refresh()
  }

  async function handleToggleActive(item: CatalogItem) {
    await updateCatalogItemAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      id: item.id,
      label: item.label,
      color: item.color,
      active: !item.active,
    })
    router.refresh()
  }

  async function handleDelete(item: CatalogItem) {
    if (!confirm(`¿Eliminar "${item.label}"?`)) return
    const result = await deleteCatalogItemAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      id: item.id,
    })
    if (!result.ok) {
      alert(result.error ?? "Error al eliminar.")
      return
    }
    router.refresh()
  }

  async function handleMoveUp(idx: number) {
    if (idx === 0) return
    const newOrder = [...items]
    ;[newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]]
    setItems(newOrder)
    await reorderCatalogItemsAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      catalogKey,
      orderedIds: newOrder.map((i) => i.id),
    })
    router.refresh()
  }

  async function handleMoveDown(idx: number) {
    if (idx === items.length - 1) return
    const newOrder = [...items]
    ;[newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]]
    setItems(newOrder)
    await reorderCatalogItemsAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      catalogKey,
      orderedIds: newOrder.map((i) => i.id),
    })
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="divide-y border rounded-lg">
        {items.map((item, idx) => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className={`font-medium truncate ${!item.active ? "line-through text-muted-foreground" : ""}`}>
                {item.label}
              </p>
              <p className="text-xs text-muted-foreground font-mono">{item.key}</p>
            </div>
            {canManage && (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleMoveUp(idx)} disabled={idx === 0}>↑</Button>
                <Button variant="ghost" size="sm" onClick={() => handleMoveDown(idx)} disabled={idx === items.length - 1}>↓</Button>
                <Button variant="ghost" size="sm" onClick={() => handleToggleActive(item)}>
                  {item.active ? "Desactivar" : "Activar"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(item)} className="text-destructive">
                  Eliminar
                </Button>
              </div>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">Sin items</li>
        )}
      </ul>
      {canManage && (
        <form onSubmit={handleAdd} className="flex gap-2 pt-2">
          <Input
            placeholder="clave (sin espacios)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value.toLowerCase().replace(/\s/g, "_"))}
            required
            className="w-36"
          />
          <Input
            placeholder="Etiqueta visible"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            required
            className="flex-1"
          />
          <Button type="submit" disabled={adding}>
            {adding ? "Agregando…" : "Agregar"}
          </Button>
        </form>
      )}
    </div>
  )
}

export function CatalogSettings({ tenant, itemsByKey, canManage }: Props) {
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Catálogos</h1>
      <Tabs defaultValue="equipment">
        <TabsList>
          {CATALOG_KEYS.map((k) => (
            <TabsTrigger key={k} value={k}>{CATALOG_LABELS[k]}</TabsTrigger>
          ))}
        </TabsList>
        {CATALOG_KEYS.map((k) => (
          <TabsContent key={k} value={k} className="pt-4">
            <CatalogTab
              catalogKey={k}
              items={itemsByKey[k]}
              tenant={tenant}
              canManage={canManage}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
