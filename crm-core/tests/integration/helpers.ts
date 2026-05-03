import { PrismaClient } from "@prisma/client";

// Admin client: BYPASSRLS — use for test setup/teardown and T2.3 baseline inserts
export const prismaAdmin = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_ADMIN_URL } },
  log: ["error"],
});

// App client: RLS active — use for isolation assertions in T2.3
export const prismaApp = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
  log: ["error"],
});

// Execute fn inside a transaction with app.tenant_id set (app_user, RLS active)
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  return prismaApp.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx as unknown as PrismaClient);
  });
}

// Truncate a table if it exists, silently ignoring missing tables
async function truncateIfExists(tableName: string): Promise<void> {
  await prismaAdmin
    .$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`)
    .catch(() => {});
}

// Clean all tables between test suites — safe to call even if not all tables exist yet
export async function cleanDatabase() {
  // Business tables (T2.2) — truncated first due to FKs
  for (const table of [
    "Activity",
    "SavedView",
    "Attachment",
    "Note",
    "FollowUp",
    "Payment",
    "Quote",
    "DealEquipment",
    "Deal",
    "CatalogItem",
    "CustomFieldDefinition",
    "Counter",
    "PipelineStage",
    "Pipeline",
    "Client",
  ]) {
    await truncateIfExists(table);
  }

  // Identity tables (T2.1)
  for (const table of [
    "TenantBranding",
    "TenantSettings",
    "Membership",
    "User",
    "Tenant",
    "IndustryTemplate",
  ]) {
    await truncateIfExists(table);
  }
}

export async function disconnectAll() {
  await prismaAdmin.$disconnect();
  await prismaApp.$disconnect();
}
