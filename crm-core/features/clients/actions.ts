"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth/auth"
import { withTenant } from "@/lib/db/rls"
import { requireRole } from "@/lib/auth/rbac"
import { prisma } from "@/lib/db/client"
import { createClientSchema, updateClientSchema, deleteClientSchema } from "@/features/clients/schemas"

export async function createClientAction(raw: unknown): Promise<{ ok: boolean; error?: string; id?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = createClientSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, ...fields } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN", "MEMBER"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  let id: string | undefined
  try {
    await withTenant(tenantId, async (tx) => {
      const client = await tx.client.create({
        data: {
          tenantId,
          name: fields.name.trim(),
          company: fields.company?.trim() || null,
          phone: fields.phone?.trim() || null,
          whatsapp: fields.whatsapp?.trim() || null,
          email: fields.email?.trim() || null,
          customData: fields.customData as Prisma.InputJsonValue | undefined,
        },
      })
      id = client.id
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Ya existe un cliente con ese nombre y empresa." }
    }
    throw e
  }
  revalidatePath(`/app/${tenantSlug}/clients`, "page")
  return { ok: true, id }
}

export async function updateClientAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = updateClientSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, id, ...fields } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN", "MEMBER"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  const client = await prisma.client.findUnique({ where: { id, tenantId } })
  if (!client) return { ok: false, error: "Cliente no encontrado." }

  try {
    await withTenant(tenantId, async (tx) => {
      await tx.client.update({
        where: { id },
        data: {
          name: fields.name.trim(),
          company: fields.company?.trim() || null,
          phone: fields.phone?.trim() || null,
          whatsapp: fields.whatsapp?.trim() || null,
          email: fields.email?.trim() || null,
          customData: fields.customData as Prisma.InputJsonValue | undefined,
        },
      })
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Ya existe un cliente con ese nombre y empresa." }
    }
    throw e
  }
  revalidatePath(`/app/${tenantSlug}/clients`, "page")
  return { ok: true }
}

export async function deleteClientAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = deleteClientSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, id } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  const client = await prisma.client.findUnique({ where: { id, tenantId } })
  if (!client) return { ok: false, error: "Cliente no encontrado." }

  const dealCount = await prisma.deal.count({ where: { clientId: id, tenantId } })
  if (dealCount > 0) {
    return {
      ok: false,
      error: `No se puede eliminar: ${dealCount} oportunidad(es) vinculada(s). Elimínalas primero.`,
    }
  }

  await withTenant(tenantId, async (tx) => {
    await tx.client.delete({ where: { id } })
  })
  revalidatePath(`/app/${tenantSlug}/clients`, "page")
  return { ok: true }
}
