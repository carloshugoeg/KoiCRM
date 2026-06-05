/**
 * Grant full workspace license for a user (by email).
 * Usage: pnpm tsx scripts/grant-license.ts <email>
 *
 * Sets: Tenant.subscriptionValidated = true, Membership.status = ACTIVE,
 *       TenantSettings.storageMaxBytes = 1 PiB (effectively unlimited).
 */

import { PrismaClient, MembershipStatus, Role } from "@prisma/client";
import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { bootstrapTenant } from "../lib/tenant/bootstrap";
import { listIndustries } from "../lib/industry/registry";

try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const envFile = readFileSync(path.resolve(__dirname, "../.env"), "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
} catch {
  /* env already set externally */
}

const UNLIMITED_STORAGE_BYTES = BigInt(1024) ** BigInt(5); // 1 PiB

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_ADMIN_URL } },
});

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: pnpm tsx scripts/grant-license.ts <email>");
    process.exit(1);
  }

  const found = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        include: {
          tenant: { select: { id: true, slug: true, name: true, subscriptionValidated: true } },
        },
      },
    },
  });

  if (!found) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }

  let memberships = found.memberships;

  if (memberships.length === 0) {
    const local = email.split("@")[0] ?? "workspace";
    const slugBase = local.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
    let slug = slugBase || "workspace";
    for (let n = 0; ; n++) {
      const candidate = n === 0 ? slug : `${slugBase}-${n}`;
      const taken = await prisma.tenant.findUnique({ where: { slug: candidate } });
      if (!taken) {
        slug = candidate;
        break;
      }
    }
    const industrySlug = listIndustries()[0]?.slug ?? "aquasistemas";
    const name = found.name?.trim() || local;
    await bootstrapTenant({ name, slug, industrySlug, ownerUserId: found.id });
    console.log(`Created workspace "${name}" (${slug}) with industry ${industrySlug}.`);
    memberships = await prisma.membership.findMany({
      where: { userId: found.id },
      include: {
        tenant: { select: { id: true, slug: true, name: true, subscriptionValidated: true } },
      },
    });
  }

  const ownerTenantIds = memberships
    .filter((m) => m.role === Role.OWNER)
    .map((m) => m.tenantId);
  const tenantIds =
    ownerTenantIds.length > 0
      ? ownerTenantIds
      : memberships.map((m) => m.tenantId);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: found.id },
      data: { emailVerified: new Date() },
    }),
    prisma.membership.updateMany({
      where: { userId: found.id, tenantId: { in: tenantIds } },
      data: { status: MembershipStatus.ACTIVE },
    }),
    prisma.tenant.updateMany({
      where: { id: { in: tenantIds } },
      data: { subscriptionValidated: true },
    }),
    prisma.tenantSettings.updateMany({
      where: { tenantId: { in: tenantIds } },
      data: { storageMaxBytes: UNLIMITED_STORAGE_BYTES },
    }),
  ]);

  const slugs = memberships
    .filter((m) => tenantIds.includes(m.tenantId))
    .map((m) => m.tenant.slug);

  console.log(
    `Granted premium license for ${email}: tenants [${slugs.join(", ")}] — subscription validated, membership active, storage unlimited.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
