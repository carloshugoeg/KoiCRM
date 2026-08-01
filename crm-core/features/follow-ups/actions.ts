"use server"

import { revalidatePath } from "next/cache"
import { withTenant } from "@/lib/db/rls"
import { canEditDeal } from "@/lib/auth/rbac"
import { resolveActionActor } from "@/lib/auth/action-pin"
import { recordActivity } from "@/features/activity/queries"
import { assertDealInScopeInTx } from "@/features/deals/guards"
import { addFollowUpSchema, completeFollowUpSchema, deleteFollowUpSchema } from "@/features/follow-ups/schemas"

export async function addFollowUpAction(raw: unknown): Promise<{ ok: boolean; error?: string; requiresPin?: boolean }> {
  const parsed = addFollowUpSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, dealId, date, note, pin } = parsed.data

  const actor = await resolveActionActor({ tenantId, pin, dealId })
  if (!actor.ok) return { ok: false, requiresPin: actor.requiresPin, error: actor.error }
  const { actorUserId, actorRole } = actor.actor
  if (!canEditDeal(actorRole)) return { ok: false, error: "Acceso denegado." }

  // Existence check and scope check share one transaction with the write itself — this used to
  // be a separate withTenant() just to confirm the deal exists, then a second one to create the
  // follow-up. Folding the scope check in here collapses two interactive transactions into one
  // instead of adding a third.
  let notFound = false
  await withTenant(tenantId, async (tx) => {
    const deal = await tx.deal.findUnique({ where: { id: dealId, tenantId }, select: { id: true } })
    if (!deal) { notFound = true; return }
    if (!(await assertDealInScopeInTx(tx, tenantId, actorRole, actorUserId, dealId))) {
      notFound = true
      return
    }
    await tx.followUp.create({
      data: {
        tenantId,
        dealId,
        date: new Date(date + "T12:00:00"),
        note: note || null,
        createdById: actorUserId,
      },
    })
    await recordActivity(tx, {
      tenantId,
      entity: "Deal",
      entityId: dealId,
      type: "followUpAdded",
      payload: { date, note: note ?? null },
      userId: actorUserId,
    })
  })
  if (notFound) return { ok: false, error: "Oportunidad no encontrada." }

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

  const fu = await withTenant(tenantId, (tx) =>
    tx.followUp.findUnique({ where: { id: followUpId, tenantId }, select: { dealId: true } }),
  )
  if (!fu) return { ok: false, error: "Seguimiento no encontrado." }

  const actor = await resolveActionActor({ tenantId, pin, dealId: fu.dealId })
  if (!actor.ok) return { ok: false, requiresPin: actor.requiresPin, error: actor.error }
  const { actorUserId, actorRole } = actor.actor
  if (!canEditDeal(actorRole)) return { ok: false, error: "Acceso denegado." }

  // Scope is checked in the same transaction as the write, so this stays at one interactive
  // transaction here rather than opening a second just for the guard.
  let notFound = false
  await withTenant(tenantId, async (tx) => {
    if (!(await assertDealInScopeInTx(tx, tenantId, actorRole, actorUserId, fu.dealId))) {
      notFound = true
      return
    }
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
  if (notFound) return { ok: false, error: "Seguimiento no encontrado." }

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

  const fu = await withTenant(tenantId, (tx) =>
    tx.followUp.findUnique({ where: { id: followUpId, tenantId }, select: { dealId: true } }),
  )
  if (!fu) return { ok: false, error: "Seguimiento no encontrado." }

  const actor = await resolveActionActor({ tenantId, pin, dealId: fu.dealId })
  if (!actor.ok) return { ok: false, requiresPin: actor.requiresPin, error: actor.error }
  if (!canEditDeal(actor.actor.actorRole)) return { ok: false, error: "Acceso denegado." }

  let notFound = false
  await withTenant(tenantId, async (tx) => {
    if (!(await assertDealInScopeInTx(tx, tenantId, actor.actor.actorRole, actor.actor.actorUserId, fu.dealId))) {
      notFound = true
      return
    }
    await tx.followUp.delete({ where: { id: followUpId } })
  })
  if (notFound) return { ok: false, error: "Seguimiento no encontrado." }

  revalidatePath(`/app/${tenantSlug}`, "layout")
  revalidatePath(`/app/${tenantSlug}/pipeline`, "page")
  revalidatePath(`/app/${tenantSlug}/calendar`, "page")
  revalidatePath(`/app/${tenantSlug}/stats/alerts`, "page")
  return { ok: true }
}
