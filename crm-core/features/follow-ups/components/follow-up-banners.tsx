"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, CalendarClock, X } from "lucide-react"
import type { FollowUpBannerItem, FollowUpBannerUrgency } from "@/features/follow-ups/banner-items"

// Dark surfaces stay dark and low-saturation (the `-950` card tints, near black with a hint of
// hue) so the hue reads through the border and badge instead of washing the card. Mirrors the
// light formula (`{color}-50/95` + `shadow-{color}-100`) with the dark end of the same palette
// instead of introducing a new visual language; `dark:shadow-none` drops the light-mode colored
// shadow so it doesn't render as a pale halo around a dark card.
const URGENCY_STYLES: Record<
  FollowUpBannerUrgency,
  { card: string; badge: string; label: string }
> = {
  overdue: {
    card: "border-red-200 bg-red-50/95 shadow-red-100 dark:border-red-800/80 dark:bg-red-950/95 dark:shadow-none",
    badge: "bg-red-100 text-red-800 dark:bg-red-900/70 dark:text-red-200",
    label: "Vencido",
  },
  today: {
    card: "border-orange-200 bg-orange-50/95 shadow-orange-100 dark:border-orange-800/80 dark:bg-orange-950/95 dark:shadow-none",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/70 dark:text-orange-200",
    label: "Hoy",
  },
  upcoming: {
    card: "border-blue-200 bg-blue-50/95 shadow-blue-100 dark:border-blue-800/80 dark:bg-blue-950/95 dark:shadow-none",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/70 dark:text-blue-200",
    label: "Próximo",
  },
}

// useLayoutEffect only does anything useful on the client (it's a no-op warning source during
// SSR), so pick the effect at module init based on environment rather than calling
// useLayoutEffect unconditionally — the standard isomorphic-layout-effect pattern.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect

interface Props {
  tenantSlug: string
  items: FollowUpBannerItem[]
  totalCount: number
}

/** One reminder card. Shared between the below-`board` and `board`-and-up renderings below so
 * the card markup itself — the part that isn't changing — can't drift between the two. */
function FollowUpCard({
  item,
  onOpen,
  onDismiss,
}: {
  item: FollowUpBannerItem
  onOpen: () => void
  onDismiss: () => void
}) {
  const style = URGENCY_STYLES[item.urgency]

  return (
    <div
      className={`pointer-events-auto relative rounded-lg border p-3 shadow-lg backdrop-blur-sm ${style.card}`}
    >
      {/* 44x44 touch target (Apple HIG minimum), anchored flush to the card's rounded
          corner so the visible icon stays the same small size — only the invisible hit
          area grows. It necessarily overlaps the top of the "open deal" button below;
          that's an accepted tradeoff for a corner dismiss control, and the open-deal
          button still has the rest of the card (title tail, company, note, date) to
          receive taps. */}
      <button
        type="button"
        className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-tr-lg text-muted-foreground motion-safe:transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
        aria-label="Cerrar recordatorio"
        onClick={onDismiss}
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <button type="button" className="w-full pr-11 text-left" onClick={onOpen}>
        <div className="mb-1.5 flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.badge}`}
          >
            {style.label}
          </span>
        </div>
        <p className="truncate text-sm font-semibold text-foreground">{item.dealName}</p>
        {item.company && (
          <p className="truncate text-xs text-muted-foreground">{item.company}</p>
        )}
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {item.note ? `${item.note} · ${item.stageLabel}` : item.stageLabel}
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-foreground/80">
          <CalendarClock className="h-3 w-3 shrink-0" aria-hidden />
          {item.dateLabel}
        </p>
      </button>
    </div>
  )
}

export function FollowUpBanners({ tenantSlug, items, totalCount }: Props) {
  const router = useRouter()
  const storageKey = `follow-up-banners-dismissed:${tenantSlug}`

  // Start empty so the first client render matches the server exactly (the server always sees
  // an empty dismissed set — sessionStorage doesn't exist there). Reading sessionStorage in the
  // initializer instead would make the very first client render disagree with the server's HTML
  // whenever the user had dismissed something earlier in the session, and React discards the
  // whole SSR'd tree to recover — see the hydration-fix report for the exact error this caused.
  //
  // The read happens in a layout effect (isomorphic — see above) rather than a regular effect,
  // so it applies synchronously after the DOM is committed but before the browser paints. Net
  // effect for the user: on a page that has any dismissed follow-ups this session, those banners
  // are technically present in the DOM for a moment, but never actually painted — there is no
  // visible flash. A plain `useEffect` would have painted the full (undismissed) list first and
  // then removed items a frame later, which is the flash we're explicitly avoiding.
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())

  // Only meaningful below `board` (see the render below) — the panel there defaults to a
  // collapsed summary and this tracks whether the person opened it. Starts closed on both
  // server and client, unconditionally, so — unlike the sessionStorage read above — there is
  // nothing here that can disagree between the two renders.
  const [expanded, setExpanded] = useState(false)

  useIsomorphicLayoutEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (raw) setDismissed(new Set(JSON.parse(raw) as string[]))
    } catch {
      /* ignore malformed/unavailable storage — behaves as if nothing was dismissed */
    }
  }, [storageKey])

  const visible = useMemo(
    () => items.filter((item) => !dismissed.has(item.id)),
    [items, dismissed],
  )

  const persistDismissed = useCallback(
    (next: Set<string>) => {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify([...next]))
      } catch {
        /* ignore quota errors */
      }
    },
    [storageKey],
  )

  const dismiss = useCallback(
    (id: string) => {
      setDismissed((prev) => {
        const next = new Set(prev)
        next.add(id)
        persistDismissed(next)
        return next
      })
    },
    [persistDismissed],
  )

  const dismissAll = useCallback(() => {
    setDismissed((prev) => {
      const next = new Set(prev)
      for (const item of visible) next.add(item.id)
      persistDismissed(next)
      return next
    })
    setExpanded(false)
  }, [visible, persistDismissed])

  if (visible.length === 0) return null

  const alertsHref = `/app/${tenantSlug}/stats/alerts`
  const hiddenCount = totalCount - visible.length
  const worstUrgency: FollowUpBannerUrgency = visible.some((i) => i.urgency === "overdue")
    ? "overdue"
    : visible.some((i) => i.urgency === "today")
      ? "today"
      : "upcoming"
  const countLabel =
    visible.length === 1 ? "1 seguimiento pendiente" : `${visible.length} seguimientos pendientes`

  const seeAllLink = (hiddenCount > 0 || totalCount > items.length) && (
    <Link
      href={alertsHref}
      className="pointer-events-auto rounded-lg border border-border bg-background/95 px-3 py-2 text-center text-xs font-medium text-indigo-600 shadow-md backdrop-blur-sm hover:bg-muted/80"
    >
      Ver todos los seguimientos
      {hiddenCount > 0 ? ` (+${hiddenCount} más)` : ""}
    </Link>
  )

  return (
    <>
      {/*
        Below `board` (1024px): this is what was eating up to 91% of a phone's width and 74%
        of the tablet-landscape height with no way to see or reach the pipeline underneath.
        Default view is a single 56px round summary button — small enough to sit next to the
        content it used to cover, with the count and worst urgency visible without opening
        anything. The full list, with its own "descartar todos", only takes over the screen
        when someone actually taps it, and even then it's capped to `70dvh` with its own
        internal scroll instead of growing past the viewport.
      */}
      <div
        className="board:hidden print:hidden pointer-events-none fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2"
        aria-live="polite"
        aria-label="Recordatorios de seguimiento"
      >
        {expanded ? (
          <div className="pointer-events-auto flex max-h-[min(70dvh,32rem)] w-[min(100vw-2rem,22rem)] flex-col gap-2">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/95 py-1 pl-3 pr-1 shadow-md backdrop-blur-sm">
              <p className="text-xs font-semibold text-foreground">{countLabel}</p>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={dismissAll}
                  className="flex h-11 items-center rounded-md px-2 text-xs font-medium text-muted-foreground motion-safe:transition-colors hover:bg-muted hover:text-foreground"
                >
                  Descartar todos
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  aria-label="Cerrar recordatorios"
                  className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto overscroll-contain">
              {visible.map((item) => (
                <FollowUpCard
                  key={item.id}
                  item={item}
                  onOpen={() => router.push(`/app/${tenantSlug}/pipeline?deal=${item.dealId}`)}
                  onDismiss={() => dismiss(item.id)}
                />
              ))}
              {seeAllLink}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-lg backdrop-blur-sm motion-safe:transition-colors hover:bg-muted/80"
            aria-label={`Ver ${countLabel}`}
          >
            <Bell className="h-5 w-5" aria-hidden />
            <span
              className={`absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-bold ${URGENCY_STYLES[worstUrgency].badge}`}
            >
              {visible.length}
            </span>
          </button>
        )}
      </div>

      {/*
        `board` and up (desktop, ≥1024px): unchanged from before this fix — same classes as the
        original single rendering (just gated behind `hidden board:flex` instead of `flex`),
        same always-expanded stacked list, no collapse control, no dismiss-all.
      */}
      <div
        className="print:hidden pointer-events-none fixed bottom-20 right-4 z-50 hidden w-[min(100vw-2rem,22rem)] flex-col gap-2 board:flex"
        aria-live="polite"
        aria-label="Recordatorios de seguimiento"
      >
        {visible.map((item) => (
          <FollowUpCard
            key={item.id}
            item={item}
            onOpen={() => router.push(`/app/${tenantSlug}/pipeline?deal=${item.dealId}`)}
            onDismiss={() => dismiss(item.id)}
          />
        ))}
        {seeAllLink}
      </div>
    </>
  )
}
