import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/client"
import { resolveTenant } from "@/lib/tenant/resolve"
import { canManageMembers } from "@/lib/auth/rbac"
import { UsersSettings } from "@/features/users/components/users-settings"

interface Props {
  params: { tenantSlug: string }
}

export default async function UsersSettingsPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant, membership } = resolved

  const [members, pendingInvitations] = await Promise.all([
    prisma.membership.findMany({
      where: { tenantId: tenant.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { tenantId: tenant.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ])

  return (
    <UsersSettings
      tenant={tenant}
      currentMembership={membership}
      members={members}
      pendingInvitations={pendingInvitations}
      canManage={canManageMembers(membership.role)}
    />
  )
}
