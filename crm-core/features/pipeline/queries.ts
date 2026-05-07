import { prisma } from "@/lib/db/client"

export async function getDefaultPipeline(tenantId: string) {
  return prisma.pipeline.findFirst({
    where: { tenantId, isDefault: true },
    include: {
      stages: { orderBy: { order: "asc" } },
    },
  })
}
