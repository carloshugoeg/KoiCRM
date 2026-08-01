import { useEffect, useRef, useState } from "react"
import { MONTH_NAMES } from "@/features/calendar/month-names"
import type { CalendarFollowUp } from "@/features/calendar/queries"

interface MonthGridProps {
  year: number
  month: number
  followUps: CalendarFollowUp[]
  selectedDay: number | null
  onSelectDay: (day: number) => void
}

const WEEKDAY_HEADERS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
const WEEKDAY_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

type DotCategory = "completado" | "urgente" | "vencido" | "proximo"

function categoryOf(fu: CalendarFollowUp, todayMidnight: Date): DotCategory {
  if (fu.completed) return "completado"
  if (fu.deal.statusKey === "urgente") return "urgente"
  if (new Date(fu.date) < todayMidnight) return "vencido"
  return "proximo"
}

const DOT_CLASS: Record<DotCategory, string> = {
  completado: "bg-green-500",
  urgente: "bg-red-500",
  vencido: "bg-amber-500",
  proximo: "bg-blue-500",
}

const CATEGORY_LABEL: Record<DotCategory, string> = {
  completado: "completado",
  urgente: "urgente",
  vencido: "vencido",
  proximo: "próximo",
}

// Screen readers get a spoken breakdown ("2 seguimientos: 1 vencido, 1 próximo") instead of
// leaning on dot color alone, which a sighted-only reading of the cell can't convey.
function describeFollowUps(dayFus: CalendarFollowUp[], todayMidnight: Date): string {
  if (dayFus.length === 0) return "sin seguimientos"
  const counts = new Map<DotCategory, number>()
  for (const fu of dayFus) {
    const cat = categoryOf(fu, todayMidnight)
    counts.set(cat, (counts.get(cat) ?? 0) + 1)
  }
  const breakdown = (["vencido", "urgente", "proximo", "completado"] as DotCategory[])
    .filter((cat) => counts.has(cat))
    .map((cat) => `${counts.get(cat)} ${CATEGORY_LABEL[cat]}`)
    .join(", ")
  const noun = dayFus.length === 1 ? "seguimiento" : "seguimientos"
  return `${dayFus.length} ${noun}: ${breakdown}`
}

interface DayCellProps {
  day: number
  dayFus: CalendarFollowUp[]
  isSelected: boolean
  isToday: boolean
  todayMidnight: Date
  ariaLabel: string
  tabIndex: 0 | -1
  onActivate: (day: number) => void
  onFocusCell: (day: number) => void
  onKeyNav: (e: React.KeyboardEvent<HTMLButtonElement>, day: number) => void
  buttonRef: (el: HTMLButtonElement | null) => void
}

function DayCell({
  day,
  dayFus,
  isSelected,
  isToday,
  todayMidnight,
  ariaLabel,
  tabIndex,
  onActivate,
  onFocusCell,
  onKeyNav,
  buttonRef,
}: DayCellProps) {
  const tabletNames = dayFus.slice(0, 2)
  const tabletOverflow = dayFus.length - tabletNames.length
  const boardNames = dayFus.slice(0, 5)
  const boardOverflow = dayFus.length - boardNames.length
  const dots = dayFus.slice(0, 4)
  const dotOverflow = dayFus.length - dots.length

  return (
    <div role="gridcell" className="border-b border-r">
      <button
        ref={buttonRef}
        type="button"
        tabIndex={tabIndex}
        onClick={() => onActivate(day)}
        onFocus={() => onFocusCell(day)}
        onKeyDown={(e) => onKeyNav(e, day)}
        aria-pressed={isSelected}
        aria-label={ariaLabel}
        className={[
          "flex min-h-11 w-full flex-col p-1 text-left transition-colors hover:bg-muted/50",
          "board:min-h-[80px] board:p-1.5",
          isSelected ? "ring-2 ring-inset ring-primary" : "",
          isToday ? "bg-primary/5" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className="flex justify-end">
          <span
            className={[
              "flex h-5 w-5 items-center justify-center rounded-full text-xs",
              isToday ? "font-bold text-primary" : "text-muted-foreground",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {day}
          </span>
        </span>

        {dayFus.length > 0 && (
          <>
            {/* Below `tablet`: names truncate unreadably at ~50px columns, so mobile shows a
                dot cluster only — tapping the cell opens the day sheet for the real list. */}
            <div className="mt-1 flex flex-wrap items-center gap-1 tablet:hidden" aria-hidden="true">
              {dots.map((fu) => (
                <span key={fu.id} className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASS[categoryOf(fu, todayMidnight)]}`} />
              ))}
              {dotOverflow > 0 && <span className="text-[9px] leading-none text-muted-foreground">+{dotOverflow}</span>}
            </div>

            {/* Tablet tier (520–1023px): narrower columns than board, so fewer names fit. */}
            <div className="mt-0.5 hidden space-y-0.5 tablet:block board:hidden" aria-hidden="true">
              {tabletNames.map((fu) => (
                <div key={fu.id} className="flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASS[categoryOf(fu, todayMidnight)]}`} />
                  <span className="truncate text-[10px] leading-tight">{fu.deal.name}</span>
                </div>
              ))}
              {tabletOverflow > 0 && <span className="text-[10px] text-muted-foreground">+{tabletOverflow} más</span>}
            </div>

            {/* Board tier (>=1024px): the grid now fills the viewport height, so rows are tall
                enough to show more than the 3 the old fixed-height cells allowed. */}
            <div className="mt-0.5 hidden space-y-0.5 board:block" aria-hidden="true">
              {boardNames.map((fu) => (
                <div key={fu.id} className="flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASS[categoryOf(fu, todayMidnight)]}`} />
                  <span className="truncate text-[11px] leading-tight">{fu.deal.name}</span>
                </div>
              ))}
              {boardOverflow > 0 && <span className="text-[10px] text-muted-foreground">+{boardOverflow} más</span>}
            </div>
          </>
        )}
      </button>
    </div>
  )
}

export function MonthGrid({ year, month, followUps, selectedDay, onSelectDay }: MonthGridProps) {
  const today = new Date()
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  const todayDay = isCurrentMonth ? today.getDate() : -1

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDate = new Date(year, month, 1)
  // Mon-first offset: Sun=0 → 6, Mon=1 → 0, …
  const startOffset = (firstDate.getDay() + 6) % 7

  // dates stored at noon — local .getDate() matches calendar day across timezones
  const byDay = new Map<number, CalendarFollowUp[]>()
  for (const fu of followUps) {
    const d = new Date(fu.date).getDate()
    const arr = byDay.get(d) ?? []
    arr.push(fu)
    byDay.set(d, arr)
  }

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const numRows = Math.ceil(cells.length / 7)
  const rows: (number | null)[][] = []
  for (let r = 0; r < numRows; r++) rows.push(cells.slice(r * 7, r * 7 + 7))

  // Roving tabindex (WAI-ARIA grid pattern): exactly one day button is in the tab order at a
  // time; arrow keys move focus between cells instead of tabbing through all ~30 of them.
  const [focusedDay, setFocusedDay] = useState(() => selectedDay ?? 1)
  const buttonRefs = useRef(new Map<number, HTMLButtonElement>())

  useEffect(() => {
    setFocusedDay((d) => Math.min(Math.max(d, 1), daysInMonth))
  }, [daysInMonth])

  function focusDay(day: number) {
    setFocusedDay(day)
    buttonRefs.current.get(day)?.focus()
  }

  function handleKeyNav(e: React.KeyboardEvent<HTMLButtonElement>, day: number) {
    const col = (startOffset + day - 1) % 7
    let next: number | null = null
    switch (e.key) {
      case "ArrowRight":
        next = day + 1
        break
      case "ArrowLeft":
        next = day - 1
        break
      case "ArrowDown":
        next = day + 7
        break
      case "ArrowUp":
        next = day - 7
        break
      case "Home":
        next = day - col
        break
      case "End":
        next = day + (6 - col)
        break
      default:
        return
    }
    // Arrow keys stay within the visible month rather than crossing into a month whose data
    // isn't loaded — Mes anterior/siguiente already cover that navigation.
    if (next === null || next < 1 || next > daysInMonth) {
      e.preventDefault()
      return
    }
    e.preventDefault()
    focusDay(next)
  }

  return (
    <div
      role="grid"
      aria-label={`Calendario de ${MONTH_NAMES[month]} ${year}`}
      className="flex h-full min-h-0 flex-col"
    >
      <div role="row" className="grid shrink-0 grid-cols-7 border-b">
        {WEEKDAY_HEADERS.map((h, i) => (
          <div
            key={h}
            role="columnheader"
            aria-label={WEEKDAY_FULL[i]}
            className="py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {h}
          </div>
        ))}
      </div>
      <div
        className="grid min-h-0 flex-1 grid-cols-7"
        style={{ gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))` }}
      >
        {rows.map((row, rIdx) => (
          <div role="row" key={rIdx} style={{ display: "contents" }}>
            {row.map((day, cIdx) => {
              if (day === null) {
                return <div key={`blank-${rIdx}-${cIdx}`} role="gridcell" aria-hidden="true" className="border-b border-r" />
              }

              const dayFus = byDay.get(day) ?? []
              const isSelected = selectedDay === day
              const isToday = day === todayDay
              const weekday = WEEKDAY_FULL[(startOffset + day - 1) % 7]
              const ariaLabel = [
                `${day} de ${MONTH_NAMES[month]}`,
                weekday,
                isToday ? "hoy" : null,
                describeFollowUps(dayFus, todayMidnight),
                isSelected ? "seleccionado" : null,
              ]
                .filter(Boolean)
                .join(", ")

              return (
                <DayCell
                  key={day}
                  day={day}
                  dayFus={dayFus}
                  isSelected={isSelected}
                  isToday={isToday}
                  todayMidnight={todayMidnight}
                  ariaLabel={ariaLabel}
                  tabIndex={day === focusedDay ? 0 : -1}
                  onActivate={(d) => {
                    setFocusedDay(d)
                    onSelectDay(d)
                  }}
                  onFocusCell={setFocusedDay}
                  onKeyNav={handleKeyNav}
                  buttonRef={(el) => {
                    if (el) buttonRefs.current.set(day, el)
                    else buttonRefs.current.delete(day)
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
