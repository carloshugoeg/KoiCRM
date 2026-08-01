"use client"

import { useState } from "react"
import { toast } from "sonner"
import { toastMessages, toastErrorFromResult } from "@/lib/ui/toast-messages"
import { useRouter, usePathname } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { MonthGrid } from "@/features/calendar/components/MonthGrid"
import { DayPanel } from "@/features/calendar/components/DayPanel"
import { DealDetailModal } from "@/features/deals/components/DealDetailModal"
import { getDealSummaryAction } from "@/features/deals/actions"
import { MONTH_NAMES } from "@/features/calendar/month-names"
import type { CalendarFollowUp } from "@/features/calendar/queries"
import type { IntlSettings } from "@/lib/intl/format"
import type { PipelineStage, CatalogItem } from "@prisma/client"

const LEGEND: { className: string; label: string }[] = [
  { className: "bg-blue-500", label: "Próximo" },
  { className: "bg-amber-500", label: "Vencido" },
  { className: "bg-red-500", label: "Urgente" },
  { className: "bg-green-500", label: "Completado" },
]

type SelectedDeal = NonNullable<Awaited<ReturnType<typeof getDealSummaryAction>>["deal"]>

interface CalendarClientProps {
  tenantId: string
  tenantSlug: string
  year: number
  month: number
  followUps: CalendarFollowUp[]
  members: { id: string; name: string | null; email: string }[]
  stages: PipelineStage[]
  currentOwnerId?: string
  settings: IntlSettings
  currentUserId: string
  canSeeAll: boolean
  canArchive: boolean
  canDelete: boolean
  archiveReasons: CatalogItem[]
}

export function CalendarClient({
  tenantId,
  tenantSlug,
  year,
  month,
  followUps,
  members,
  stages,
  currentOwnerId,
  settings,
  currentUserId,
  canSeeAll,
  canArchive,
  canDelete,
  archiveReasons,
}: CalendarClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  const defaultDay = isCurrentMonth ? today.getDate() : 1

  const [selectedDay, setSelectedDay] = useState<number | null>(defaultDay)
  // The day panel used to sit permanently beside the grid, empty on every day without a
  // follow-up. It's now a sheet that folds up on demand — the grid keeps the full viewport by
  // default, and `dayPanelOpen` tracks only whether that sheet is currently raised.
  const [dayPanelOpen, setDayPanelOpen] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState<SelectedDeal | null>(null)
  const [openingDealId, setOpeningDealId] = useState<string | null>(null)

  function navigate(targetYear: number, targetMonth: number, ownerId?: string) {
    const params = new URLSearchParams()
    params.set("year", String(targetYear))
    params.set("month", String(targetMonth))
    if (ownerId && ownerId !== "__all__") params.set("owner", ownerId)
    router.push(pathname + "?" + params.toString())
  }

  function goPrev() {
    if (month === 0) navigate(year - 1, 11, currentOwnerId)
    else navigate(year, month - 1, currentOwnerId)
  }

  function goNext() {
    if (month === 11) navigate(year + 1, 0, currentOwnerId)
    else navigate(year, month + 1, currentOwnerId)
  }

  function goToday() {
    navigate(today.getFullYear(), today.getMonth(), currentOwnerId)
  }

  function handleOwnerChange(value: string) {
    navigate(year, month, value === "__all__" ? undefined : value)
  }

  function handleSelectDay(day: number) {
    setSelectedDay(day)
    setDayPanelOpen(true)
  }

  const dayLabel =
    selectedDay !== null
      ? `${selectedDay} de ${MONTH_NAMES[month]} de ${year}`
      : ""

  async function handleOpenDeal(dealId: string) {
    setOpeningDealId(dealId)
    try {
      const res = await getDealSummaryAction({ tenantId, dealId })
      if (res.ok && res.deal) setSelectedDeal(res.deal)
      else toast.error(toastErrorFromResult(res.error, toastMessages.calendar.errorOpenDeal))
    } finally {
      setOpeningDealId(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 short:py-2 tablet:gap-3 tablet:px-4 tablet:py-3">
        <h2 className="mr-1 text-base font-black tablet:text-xl" style={{ color: "var(--foreground)" }}>
          Calendario<span className="hidden tablet:inline"> de Seguimientos</span>
        </h2>
        <Button variant="outline" size="sm" className="h-11 tablet:h-8" onClick={goToday}>
          Hoy
        </Button>
        <div className="ml-auto flex items-center gap-1 tablet:gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 tablet:h-9 tablet:w-9"
            onClick={goPrev}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[104px] text-center text-sm font-bold tablet:min-w-[120px] tablet:text-base">
            {MONTH_NAMES[month]} {year}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 tablet:h-9 tablet:w-9"
            onClick={goNext}
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {canSeeAll && (
          <div className="order-last w-full tablet:order-none tablet:w-48">
            <Select value={currentOwnerId ?? "__all__"} onValueChange={handleOwnerChange}>
              <SelectTrigger className="h-11 text-sm tablet:h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos los asesores</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name ?? m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="hidden items-center gap-3 tablet:flex" aria-hidden="true">
          {LEGEND.map((item) => (
            <span key={item.label} className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${item.className}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 p-2 tablet:p-3">
        <MonthGrid
          year={year}
          month={month}
          followUps={followUps}
          selectedDay={selectedDay}
          onSelectDay={handleSelectDay}
        />
      </div>
      <Sheet open={dayPanelOpen} onOpenChange={setDayPanelOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-2xl rounded-t-xl">
          <SheetHeader>
            <SheetTitle>{dayLabel}</SheetTitle>
          </SheetHeader>
          {selectedDay !== null && (
            <DayPanel
              day={selectedDay}
              month={month}
              year={year}
              followUps={followUps}
              onOpenDeal={handleOpenDeal}
              loadingDealId={openingDealId}
            />
          )}
        </SheetContent>
      </Sheet>
      {selectedDeal !== null && (
        <DealDetailModal
          deal={selectedDeal}
          stages={stages}
          tenantId={tenantId}
          tenantSlug={tenantSlug}
          settings={settings}
          canEdit={canSeeAll || selectedDeal.ownerId === currentUserId}
          canArchive={canArchive}
          canDelete={canDelete}
          members={members}
          archiveReasons={archiveReasons}
          onClose={() => setSelectedDeal(null)}
          onAction={() => {
            setSelectedDeal(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
