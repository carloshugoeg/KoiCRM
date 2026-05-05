import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant, getUserMemberships } from "@/lib/tenant/resolve"
import { TenantProvider } from "@/lib/tenant/context"
import { TenantHeader } from "@/components/app/tenant-header"

interface Props {
  children: React.ReactNode
  params: { tenantSlug: string }
}

export default async function TenantLayout({ children, params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const [resolved, memberships] = await Promise.all([
    resolveTenant(params.tenantSlug, session),
    getUserMemberships(session.user.id),
  ])

  if (!resolved) notFound()

  return (
    <TenantProvider value={resolved}>
      <div className="min-h-screen flex flex-col">
        <TenantHeader memberships={memberships} />
        <main className="flex-1">{children}</main>
      </div>
    </TenantProvider>
  )
}
