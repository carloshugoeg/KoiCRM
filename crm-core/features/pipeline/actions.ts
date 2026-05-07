"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db/client"
import { auth } from "@/lib/auth/auth"
import { withTenant } from "@/lib/db/rls"
import { requireRole } from "@/lib/auth/rbac"
import { updateStageSchema, reorderStagesSchema, deleteStageSchema } from "@/features/pipeline/schemas"

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

  await withTenant(tenantId, async (tx) => {
    await tx.pipelineStage.update({ where: { id }, data: fields })
  })
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
  const count = await prisma.pipelineStage.count({
    where: { id: { in: orderedIds }, tenantId, pipelineId },
  })
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

  // Verify stage belongs to this tenant
  const stage = await prisma.pipelineStage.findUnique({ where: { id, tenantId } })
  if (!stage) return { ok: false, error: "Etapa no encontrada." }

  const dealCount = await prisma.deal.count({ where: { stageId: id } })
  if (dealCount > 0) {
    return {
      ok: false,
      error: `No se puede eliminar: ${dealCount} oportunidad(es) en esta etapa. Reasigna primero.`,
      dealCount,
    }
  }

  await withTenant(tenantId, async (tx) => {
    await tx.pipelineStage.delete({ where: { id } })
  })
  revalidatePath(`/app/${tenantSlug}/settings/pipeline`, "page")
  return { ok: true }
}
