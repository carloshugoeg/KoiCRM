"use client"

import { Plus, X } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox"
import { equipmentIcon } from "@/lib/settings/constants"
import type { EquipmentCategory } from "@/features/catalogs/queries"

/** One chosen categoría with the subcategorías picked from it. */
export type EquipmentGroup = { categoryKey: string; subcategoryKeys: string[] }

/** Folds flat deal-equipment rows back into the grouped shape the selector edits. */
export function rowsToEquipmentGroups(
  rows: { categoryKey: string; subcategoryKey: string }[],
): EquipmentGroup[] {
  const byCategory = new Map<string, string[]>()
  for (const row of rows) {
    const list = byCategory.get(row.categoryKey) ?? []
    list.push(row.subcategoryKey)
    byCategory.set(row.categoryKey, list)
  }
  return Array.from(byCategory.entries()).map(([categoryKey, subcategoryKeys]) => ({
    categoryKey,
    subcategoryKeys,
  }))
}

interface EquipmentSelectorProps {
  hierarchy: EquipmentCategory[]
  value: EquipmentGroup[]
  onChange: (next: EquipmentGroup[]) => void
  /** Highlight the empty state in red when validation failed. */
  invalid?: boolean
  disabled?: boolean
}

/**
 * Equipo de interés selector: add one or more categorías, and for each one pick its subcategorías
 * from a combo box. At least one categoría with one subcategoría is required (validated on submit).
 */
export function EquipmentSelector({
  hierarchy,
  value,
  onChange,
  invalid,
  disabled,
}: EquipmentSelectorProps) {
  const usedKeys = new Set(value.map((g) => g.categoryKey))
  const available = hierarchy.filter((h) => !usedKeys.has(h.category.key))

  function addCategory(categoryKey: string) {
    if (value.some((g) => g.categoryKey === categoryKey)) return
    onChange([...value, { categoryKey, subcategoryKeys: [] }])
  }

  function removeCategory(categoryKey: string) {
    onChange(value.filter((g) => g.categoryKey !== categoryKey))
  }

  function setSubcategories(categoryKey: string, subcategoryKeys: string[]) {
    onChange(value.map((g) => (g.categoryKey === categoryKey ? { ...g, subcategoryKeys } : g)))
  }

  return (
    <div className="space-y-2.5">
      {value.map((group) => {
        const cat = hierarchy.find((h) => h.category.key === group.categoryKey)
        const Icon = equipmentIcon(cat?.category.label ?? group.categoryKey)
        const options = (cat?.subcategories ?? []).map((s) => ({ value: s.key, label: s.label }))
        return (
          <div
            key={group.categoryKey}
            className="rounded-xl border border-border bg-muted/30 p-2.5 space-y-2"
          >
            <div className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
              <span className="flex-1 text-xs font-semibold">
                {cat?.category.label ?? group.categoryKey}
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeCategory(group.categoryKey)}
                  className="text-muted-foreground transition-opacity hover:text-red-400"
                  aria-label={`Quitar ${cat?.category.label ?? group.categoryKey}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <MultiSelectCombobox
              options={options}
              selected={group.subcategoryKeys}
              onChange={(next) => setSubcategories(group.categoryKey, next)}
              placeholder="Selecciona subcategorías…"
              searchPlaceholder="Buscar subcategoría…"
              emptyText="Sin subcategorías."
              disabled={disabled}
              invalid={invalid && group.subcategoryKeys.length === 0}
            />
          </div>
        )
      })}

      {!disabled && available.length > 0 && (
        <Select value="" onValueChange={addCategory}>
          <SelectTrigger
            className={`h-9 text-sm ${invalid && value.length === 0 ? "border-red-400" : ""}`}
          >
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Plus className="h-3.5 w-3.5" />
              <SelectValue placeholder="Agregar categoría…" />
            </span>
          </SelectTrigger>
          <SelectContent>
            {available.map((h) => (
              <SelectItem key={h.category.key} value={h.category.key}>
                {h.category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
