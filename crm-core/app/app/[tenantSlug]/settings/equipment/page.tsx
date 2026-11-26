import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { can } from "@/lib/permissions/resolve"
import { getEquipmentHierarchy } from "@/features/catalogs/queries"
import { EquipmentSettings } from "@/features/catalogs/components/equipment-settings"

interface Props {
  params: { tenantSlug: string }
}

export default async function EquipmentSettingsPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant, membership } = resolved
  const categories = await getEquipmentHierarchy(tenant.id)
  const canManage = await can(tenant.id, membership.role, session.user.id, "catalog.manage")

  return (
    <EquipmentSettings
      tenant={tenant}
      categories={categories}
      canManage={canManage}
    />
  )
}
