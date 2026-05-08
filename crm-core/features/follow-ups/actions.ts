"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth/auth"
import { withTenant } from "@/lib/db/rls"
import { requireRole } from "@/lib/auth/rbac"
import { prisma } from "@/lib/db/client"
import { recordActivity } from "@/features/activity/queries"
import { addFollowUpSchema, completeFollowUpSchema, deleteFollowUpSchema } from "@/features/follow-ups/schemas"

export async function addFollowUpAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = addFollowUpSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, dealId, date, reasonKey } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN", "MEMBER"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  const deal = await prisma.deal.findUnique({ where: { id: dealId, tenantId } })
  if (!deal) return { ok: false, error: "Oportunidad no encontrada." }

  await withTenant(tenantId, async (tx) => {
    await tx.followUp.create({
      data: {
        tenantId,
        dealId,
        date: new Date(date + "T12:00:00"),
        reasonKey,
        createdById: session.user!.id,
      },
    })
    await recordActivity(tx, {
      tenantId,
      entity: "Deal",
      entityId: dealId,
      type: "followUpAdded",
      payload: { date, reasonKey },
      userId: session.user!.id,
    })
  })

  revalidatePath(`/app/${tenantSlug}/pipeline`, "page")
  return { ok: true }
}

export async function completeFollowUpAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = completeFollowUpSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, followUpId, result } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN", "MEMBER"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

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
      userId: session.user!.id,
    })
  })

  revalidatePath(`/app/${tenantSlug}/pipeline`, "page")
  return { ok: true }
}

export async function deleteFollowUpAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = deleteFollowUpSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, followUpId } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN", "MEMBER"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  const fu = await prisma.followUp.findUnique({ where: { id: followUpId, tenantId } })
  if (!fu) return { ok: false, error: "Seguimiento no encontrado." }

  await withTenant(tenantId, async (tx) => {
    await tx.followUp.delete({ where: { id: followUpId } })
  })

  revalidatePath(`/app/${tenantSlug}/pipeline`, "page")
  return { ok: true }
}
