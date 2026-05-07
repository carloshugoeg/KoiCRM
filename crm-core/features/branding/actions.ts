"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth/auth"
import { withTenant } from "@/lib/db/rls"
import { requireRole } from "@/lib/auth/rbac"

const updateBrandingSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  bgColorLight: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  bgColorDark: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  headerBgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  kpiBgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  productName: z.string().max(50).optional().nullable(),
})

export async function updateBrandingAction(
  raw: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = updateBrandingSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, ...fields } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  await withTenant(tenantId, async (tx) => {
    await tx.tenantBranding.upsert({
      where: { tenantId },
      create: { tenantId, ...fields },
      update: fields,
    })
  })

  revalidatePath(`/app/${tenantSlug}`, "layout")
  return { ok: true }
}
