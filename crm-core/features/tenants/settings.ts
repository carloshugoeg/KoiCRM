"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth/auth"
import { withTenant } from "@/lib/db/rls"
import { requireRole } from "@/lib/auth/rbac"

const updateSettingsSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  locale: z.string().min(2).max(20),
  currency: z.string().length(3),
  timezone: z.string().min(3).max(60),
  phoneFormat: z.string().max(20),
  whatsappCountryCode: z.string().max(10),
  dealIdPrefix: z.string().min(1).max(10).toUpperCase(),
  dealIdYearDigits: z.number().int().min(2).max(4),
})

export async function updateTenantSettingsAction(
  raw: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = updateSettingsSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, tenantSlug, ...fields } = parsed.data

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  await withTenant(tenantId, async (tx) => {
    await tx.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...fields },
      update: fields,
    })
  })

  revalidatePath(`/app/${tenantSlug}`, "layout")
  return { ok: true }
}
