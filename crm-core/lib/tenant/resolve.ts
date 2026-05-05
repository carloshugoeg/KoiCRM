import { prisma } from "@/lib/db/client"
import type { Session } from "next-auth"
import type { Membership, Tenant, TenantBranding } from "@prisma/client"

export type ResolvedTenant = {
  tenant: Tenant & { branding: TenantBranding | null }
  membership: Membership
}

export async function resolveTenant(
  slug: string,
  session: Session | null,
): Promise<ResolvedTenant | null> {
  if (!session?.user?.id) return null

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, tenant: { slug } },
    include: { tenant: { include: { branding: true } } },
  })

  if (!membership) return null
  return { tenant: membership.tenant, membership }
}

export async function getUserMemberships(userId: string) {
  return prisma.membership.findMany({
    where: { userId },
    include: { tenant: { select: { slug: true, name: true } } },
    orderBy: { createdAt: "asc" },
  })
}
