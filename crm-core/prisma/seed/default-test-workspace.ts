/**
 * Default test workspace (espacio de trabajo) for local development.
 *
 * Usage: pnpm seed:test
 *
 * Credentials (fixed, for local testing only):
 *   Email:    admin@test.local
 *   Password: Test1234!
 *   Tenant:   test → http://localhost:3000/app/test/pipeline
 *
 * Idempotent: removes and recreates slug "test" and the admin user.
 */

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import path from "path"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { applyIndustryTemplate } from "../../lib/industry/registry"

try {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const envFile = readFileSync(path.resolve(__dirname, "../../.env"), "utf-8")
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "")
    if (key && !(key in process.env)) process.env[key] = val
  }
} catch {
  /* env set externally */
}

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_ADMIN_URL } },
})

const TENANT_SLUG = "test"
const TENANT_NAME = "Espacio de prueba"
const INDUSTRY_SLUG = "generic"
const ADMIN_EMAIL = "admin@test.local"
const ADMIN_NAME = "Admin de prueba"
const ADMIN_PASSWORD = "Test1234!"

async function seedTestWorkspace() {
  console.log("Seeding default test workspace...")

  const existingTenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (existingTenant) {
    await prisma.deal.deleteMany({ where: { tenantId: existingTenant.id } })
    await prisma.tenant.delete({ where: { id: existingTenant.id } })
  }

  await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } })

  const pwHash = await bcrypt.hash(ADMIN_PASSWORD, 12)

  await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        slug: TENANT_SLUG,
        name: TENANT_NAME,
        industrySlug: INDUSTRY_SLUG,
        subscriptionValidated: true,
      },
    })

    await applyIndustryTemplate(tenant.id, INDUSTRY_SLUG, tx)

    const admin = await tx.user.create({
      data: {
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        password: pwHash,
        emailVerified: new Date(),
      },
    })

    await tx.membership.create({
      data: { tenantId: tenant.id, userId: admin.id, role: "OWNER" },
    })
  })

  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000"
  console.log(`
✓ Espacio de trabajo: ${TENANT_NAME} (slug: ${TENANT_SLUG})
✓ Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}
✓ Iniciar sesión: ${baseUrl}/signin
✓ Pipeline: ${baseUrl}/app/${TENANT_SLUG}/pipeline
`)
}

seedTestWorkspace()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
