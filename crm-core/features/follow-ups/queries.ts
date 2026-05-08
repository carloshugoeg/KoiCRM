import { withTenant } from "@/lib/db/rls"

export async function getDealFollowUps(tenantId: string, dealId: string) {
  return withTenant(tenantId, (tx) =>
    tx.followUp.findMany({
      where: { tenantId, dealId },
      orderBy: { date: "asc" },
    })
  )
}
