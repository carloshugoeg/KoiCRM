import { prisma } from "@/lib/db/client"
import type { Membership, Tenant } from "@prisma/client"
import type { TenantEmbudoAccess, UserAppDestination } from "@/lib/tenant/access-types"

export type { AccessDenialReason, UserAppDestination, TenantEmbudoAccess } from "@/lib/tenant/access-types"
export { parseInviteToken } from "@/lib/tenant/parse-invite-token"
export { accessDenialCopy, membershipContactInfo } from "@/lib/tenant/access-messages"

export function isMembershipActive(status: Membership["status"]): boolean {
  return status === "ACTIVE"
}

export function evaluateMembershipAccess(
  membership: Pick<Membership, "status"> | null,
  tenant: Pick<Tenant, "subscriptionValidated">,
): TenantEmbudoAccess {
  if (!membership) return { allowed: false, reason: "no_membership" }
  if (!isMembershipActive(membership.status)) {
    return { allowed: false, reason: "membership_inactive" }
  }
  if (!tenant.subscriptionValidated) {
    return { allowed: false, reason: "tenant_subscription_inactive" }
  }
  return { allowed: true }
}

/** First membership by join date — used for post-login routing. */
export async function getPrimaryMembership(userId: string) {
  return prisma.membership.findFirst({
    where: { userId },
    include: { tenant: { select: { slug: true, subscriptionValidated: true } } },
    orderBy: { createdAt: "asc" },
  })
}

export async function resolveUserAppDestination(userId: string): Promise<UserAppDestination> {
  const membership = await getPrimaryMembership(userId)
  if (!membership) return { kind: "access", reason: "no_membership" }

  const access = evaluateMembershipAccess(membership, membership.tenant)
  if (!access.allowed) return { kind: "access", reason: access.reason }

  return { kind: "embudo", slug: membership.tenant.slug }
}

export function appPathForDestination(destination: UserAppDestination): string {
  if (destination.kind === "embudo") return `/app/${destination.slug}/pipeline`
  return `/app/access?reason=${destination.reason}`
}

export async function getDefaultAppPathForUser(userId: string): Promise<string> {
  return appPathForDestination(await resolveUserAppDestination(userId))
}

const RESERVED_APP_SEGMENTS = new Set(["access", "onboarding"])

/**
 * Validates callbackUrl after login. Unknown or inaccessible tenant slugs fall back to the user's workspace.
 */
export async function resolvePostLoginPath(
  userId: string,
  callbackUrl: string | null | undefined,
): Promise<string> {
  const fallback = await getDefaultAppPathForUser(userId)
  const raw = callbackUrl?.trim()
  if (!raw) return fallback

  let pathWithSearch: string
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const u = new URL(raw)
      pathWithSearch = u.pathname + u.search
    } else {
      pathWithSearch = raw.startsWith("/") ? raw : `/${raw}`
    }
  } catch {
    return fallback
  }

  const pathname = pathWithSearch.split("?")[0] ?? pathWithSearch
  if (pathname === "/app" || pathname === "/app/") return fallback
  if (pathname.startsWith("/app/access") || pathname.startsWith("/app/onboarding")) {
    return pathWithSearch
  }

  const match = pathname.match(/^\/app\/([^/]+)/)
  if (!match) return fallback

  const slug = match[1]
  if (RESERVED_APP_SEGMENTS.has(slug)) return pathWithSearch

  const membership = await prisma.membership.findFirst({
    where: { userId, tenant: { slug } },
    select: { id: true },
  })
  if (!membership) return fallback

  const embudoAccess = await checkTenantEmbudoAccess(userId, slug)
  if (!embudoAccess.allowed) {
    return `/app/access?reason=${embudoAccess.reason}`
  }

  return pathWithSearch
}

export async function checkTenantEmbudoAccess(
  userId: string,
  tenantSlug: string,
): Promise<TenantEmbudoAccess> {
  const membership = await prisma.membership.findFirst({
    where: { userId, tenant: { slug: tenantSlug } },
    include: { tenant: { select: { subscriptionValidated: true } } },
  })
  if (!membership) return { allowed: false, reason: "no_membership" }
  return evaluateMembershipAccess(membership, membership.tenant)
}
