import { prisma } from "@/lib/db/client"

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export async function withTenant<T>(
  tenantId: string,
  fn: (tx: PrismaTx) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
    return fn(tx)
  })
}
