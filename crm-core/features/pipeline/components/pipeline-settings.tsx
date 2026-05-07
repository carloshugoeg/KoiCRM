"use client"

import { useState } from "react"
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
import { updateStageAction, reorderStagesAction, deleteStageAction } from "@/features/pipeline/actions"
import type { Pipeline, PipelineStage, Tenant } from "@prisma/client"

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
  const [color, setColor] = useState(stage.color)
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
      color,
      iconKey: stage.iconKey,
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
        <div className="flex-1 flex gap-2 items-center">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="flex-1"
            autoFocus
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-10 cursor-pointer rounded border"
          />
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "…" : "Guardar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
        </div>
      ) : (
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{stage.label}</p>
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
    </div>
  )
}
