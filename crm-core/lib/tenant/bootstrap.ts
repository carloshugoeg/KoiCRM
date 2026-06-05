import type { Session } from "next-auth"
import { prisma } from "@/lib/db/client"
import { prismaAdmin } from "@/lib/db/admin"
import { applyIndustryTemplate } from "@/lib/industry/registry"

export async function resolveSessionUserId(session: Session): Promise<string | null> {
  if (session.user?.id) return session.user.id
  const email = session.user?.email
  if (!email) return null
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}

/** SUPERUSER: first-tenant bootstrap — user has no tenant yet, so RLS cannot apply. */
export async function bootstrapTenant(input: {
  name: string
  slug: string
  industrySlug: string
  ownerUserId: string
}) {
  const { name, slug, industrySlug, ownerUserId } = input

  return prismaAdmin.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name, slug, industrySlug, subscriptionValidated: false },
    })
    await tx.membership.create({
      data: { userId: ownerUserId, tenantId: tenant.id, role: "OWNER" },
    })
    await applyIndustryTemplate(tenant.id, industrySlug, tx)
    return tenant
  })
}
