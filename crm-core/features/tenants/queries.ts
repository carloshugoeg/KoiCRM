import { withTenant } from "@/lib/db/rls"

export async function getTenantPipelines(tenantId: string) {
  return withTenant(tenantId, (tx) => tx.pipeline.findMany({ where: { tenantId } }))
}

export async function getTenantMembers(tenantId: string) {
  return withTenant(tenantId, (tx) =>
    tx.membership.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  )
}
