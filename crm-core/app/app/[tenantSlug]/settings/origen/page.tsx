import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { canManageSettings } from "@/lib/auth/rbac"
import { getCatalogItems } from "@/features/catalogs/queries"
import { LeadSourcesSettings } from "@/features/catalogs/components/lead-sources-settings"

interface Props {
  params: { tenantSlug: string }
}

export default async function LeadSourcesSettingsPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant, membership } = resolved
  const items = await getCatalogItems(tenant.id, "salesChannel")

  return (
    <LeadSourcesSettings
      tenant={tenant}
      items={items}
      canManage={canManageSettings(membership.role)}
    />
  )
}
