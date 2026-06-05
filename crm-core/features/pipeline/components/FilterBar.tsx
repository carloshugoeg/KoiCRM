"use client"

import { useRouter, usePathname } from "next/navigation"
import { useTransition } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { CatalogItem } from "@prisma/client"
import type { PipelineFiltersParams } from "@/features/pipeline/schemas"
import { User, Phone, Package, Bell, Calendar } from "lucide-react"

interface FilterBarProps {
  members: { id: string; name: string | null; email: string }[]
  channels: CatalogItem[]
  equipment: CatalogItem[]
  currentFilters: PipelineFiltersParams
  tenantSlug: string
}

const ALL = "__all__"

export function FilterBar({ members, channels, equipment, currentFilters, tenantSlug }: FilterBarProps) {
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

      <Select value={currentFilters.equipment ?? ALL} onValueChange={(v) => update("equipment", v)}>
        <SelectTrigger className={`w-40 ${triggerClasses}${isPending ? " opacity-50" : ""}`} disabled={isPending}>
          <div className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5 opacity-60" /><SelectValue placeholder="Equipo" /></div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los equipos</SelectItem>
          {equipment.map((e) => (
            <SelectItem key={e.key} value={e.key}>
              {e.label}
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

      <div className="flex items-center bg-slate-50 border border-slate-200 rounded-full px-3 h-9 shadow-sm">
        <Calendar className="w-3.5 h-3.5 opacity-60 mr-2 text-slate-600" />
        <Input
          type="date"
          className={`h-7 text-xs w-28 border-0 bg-transparent px-0 py-0 text-slate-600 focus-visible:ring-0 focus-visible:ring-offset-0${isPending ? " opacity-50" : ""}`}
          disabled={isPending}
          value={currentFilters.from ?? ""}
          onChange={(e) => update("from", e.target.value || undefined)}
          aria-label="Fecha desde"
        />
        <span className="text-xs text-slate-400 mx-2" aria-hidden="true">→</span>
        <Input
          type="date"
          className={`h-7 text-xs w-28 border-0 bg-transparent px-0 py-0 text-slate-600 focus-visible:ring-0 focus-visible:ring-offset-0${isPending ? " opacity-50" : ""}`}
          disabled={isPending}
          value={currentFilters.to ?? ""}
          onChange={(e) => update("to", e.target.value || undefined)}
          aria-label="Fecha hasta"
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

