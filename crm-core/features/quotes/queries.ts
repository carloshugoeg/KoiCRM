import type { PrismaTx } from "@/lib/db/rls"

export async function getQuotesByDeal(tx: PrismaTx, dealId: string) {
  return tx.quote.findMany({
    where: { dealId },
    orderBy: { createdAt: "asc" },
  })
}
