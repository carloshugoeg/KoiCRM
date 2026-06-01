"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db/client"
import { auth } from "@/lib/auth/auth"
import { withTenant } from "@/lib/db/rls"
import { requireRole } from "@/lib/auth/rbac"
import { updateStageSchema, reorderStagesSchema, deleteStageSchema, createStageSchema } from "@/features/pipeline/schemas"

export async function updateStageAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = updateStageSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, id, ...fields } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  let errMsg: string | null = null
  await withTenant(tenantId, async (tx) => {
    const stage = await tx.pipelineStage.findUnique({ where: { id } })
    if (!stage || stage.tenantId !== tenantId) { errMsg = "Etapa no encontrada."; return }
    await tx.pipelineStage.update({ where: { id }, data: fields })
  })
  if (errMsg) return { ok: false, error: errMsg }
  revalidatePath(`/app/${tenantSlug}/settings/pipeline`, "page")
  return { ok: true }
}

export async function reorderStagesAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = reorderStagesSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, pipelineId, orderedIds } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  // Validate all IDs belong to this tenant's pipeline
  const count = await withTenant(tenantId, (tx) =>
    tx.pipelineStage.count({ where: { id: { in: orderedIds }, tenantId, pipelineId } })
  )
  if (count !== orderedIds.length) return { ok: false, error: "IDs inválidos." }

  await withTenant(tenantId, async (tx) => {
    await Promise.all(
      orderedIds.map((id, idx) => tx.pipelineStage.update({ where: { id }, data: { order: idx } }))
    )
  })
  revalidatePath(`/app/${tenantSlug}/settings/pipeline`, "page")
  return { ok: true }
}

export async function deleteStageAction(raw: unknown): Promise<{ ok: boolean; error?: string; dealCount?: number }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = deleteStageSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, id } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  let errMsg: string | null = null
  let dealCount = 0

  await withTenant(tenantId, async (tx) => {
    const stage = await tx.pipelineStage.findUnique({ where: { id } })
    if (!stage || stage.tenantId !== tenantId) { errMsg = "Etapa no encontrada."; return }
    if (stage.locked) { errMsg = "No se puede eliminar una etapa bloqueada."; return }

    dealCount = await tx.deal.count({ where: { stageId: id } })
    if (dealCount > 0) {
      errMsg = `No se puede eliminar: ${dealCount} oportunidad(es) en esta etapa. Reasigna primero.`
      return
    }
    await tx.pipelineStage.delete({ where: { id } })
  })

  if (errMsg) return { ok: false, error: errMsg, dealCount: dealCount > 0 ? dealCount : undefined }
  revalidatePath(`/app/${tenantSlug}/settings/pipeline`, "page")
  return { ok: true }
}

export async function createStageAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = createStageSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, pipelineId, label, sublabel, color, iconKey } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  const existingStages = await withTenant(tenantId, (tx) =>
    tx.pipelineStage.findMany({ where: { pipelineId, tenantId }, orderBy: { order: "asc" } })
  )

  const nonLockedStages = existingStages.filter((s) => !s.locked)
  const newOrder = nonLockedStages.length

  const key = `s_${Date.now()}`

  await withTenant(tenantId, async (tx) => {
    await tx.pipelineStage.create({
      data: {
        tenantId,
        pipelineId,
        key,
        label,
        sublabel: sublabel ?? null,
        color,
        iconKey,
        order: newOrder,
        locked: false,
      },
    })
  })
  revalidatePath(`/app/${tenantSlug}/settings/pipeline`, "page")
  return { ok: true }
}
