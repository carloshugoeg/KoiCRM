"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth/auth"
import { withTenant } from "@/lib/db/rls"
import { requireRole } from "@/lib/auth/rbac"
import { createClientSchema, updateClientSchema, deleteClientSchema } from "@/features/clients/schemas"

export async function createClientAction(raw: unknown): Promise<{ ok: boolean; error?: string; id?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = createClientSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, ...fields } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN", "SUPERVISOR", "MEMBER"])
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
    await requireRole(session, tenantId, ["OWNER", "ADMIN", "SUPERVISOR", "MEMBER"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  // Verify the client exists inside the tenant context — a bare prisma read runs as
  // app_user without app.tenant_id set (RLS) and returns null even for own rows.
  try {
    const found = await withTenant(tenantId, async (tx) => {
      const client = await tx.client.findUnique({ where: { id, tenantId } })
      if (!client) return false
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
      return true
    })
    if (!found) return { ok: false, error: "Cliente no encontrado." }
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

  // Existence + linked-deal guard + delete all inside the tenant context — bare prisma reads
  // run as app_user without app.tenant_id set (RLS) and return null/0 even for own rows.
  const result = await withTenant(tenantId, async (tx) => {
    const client = await tx.client.findUnique({ where: { id, tenantId } })
    if (!client) return { kind: "notfound" as const }

    const dealCount = await tx.deal.count({ where: { clientId: id, tenantId } })
    if (dealCount > 0) return { kind: "linked" as const, dealCount }

    await tx.client.delete({ where: { id } })
    return { kind: "ok" as const }
  })

  if (result.kind === "notfound") return { ok: false, error: "Cliente no encontrado." }
  if (result.kind === "linked") {
    return {
      ok: false,
      error: `No se puede eliminar: ${result.dealCount} oportunidad(es) vinculada(s). Elimínalas primero.`,
    }
  }

  revalidatePath(`/app/${tenantSlug}/clients`, "page")
  return { ok: true }
}
