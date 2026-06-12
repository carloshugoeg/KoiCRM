"use server"

import * as Sentry from "@sentry/nextjs"
import { z } from "zod"
import { prisma } from "@/lib/db/client"
import { auth } from "@/lib/auth/auth"
import { bootstrapTenant, resolveSessionUserId } from "@/lib/tenant/bootstrap"

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
  if (!session?.user) return { ok: false, error: "No autenticado." }

  const userId = await resolveSessionUserId(session)
  if (!userId) return { ok: false, error: "No autenticado." }

  const existingMembership = await prisma.membership.findFirst({ where: { userId } })
  if (existingMembership) {
    return { ok: false, error: "Ya tienes un espacio de trabajo." }
  }

  const parsed = createTenantSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { name, slug, industrySlug } = parsed.data

  const existing = await prisma.tenant.findUnique({ where: { slug } })
  if (existing) return { ok: false, error: "Ese slug ya está en uso. Elige otro." }

  try {
    const tenant = await bootstrapTenant({ name, slug, industrySlug, ownerUserId: userId })
    return { ok: true, slug: tenant.slug }
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === "P2002") return { ok: false, error: "Ese slug ya está en uso. Elige otro." }
    const message = (err as { message?: string })?.message ?? ""
    if (message.includes("Unknown industry")) {
      return { ok: false, error: "Industria no válida." }
    }
    Sentry.captureException(err)
    if (process.env.NODE_ENV === "development" && message) {
      return { ok: false, error: message.slice(0, 300) }
    }
    return { ok: false, error: "No se pudo crear el espacio de trabajo. Intenta de nuevo." }
  }
}
