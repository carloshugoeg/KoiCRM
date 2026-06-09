"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth/auth"
import { withTenant } from "@/lib/db/rls"
import { requireRole, canEditDeal } from "@/lib/auth/rbac"
import { resolveActionActor } from "@/lib/auth/action-pin"
import { prisma } from "@/lib/db/client"
import { recordActivity } from "@/features/activity/queries"
import { addNoteSchema, deleteNoteSchema } from "@/features/notes/schemas"
import { getDealNotes, getClientNotes } from "@/features/notes/queries"

export async function addNoteAction(raw: unknown): Promise<{ ok: boolean; error?: string; requiresPin?: boolean }> {
  const parsed = addNoteSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, body, dealId, clientId, pin } = parsed.data

  const actor = await resolveActionActor({ tenantId, pin, dealId: dealId ?? null })
  if (!actor.ok) return { ok: false, requiresPin: actor.requiresPin, error: actor.error }
  const { actorUserId, actorRole } = actor.actor
  if (!canEditDeal(actorRole)) return { ok: false, error: "Acceso denegado." }

  await withTenant(tenantId, async (tx) => {
    await tx.note.create({
      data: {
        tenantId,
        text: body,
        dealId: dealId ?? null,
        clientId: clientId ?? null,
        createdById: actorUserId,
      },
    })
    if (dealId) {
      await recordActivity(tx, {
        tenantId,
        entity: "Deal",
        entityId: dealId,
        type: "noteAdded",
        payload: { preview: body.slice(0, 80) },
        userId: actorUserId,
      })
    }
  })

  revalidatePath(`/app/${tenantSlug}/pipeline`, "page")
  revalidatePath(`/app/${tenantSlug}/clients`, "page")
  return { ok: true }
}

export async function deleteNoteAction(raw: unknown): Promise<{ ok: boolean; error?: string; requiresPin?: boolean }> {
  const parsed = deleteNoteSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, noteId, pin } = parsed.data

  const note = await prisma.note.findUnique({ where: { id: noteId } })
  if (!note || note.tenantId !== tenantId) return { ok: false, error: "Nota no encontrada." }

  const actor = await resolveActionActor({ tenantId, pin, dealId: note.dealId })
  if (!actor.ok) return { ok: false, requiresPin: actor.requiresPin, error: actor.error }
  if (!canEditDeal(actor.actor.actorRole)) return { ok: false, error: "Acceso denegado." }

  await withTenant(tenantId, (tx) => tx.note.delete({ where: { id: noteId } }))

  revalidatePath(`/app/${tenantSlug}/pipeline`, "page")
  revalidatePath(`/app/${tenantSlug}/clients`, "page")
  return { ok: true }
}

export async function getDealNotesAction(tenantId: string, dealId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("No autenticado.")
  await requireRole(session, tenantId, ["OWNER", "ADMIN", "SUPERVISOR", "MEMBER", "VIEWER"])
  return getDealNotes(tenantId, dealId)
}

export async function getClientNotesAction(tenantId: string, clientId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("No autenticado.")
  await requireRole(session, tenantId, ["OWNER", "ADMIN", "SUPERVISOR", "MEMBER", "VIEWER"])
  return getClientNotes(tenantId, clientId)
}
