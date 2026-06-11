"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertDialog } from "@/components/ui/alert-dialog"
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
import type { EquipmentCategory } from "@/features/catalogs/queries"
import type { CatalogItem, Tenant } from "@prisma/client"

interface Props {
  tenant: Tenant
  categories: EquipmentCategory[]
  canManage: boolean
}

export function EquipmentSettings({ tenant, categories: initial, canManage }: Props) {
  const router = useRouter()
  const [categories, setCategories] = useState(initial)
  const [newCategory, setNewCategory] = useState("")
  const [newSub, setNewSub] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ item: CatalogItem; isCategory: boolean } | null>(null)

  useEffect(() => {
    setCategories(initial)
  }, [initial])

  async function addCategory() {
    const label = newCategory.trim()
    if (!label || busy) return
    setBusy(true)
    const result = await createCatalogItemAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      catalogKey: "equipment",
      key: catalogKeyFromLabel(label),
      label,
      order: categories.length,
      parentId: null,
    })
    setBusy(false)
    if (!result.ok) {
      toast.error(toastErrorFromResult(result.error, toastMessages.equipment.errorAdd))
      return
    }
    setNewCategory("")
    toast.success(toastMessages.equipment.added)
    router.refresh()
  }

  async function addSubcategory(category: EquipmentCategory) {
    const label = (newSub[category.category.id] ?? "").trim()
    if (!label || busy) return
    setBusy(true)
    const result = await createCatalogItemAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      catalogKey: "equipment",
      // Namespace the subcategoría key under its categoría so it stays globally unique.
      key: `${category.category.key}__${catalogKeyFromLabel(label)}`,
      label,
      order: category.subcategories.length,
      parentId: category.category.id,
    })
    setBusy(false)
    if (!result.ok) {
      toast.error(toastErrorFromResult(result.error, toastMessages.equipment.errorAdd))
      return
    }
    setNewSub((prev) => ({ ...prev, [category.category.id]: "" }))
    toast.success(toastMessages.equipment.added)
    router.refresh()
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const { item } = pendingDelete
    const result = await deleteCatalogItemAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      id: item.id,
    })
    setPendingDelete(null)
    if (!result.ok) {
      toast.error(toastErrorFromResult(result.error, toastMessages.equipment.errorRemove))
      return
    }
    toast.success(toastMessages.equipment.removed)
    router.refresh()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 space-y-3">
        <SettingsSectionTitle>Categorías de equipo de interés</SettingsSectionTitle>
        <p className="text-xs text-muted-foreground">
          Cada categoría agrupa subcategorías. Las oportunidades eligen una o más subcategorías.
        </p>

        {canManage && (
          <div className="flex gap-2">
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void addCategory()
                }
              }}
              placeholder="Nueva categoría. Ej. Bombas, Filtros…"
              className="flex-1 text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              disabled={busy || !newCategory.trim()}
              className="border border-indigo-500/40 bg-indigo-500/15 px-4 text-indigo-400 hover:bg-indigo-500/25"
              onClick={() => void addCategory()}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="space-y-3 py-2">
          {categories.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aún no hay categorías. Agrega la primera arriba.
            </p>
          )}
          {categories.map((cat) => {
            const Icon = equipmentIcon(cat.category.label)
            return (
              <div key={cat.category.id} className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-indigo-400" />
                  <span className="flex-1 text-sm font-bold">{cat.category.label}</span>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setPendingDelete({ item: cat.category, isCategory: true })}
                      className="text-red-400 transition-opacity hover:opacity-70"
                      aria-label={`Eliminar categoría ${cat.category.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="mt-2 space-y-1.5 pl-6">
                  {cat.subcategories.length === 0 && (
                    <p className="text-xs italic text-muted-foreground">Sin subcategorías.</p>
                  )}
                  {cat.subcategories.map((sub) => (
                    <SettingsRowCard key={sub.id}>
                      <span className="flex-1 text-sm">{sub.label}</span>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setPendingDelete({ item: sub, isCategory: false })}
                          className="text-red-400 transition-opacity hover:opacity-70"
                          aria-label={`Eliminar subcategoría ${sub.label}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </SettingsRowCard>
                  ))}

                  {canManage && (
                    <div className="flex gap-2 pt-1">
                      <Input
                        value={newSub[cat.category.id] ?? ""}
                        onChange={(e) =>
                          setNewSub((prev) => ({ ...prev, [cat.category.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            void addSubcategory(cat)
                          }
                        }}
                        placeholder="Nueva subcategoría…"
                        className="flex-1 text-xs"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy || !(newSub[cat.category.id] ?? "").trim()}
                        className="border border-indigo-500/30 bg-indigo-500/10 px-3 text-indigo-400 hover:bg-indigo-500/20"
                        onClick={() => void addSubcategory(cat)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null) }}
        title={pendingDelete?.isCategory ? "¿Eliminar categoría?" : "¿Eliminar subcategoría?"}
        description={
          pendingDelete?.isCategory
            ? "Se eliminará la categoría y todas sus subcategorías. No se puede si está en uso por alguna oportunidad."
            : "Se eliminará la subcategoría. No se puede si está en uso por alguna oportunidad."
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  )
}
