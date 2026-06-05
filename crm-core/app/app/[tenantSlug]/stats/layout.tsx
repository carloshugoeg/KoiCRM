import { Suspense } from "react"
import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { canSeeAllDeals } from "@/lib/auth/rbac"
import { StatsShell } from "@/features/stats/components/StatsShell"

interface Props {
  children: React.ReactNode
  params: { tenantSlug: string }
}

export default async function StatsLayout({ children, params }: Props) {
  // Stats aggregate the whole team's pipeline — restricted to supervisors/superadmins.
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")
  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()
  if (!canSeeAllDeals(resolved.membership.role)) {
    redirect(`/app/${params.tenantSlug}/pipeline`)
  }

  return (
    <div className="flex flex-col h-full">
      <Suspense>
        <StatsShell tenantSlug={params.tenantSlug} />
      </Suspense>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}
