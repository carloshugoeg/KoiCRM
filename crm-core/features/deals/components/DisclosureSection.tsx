"use client"

import { useId, useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface DisclosureSectionProps {
  /** Section name shown on the trigger row, e.g. "Cotizaciones". */
  title: string
  /** Optional cheap count shown next to the title, e.g. 2 -> "Cotizaciones (2)". Omit if it would require a new fetch. */
  count?: number
  /** Initial open state on mobile. Ignored on desktop, where content is always shown. */
  defaultOpen?: boolean
  /** Result of useNarrowViewport() from the caller — kept as a prop so every instance shares one subscription. */
  isNarrow: boolean
  className?: string
  children: React.ReactNode
}

/**
 * Collapses `children` behind a tappable disclosure header on mobile viewports.
 * On desktop it is a transparent passthrough: same DOM shape as before this
 * component existed, always expanded, no button, no chevron.
 */
export function DisclosureSection({ title, count, defaultOpen = false, isNarrow, className, children }: DisclosureSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()

  if (!isNarrow) {
    // No className means the caller relied on `children` rendering directly into its
    // parent with no extra wrapper — preserve that exactly (e.g. Seguimientos/Historial,
    // whose heading lives inline rather than inside a bordered block).
    return className ? <div className={className}>{children}</div> : <>{children}</>
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex min-h-11 w-full items-center justify-between gap-3 py-2.5 text-left"
      >
        <span className="text-sm font-semibold">
          {title}
          {typeof count === "number" && <span className="ml-1.5 font-normal text-muted-foreground">({count})</span>}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>
      <div id={contentId} hidden={!open} className="pb-1">
        {children}
      </div>
    </div>
  )
}
