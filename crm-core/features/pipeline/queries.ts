import type { PrismaTx } from "@/lib/db/rls"

export async function getDefaultPipeline(tx: PrismaTx, tenantId: string) {
  return tx.pipeline.findFirst({
    where: { tenantId, isDefault: true },
    include: {
      stages: { orderBy: { order: "asc" } },
    },
  })
}
