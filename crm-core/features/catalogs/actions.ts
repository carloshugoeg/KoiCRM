"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/client"
import { withTenant } from "@/lib/db/rls"
import { requireRole } from "@/lib/auth/rbac"
import { getCatalogItemUsageCount } from "@/features/catalogs/queries"
import {
  createCatalogItemSchema,
  updateCatalogItemSchema,
  deleteCatalogItemSchema,
  reorderCatalogItemsSchema,
} from "@/features/catalogs/schemas"
import type { CatalogKey } from "@/features/catalogs/queries"

export async function createCatalogItemAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = createCatalogItemSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, ...data } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  await withTenant(tenantId, async (tx) => {
    await tx.catalogItem.create({ data: { tenantId, ...data } })
  })
  revalidatePath(`/app/${tenantSlug}/settings/catalogs`, "page")
  return { ok: true }
}

export async function updateCatalogItemAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = updateCatalogItemSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, id, ...fields } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  await withTenant(tenantId, async (tx) => {
    await tx.catalogItem.update({ where: { id }, data: fields })
  })
  revalidatePath(`/app/${tenantSlug}/settings/catalogs`, "page")
  return { ok: true }
}

export async function deleteCatalogItemAction(raw: unknown): Promise<{ ok: boolean; error?: string; usageCount?: number }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = deleteCatalogItemSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, id } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  const item = await prisma.catalogItem.findUnique({ where: { id, tenantId } })
  if (!item) return { ok: false, error: "Item no encontrado." }

  const usage = await getCatalogItemUsageCount(tenantId, item.catalogKey as CatalogKey, item.key)
  if (usage > 0) {
    return { ok: false, error: `No se puede eliminar: está en uso en ${usage} registro(s).`, usageCount: usage }
  }

  await withTenant(tenantId, async (tx) => {
    await tx.catalogItem.delete({ where: { id } })
  })
  revalidatePath(`/app/${tenantSlug}/settings/catalogs`, "page")
  return { ok: true }
}

export async function reorderCatalogItemsAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = reorderCatalogItemsSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, orderedIds } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  const count = await prisma.catalogItem.count({
    where: { id: { in: orderedIds }, tenantId, catalogKey: parsed.data.catalogKey },
  })
  if (count !== orderedIds.length) return { ok: false, error: "IDs inválidos." }

  await withTenant(tenantId, async (tx) => {
    await Promise.all(
      orderedIds.map((id, idx) => tx.catalogItem.update({ where: { id }, data: { order: idx } }))
    )
  })
  revalidatePath(`/app/${tenantSlug}/settings/catalogs`, "page")
  return { ok: true }
}
