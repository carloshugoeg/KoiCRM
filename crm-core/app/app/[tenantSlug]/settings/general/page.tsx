import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/client"
import { resolveTenant } from "@/lib/tenant/resolve"
import { canManageSettings } from "@/lib/auth/rbac"
import { GeneralSettings } from "@/features/tenants/components/general-settings"

interface Props {
  params: { tenantSlug: string }
}

export default async function GeneralSettingsPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant, membership } = resolved

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId: tenant.id },
  })

  return (
    <GeneralSettings
      tenant={tenant}
      settings={settings}
      canManage={canManageSettings(membership.role)}
    />
  )
}
