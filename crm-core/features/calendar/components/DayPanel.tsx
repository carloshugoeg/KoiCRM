import { CalendarCheck } from "lucide-react"
import { avatarColor, avatarInitials } from "@/lib/utils/avatar-color"
import { Button } from "@/components/ui/button"
import type { CalendarFollowUp } from "@/features/calendar/queries"

interface DayPanelProps {
  day: number
  month: number
  year: number
  followUps: CalendarFollowUp[]
  onOpenDeal: (dealId: string) => void
  loadingDealId?: string | null
}

export function DayPanel({ day, month, year, followUps, onOpenDeal, loadingDealId }: DayPanelProps) {
  const today = new Date()
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const dayFus = followUps.filter((fu) => {
    const d = new Date(fu.date)
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
  })

  if (dayFus.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-muted-foreground">
        <CalendarCheck className="w-8 h-8 opacity-40" />
        <p className="text-sm">No hay seguimientos programados para este día.</p>
      </div>
    )
  }

  // Flat, divided list rather than a card per row — the sheet itself is already the
  // "container"; boxing each follow-up again inside it would be a nested-card stack.
  return (
    <div className="flex max-h-[50vh] flex-col divide-y divide-border overflow-y-auto pr-1">
      {dayFus.map((fu) => {
        const isOverdue = !fu.completed && new Date(fu.date) < todayMidnight
        const initials = avatarInitials(fu.deal.owner.name)
        const color = avatarColor(fu.deal.owner.id)
        const stageColor = fu.deal.stage.color

        return (
          <div
            key={fu.id}
            className={`flex flex-col gap-2 py-3 first:pt-0 last:pb-0 ${fu.completed ? "opacity-50 grayscale" : ""}`}
          >
            <div className="flex items-start gap-2">
              <div
                className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-white text-[10px] font-semibold"
                style={{ backgroundColor: color }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{fu.deal.name}</p>
                <div className="flex flex-wrap items-center gap-1 mt-1">
                  {isOverdue && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500 text-white">
                      Vencido
                    </span>
                  )}
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{
                      backgroundColor: fu.deal.stage.color + "22", // schema enforces #RRGGBB — 22 = ~13% opacity
                      color: stageColor,
                    }}
                  >
                    {fu.deal.stage.label}
                  </span>
                  {fu.note && (
                    <span className="text-[10px] text-muted-foreground">{fu.note}</span>
                  )}
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-11 shrink-0 text-xs board:h-7"
              onClick={() => onOpenDeal(fu.deal.id)}
              disabled={loadingDealId === fu.deal.id}
            >
              {loadingDealId === fu.deal.id ? "…" : "Detalles"}
            </Button>
          </div>
        )
      })}
    </div>
  )
}
