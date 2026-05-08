"use client"

import { useRouter, usePathname } from "next/navigation"
import { useTransition } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { CatalogItem } from "@prisma/client"
import type { PipelineFiltersParams } from "@/features/pipeline/schemas"

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
  const [, startTransition] = useTransition()

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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={currentFilters.owner ?? ALL} onValueChange={(v) => update("owner", v)}>
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue placeholder="Asesor" />
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
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue placeholder="Canal" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los canales</SelectItem>
          {channels.map((c) => (
            <SelectItem key={c.key} value={c.key}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentFilters.equipment ?? ALL} onValueChange={(v) => update("equipment", v)}>
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue placeholder="Equipo" />
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
        <SelectTrigger className="w-40 h-8 text-xs">
          <SelectValue placeholder="Alertas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Sin filtro de alerta</SelectItem>
          <SelectItem value="missingQuote">Falta Cotización</SelectItem>
          <SelectItem value="missingPayment">Falta Pago</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <Input
          type="date"
          className="h-8 text-xs w-36"
          value={currentFilters.from ?? ""}
          onChange={(e) => update("from", e.target.value || undefined)}
        />
        <span className="text-xs text-muted-foreground">→</span>
        <Input
          type="date"
          className="h-8 text-xs w-36"
          value={currentFilters.to ?? ""}
          onChange={(e) => update("to", e.target.value || undefined)}
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearAll}>
          Limpiar filtros
        </Button>
      )}
    </div>
  )
}
