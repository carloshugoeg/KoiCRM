"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/client"
import { withTenant } from "@/lib/db/rls"
import { requireRole } from "@/lib/auth/rbac"
import { isPermissionKey, LOCKED_ROLES } from "@/lib/permissions/defaults"

const setRolePermissionSchema = z.object({
  tenantId: z.string().min(1),
  role: z.enum(["OWNER", "ADMIN", "SUPERVISOR", "MEMBER", "VIEWER"]),
  key: z.string().min(1).refine(isPermissionKey, { message: "Permiso no válido." }),
  allowed: z.boolean(),
})

const setUserPermissionSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  key: z.string().min(1).refine(isPermissionKey, { message: "Permiso no válido." }),
  /** null clears the exception so the person goes back to inheriting their role. */
  allowed: z.boolean().nullable(),
})

export async function setRolePermissionAction(
  raw: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = setRolePermissionSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, role, key, allowed } = parsed.data

  // Narrow to PermissionKey — the zod refine above already guaranteed it.
  if (!isPermissionKey(key)) return { ok: false, error: "Permiso no válido." }

  if (LOCKED_ROLES.includes(role)) {
    return { ok: false, error: "Superadmin y Admin siempre conservan el acceso completo." }
  }

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  await withTenant(tenantId, async (tx) => {
    await tx.rolePermission.upsert({
      where: { tenantId_role_key: { tenantId, role, key } },
      create: { tenantId, role, key, allowed },
      update: { allowed },
    })
  })

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  })
  if (tenant) revalidatePath(`/app/${tenant.slug}/settings/permissions`)

  return { ok: true }
}

/**
 * Per-person exception. `allowed: null` deletes the row so the person inherits their
 * role again. Owners and admins cannot be given exceptions — they always keep full access.
 */
export async function setUserPermissionAction(
  raw: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = setUserPermissionSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, userId, key, allowed } = parsed.data
  if (!isPermissionKey(key)) return { ok: false, error: "Permiso no válido." }

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  // The target must be a member of this workspace, and must not be an owner/admin.
  const target = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    select: { role: true },
  })
  if (!target) return { ok: false, error: "La persona no pertenece a este espacio." }
  if (LOCKED_ROLES.includes(target.role)) {
    return { ok: false, error: "Superadmin y Admin siempre conservan el acceso completo." }
  }

  await withTenant(tenantId, async (tx) => {
    if (allowed === null) {
      await tx.userPermission.deleteMany({ where: { tenantId, userId, key } })
    } else {
      await tx.userPermission.upsert({
        where: { tenantId_userId_key: { tenantId, userId, key } },
        create: { tenantId, userId, key, allowed },
        update: { allowed },
      })
    }
  })

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  })
  if (tenant) revalidatePath(`/app/${tenant.slug}/settings/permissions`)

  return { ok: true }
}
