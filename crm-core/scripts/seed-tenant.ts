/**
 * First-tenant onboarding script.
 * Usage: pnpm tsx scripts/seed-tenant.ts --name "Aquasistemas" --slug "aquasistemas" [--prefix "AQX"]
 *
 * Creates: Tenant → Pipeline + Stages → Catalog → TenantSettings → TenantBranding → admin User → Membership
 * Idempotent: exits cleanly if the slug already exists.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

// Load .env manually (runs outside Next.js)
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

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_ADMIN_URL } },
});

// ─── Default pipeline stages ─────────────────────────────────────────────────
const STAGES = [
  {
    key: "prospecto",
    label: "Prospecto",
    color: "#6366f1",
    iconKey: "circle",
    order: 0,
    locked: false,
    requiresQuote: false,
    requiresPayment: false,
  },
  {
    key: "contactado",
    label: "Contactado",
    color: "#f59e0b",
    iconKey: "phone",
    order: 1,
    locked: false,
    requiresQuote: false,
    requiresPayment: false,
  },
  {
    key: "cotizacion",
    label: "Cotización",
    color: "#3b82f6",
    iconKey: "file-text",
    order: 2,
    locked: false,
    requiresQuote: true,
    requiresPayment: false,
  },
  {
    key: "negociacion",
    label: "En negociación",
    color: "#8b5cf6",
    iconKey: "handshake",
    order: 3,
    locked: false,
    requiresQuote: true,
    requiresPayment: false,
  },
  {
    key: "ganado",
    label: "Ganado",
    color: "#22c55e",
    iconKey: "check-circle",
    order: 4,
    locked: true,
    requiresQuote: true,
    requiresPayment: true,
  },
  {
    key: "perdido",
    label: "Perdido",
    color: "#ef4444",
    iconKey: "x-circle",
    order: 5,
    locked: true,
    requiresQuote: false,
    requiresPayment: false,
  },
];

// ─── Default catalog items ────────────────────────────────────────────────────
const CATALOG_ITEMS = [
  { catalogKey: "salesChannel", key: "sala", label: "Sala", color: "#6366f1", order: 0 },
  { catalogKey: "salesChannel", key: "telefono", label: "Teléfono", color: "#f59e0b", order: 1 },
  { catalogKey: "salesChannel", key: "whatsapp", label: "WhatsApp", color: "#22c55e", order: 2 },
  { catalogKey: "salesChannel", key: "facebook", label: "Facebook", color: "#3b82f6", order: 3 },
  { catalogKey: "salesChannel", key: "instagram", label: "Instagram", color: "#ec4899", order: 4 },
  { catalogKey: "dealStatus", key: "activo", label: "Activo", color: "#22c55e", order: 0 },
  {
    catalogKey: "dealStatus",
    key: "seguimiento",
    label: "Seguimiento",
    color: "#f59e0b",
    order: 1,
  },
  { catalogKey: "dealStatus", key: "esperando", label: "Esperando", color: "#6366f1", order: 2 },
  { catalogKey: "dealStatus", key: "frio", label: "Frío", color: "#6b7280", order: 3 },
  { catalogKey: "dealStatus", key: "urgente", label: "Urgente", color: "#ef4444", order: 4 },
  { catalogKey: "followupReason", key: "no_responde", label: "No responde", color: null, order: 0 },
  {
    catalogKey: "followupReason",
    key: "pide_informacion",
    label: "Pide más información",
    color: null,
    order: 1,
  },
  {
    catalogKey: "followupReason",
    key: "necesita_tiempo",
    label: "Necesita tiempo",
    color: null,
    order: 2,
  },
  {
    catalogKey: "followupReason",
    key: "revisar_cotizacion",
    label: "Revisar cotización",
    color: null,
    order: 3,
  },
  {
    catalogKey: "followupReason",
    key: "agendar_visita",
    label: "Agendar visita",
    color: null,
    order: 4,
  },
  { catalogKey: "followupReason", key: "otro", label: "Otro", color: null, order: 5 },
];

// ─── CLI arg parsing ──────────────────────────────────────────────────────────
function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function prompt(rl: readline.Interface, question: string): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim();
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const tenantName = getArg("--name");
  const tenantSlug = getArg("--slug");
  const dealPrefix = getArg("--prefix");

  if (!tenantName || !tenantSlug) {
    console.error(
      'Usage: pnpm tsx scripts/seed-tenant.ts --name "Client Name" --slug "client-slug" [--prefix "XXX"]'
    );
    process.exit(1);
  }

  if (!/^[a-z0-9-]+$/.test(tenantSlug)) {
    console.error("Slug must be lowercase letters, numbers, and hyphens only.");
    process.exit(1);
  }

  // Idempotency check
  const existing = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (existing) {
    console.log(`\nTenant "${tenantSlug}" already exists (id: ${existing.id}). Nothing to do.\n`);
    await prisma.$disconnect();
    return;
  }

  // Prompt for admin credentials
  const rl = readline.createInterface({ input, output });
  console.log(`\nCreating tenant: ${tenantName} (slug: ${tenantSlug})\n`);

  const adminName = await prompt(rl, "Admin full name:  ");
  const adminEmail = await prompt(rl, "Admin email:      ");
  const adminPw = await prompt(rl, "Admin password (min 8 chars): ");
  rl.close();

  if (!adminName || !adminEmail || adminPw.length < 8) {
    console.error(
      "Invalid input. Name and email are required; password must be at least 8 characters."
    );
    process.exit(1);
  }

  console.log("\nCreating tenant...\n");

  // ── 1. Tenant
  const tenant = await prisma.tenant.create({
    data: { slug: tenantSlug, name: tenantName },
  });

  // ── 2. Pipeline + Stages
  const pipeline = await prisma.pipeline.create({
    data: {
      tenantId: tenant.id,
      name: "Pipeline principal",
      isDefault: true,
      stages: {
        create: STAGES.map((s) => ({ tenantId: tenant.id, ...s })),
      },
    },
    include: { stages: true },
  });

  // ── 3. Catalog items
  await prisma.catalogItem.createMany({
    data: CATALOG_ITEMS.map((c) => ({ tenantId: tenant.id, ...c })),
  });

  // ── 4. TenantSettings
  const prefix = dealPrefix ?? tenantSlug.slice(0, 3).toUpperCase();
  await prisma.tenantSettings.create({
    data: {
      tenantId: tenant.id,
      defaultPipelineId: pipeline.id,
      dealIdPrefix: prefix,
      locale: "es-GT",
      currency: "GTQ",
      timezone: "America/Guatemala",
    },
  });

  // ── 5. TenantBranding (minimal — configure via Settings UI)
  await prisma.tenantBranding.create({
    data: { tenantId: tenant.id, productName: "KoiCRM" },
  });

  // ── 6. Admin user
  const pwHash = await bcrypt.hash(adminPw, 12);
  const admin = await prisma.user.create({
    data: {
      name: adminName,
      email: adminEmail,
      password: pwHash,
      emailVerified: new Date(),
    },
  });

  // ── 7. OWNER membership
  await prisma.membership.create({
    data: { tenantId: tenant.id, userId: admin.id, role: "OWNER" },
  });

  console.log(`✓ Tenant created successfully

  Tenant ID:   ${tenant.id}
  Tenant slug: ${tenantSlug}
  Admin email: ${adminEmail}
  Login URL:   ${process.env.AUTH_URL ?? "http://localhost:3000"}/signin
  `);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
