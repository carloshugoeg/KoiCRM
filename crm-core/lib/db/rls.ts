import "server-only"
import { prisma } from "@/lib/db/client"
import { ensureAppRole, registerRoleEstablishedCheck } from "@/lib/db/ensure-app-role"
import { isRoleEstablished, runWithEstablishedRoleAsync } from "@/lib/db/role-context"

registerRoleEstablishedCheck(isRoleEstablished)

/** For prisma.$transaction([...]) and other non-withTenant flows on connection_limit=1. */
export async function withEstablishedAppRole<T>(fn: () => Promise<T>): Promise<T> {
  await ensureAppRole()
  return runWithEstablishedRoleAsync(fn)
}

export type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export type WithTenantOptions = {
  /** Max ms the interactive transaction may run (Prisma default: 5000). */
  timeout?: number
  /** Max ms to wait for a pool connection (Prisma default: 2000). */
  maxWait?: number
}

const DEFAULT_TX_TIMEOUT_MS =
  process.env.NODE_ENV === "production" ? 20_000 : 5_000
const DEFAULT_TX_MAX_WAIT_MS = 10_000

async function runTenantTransaction<T>(
  tx: PrismaTx,
  fn: (tx: PrismaTx) => Promise<T>,
): Promise<T> {
  await ensureAppRole(tx)
  return runWithEstablishedRoleAsync(() => fn(tx))
}

export async function withPrismaTransaction<T>(
  fn: (tx: PrismaTx) => Promise<T>,
  options?: WithTenantOptions,
): Promise<T> {
  return prisma.$transaction(
    (tx) => runTenantTransaction(tx, fn),
    {
      timeout: options?.timeout ?? DEFAULT_TX_TIMEOUT_MS,
      maxWait: options?.maxWait ?? DEFAULT_TX_MAX_WAIT_MS,
    },
  )
}

export async function withTenant<T>(
  tenantId: string,
  fn: (tx: PrismaTx) => Promise<T>,
  options?: WithTenantOptions,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await ensureAppRole(tx)
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
      return runWithEstablishedRoleAsync(() => fn(tx))
    },
    {
      timeout: options?.timeout ?? DEFAULT_TX_TIMEOUT_MS,
      maxWait: options?.maxWait ?? DEFAULT_TX_MAX_WAIT_MS,
    },
  )
}
