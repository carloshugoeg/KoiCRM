/**
 * Reseed the equipment (equipo de interés) catalog hierarchy for a tenant after the
 * 20260610120000_equipment_hierarchy migration wipes the old flat equipment data.
 *
 * Idempotent: skips tenants that already have equipment catalog items.
 * Uses DATABASE_ADMIN_URL (admin_user / BYPASSRLS) so it can write across the tenant.
 *
 * Usage: pnpm tsx scripts/reseed-equipment.ts --tenant-slug aquaxela
 */
import { config as loadEnv } from "dotenv"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { PrismaClient } from "@prisma/client"

function resolveAdminUrl(): string {
  if (process.env.DATABASE_ADMIN_URL) return process.env.DATABASE_ADMIN_URL
  loadEnv({ path: resolve(process.cwd(), ".env.deploy.local") })
  if (process.env.DATABASE_ADMIN_URL) return process.env.DATABASE_ADMIN_URL

  const ref = process.env.SUPABASE_PROJECT_REF
  const statePath = resolve(process.cwd(), "bootstrap-state.json")
  if (ref && existsSync(statePath)) {
    const state = JSON.parse(readFileSync(statePath, "utf8"))
    const pw = state.admin_user_password
    if (pw) return `postgresql://admin_user:${encodeURIComponent(pw)}@db.${ref}.supabase.co:5432/postgres`
  }
  throw new Error("No DATABASE_ADMIN_URL available (set env or .env.deploy.local).")
}

// Aquasistemas equipo de interés taxonomy (mirrors scripts/seed-tenant.ts EQUIPMENT).
const EQUIPMENT = [
  { key: "bombas", label: "Bombas", subs: [
    { key: "bombas__sumergible", label: "Bomba sumergible" },
    { key: "bombas__centrifuga", label: "Bomba centrífuga" },
  ] },
  { key: "filtros", label: "Filtros", subs: [
    { key: "filtros__arena", label: "Filtro de arena" },
    { key: "filtros__cartucho", label: "Filtro de cartucho" },
  ] },
  { key: "otros", label: "Otros", subs: [
    { key: "otros__otros", label: "Otros" },
  ] },
]

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag)
  return idx >= 0 ? process.argv[idx + 1] : undefined
}

async function main() {
  const tenantSlug = getArg("--tenant-slug") ?? "aquaxela"
  const adminUrl = resolveAdminUrl()
  const prisma = new PrismaClient({ datasources: { db: { url: adminUrl } } })

  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } })
    if (!tenant) throw new Error(`Tenant "${tenantSlug}" not found`)

    const existing = await prisma.catalogItem.count({
      where: { tenantId: tenant.id, catalogKey: "equipment" },
    })
    if (existing > 0) {
      console.log(`Tenant "${tenantSlug}" already has ${existing} equipment items. Nothing to do.`)
      return
    }

    for (const [order, cat] of EQUIPMENT.entries()) {
      const created = await prisma.catalogItem.create({
        data: { tenantId: tenant.id, catalogKey: "equipment", key: cat.key, label: cat.label, order },
      })
      await prisma.catalogItem.createMany({
        data: cat.subs.map((s, idx) => ({
          tenantId: tenant.id,
          catalogKey: "equipment",
          key: s.key,
          label: s.label,
          order: idx,
          parentId: created.id,
        })),
      })
    }

    const total = await prisma.catalogItem.count({
      where: { tenantId: tenant.id, catalogKey: "equipment" },
    })
    console.log(`✓ Reseeded equipment hierarchy for "${tenantSlug}" (${total} items).`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
