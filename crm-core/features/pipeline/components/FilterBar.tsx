"use client"

import { useRouter, usePathname } from "next/navigation"
import { useTransition } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import type { CatalogItem } from "@prisma/client"
import type { EquipmentCategory } from "@/features/catalogs/queries"
import type { PipelineFiltersParams } from "@/features/pipeline/schemas"
import { User, Phone, Package, Layers, Bell } from "lucide-react"

interface FilterBarProps {
  members: { id: string; name: string | null; email: string }[]
  channels: CatalogItem[]
  equipmentHierarchy: EquipmentCategory[]
  currentFilters: PipelineFiltersParams
  tenantSlug: string
}

const ALL = "__all__"

export function FilterBar({ members, channels, equipmentHierarchy, currentFilters, tenantSlug }: FilterBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  function update(key: string, value: string | undefined) {
    const params = new URLSearchParams()
    const merged = { ...currentFilters, [key]: value === ALL ? undefined : value }
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v)
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`)
    })
  }

  function clearAll() {
    startTransition(() => {
      router.replace(pathname)
    })
  }

  // Changing the categoría resets the subcategoría so the pair stays consistent.
  function updateCategory(value: string | undefined) {
    const params = new URLSearchParams()
    const merged = {
      ...currentFilters,
      equipmentCategory: value === ALL ? undefined : value,
      equipmentSubcategory: undefined,
    }
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v)
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`)
    })
  }

  const selectedCategory = equipmentHierarchy.find(
    (h) => h.category.key === currentFilters.equipmentCategory,
  )
  const subOptions = selectedCategory?.subcategories ?? []

  const hasFilters = Object.values(currentFilters).some(Boolean)
  const triggerClasses = "h-9 text-xs bg-slate-50 border-slate-200 rounded-full font-medium text-slate-600 shadow-sm focus:ring-0 focus:ring-offset-0"

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={currentFilters.owner ?? ALL} onValueChange={(v) => update("owner", v)}>
        <SelectTrigger className={`w-40 ${triggerClasses}${isPending ? " opacity-50" : ""}`} disabled={isPending}>
          <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 opacity-60" /><SelectValue placeholder="Asesor" /></div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los asesores</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name ?? m.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentFilters.channel ?? ALL} onValueChange={(v) => update("channel", v)}>
        <SelectTrigger className={`w-40 ${triggerClasses}${isPending ? " opacity-50" : ""}`} disabled={isPending}>
          <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 opacity-60" /><SelectValue placeholder="Origen" /></div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los orígenes</SelectItem>
          {channels.map((c) => (
            <SelectItem key={c.key} value={c.key}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentFilters.equipmentCategory ?? ALL} onValueChange={updateCategory}>
        <SelectTrigger className={`w-40 ${triggerClasses}${isPending ? " opacity-50" : ""}`} disabled={isPending}>
          <div className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5 opacity-60" /><SelectValue placeholder="Categoría" /></div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas las categorías</SelectItem>
          {equipmentHierarchy.map((h) => (
            <SelectItem key={h.category.key} value={h.category.key}>
              {h.category.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentFilters.equipmentSubcategory ?? ALL}
        onValueChange={(v) => update("equipmentSubcategory", v)}
        disabled={isPending || !selectedCategory || subOptions.length === 0}
      >
        <SelectTrigger
          className={`w-40 ${triggerClasses}${isPending || !selectedCategory ? " opacity-50" : ""}`}
          disabled={isPending || !selectedCategory || subOptions.length === 0}
        >
          <div className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 opacity-60" /><SelectValue placeholder="Subcategoría" /></div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas las subcategorías</SelectItem>
          {subOptions.map((s) => (
            <SelectItem key={s.key} value={s.key}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentFilters.alerts ?? ALL} onValueChange={(v) => update("alerts", v)}>
        <SelectTrigger className={`w-40 ${triggerClasses}${isPending ? " opacity-50" : ""}`} disabled={isPending}>
          <div className="flex items-center gap-1.5"><Bell className="w-3.5 h-3.5 opacity-60" /><SelectValue placeholder="Alertas" /></div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Sin alertas</SelectItem>
          <SelectItem value="missingQuote">Falta Cotización</SelectItem>
          <SelectItem value="missingPayment">Falta Pago</SelectItem>
          <SelectItem value="overdueFollowUp">Seguim. Vencido</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1.5">
        <DatePicker
          value={currentFilters.from ?? ""}
          onChange={(v) => update("from", v || undefined)}
          disabled={isPending}
          placeholder="Desde"
          aria-label="Fecha desde"
          className={`h-9 min-w-0 w-32 bg-slate-50 border-slate-200 rounded-full text-slate-600 shadow-sm${isPending ? " opacity-50" : ""}`}
        />
        <span className="text-xs text-slate-400" aria-hidden="true">→</span>
        <DatePicker
          value={currentFilters.to ?? ""}
          onChange={(v) => update("to", v || undefined)}
          disabled={isPending}
          placeholder="Hasta"
          aria-label="Fecha hasta"
          className={`h-9 min-w-0 w-32 bg-slate-50 border-slate-200 rounded-full text-slate-600 shadow-sm${isPending ? " opacity-50" : ""}`}
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-9 text-xs rounded-full" onClick={clearAll}>
          Limpiar filtros
        </Button>
      )}
    </div>
  )
}

