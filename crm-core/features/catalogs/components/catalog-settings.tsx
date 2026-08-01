"use client"

import { useState, type CSSProperties } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
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
import { EquipmentSettings } from "@/features/catalogs/components/equipment-settings"
import type { CatalogItem, Tenant } from "@prisma/client"
import type { CatalogKey, EquipmentCategory } from "@/features/catalogs/queries"
import { toastMessages, toastErrorFromResult } from "@/lib/ui/toast-messages"

const CATALOG_KEYS: CatalogKey[] = ["equipment", "salesChannel", "dealStatus", "archiveReason"]

interface Props {
  tenant: Tenant
  itemsByKey: Record<CatalogKey, CatalogItem[]>
  equipmentCategories: EquipmentCategory[]
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
    if (!result.ok) {
      const msg = toastErrorFromResult(result.error, toastMessages.catalog.errorAdd)
      setError(msg)
      toast.error(msg)
      return
    }
    const addedLabel = newLabel
    setNewKey("")
    setNewLabel("")
    toast.success(toastMessages.catalog.itemAdded(addedLabel))
    router.refresh()
  }

  async function handleToggleActive(item: CatalogItem) {
    const result = await updateCatalogItemAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      id: item.id,
      label: item.label,
      color: item.color,
      active: !item.active,
    })
    if (!result.ok) {
      toast.error(toastErrorFromResult(result.error, toastMessages.catalog.errorAdd))
      return
    }
    toast.success(
      item.active
        ? toastMessages.catalog.itemDeactivated(item.label)
        : toastMessages.catalog.itemActivated(item.label),
    )
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
      toast.error(toastErrorFromResult(result.error, toastMessages.catalog.errorRemove))
      return
    }
    toast.success(toastMessages.catalog.itemRemoved(item.label))
    router.refresh()
  }

  async function handleMoveUp(idx: number) {
    if (idx === 0) return
    const newOrder = [...items]
    ;[newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]]
    setItems(newOrder)
    const result = await reorderCatalogItemsAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      catalogKey,
      orderedIds: newOrder.map((i) => i.id),
    })
    if (!result.ok) {
      toast.error(toastErrorFromResult(result.error, toastMessages.catalog.errorAdd))
      return
    }
    toast.success(toastMessages.catalog.orderUpdated)
    router.refresh()
  }

  async function handleMoveDown(idx: number) {
    if (idx === items.length - 1) return
    const newOrder = [...items]
    ;[newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]]
    setItems(newOrder)
    const result = await reorderCatalogItemsAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      catalogKey,
      orderedIds: newOrder.map((i) => i.id),
    })
    if (!result.ok) {
      toast.error(toastErrorFromResult(result.error, toastMessages.catalog.errorAdd))
      return
    }
    toast.success(toastMessages.catalog.orderUpdated)
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

// CSS-only "scroll shadow": a pair of hard-edged fills in `background-attachment: local` slide
// with the tab strip's own content and exactly cancel the paired soft `scroll`-attached shadow
// at each edge, so the fade only shows while there is more to scroll in that direction — no JS
// scroll-position tracking, and it collapses to nothing by itself once the strip fits (board
// and up), so it never has to be gated behind a `board:` override to look "off".
const TAB_SCROLL_SHADOW_STYLE: CSSProperties = {
  backgroundImage: [
    "linear-gradient(to right, hsl(var(--muted)) 30%, transparent)",
    "linear-gradient(to left, hsl(var(--muted)) 30%, transparent) 100% 0",
    "linear-gradient(to right, hsl(var(--foreground) / 0.14), transparent)",
    "linear-gradient(to left, hsl(var(--foreground) / 0.14), transparent) 100% 0",
  ].join(", "),
  backgroundRepeat: "no-repeat",
  backgroundSize: "24px 100%, 24px 100%, 10px 100%, 10px 100%",
  backgroundAttachment: "local, local, scroll, scroll",
  WebkitOverflowScrolling: "touch",
}

export function CatalogSettings({ tenant, itemsByKey, equipmentCategories, canManage }: Props) {
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Catálogos</h1>
      <Tabs defaultValue="equipment">
        {/*
          Bug: TabsList is `inline-flex`, so it always reports its own true (unclipped) size —
          617px of tabs on a 533px viewport — and never overflows itself. The actual clipping
          ancestor is several levels up: `app/app/[tenantSlug]/layout.tsx`'s `<main>` and the
          settings shell (`settings/layout.tsx`, `settings/_width.tsx`) are all
          `overflow-hidden` by design — that's the app's scroll-containment pattern, where each
          route's own content is expected to own a scroll container rather than the shell
          scrolling. `_width.tsx` also caps width to `max-w-lg` on this route, so it's the
          nearest ancestor whose box is actually narrower than the tab strip's 617px — that's
          where the fourth tab gets cut off, in a way that reports no overflow anywhere near
          the tabs themselves. Fix stays local to this page: wrap the strip in its own
          `overflow-x-auto` container per the same "content owns its scroll" pattern used
          elsewhere (see permissions/page.tsx, equipment-settings.tsx).
        */}
        <div
          className="overflow-x-auto overscroll-x-contain rounded-lg board:overflow-visible board:bg-none"
          style={TAB_SCROLL_SHADOW_STYLE}
        >
          <TabsList className="h-auto w-max min-w-full justify-start gap-1 board:h-9 board:w-auto board:justify-center board:gap-0">
            {CATALOG_KEYS.map((k) => (
              <TabsTrigger
                key={k}
                value={k}
                className="h-11 shrink-0 px-4 board:h-auto board:px-3"
              >
                {CATALOG_LABELS[k]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {CATALOG_KEYS.map((k) => (
          <TabsContent key={k} value={k} className="pt-4">
            {k === "equipment" ? (
              // Equipo de interés is a 2-level taxonomy — use the nested manager, not the flat list.
              <EquipmentSettings tenant={tenant} categories={equipmentCategories} canManage={canManage} />
            ) : (
              <CatalogTab
                catalogKey={k}
                items={itemsByKey[k]}
                tenant={tenant}
                canManage={canManage}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
