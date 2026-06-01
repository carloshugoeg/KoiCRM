"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateStageAction, reorderStagesAction, deleteStageAction, createStageAction } from "@/features/pipeline/actions"
import type { Pipeline, PipelineStage, Tenant } from "@prisma/client"

const PRESET_COLORS = [
  "#818cf8","#38bdf8","#fbbf24","#f472b6",
  "#34d399","#fb923c","#f87171","#a78bfa",
  "#4ade80","#e879f9","#facc15","#60a5fa",
]

const STAGE_ICONS = ["Star","User","Phone","DollarSign","Flame","CheckCircle2","Clock","Zap","Package","Waves"]

type PipelineWithStages = Pipeline & { stages: PipelineStage[] }

interface Props {
  tenant: Tenant
  pipeline: PipelineWithStages | null
  canManage: boolean
}

function SortableStageRow({
  stage,
  tenant,
  canManage,
  onDelete,
}: {
  stage: PipelineStage
  tenant: Tenant
  canManage: boolean
  onDelete: () => void
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(stage.label)
  const [sublabel, setSublabel] = useState(stage.sublabel ?? "")
  const [color, setColor] = useState(stage.color)
  const [iconKey, setIconKey] = useState(stage.iconKey)
  const [saving, setSaving] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  async function handleSave() {
    setSaving(true)
    await updateStageAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      id: stage.id,
      label,
      sublabel: sublabel || null,
      color,
      iconKey,
    })
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-3 px-4 py-3 bg-background">
      {canManage && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
          aria-label="Arrastrar para reordenar"
        >
          ⠿
        </button>
      )}
      <div
        className="w-4 h-4 rounded-full shrink-0 border"
        style={{ backgroundColor: color }}
      />
      {editing ? (
        <div className="flex-1 flex flex-col gap-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nombre de etapa"
            autoFocus
          />
          <Input
            value={sublabel}
            onChange={(e) => setSublabel(e.target.value)}
            placeholder="Descripción corta (opcional)"
          />
          <div className="flex flex-wrap gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-3 h-3 cursor-pointer rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
          <select
            value={iconKey}
            onChange={(e) => setIconKey(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {STAGE_ICONS.map((icon) => (
              <option key={icon} value={icon}>{icon}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "…" : "Guardar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{stage.label}</p>
          {stage.sublabel && <p className="text-xs text-muted-foreground truncate">{stage.sublabel}</p>}
          {stage.locked && <span className="text-xs text-muted-foreground">Bloqueada</span>}
        </div>
      )}
      {canManage && !editing && (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Editar</Button>
          {!stage.locked && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}>
              Eliminar
            </Button>
          )}
        </div>
      )}
    </li>
  )
}

export function PipelineSettings({ tenant, pipeline, canManage }: Props) {
  const router = useRouter()
  const [stages, setStages] = useState(pipeline?.stages ?? [])
  const [error, setError] = useState<string | null>(null)

  // Sync stages list when server component re-renders after router.refresh()
  useEffect(() => { setStages(pipeline?.stages ?? []) }, [pipeline])
  const [newLabel, setNewLabel] = useState("")
  const [newSublabel, setNewSublabel] = useState("")
  const [newColor, setNewColor] = useState("#818cf8")
  const [newIconKey, setNewIconKey] = useState("Star")
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIdx = stages.findIndex((s) => s.id === active.id)
    const newIdx = stages.findIndex((s) => s.id === over.id)
    const newStages = arrayMove(stages, oldIdx, newIdx)
    setStages(newStages)

    await reorderStagesAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      pipelineId: pipeline!.id,
      orderedIds: newStages.map((s) => s.id),
    })
    router.refresh()
  }

  async function handleAddStage(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setAddError(null)
    const result = await createStageAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      pipelineId: pipeline!.id,
      label: newLabel,
      sublabel: newSublabel || null,
      color: newColor,
      iconKey: newIconKey,
    })
    setAdding(false)
    if (!result.ok) { setAddError(result.error ?? "Error."); return }
    setNewLabel("")
    setNewSublabel("")
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
    if (!result.ok) { setError(result.error ?? "Error."); return }
    router.refresh()
  }

  if (!pipeline) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Embudo</h1>
        <p className="text-muted-foreground">No hay un pipeline configurado para este tenant.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Embudo: {pipeline.name}</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {canManage && (
        <p className="text-sm text-muted-foreground">
          Arrastra las etapas para reordenarlas. Las etapas bloqueadas no se pueden eliminar.
        </p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul className="divide-y border rounded-lg">
            {stages.map((stage) => (
              <SortableStageRow
                key={stage.id}
                stage={stage}
                tenant={tenant}
                canManage={canManage}
                onDelete={() => handleDelete(stage.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {canManage && (
        <form onSubmit={handleAddStage} className="border rounded-lg p-4 space-y-3">
          <h2 className="text-base font-semibold">Nueva etapa</h2>
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Nombre de etapa"
            required
          />
          <Input
            value={newSublabel}
            onChange={(e) => setNewSublabel(e.target.value)}
            placeholder="Descripción corta (opcional)"
          />
          <div className="flex flex-wrap gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className={`w-3 h-3 cursor-pointer rounded-full border-2 ${newColor === c ? "border-foreground" : "border-transparent"}`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
          <select
            value={newIconKey}
            onChange={(e) => setNewIconKey(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {STAGE_ICONS.map((icon) => (
              <option key={icon} value={icon}>{icon}</option>
            ))}
          </select>
          {addError && <p className="text-sm text-destructive">{addError}</p>}
          <Button type="submit" disabled={adding}>
            {adding ? "Agregando…" : "Agregar"}
          </Button>
        </form>
      )}
    </div>
  )
}
