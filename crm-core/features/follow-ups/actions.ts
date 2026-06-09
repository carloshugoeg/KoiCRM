"use server"

import { revalidatePath } from "next/cache"
import { withTenant } from "@/lib/db/rls"
import { canEditDeal } from "@/lib/auth/rbac"
import { resolveActionActor } from "@/lib/auth/action-pin"
import { prisma } from "@/lib/db/client"
import { recordActivity } from "@/features/activity/queries"
import { addFollowUpSchema, completeFollowUpSchema, deleteFollowUpSchema } from "@/features/follow-ups/schemas"

export async function addFollowUpAction(raw: unknown): Promise<{ ok: boolean; error?: string; requiresPin?: boolean }> {
  const parsed = addFollowUpSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, dealId, date, reasonKey, pin } = parsed.data

  const actor = await resolveActionActor({ tenantId, pin })
  if (!actor.ok) return { ok: false, requiresPin: actor.requiresPin, error: actor.error }
  const { actorUserId, actorRole } = actor.actor
  if (!canEditDeal(actorRole)) return { ok: false, error: "Acceso denegado." }

  const deal = await prisma.deal.findUnique({ where: { id: dealId, tenantId } })
  if (!deal) return { ok: false, error: "Oportunidad no encontrada." }

  await withTenant(tenantId, async (tx) => {
    await tx.followUp.create({
      data: {
        tenantId,
        dealId,
        date: new Date(date + "T12:00:00"),
        reasonKey,
        createdById: actorUserId,
      },
    })
    await recordActivity(tx, {
      tenantId,
      entity: "Deal",
      entityId: dealId,
      type: "followUpAdded",
      payload: { date, reasonKey },
      userId: actorUserId,
    })
  })

  revalidatePath(`/app/${tenantSlug}`, "layout")
  revalidatePath(`/app/${tenantSlug}/pipeline`, "page")
  revalidatePath(`/app/${tenantSlug}/calendar`, "page")
  revalidatePath(`/app/${tenantSlug}/stats/alerts`, "page")
  return { ok: true }
}

export async function completeFollowUpAction(raw: unknown): Promise<{ ok: boolean; error?: string; requiresPin?: boolean }> {
  const parsed = completeFollowUpSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, followUpId, result, pin } = parsed.data

  const actor = await resolveActionActor({ tenantId, pin })
  if (!actor.ok) return { ok: false, requiresPin: actor.requiresPin, error: actor.error }
  const { actorUserId, actorRole } = actor.actor
  if (!canEditDeal(actorRole)) return { ok: false, error: "Acceso denegado." }

  const fu = await prisma.followUp.findUnique({ where: { id: followUpId, tenantId } })
  if (!fu) return { ok: false, error: "Seguimiento no encontrado." }

  await withTenant(tenantId, async (tx) => {
    await tx.followUp.update({
      where: { id: followUpId },
      data: { completed: true, completedAt: new Date(), result: result ?? null },
    })
    await recordActivity(tx, {
      tenantId,
      entity: "Deal",
      entityId: fu.dealId,
      type: "followUpCompleted",
      payload: { result: result ?? null },
      userId: actorUserId,
    })
  })

  revalidatePath(`/app/${tenantSlug}`, "layout")
  revalidatePath(`/app/${tenantSlug}/pipeline`, "page")
  revalidatePath(`/app/${tenantSlug}/calendar`, "page")
  revalidatePath(`/app/${tenantSlug}/stats/alerts`, "page")
  return { ok: true }
}

export async function deleteFollowUpAction(raw: unknown): Promise<{ ok: boolean; error?: string; requiresPin?: boolean }> {
  const parsed = deleteFollowUpSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, followUpId, pin } = parsed.data

  const actor = await resolveActionActor({ tenantId, pin })
  if (!actor.ok) return { ok: false, requiresPin: actor.requiresPin, error: actor.error }
  if (!canEditDeal(actor.actor.actorRole)) return { ok: false, error: "Acceso denegado." }

  const fu = await prisma.followUp.findUnique({ where: { id: followUpId, tenantId } })
  if (!fu) return { ok: false, error: "Seguimiento no encontrado." }

  await withTenant(tenantId, async (tx) => {
    await tx.followUp.delete({ where: { id: followUpId } })
  })

  revalidatePath(`/app/${tenantSlug}`, "layout")
  revalidatePath(`/app/${tenantSlug}/pipeline`, "page")
  revalidatePath(`/app/${tenantSlug}/calendar`, "page")
  revalidatePath(`/app/${tenantSlug}/stats/alerts`, "page")
  return { ok: true }
}
