import { withTenant } from "@/lib/db/rls"
import type { PrismaTx } from "@/lib/db/rls"

export async function getPaymentsByDeal(tx: PrismaTx, dealId: string) {
  return tx.payment.findMany({
    where: { dealId },
    orderBy: { createdAt: "asc" },
  })
}

/** Standalone payment fetch for client components (e.g. DealDetailModal). */
export async function getPaymentsForDeal(tenantId: string, dealId: string) {
  return withTenant(tenantId, (tx) =>
    tx.payment.findMany({
      where: { tenantId, dealId },
      orderBy: { createdAt: "asc" },
    })
  )
}
