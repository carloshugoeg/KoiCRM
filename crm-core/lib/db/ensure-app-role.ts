import type { PrismaClient } from "@prisma/client";
import type { PrismaTx } from "@/lib/db/rls";

/** Registered by lib/db/rls.ts — avoids importing async_hooks into client bundles. */
let isRoleEstablished: (() => boolean) | null = null;

export function registerRoleEstablishedCheck(fn: () => boolean): void {
  isRoleEstablished = fn;
}

let roleReady: Promise<void> | null = null;
let inEnsureRole = false;

/** SET ROLE must use the non-extended client — $extends hooks would deadlock otherwise. */
let baseClient: PrismaClient | null = null;

export function registerBasePrismaClient(client: PrismaClient): void {
  baseClient = client;
}

function usesTransactionPooler(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return url.includes("pgbouncer=true") || url.includes(":6543/");
}

/** When DATABASE_URL uses postgres.<ref> pooler, switch to app_user for RLS. */
export async function ensureAppRole(tx?: PrismaTx): Promise<void> {
  if (process.env.DATABASE_SET_ROLE !== "app_user") return;

  if (tx) {
    await tx.$executeRawUnsafe("SET LOCAL ROLE app_user");
    return;
  }

  // Role already set for this connection/transaction (see withTenant + role-context).
  if (isRoleEstablished?.()) return;

  if (inEnsureRole) return;
  const client = baseClient;
  if (!client) return;

  // Transaction pooler hands out a different backend per checkout — do not cache SET ROLE.
  if (usesTransactionPooler()) {
    await client.$executeRawUnsafe("SET ROLE app_user");
    return;
  }

  if (!roleReady) {
    inEnsureRole = true;
    try {
      roleReady = client.$executeRawUnsafe("SET ROLE app_user").then(() => undefined);
      await roleReady;
    } catch (err) {
      roleReady = null;
      throw err;
    } finally {
      inEnsureRole = false;
    }
    return;
  }

  await roleReady;
}

