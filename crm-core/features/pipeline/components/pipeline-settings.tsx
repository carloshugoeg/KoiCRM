"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  updateStageAction,
  reorderStagesAction,
  deleteStageAction,
  createStageAction,
} from "@/features/pipeline/actions"
import {
  SettingsCard,
  SettingsSectionTitle,
} from "@/components/settings/settings-section"
import { PRESET_COLORS } from "@/lib/settings/constants"
import { getStageIcon } from "@/lib/pipeline/stage-icon"
import { toastMessages, toastErrorFromResult } from "@/lib/ui/toast-messages"
import type { Pipeline, PipelineStage, Tenant } from "@prisma/client"

type PipelineWithStages = Pipeline & { stages: PipelineStage[] }

interface Props {
  tenant: Tenant
  pipeline: PipelineWithStages | null
  canManage: boolean
}

function hex2rgba(hex: string, alpha = 0.15) {
  let h = hex.replace("#", "")
  if (h.length === 3) h = h.split("").map((c) => c + c).join("")
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${isNaN(r) ? 0 : r},${isNaN(g) ? 0 : g},${isNaN(b) ? 0 : b},${alpha})`
}

export function PipelineSettings({ tenant, pipeline, canManage }: Props) {
  const router = useRouter()
  const [stages, setStages] = useState(pipeline?.stages ?? [])
  const [error, setError] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState("")
  const [newSublabel, setNewSublabel] = useState("")
  const [newColor, setNewColor] = useState("#818cf8")
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    setStages(pipeline?.stages ?? [])
  }, [pipeline])

  function moveStage(index: number, dir: -1 | 1) {
    const arr = [...stages]
    const fixed = arr.filter((s) => s.locked).map((s) => s.id)
    if (fixed.includes(arr[index]!.id)) return
    const ni = index + dir
    if (ni < 0 || ni >= arr.length || fixed.includes(arr[ni]?.id)) return
    ;[arr[index], arr[ni]] = [arr[ni]!, arr[index]!]
    setStages(arr)
    void reorderStagesAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      pipelineId: pipeline!.id,
      orderedIds: arr.map((s) => s.id),
    }).then((result) => {
      if (!result.ok) {
        toast.error(toastErrorFromResult(result.error, toastMessages.pipeline.errorUpdateStage))
        return
      }
      toast.success(toastMessages.pipeline.orderUpdated)
      router.refresh()
    })
  }

  async function handleFieldChange(
    stage: PipelineStage,
    fields: Partial<Pick<PipelineStage, "label" | "sublabel" | "color">>,
  ) {
    const result = await updateStageAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      id: stage.id,
      label: fields.label ?? stage.label,
      sublabel: fields.sublabel !== undefined ? fields.sublabel : stage.sublabel,
      color: fields.color ?? stage.color,
      iconKey: stage.iconKey,
    })
    if (!result.ok) {
      toast.error(toastErrorFromResult(result.error, toastMessages.pipeline.errorUpdateStage))
      return
    }
    toast.success(toastMessages.pipeline.stageUpdated)
    router.refresh()
  }

  async function handleDelete(stageId: string) {
    if (!confirm("¿Eliminar esta etapa?")) return
    setError(null)
    const result = await deleteStageAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      id: stageId,
    })
    if (!result.ok) {
      const msg = toastErrorFromResult(result.error, toastMessages.pipeline.errorRemoveStage)
      setError(msg)
      toast.error(msg)
      return
    }
    toast.success(toastMessages.pipeline.stageRemoved)
    router.refresh()
  }

  async function handleAddStage() {
    if (!newLabel.trim()) return
    setAdding(true)
    setAddError(null)
    const result = await createStageAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      pipelineId: pipeline!.id,
      label: newLabel,
      sublabel: newSublabel || null,
      color: newColor,
      iconKey: "Star",
    })
    setAdding(false)
    if (!result.ok) {
      const msg = toastErrorFromResult(result.error, toastMessages.pipeline.errorAddStage)
      setAddError(msg)
      toast.error(msg)
      return
    }
    setNewLabel("")
    setNewSublabel("")
    setNewColor("#818cf8")
    toast.success(toastMessages.pipeline.stageAdded)
    router.refresh()
  }

  if (!pipeline) {
    return (
      <p className="text-muted-foreground text-sm">
        No hay un pipeline configurado para este tenant.
      </p>
    )
  }

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain">
      <SettingsSectionTitle>Etapas del embudo</SettingsSectionTitle>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        {stages.map((stage, i) => {
          const Icon = getStageIcon(stage.iconKey)
          const isLocked = stage.locked
          return (
            <div
              key={stage.id}
              className="rounded-xl border overflow-hidden"
              style={{
                borderColor: hex2rgba(stage.color, 0.45),
                background: "hsl(var(--muted) / 0.2)",
              }}
            >
              <div className="flex items-center gap-3 p-3">
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                  style={{
                    background: hex2rgba(stage.color, 0.2),
                    border: `1px solid ${hex2rgba(stage.color, 0.45)}`,
                  }}
                >
                  <Icon className="h-3 w-3" style={{ color: stage.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{stage.label}</p>
                  {stage.sublabel && (
                    <p className="text-xs text-muted-foreground truncate">{stage.sublabel}</p>
                  )}
                </div>
                {isLocked ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-500 border border-slate-500/30">
                    Fijo
                  </span>
                ) : canManage ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => moveStage(i, -1)}
                      className="w-6 h-6 rounded flex items-center justify-center bg-muted disabled:opacity-20"
                      aria-label="Subir etapa"
                    >
                      <ChevronUp className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      disabled={i >= stages.length - 1}
                      onClick={() => moveStage(i, 1)}
                      className="w-6 h-6 rounded flex items-center justify-center bg-muted disabled:opacity-20"
                      aria-label="Bajar etapa"
                    >
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(stage.id)}
                      className="w-6 h-6 rounded flex items-center justify-center bg-muted text-red-400 hover:opacity-70"
                      aria-label="Eliminar etapa"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ) : null}
              </div>
              {!isLocked && canManage && (
                <div className="px-3 pb-3 pt-0 space-y-2 border-t border-border/60">
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Input
                      value={stage.label}
                      onChange={(e) =>
                        setStages((ss) =>
                          ss.map((x) => (x.id === stage.id ? { ...x, label: e.target.value } : x)),
                        )
                      }
                      onBlur={(e) => handleFieldChange(stage, { label: e.target.value })}
                      placeholder="Etiqueta"
                      className="text-sm h-9"
                    />
                    <Input
                      value={stage.sublabel ?? ""}
                      onChange={(e) =>
                        setStages((ss) =>
                          ss.map((x) =>
                            x.id === stage.id ? { ...x, sublabel: e.target.value } : x,
                          ),
                        )
                      }
                      onBlur={(e) =>
                        handleFieldChange(stage, { sublabel: e.target.value || null })
                      }
                      placeholder="Subtítulo"
                      className="text-sm h-9"
                    />
                  </div>
                  <div>
                    <p className="text-xs mb-1.5 text-muted-foreground">Color</p>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_COLORS.map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => {
                            setStages((ss) =>
                              ss.map((x) => (x.id === stage.id ? { ...x, color: col } : x)),
                            )
                            void handleFieldChange(stage, { color: col })
                          }}
                          className="w-5 h-5 rounded-full border-2 transition-all"
                          style={{
                            background: col,
                            borderColor: stage.color === col ? "white" : "transparent",
                            boxShadow: stage.color === col ? `0 0 0 2px ${col}` : "none",
                          }}
                          aria-label={col}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {canManage && (
        <SettingsCard className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">Agregar etapa</p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Ej. Demo"
              className="text-sm h-9"
            />
            <Input
              value={newSublabel}
              onChange={(e) => setNewSublabel(e.target.value)}
              placeholder="Descripción corta"
              className="text-sm h-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => setNewColor(col)}
                className="w-6 h-6 rounded-full border-2 transition-all"
                style={{
                  background: col,
                  borderColor: newColor === col ? "white" : "transparent",
                  boxShadow: newColor === col ? `0 0 0 2px ${col}` : "none",
                }}
                aria-label={col}
              />
            ))}
          </div>
          {addError && <p className="text-sm text-destructive">{addError}</p>}
          <Button
            type="button"
            disabled={adding || !newLabel.trim()}
            onClick={() => void handleAddStage()}
            className="w-full text-xs font-bold gap-1.5"
            style={{
              background: hex2rgba(newColor, 0.2),
              color: newColor,
              border: `1px solid ${hex2rgba(newColor, 0.4)}`,
            }}
            variant="ghost"
          >
            <Plus className="h-3.5 w-3.5" />
            {adding ? "Agregando…" : "Agregar etapa"}
          </Button>
        </SettingsCard>
      )}
    </div>
  )
}
