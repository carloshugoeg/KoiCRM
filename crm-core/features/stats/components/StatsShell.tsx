"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { RangePicker } from "./RangePicker"

const TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "listado", label: "Listado" },
  { key: "embudo", label: "Embudo" },
  { key: "equipo", label: "Equipo" },
  { key: "canal", label: "Canal" },
  { key: "productos", label: "Productos" },
  { key: "alerts", label: "Alertas" },
] as const

export function StatsShell({ tenantSlug }: { tenantSlug: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const qs = searchParams.toString()

  function tabHref(key: string) {
    const base = `/app/${tenantSlug}/stats/${key}`
    return qs ? `${base}?${qs}` : base
  }

  function isActive(key: string) {
    return pathname.includes(`/stats/${key}`)
  }

  return (
    <div className="border-b bg-background px-4 pt-3 pb-0">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <h1 className="text-base font-semibold">Estadísticas</h1>
        <RangePicker />
      </div>
      <nav className="flex gap-0 -mb-px overflow-x-auto">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tabHref(tab.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              isActive(tab.key)
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
