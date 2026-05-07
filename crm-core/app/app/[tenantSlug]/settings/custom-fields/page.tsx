import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { canManageSettings } from "@/lib/auth/rbac"
import { getCustomFieldDefs } from "@/features/custom-fields/queries"
import { CustomFieldsSettings } from "@/features/custom-fields/components/custom-fields-settings"

interface Props {
  params: { tenantSlug: string }
}

export default async function CustomFieldsSettingsPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant, membership } = resolved

  const [dealFields, clientFields] = await Promise.all([
    getCustomFieldDefs(tenant.id, "Deal"),
    getCustomFieldDefs(tenant.id, "Client"),
  ])

  return (
    <CustomFieldsSettings
      tenant={tenant}
      dealFields={dealFields}
      clientFields={clientFields}
      canManage={canManageSettings(membership.role)}
    />
  )
}
