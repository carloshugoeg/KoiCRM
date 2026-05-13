"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback } from "react"

type Preset = "all" | "today" | "week" | "month" | "quarter" | "year"

const PRESETS: { key: Preset; label: string }[] = [
  { key: "all", label: "Todo" },
  { key: "today", label: "Hoy" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "quarter", label: "Trimestre" },
  { key: "year", label: "Año" },
]

function toISODate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function getPresetRange(preset: Preset): { from: string; to: string } | null {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (preset === "all") return null
  if (preset === "today") {
    const s = toISODate(today)
    return { from: s, to: s }
  }
  if (preset === "week") {
    const day = today.getDay()
    const mon = new Date(today)
    mon.setDate(today.getDate() - ((day + 6) % 7))
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    return { from: toISODate(mon), to: toISODate(sun) }
  }
  if (preset === "month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { from: toISODate(first), to: toISODate(last) }
  }
  if (preset === "quarter") {
    const q = Math.floor(now.getMonth() / 3)
    const first = new Date(now.getFullYear(), q * 3, 1)
    const last = new Date(now.getFullYear(), q * 3 + 3, 0)
    return { from: toISODate(first), to: toISODate(last) }
  }
  if (preset === "year") {
    const first = new Date(now.getFullYear(), 0, 1)
    const last = new Date(now.getFullYear(), 11, 31)
    return { from: toISODate(first), to: toISODate(last) }
  }
  return null
}

export function RangePicker() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const from = searchParams.get("from") ?? ""
  const to = searchParams.get("to") ?? ""

  const activePreset: Preset | "custom" = (() => {
    if (!from && !to) return "all"
    const today = toISODate(new Date())
    if (from === today && to === today) return "today"
    const range = { from, to }
    for (const p of PRESETS.filter((p) => p.key !== "all")) {
      const r = getPresetRange(p.key)
      if (r?.from === range.from && r?.to === range.to) return p.key
    }
    return "custom"
  })()

  const navigate = useCallback(
    (params: URLSearchParams) => {
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname]
  )

  function applyPreset(preset: Preset) {
    const params = new URLSearchParams(searchParams.toString())
    if (preset === "all") {
      params.delete("from")
      params.delete("to")
    } else {
      const r = getPresetRange(preset)
      if (r) {
        params.set("from", r.from)
        params.set("to", r.to)
      }
    }
    navigate(params)
  }

  function applyCustom(field: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(field, value)
    else params.delete(field)
    navigate(params)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map((p) => (
        <button
          type="button"
          key={p.key}
          onClick={() => applyPreset(p.key)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            activePreset === p.key
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-1 ml-1">
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => applyCustom("from", e.target.value)}
          className="h-7 rounded border text-xs px-2 bg-background w-32"
        />
        <span className="text-xs text-muted-foreground">—</span>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => applyCustom("to", e.target.value)}
          className="h-7 rounded border text-xs px-2 bg-background w-32"
        />
      </div>
    </div>
  )
}
