"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

// ---------------------------------------------------------------------------
// SettingsNav — client sub-component for active-link detection
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { label: "Apariencia", section: "appearance" },
  { label: "Embudo",     section: "pipeline"   },
  { label: "Catálogos",  section: "catalogs"   },
  { label: "Usuarios",   section: "users"      },
  { label: "General",    section: "general"    },
] as const

export function SettingsNav({ tenantSlug }: { tenantSlug: string }) {
  const pathname = usePathname()

  function navClass(href: string) {
    return pathname.startsWith(href)
      ? "block text-sm font-semibold text-foreground px-2 py-1 rounded"
      : "block text-sm text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors"
  }

  return (
    <aside className="w-48 shrink-0 border-r pt-8 px-4 space-y-1">
      <p className="text-sm font-semibold text-muted-foreground mb-4">Configuración</p>
      {NAV_ITEMS.map(({ label, section }) => {
        const href = `/app/${tenantSlug}/settings/${section}`
        return (
          <Link key={section} href={href} className={navClass(href)}>
            {label}
          </Link>
        )
      })}
    </aside>
  )
}
