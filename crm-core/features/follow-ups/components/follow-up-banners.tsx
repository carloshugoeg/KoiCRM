"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, CalendarClock, X } from "lucide-react"
import type { FollowUpBannerItem, FollowUpBannerUrgency } from "@/features/follow-ups/banner-items"

const URGENCY_STYLES: Record<
  FollowUpBannerUrgency,
  { card: string; badge: string; label: string }
> = {
  overdue: {
    card: "border-red-200 bg-red-50/95 shadow-red-100",
    badge: "bg-red-100 text-red-800",
    label: "Vencido",
  },
  today: {
    card: "border-orange-200 bg-orange-50/95 shadow-orange-100",
    badge: "bg-orange-100 text-orange-800",
    label: "Hoy",
  },
  upcoming: {
    card: "border-blue-200 bg-blue-50/95 shadow-blue-100",
    badge: "bg-blue-100 text-blue-800",
    label: "Próximo",
  },
}

function formatFollowUpDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-GT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface Props {
  tenantSlug: string
  items: FollowUpBannerItem[]
  totalCount: number
}

export function FollowUpBanners({ tenantSlug, items, totalCount }: Props) {
  const router = useRouter()
  const storageKey = `follow-up-banners-dismissed:${tenantSlug}`

  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try {
      const raw = sessionStorage.getItem(storageKey)
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch {
      return new Set()
    }
  })

  const visible = useMemo(
    () => items.filter((item) => !dismissed.has(item.id)),
    [items, dismissed],
  )

  const dismiss = useCallback(
    (id: string) => {
      setDismissed((prev) => {
        const next = new Set(prev)
        next.add(id)
        try {
          sessionStorage.setItem(storageKey, JSON.stringify([...next]))
        } catch {
          /* ignore quota errors */
        }
        return next
      })
    },
    [storageKey],
  )

  if (visible.length === 0) return null

  const alertsHref = `/app/${tenantSlug}/stats/alerts`
  const hiddenCount = totalCount - visible.length

  return (
    <div
      className="print:hidden pointer-events-none fixed bottom-20 right-4 z-50 flex w-[min(100vw-2rem,22rem)] flex-col gap-2"
      aria-live="polite"
      aria-label="Recordatorios de seguimiento"
    >
      {visible.map((item) => {
        const style = URGENCY_STYLES[item.urgency]
        const dealHref = `/app/${tenantSlug}/pipeline?deal=${item.dealId}`

        return (
          <div
            key={item.id}
            className={`pointer-events-auto relative rounded-lg border p-3 shadow-lg backdrop-blur-sm ${style.card}`}
          >
            <button
              type="button"
              className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground hover:bg-black/5 hover:text-foreground"
              aria-label="Cerrar recordatorio"
              onClick={() => dismiss(item.id)}
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              className="w-full pr-6 text-left"
              onClick={() => router.push(dealHref)}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <Bell className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.badge}`}>
                  {style.label}
                </span>
              </div>
              <p className="truncate text-sm font-semibold text-foreground">{item.dealName}</p>
              {item.company && (
                <p className="truncate text-xs text-muted-foreground">{item.company}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {item.reasonLabel} · {item.stageLabel}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-foreground/80">
                <CalendarClock className="h-3 w-3 shrink-0" aria-hidden />
                {formatFollowUpDate(item.dateIso)}
              </p>
            </button>
          </div>
        )
      })}

      {(hiddenCount > 0 || totalCount > items.length) && (
        <Link
          href={alertsHref}
          className="pointer-events-auto rounded-lg border border-border bg-background/95 px-3 py-2 text-center text-xs font-medium text-indigo-600 shadow-md backdrop-blur-sm hover:bg-muted/80"
        >
          Ver todos los seguimientos
          {hiddenCount > 0 ? ` (+${hiddenCount} más)` : ""}
        </Link>
      )}
    </div>
  )
}
