"use server"

import { z } from "zod"
import { prisma } from "@/lib/db/client"
import { auth } from "@/lib/auth/auth"
import { applyIndustryTemplate } from "@/lib/industry/registry"

const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
  industrySlug: z.string().min(1),
})

export async function createTenantAction(
  raw: unknown,
): Promise<{ ok: boolean; slug?: string; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = createTenantSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { name, slug, industrySlug } = parsed.data

  const existing = await prisma.tenant.findUnique({ where: { slug } })
  if (existing) return { ok: false, error: "Ese slug ya está en uso. Elige otro." }

  try {
    const tenant = await prisma.$transaction(async (tx) => {
      const t = await tx.tenant.create({ data: { name, slug, industrySlug } })
      await tx.membership.create({
        data: { userId: session.user.id, tenantId: t.id, role: "OWNER" },
      })
      await applyIndustryTemplate(t.id, industrySlug, tx)
      return t
    })
    return { ok: true, slug: tenant.slug }
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === "P2002") return { ok: false, error: "Ese slug ya está en uso. Elige otro." }
    throw err
  }
}
