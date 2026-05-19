"use client"

import { formatDateTime } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"
import { ACTIVITY_LABELS } from "@/features/activity/constants"
import type { ActivityType, ActivityEntry } from "@/features/activity/queries"

interface HistoryPanelProps {
  activities: ActivityEntry[]
  settings: IntlSettings
}

function activityDescription(type: string, payload: unknown): string {
  const label = ACTIVITY_LABELS[type as ActivityType] ?? type
  if (!payload || typeof payload !== "object") return label

  const p = payload as Record<string, unknown>

  if (type === "stageChanged" && p.toLabel) return `Movido a "${p.toLabel}"`
  if (type === "valueChanged" && p.new !== undefined) return `Valor actualizado a Q${Number(p.new).toFixed(2)}`
  if (type === "followUpAdded" && p.date) return `Seguimiento programado para ${p.date}`
  if (type === "followUpCompleted" && p.result) return `Seguimiento completado: ${p.result}`
  if (type === "noteAdded") return "Nota agregada"

  return label
}

export function HistoryPanel({ activities, settings }: HistoryPanelProps) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
        <p>Sin historial aún.</p>
      </div>
    )
  }

  return (
    <ol className="space-y-3">
      {activities.map((a, i) => (
        <li key={a.id} className="flex gap-3 text-sm">
          <div className="flex flex-col items-center">
            <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
            {i < activities.length - 1 && <span className="w-px flex-1 bg-border mt-1" />}
          </div>
          <div className="pb-3">
            <p className="font-medium leading-snug">{activityDescription(a.type, a.payload)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDateTime(a.createdAt, settings)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
