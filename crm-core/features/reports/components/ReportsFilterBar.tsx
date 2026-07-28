"use client"

import { useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowDown, ArrowUp, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ReportSort } from "@/features/reports/queries"

/** Sentinel for "todos los asesores" — Radix Select forbids empty string values. */
export const ALL_OWNERS = "__all__"

interface ReportsFilterBarProps {
  sort: ReportSort
  /** Omitted (or empty) when the member may only see their own opportunities. */
  members?: { id: string; name: string | null; email: string }[]
  ownerId?: string | null
  /** When false the asesor select is hidden entirely. */
  canFilterByOwner: boolean
}

export function ReportsFilterBar({
  sort,
  members = [],
  ownerId,
  canFilterByOwner,
}: ReportsFilterBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function update(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    const query = params.toString()
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname)
    })
  }

  const triggerClasses =
    "h-9 text-xs bg-slate-50 border-slate-200 rounded-full font-medium text-slate-600 shadow-sm focus:ring-0 focus:ring-offset-0"

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        className="h-9 text-xs rounded-full"
        disabled={isPending}
        onClick={() => update("sort", sort === "oldest" ? "newest" : "oldest")}
        aria-label="Cambiar el orden por fecha de creación"
      >
        {sort === "oldest" ? (
          <ArrowUp className="w-3.5 h-3.5 mr-1.5 opacity-60" />
        ) : (
          <ArrowDown className="w-3.5 h-3.5 mr-1.5 opacity-60" />
        )}
        {sort === "oldest" ? "Más antiguas primero" : "Más recientes primero"}
      </Button>

      {canFilterByOwner && (
        <Select
          value={ownerId ?? ALL_OWNERS}
          onValueChange={(v) => update("owner", v === ALL_OWNERS ? undefined : v)}
        >
          <SelectTrigger
            className={`w-44 ${triggerClasses}${isPending ? " opacity-50" : ""}`}
            disabled={isPending}
            aria-label="Filtrar por asesor"
          >
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 opacity-60" />
              <SelectValue placeholder="Asesor" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_OWNERS}>Todos los asesores</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name ?? m.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
