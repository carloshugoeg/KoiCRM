/**
 * Provision or update a workspace user (login + optional action PIN).
 *
 * Usage:
 *   pnpm tsx scripts/provision-user.ts \
 *     --tenant-slug aquaxela \
 *     --name "Hugo Escobar Leon" \
 *     --email hugoescobar@koicrm.com \
 *     --password "hugoescobar.2721" \
 *     --pin 2721 \
 *     --role OWNER
 *
 * Requires: DATABASE_ADMIN_URL (or .env.deploy.local + bootstrap-state.json), AUTH_SECRET
 */

import { PrismaClient, type Role } from "@prisma/client"
import bcrypt from "bcryptjs"
import { readFileSync, existsSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { hashActionPin } from "../lib/auth/action-pin-token"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, "..")

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return
  const envFile = readFileSync(filePath, "utf-8")
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (key && !(key in process.env)) process.env[key] = val
  }
}

function resolveDatabaseAdminUrl(): void {
  if (process.env.DATABASE_ADMIN_URL) return

  const statePath = path.join(root, "bootstrap-state.json")
  loadEnvFile(path.join(root, ".env.deploy.local"))

  const ref = process.env.SUPABASE_PROJECT_REF
  const adminPw =
    process.env.ADMIN_USER_PASSWORD ||
    (existsSync(statePath)
      ? (JSON.parse(readFileSync(statePath, "utf-8")).admin_user_password as string | undefined)
      : undefined)

  if (ref && adminPw) {
    const enc = encodeURIComponent(adminPw)
    process.env.DATABASE_ADMIN_URL = `postgresql://admin_user:${enc}@db.${ref}.supabase.co:5432/postgres`
  }
}

for (const name of [".env.deploy.local", ".env", ".env.local"]) {
  loadEnvFile(path.join(root, name))
}
resolveDatabaseAdminUrl()

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_ADMIN_URL } },
})

const ROLES: Role[] = ["OWNER", "ADMIN", "SUPERVISOR", "MEMBER", "VIEWER"]

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag)
  return idx >= 0 ? process.argv[idx + 1] : undefined
}

async function main() {
  const tenantSlug = getArg("--tenant-slug") ?? "aquaxela"
  const name = getArg("--name")
  const email = getArg("--email")?.trim().toLowerCase()
  const password = getArg("--password")
  const pin = getArg("--pin")
  const role = (getArg("--role") ?? "OWNER") as Role
  const dryRun = process.argv.includes("--dry-run")

  if (!name || !email || !password) {
    console.error(
      "Usage: --tenant-slug <slug> --name <name> --email <email> --password <pw> [--pin 1234] [--role OWNER]"
    )
    process.exit(1)
  }
  if (!process.env.DATABASE_ADMIN_URL) {
    throw new Error("DATABASE_ADMIN_URL is required (set in env or .env.deploy.local)")
  }
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is required")
  if (!ROLES.includes(role)) throw new Error(`Invalid role: ${role}`)

  let pinHash: string | undefined
  if (pin) {
    if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be 4 digits")
    pinHash = hashActionPin(pin)
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    include: { settings: true },
  })
  if (!tenant) throw new Error(`Tenant "${tenantSlug}" not found`)

  if (pinHash) {
    const pinTaken = await prisma.membership.findFirst({
      where: { tenantId: tenant.id, actionPinHash: pinHash },
      include: { user: { select: { email: true } } },
    })
    if (pinTaken && pinTaken.user.email !== email) {
      throw new Error(`PIN ${pin} already used by ${pinTaken.user.email} in this workspace`)
    }
  }

  if (dryRun) {
    console.log({ tenantSlug, name, email, role, pin: pin ?? "(none)", dryRun: true })
    return
  }

  const pwHash = await bcrypt.hash(password, 12)
  const existing = await prisma.user.findUnique({ where: { email } })

  let userId: string
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { name, password: pwHash, emailVerified: new Date() },
    })
    userId = existing.id
  } else {
    const created = await prisma.user.create({
      data: { email, name, password: pwHash, emailVerified: new Date() },
    })
    userId = created.id
  }

  await prisma.membership.upsert({
    where: { userId_tenantId: { userId, tenantId: tenant.id } },
    create: {
      userId,
      tenantId: tenant.id,
      role,
      status: "ACTIVE",
      actionPinHash: pinHash ?? null,
    },
    update: {
      role,
      status: "ACTIVE",
      ...(pinHash ? { actionPinHash: pinHash } : {}),
    },
  })

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { subscriptionValidated: true },
  })

  if (pinHash && !tenant.settings?.pinEnabled) {
    await prisma.tenantSettings.update({
      where: { tenantId: tenant.id },
      data: { pinEnabled: true },
    })
  }

  console.log(`✓ User provisioned in tenant "${tenantSlug}"`)
  console.log(`  Name:     ${name}`)
  console.log(`  Email:    ${email}`)
  console.log(`  Role:     ${role}`)
  console.log(`  PIN:      ${pin ?? "(unchanged)"}`)
  console.log(`  Sign-in:  ${process.env.AUTH_URL ?? "(set AUTH_URL)"}/signin`)
  console.log(`  Pipeline: ${process.env.AUTH_URL ?? ""}/app/${tenantSlug}/pipeline`)
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
