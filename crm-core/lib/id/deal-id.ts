import type { PrismaClient } from "@prisma/client";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Atomically generates the next Deal ID for a tenant.
 *
 * Must be called inside a transaction that has already set app.tenant_id
 * via set_config (i.e., inside withTenant()).
 *
 * Format: {prefix}-{counter:0000}-{ownerInitials}-{YY|YYYY}
 * Example: DEAL-0032-RO-26
 */
export async function generateDealId(
  tx: Tx,
  tenantId: string,
  ownerInitials: string,
): Promise<string> {
  // Atomically increment counter using SELECT ... FOR UPDATE equivalent via upsert
  await tx.$executeRaw`
    INSERT INTO "Counter" ("tenantId", "key", "value")
    VALUES (${tenantId}, 'deal', 1)
    ON CONFLICT ("tenantId", "key")
    DO UPDATE SET "value" = "Counter"."value" + 1
  `;

  const counter = await tx.counter.findUniqueOrThrow({
    where: { tenantId_key: { tenantId, key: "deal" } },
  });

  const settings = await tx.tenantSettings.findUnique({
    where: { tenantId },
  });

  const prefix = settings?.dealIdPrefix ?? "DEAL";
  const yearDigits = settings?.dealIdYearDigits ?? 2;
  const year = new Date().getFullYear().toString().slice(-yearDigits);
  const seq = counter.value.toString().padStart(4, "0");
  const initials = ownerInitials.toUpperCase().slice(0, 3);

  return `${prefix}-${seq}-${initials}-${year}`;
}
