import type { CalendarFollowUp } from "@/features/calendar/queries"

interface MonthGridProps {
  year: number
  month: number
  followUps: CalendarFollowUp[]
  selectedDay: number | null
  onSelectDay: (day: number) => void
}

const WEEKDAY_HEADERS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

function dotColor(fu: CalendarFollowUp, todayMidnight: Date): string {
  if (fu.completed) return "bg-green-500"
  if (fu.deal.statusKey === "urgente") return "bg-red-500"
  if (new Date(fu.date) < todayMidnight) return "bg-amber-500"
  return "bg-blue-500"
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

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 border-b">
        {WEEKDAY_HEADERS.map((h) => (
          <div key={h} className="py-2 text-center text-xs font-medium text-muted-foreground">
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`blank-${idx}`} className="min-h-[80px] border-b border-r" />
          }

          const dayFus = byDay.get(day) ?? []
          const visible = dayFus.slice(0, 3)
          const overflow = dayFus.length - visible.length
          const isSelected = selectedDay === day
          const isToday = day === todayDay

          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(day)}
              aria-pressed={isSelected}
              className={[
                "min-h-[80px] border-b border-r p-1 hover:bg-muted/50 transition-colors w-full text-left",
                isSelected ? "ring-2 ring-inset ring-primary" : "",
                isToday ? "bg-primary/5" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="flex justify-end">
                <span
                  className={[
                    "text-xs w-5 h-5 flex items-center justify-center rounded-full",
                    isToday ? "text-primary font-bold" : "text-muted-foreground",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {day}
                </span>
              </div>
              <div className="mt-0.5 space-y-0.5">
                {visible.map((fu) => (
                  <div key={fu.id} className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor(fu, todayMidnight)}`} />
                    <span className="text-[10px] truncate leading-tight">{fu.deal.name}</span>
                  </div>
                ))}
                {overflow > 0 && (
                  <span className="text-[10px] text-muted-foreground">+{overflow} más</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
