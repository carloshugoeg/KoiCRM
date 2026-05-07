import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { canManageSettings } from "@/lib/auth/rbac"
import { getDefaultPipeline } from "@/features/pipeline/queries"
import { PipelineSettings } from "@/features/pipeline/components/pipeline-settings"

interface Props {
  params: { tenantSlug: string }
}

export default async function PipelineSettingsPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant, membership } = resolved
  const pipeline = await getDefaultPipeline(tenant.id)

  return (
    <PipelineSettings
      tenant={tenant}
      pipeline={pipeline}
      canManage={canManageSettings(membership.role)}
    />
  )
}
