"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { SETTINGS_NAV } from "@/lib/settings/constants"

export function SettingsNav({ tenantSlug }: { tenantSlug: string }) {
  const pathname = usePathname()

  function isActive(section: string) {
    return pathname.includes(`/settings/${section}`)
  }

  return (
    <div className="shrink-0 border-b bg-background/80 backdrop-blur-sm z-30">
      <div className="max-w-lg mx-auto px-4">
        <div className="flex items-center gap-2.5 py-4 border-b border-border/60">
          <Settings className="h-[18px] w-[18px] text-indigo-400 shrink-0" />
          <h1 className="font-bold text-lg">Configuración</h1>
        </div>
        <div className="flex w-full gap-1 py-3">
          {SETTINGS_NAV.map(({ label, section, icon: Icon }) => {
            const href = `/app/${tenantSlug}/settings/${section}`
            const active = isActive(section)
            return (
              <Link
                key={section}
                href={href}
                className={cn(
                  "flex flex-1 basis-0 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all border text-center leading-tight",
                  active
                    ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/40"
                    : "bg-muted/40 text-muted-foreground border-border hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="line-clamp-2">{label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
