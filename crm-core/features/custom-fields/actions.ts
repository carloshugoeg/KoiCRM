"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth/auth"
import { withTenant } from "@/lib/db/rls"
import { requireRole } from "@/lib/auth/rbac"
import {
  createCustomFieldSchema,
  deleteCustomFieldSchema,
  reorderCustomFieldsSchema,
} from "@/features/custom-fields/schemas"

export async function createCustomFieldAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = createCustomFieldSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, ...data } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  try {
    await withTenant(tenantId, async (tx) => {
      await tx.customFieldDefinition.create({
        data: {
          tenantId,
          entity: data.entity,
          key: data.key,
          label: data.label,
          type: data.type,
          options: data.options ?? undefined,
          required: data.required,
          order: data.order,
        },
      })
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Ya existe un campo con esa clave para esta entidad." }
    }
    throw e
  }
  revalidatePath(`/app/${tenantSlug}/settings/custom-fields`, "page")
  return { ok: true }
}

export async function deleteCustomFieldAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = deleteCustomFieldSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, id } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  // Verify the field belongs to this tenant inside the tenant context — a bare prisma read
  // runs as app_user without app.tenant_id set (RLS) and returns null even for own rows.
  const deleted = await withTenant(tenantId, async (tx) => {
    const def = await tx.customFieldDefinition.findUnique({ where: { id, tenantId } })
    if (!def) return false
    await tx.customFieldDefinition.delete({ where: { id } })
    return true
  })
  if (!deleted) return { ok: false, error: "Campo no encontrado." }
  revalidatePath(`/app/${tenantSlug}/settings/custom-fields`, "page")
  return { ok: true }
}

export async function reorderCustomFieldsAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = reorderCustomFieldsSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, entity, orderedIds } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  // Validate IDs belong to this tenant/entity inside the tenant context — a bare prisma
  // count runs as app_user without app.tenant_id set (RLS) and returns 0 for own rows.
  const valid = await withTenant(tenantId, async (tx) => {
    const count = await tx.customFieldDefinition.count({
      where: { id: { in: orderedIds }, tenantId, entity },
    })
    if (count !== orderedIds.length) return false
    await Promise.all(
      orderedIds.map((id, idx) =>
        tx.customFieldDefinition.update({ where: { id }, data: { order: idx } })
      )
    )
    return true
  })
  if (!valid) return { ok: false, error: "IDs inválidos." }
  revalidatePath(`/app/${tenantSlug}/settings/custom-fields`, "page")
  return { ok: true }
}
