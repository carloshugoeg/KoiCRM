/**
 * Provision team users with login credentials and 4-digit action PINs.
 *
 * Usage:
 *   pnpm tsx scripts/provision-team-users.ts [--tenant-slug aquaxela] [--dry-run]
 *
 * Requires: DATABASE_ADMIN_URL, AUTH_SECRET
 */

import { PrismaClient, type Role } from "@prisma/client"
import bcrypt from "bcryptjs"
import path from "path"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { hashActionPin } from "../lib/auth/action-pin-token"

function loadEnvFile(filePath: string) {
  try {
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
  } catch {
    /* missing file */
  }
}

{
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const root = path.resolve(__dirname, "..")
  for (const name of [".env", ".env.production.local", ".env.local"]) {
    loadEnvFile(path.join(root, name))
  }
}

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_ADMIN_URL } },
})

type TeamMember = {
  slug: string
  name: string
  role: Role
  pin: string
}

/** New Aquaxela team — emails: {slug}@koicrm.com, passwords: {slug}.{pin} */
const TEAM: TeamMember[] = [
  { slug: "leticiasinay", name: "Leticia Sinay", role: "MEMBER", pin: "3814" },
  { slug: "jimenaalvarez", name: "Jimena Alvarez", role: "MEMBER", pin: "5297" },
  { slug: "jonathanperez", name: "Jonathan Perez", role: "MEMBER", pin: "6042" },
  { slug: "nancyperez", name: "Nancy Perez", role: "SUPERVISOR", pin: "7183" },
  { slug: "emanuelfuentes", name: "Emanuel Fuentes", role: "ADMIN", pin: "2956" },
  { slug: "robertoyax", name: "Roberto Yax", role: "MEMBER", pin: "8461" },
  { slug: "paolachaj", name: "Paola Chaj", role: "MEMBER", pin: "4738" },
]

/** PINs for existing members without one (by email). */
const EXISTING_MEMBER_PINS: Record<string, string> = {
  "koicrm@aquaxela.com": "1024",
  "hescobar06cvo@gmail.com": "3057",
}

function parseArgs() {
  const args = process.argv.slice(2)
  let tenantSlug = "aquaxela"
  let dryRun = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tenant-slug" && args[i + 1]) tenantSlug = args[++i]
    else if (args[i] === "--dry-run") dryRun = true
  }
  return { tenantSlug, dryRun }
}

function emailFor(slug: string) {
  return `${slug}@koicrm.com`
}

function passwordFor(slug: string, pin: string) {
  return `${slug}.${pin}`
}

function assertValidPin(pin: string, label: string) {
  if (!/^\d{4}$/.test(pin)) throw new Error(`PIN inválido para ${label}: ${pin}`)
}

async function main() {
  const { tenantSlug, dryRun } = parseArgs()

  if (!process.env.DATABASE_ADMIN_URL) throw new Error("DATABASE_ADMIN_URL is required")
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is required")

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    include: { settings: true },
  })
  if (!tenant) throw new Error(`Tenant "${tenantSlug}" no encontrado.`)

  const memberships = await prisma.membership.findMany({
    where: { tenantId: tenant.id },
    include: { user: { select: { id: true, email: true, name: true } } },
  })

  const withPin = memberships.filter((m) => m.actionPinHash)
  if (withPin.length > 0) {
    console.error("⚠️  Miembros que YA tienen PIN asignado (no se sobrescribirán):")
    for (const m of withPin) {
      console.error(`   - ${m.user.email} (${m.role})`)
    }
  }

  const allPins = new Set<string>()
  for (const m of TEAM) {
    assertValidPin(m.pin, m.name)
    if (allPins.has(m.pin)) throw new Error(`PIN duplicado en TEAM: ${m.pin}`)
    allPins.add(m.pin)
  }
  for (const [email, pin] of Object.entries(EXISTING_MEMBER_PINS)) {
    assertValidPin(pin, email)
    if (allPins.has(pin)) throw new Error(`PIN duplicado: ${pin}`)
    allPins.add(pin)
  }

  // Collect hashes already in DB to avoid collisions
  const usedHashes = new Set(
    memberships.map((m) => m.actionPinHash).filter((h): h is string => !!h),
  )

  type CredentialRow = {
    name: string
    email: string
    role: Role
    pin: string
    password: string
    status: "created" | "updated" | "pin-assigned" | "skipped-has-pin"
  }

  const credentials: CredentialRow[] = []

  const apply = async () => {
    for (const member of TEAM) {
      const email = emailFor(member.slug)
      const password = passwordFor(member.slug, member.pin)
      const pinHash = hashActionPin(member.pin)
      if (usedHashes.has(pinHash)) throw new Error(`Hash de PIN ya en uso: ${member.pin}`)
      usedHashes.add(pinHash)

      const pwHash = await bcrypt.hash(password, 12)
      const existing = await prisma.user.findUnique({ where: { email } })

      if (existing) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { name: member.name, password: pwHash, emailVerified: new Date() },
        })
        const mem = await prisma.membership.findUnique({
          where: { userId_tenantId: { userId: existing.id, tenantId: tenant.id } },
        })
        if (mem?.actionPinHash) {
          credentials.push({
            name: member.name,
            email,
            role: member.role,
            pin: "(ya asignado — no cambiado)",
            password: "(sin cambios)",
            status: "skipped-has-pin",
          })
          continue
        }
        await prisma.membership.upsert({
          where: { userId_tenantId: { userId: existing.id, tenantId: tenant.id } },
          create: {
            userId: existing.id,
            tenantId: tenant.id,
            role: member.role,
            actionPinHash: pinHash,
            status: "ACTIVE",
          },
          update: { role: member.role, actionPinHash: pinHash, status: "ACTIVE" },
        })
        credentials.push({
          name: member.name,
          email,
          role: member.role,
          pin: member.pin,
          password,
          status: "updated",
        })
      } else {
        const user = await prisma.user.create({
          data: {
            email,
            name: member.name,
            password: pwHash,
            emailVerified: new Date(),
          },
        })
        await prisma.membership.create({
          data: {
            userId: user.id,
            tenantId: tenant.id,
            role: member.role,
            actionPinHash: pinHash,
            status: "ACTIVE",
          },
        })
        credentials.push({
          name: member.name,
          email,
          role: member.role,
          pin: member.pin,
          password,
          status: "created",
        })
      }
    }

    for (const m of memberships) {
      const presetPin = EXISTING_MEMBER_PINS[m.user.email]
      if (!presetPin) continue
      if (m.actionPinHash) {
        credentials.push({
          name: m.user.name ?? m.user.email,
          email: m.user.email,
          role: m.role,
          pin: "(ya asignado — no cambiado)",
          password: "(sin cambios)",
          status: "skipped-has-pin",
        })
        continue
      }
      const pinHash = hashActionPin(presetPin)
      if (usedHashes.has(pinHash)) throw new Error(`Hash de PIN ya en uso: ${presetPin}`)
      usedHashes.add(pinHash)
      await prisma.membership.update({
        where: { id: m.id },
        data: { actionPinHash: pinHash },
      })
      credentials.push({
        name: m.user.name ?? m.user.email,
        email: m.user.email,
        role: m.role,
        pin: presetPin,
        password: "(cuenta existente — contraseña sin cambios)",
        status: "pin-assigned",
      })
    }

    await prisma.tenantSettings.update({
      where: { tenantId: tenant.id },
      data: { pinEnabled: true },
    })
  }

  if (dryRun) {
    console.log("DRY RUN — sin cambios en la base de datos\n")
    for (const member of TEAM) {
      console.log({
        email: emailFor(member.slug),
        password: passwordFor(member.slug, member.pin),
        role: member.role,
        pin: member.pin,
      })
    }
    for (const [email, pin] of Object.entries(EXISTING_MEMBER_PINS)) {
      console.log({ email, pin, note: "PIN para miembro existente" })
    }
    return
  }

  await prisma.$transaction(async () => {
    await apply()
  })

  console.log("\n✅ Usuarios aprovisionados en tenant:", tenantSlug)
  console.log("✅ pinEnabled activado en el workspace\n")
  console.log("── Credenciales (anotar) ──\n")
  console.log(
    "| Nombre | Email | Rol | PIN | Contraseña |",
  )
  console.log("|--------|-------|-----|-----|------------|")
  for (const c of credentials) {
    console.log(`| ${c.name} | ${c.email} | ${c.role} | ${c.pin} | ${c.password} |`)
  }
}

main()
  .catch((e) => {
    console.error("Error:", e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
