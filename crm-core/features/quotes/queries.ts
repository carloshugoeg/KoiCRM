import { withTenant } from "@/lib/db/rls"
import type { PrismaTx } from "@/lib/db/rls"

export async function getQuotesByDeal(tx: PrismaTx, dealId: string) {
  return tx.quote.findMany({
    where: { dealId },
    orderBy: { createdAt: "asc" },
  })
}

/** Standalone quote fetch for client components (e.g. DealDetailModal). */
export async function getQuotesForDeal(tenantId: string, dealId: string) {
  return withTenant(tenantId, (tx) =>
    tx.quote.findMany({
      where: { tenantId, dealId },
      orderBy: { createdAt: "asc" },
    })
  )
}
