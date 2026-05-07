import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { canManageSettings } from "@/lib/auth/rbac"
import { BrandingSettings } from "@/features/branding/components/branding-settings"

interface Props {
  params: { tenantSlug: string }
}

export default async function AppearanceSettingsPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant, membership } = resolved

  return (
    <BrandingSettings
      tenant={tenant}
      branding={tenant.branding}
      canManage={canManageSettings(membership.role)}
    />
  )
}
