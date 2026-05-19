"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth/auth"
import { withTenant } from "@/lib/db/rls"
import { requireRole } from "@/lib/auth/rbac"
import { prisma } from "@/lib/db/client"
import { recordActivity } from "@/features/activity/queries"
import { addNoteSchema, deleteNoteSchema } from "@/features/notes/schemas"
import { getDealNotes, getClientNotes } from "@/features/notes/queries"

export async function addNoteAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = addNoteSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, body, dealId, clientId } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN", "MEMBER"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  await withTenant(tenantId, async (tx) => {
    await tx.note.create({
      data: {
        tenantId,
        text: body,
        dealId: dealId ?? null,
        clientId: clientId ?? null,
        createdById: session.user!.id,
      },
    })
    if (dealId) {
      await recordActivity(tx, {
        tenantId,
        entity: "Deal",
        entityId: dealId,
        type: "noteAdded",
        payload: { preview: body.slice(0, 80) },
        userId: session.user!.id,
      })
    }
  })

  revalidatePath(`/app/${tenantSlug}/pipeline`, "page")
  revalidatePath(`/app/${tenantSlug}/clients`, "page")
  return { ok: true }
}

export async function deleteNoteAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = deleteNoteSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, noteId } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN", "MEMBER"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  const note = await prisma.note.findUnique({ where: { id: noteId } })
  if (!note || note.tenantId !== tenantId) return { ok: false, error: "Nota no encontrada." }

  await withTenant(tenantId, (tx) => tx.note.delete({ where: { id: noteId } }))

  revalidatePath(`/app/${tenantSlug}/pipeline`, "page")
  revalidatePath(`/app/${tenantSlug}/clients`, "page")
  return { ok: true }
}

export async function getDealNotesAction(tenantId: string, dealId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("No autenticado.")
  await requireRole(session, tenantId, ["OWNER", "ADMIN", "MEMBER", "VIEWER"])
  return getDealNotes(tenantId, dealId)
}

export async function getClientNotesAction(tenantId: string, clientId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("No autenticado.")
  await requireRole(session, tenantId, ["OWNER", "ADMIN", "MEMBER", "VIEWER"])
  return getClientNotes(tenantId, clientId)
}
