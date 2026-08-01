"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

/**
 * Ajustes is a narrow, form-shaped surface — a single column of fields and short lists, which
 * `max-w-lg` suits. The permissions matrix is the exception: it is a table with one column per
 * role, so at 512px it could not fit its own header and forced a horizontal scroll on a screen
 * with room to spare.
 *
 * The width is decided here rather than in `layout.tsx` because a server layout cannot see
 * which child route is rendering, and a nested layout would still sit inside the parent's cap.
 * Add a route here only when its content is genuinely tabular.
 */
const WIDE_ROUTES = ["/settings/permissions"]

export function SettingsWidth({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const wide = WIDE_ROUTES.some((route) => pathname.includes(route))

  return (
    <div
      className={[
        "mx-auto flex w-full min-h-0 flex-1 flex-col overflow-hidden px-5 pt-4",
        wide ? "max-w-3xl" : "max-w-lg",
      ].join(" ")}
    >
      {children}
    </div>
  )
}
