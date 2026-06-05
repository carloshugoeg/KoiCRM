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
import { MonthGrid } from "@/features/calendar/components/MonthGrid"
import { DayPanel } from "@/features/calendar/components/DayPanel"
import { DealDetailModal } from "@/features/deals/components/DealDetailModal"
import { getDealSummaryAction } from "@/features/deals/actions"
import type { CalendarFollowUp } from "@/features/calendar/queries"
import type { IntlSettings } from "@/lib/intl/format"
import type { PipelineStage, CatalogItem } from "@prisma/client"

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
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
  followUpReasons: CatalogItem[]
  currentOwnerId?: string
  settings: IntlSettings
  currentUserId: string
  canSeeAll: boolean
  canArchive: boolean
  canDelete: boolean
}

export function CalendarClient({
  tenantId,
  tenantSlug,
  year,
  month,
  followUps,
  members,
  stages,
  followUpReasons,
  currentOwnerId,
  settings,
  currentUserId,
  canSeeAll,
  canArchive,
  canDelete,
}: CalendarClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  const defaultDay = isCurrentMonth ? today.getDate() : 1

  const [selectedDay, setSelectedDay] = useState<number | null>(defaultDay)
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
      <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <h2 className="mr-1 text-xl font-black" style={{ color: "var(--foreground)" }}>
          Calendario de Seguimientos
        </h2>
        <Button variant="outline" size="sm" onClick={goToday}>
          Hoy
        </Button>
        {canSeeAll && (
          <div className="w-48">
            <Select value={currentOwnerId ?? "__all__"} onValueChange={handleOwnerChange}>
              <SelectTrigger className="h-8 text-sm">
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
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={goPrev} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[120px] text-center text-base font-bold">
            {MONTH_NAMES[month]} {year}
          </span>
          <Button variant="ghost" size="icon" onClick={goNext} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <MonthGrid
            year={year}
            month={month}
            followUps={followUps}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        </div>
        <div className="flex w-80 shrink-0 flex-col overflow-hidden border-l">
          {selectedDay !== null ? (
            <DayPanel
              day={selectedDay}
              month={month}
              year={year}
              followUps={followUps}
              followUpReasons={followUpReasons}
              onOpenDeal={handleOpenDeal}
              loadingDealId={openingDealId}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Selecciona un día para ver los seguimientos.
            </div>
          )}
        </div>
      </div>
      {selectedDeal !== null && (
        <DealDetailModal
          deal={selectedDeal}
          stages={stages}
          followUpReasons={followUpReasons}
          tenantId={tenantId}
          tenantSlug={tenantSlug}
          settings={settings}
          canEdit={canSeeAll || selectedDeal.ownerId === currentUserId}
          canArchive={canArchive}
          canDelete={canDelete}
          members={members}
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
