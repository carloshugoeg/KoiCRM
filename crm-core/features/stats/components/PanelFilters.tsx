"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  PANEL_FILTER_ALL_LABELS,
  PANEL_FILTER_LABELS,
  panelParamName,
  type PanelFilterKey,
  type PanelFilterValues,
  type StatsFilterOptions,
} from "@/features/stats/panel-filters"

const ALL = "__all__"

interface PanelFiltersProps {
  /** Namespaces this panel's params in the URL, e.g. `etapas.owner`. */
  panelId: string
  keys: readonly PanelFilterKey[]
  options: StatsFilterOptions
  values: PanelFilterValues
}

/**
 * Filter control for a single stats panel. Writes only its own namespaced params, so the shared
 * date range and every other panel's selection survive untouched — and the resulting URL is
 * shareable, exactly like the range picker's.
 */
export function PanelFilters({ panelId, keys, options, values }: PanelFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const activeCount = keys.filter((k) => values[k]).length

  function push(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    mutate(params)
    const qs = params.toString()
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }

  function update(key: PanelFilterKey, value: string) {
    push((params) => {
      const name = panelParamName(panelId, key)
      if (!value || value === ALL) params.delete(name)
      else params.set(name, value)
    })
  }

  function clear() {
    push((params) => {
      for (const key of keys) params.delete(panelParamName(panelId, key))
    })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={`Filtros del panel${activeCount ? ` (${activeCount} activos)` : ""}`}
          className={`h-7 px-2 text-xs font-medium gap-1.5 [&_svg]:size-3.5 ${
            activeCount ? "border-primary/40 text-foreground" : "text-muted-foreground"
          }${isPending ? " opacity-60" : ""}`}
        >
          <SlidersHorizontal />
          Filtros
          {activeCount > 0 && (
            <span className="rounded bg-primary px-1 text-[10px] leading-4 text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="space-y-3">
          {keys.map((key) => (
            <div key={key}>
              <label className="mb-1 block text-xs text-muted-foreground">
                {PANEL_FILTER_LABELS[key]}
              </label>
              <Select
                value={values[key] ?? ALL}
                onValueChange={(v) => update(key, v)}
                disabled={isPending}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={PANEL_FILTER_ALL_LABELS[key]} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{PANEL_FILTER_ALL_LABELS[key]}</SelectItem>
                  {options[key].map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          <div className="flex justify-end pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={clear}
              disabled={isPending || activeCount === 0}
            >
              Limpiar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
