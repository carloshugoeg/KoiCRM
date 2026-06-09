import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import path from "path"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { hashActionPin } from "../../lib/auth/action-pin-token"

// Load .env manually (this script runs outside Next.js)
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
    const val = trimmed.slice(eqIdx + 1).trim()
    if (key && !(key in process.env)) process.env[key] = val
  }
} catch { /* env set externally */ }

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_ADMIN_URL } },
})

const STAGES = [
  { key: "prospecto",   label: "Prospecto",     color: "#6366f1", iconKey: "circle",       order: 0, locked: false, requiresQuote: false, requiresPayment: false },
  { key: "contactado",  label: "Contactado",     color: "#f59e0b", iconKey: "phone",        order: 1, locked: false, requiresQuote: false, requiresPayment: false },
  { key: "cotizacion",  label: "Cotización",     color: "#3b82f6", iconKey: "file-text",    order: 2, locked: false, requiresQuote: true,  requiresPayment: false },
  { key: "negociacion", label: "En negociación", color: "#8b5cf6", iconKey: "handshake",    order: 3, locked: false, requiresQuote: true,  requiresPayment: false },
  { key: "ganado",      label: "Ganado",         color: "#22c55e", iconKey: "check-circle", order: 4, locked: true,  requiresQuote: true,  requiresPayment: true  },
  { key: "perdido",     label: "Perdido",        color: "#ef4444", iconKey: "x-circle",     order: 5, locked: true,  requiresQuote: false, requiresPayment: false },
]

const CATALOG_ITEMS = [
  { catalogKey: "equipment",      key: "bomba",            label: "Bomba",            color: null, order: 0 },
  { catalogKey: "equipment",      key: "jacuzzi",          label: "Jacuzzi",          color: null, order: 1 },
  { catalogKey: "equipment",      key: "sauna",            label: "Sauna",            color: null, order: 2 },
  { catalogKey: "equipment",      key: "calentador",       label: "Calentador",       color: null, order: 3 },
  { catalogKey: "equipment",      key: "filtro",           label: "Filtro",           color: null, order: 4 },
  { catalogKey: "equipment",      key: "hidrojet",         label: "Hidrojet",         color: null, order: 5 },
  { catalogKey: "equipment",      key: "servicio_tecnico", label: "Servicio Técnico", color: null, order: 6 },
  { catalogKey: "equipment",      key: "iluminacion",      label: "Iluminación",      color: null, order: 7 },
  { catalogKey: "salesChannel",   key: "sala",             label: "Sala",             color: "#6366f1", order: 0 },
  { catalogKey: "salesChannel",   key: "telefono",         label: "Teléfono",         color: "#f59e0b", order: 1 },
  { catalogKey: "salesChannel",   key: "whatsapp",         label: "WhatsApp",         color: "#22c55e", order: 2 },
  { catalogKey: "salesChannel",   key: "facebook",         label: "Facebook",         color: "#3b82f6", order: 3 },
  { catalogKey: "salesChannel",   key: "instagram",        label: "Instagram",        color: "#ec4899", order: 4 },
  { catalogKey: "dealStatus",     key: "activo",           label: "Activo",           color: "#22c55e", order: 0 },
  { catalogKey: "dealStatus",     key: "seguimiento",      label: "Seguimiento",      color: "#f59e0b", order: 1 },
  { catalogKey: "dealStatus",     key: "esperando",        label: "Esperando",        color: "#6366f1", order: 2 },
  { catalogKey: "dealStatus",     key: "frio",             label: "Frío",             color: "#6b7280", order: 3 },
  { catalogKey: "dealStatus",     key: "urgente",          label: "Urgente",          color: "#ef4444", order: 4 },
  { catalogKey: "followupReason", key: "no_responde",        label: "No responde",          color: null, order: 0 },
  { catalogKey: "followupReason", key: "pide_informacion",   label: "Pide más información", color: null, order: 1 },
  { catalogKey: "followupReason", key: "necesita_tiempo",    label: "Necesita tiempo",      color: null, order: 2 },
  { catalogKey: "followupReason", key: "revisar_cotizacion", label: "Revisar cotización",   color: null, order: 3 },
  { catalogKey: "followupReason", key: "agendar_visita",     label: "Agendar visita",       color: null, order: 4 },
  { catalogKey: "followupReason", key: "otro",               label: "Otro",                 color: null, order: 5 },
]

export async function seedDemo() {
  console.log("Seeding demo-aqua tenant...")

  // Idempotent: clean up any existing demo-aqua data
  const demoEmails = [
    "roberto@demo-aqua.local",
    "emanuel@demo-aqua.local",
    "jhonatan@demo-aqua.local",
    "leticia@demo-aqua.local",
  ]

  // Find the existing tenant to get its ID (needed for deal deletion)
  const existingTenant = await prisma.tenant.findUnique({ where: { slug: "demo-aqua" } })
  if (existingTenant) {
    // Deal.ownerId has no onDelete cascade to User, so we must delete deals explicitly first
    await prisma.deal.deleteMany({ where: { tenantId: existingTenant.id } })
    // Now delete the tenant (cascades memberships, settings, branding, pipeline, stages, catalogs, clients)
    await prisma.tenant.delete({ where: { id: existingTenant.id } })
  }

  // Clean up demo users (global, not tenant-scoped)
  await prisma.user.deleteMany({ where: { email: { in: demoEmails } } })

  const tenant = await prisma.tenant.create({
    data: { slug: "demo-aqua", name: "Aquasistemas Demo", subscriptionValidated: true },
  })

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
  })

  await prisma.catalogItem.createMany({
    data: CATALOG_ITEMS.map((c) => ({ tenantId: tenant.id, ...c })),
  })

  await prisma.tenantSettings.create({
    data: {
      tenantId: tenant.id,
      defaultPipelineId: pipeline.id,
      dealIdPrefix: "AQX",
      locale: "es-GT",
      currency: "GTQ",
      timezone: "America/Guatemala",
    },
  })

  await prisma.tenantBranding.create({
    data: { tenantId: tenant.id, primaryColor: "#0ea5e9", productName: "KoiCRM" },
  })

  const pwHash = await bcrypt.hash("Demo1234!", 10)

  const [roberto, emanuel, jhonatan, leticia] = await Promise.all([
    prisma.user.create({ data: { email: "roberto@demo-aqua.local", name: "Roberto Escobar", emailVerified: new Date(), password: pwHash } }),
    prisma.user.create({ data: { email: "emanuel@demo-aqua.local", name: "Emanuel Torres", emailVerified: new Date(), password: pwHash } }),
    prisma.user.create({ data: { email: "jhonatan@demo-aqua.local", name: "Jhonatan Pérez", emailVerified: new Date(), password: pwHash } }),
    prisma.user.create({ data: { email: "leticia@demo-aqua.local", name: "Leticia Morales", emailVerified: new Date(), password: pwHash } }),
  ])

  await prisma.membership.createMany({
    data: [
      { tenantId: tenant.id, userId: roberto.id,   role: "OWNER"  },
      { tenantId: tenant.id, userId: emanuel.id,   role: "MEMBER" },
      { tenantId: tenant.id, userId: jhonatan.id,  role: "MEMBER" },
      { tenantId: tenant.id, userId: leticia.id,   role: "MEMBER" },
    ],
  })

  const demoPins: [string, string][] = [
    [roberto.id, "1234"],
    [emanuel.id, "2345"],
    [jhonatan.id, "3456"],
    [leticia.id, "4567"],
  ]
  for (const [userId, pin] of demoPins) {
    await prisma.membership.update({
      where: { userId_tenantId: { userId, tenantId: tenant.id } },
      data: { actionPinHash: hashActionPin(pin) },
    })
  }

  const stageMap = Object.fromEntries(pipeline.stages.map((s) => [s.key, s.id]))
  const owners = [roberto, emanuel, jhonatan, leticia]
  const channels = ["sala", "whatsapp", "facebook", "telefono", "instagram"]

  const clientNames: [string, string | null][] = [
    ["Villa Marina", "Villa Marina S.A."],
    ["Carlos Rodríguez", null],
    ["Hotel Las Palmas", "Hotel Las Palmas S.A."],
    ["Spa Bella Vista", "Spa Bella Vista"],
    ["Centro Deportivo Olímpico", "CDO S.A."],
    ["Ana García", null],
    ["Clínica Bienestar", "Clínica Bienestar"],
    ["Residencial Los Olivos", "Olivos S.A."],
    ["Hotel Conquistador", "Hotel Conquistador S.A."],
    ["Club Privado El Pedregal", "Pedregal Club"],
    ["Piscinas Express", "Piscinas Express S.A."],
    ["Familia Mansión Robles", null],
    ["Familia López", null],
    ["Rancho El Venado", "El Venado S.A."],
    ["La Hacienda Restaurantes", "Hacienda S.A."],
    ["Instituto Deportivo Nacional", "IDN"],
    ["Corporación Tec", "Tec Corp S.A."],
    ["Hotel Las Américas", "Américas S.A."],
    ["Villa del Sol", null],
    ["Residencia Morales", null],
    ["Empresa Soluciones S.A.", "Soluciones S.A."],
    ["Centro Wellness Premium", "Wellness S.A."],
    ["Club Social Altavista", "Altavista Club"],
    ["Municipalidad de Mixco", null],
    ["Familia Martínez", null],
    ["Inmobiliaria Premium", "Premium S.A."],
    ["Spa Royal", "Spa Royal S.A."],
    ["Constructora Norte", "Norte S.A."],
    ["Hotel Boutique Antigua", "Boutique S.A."],
    ["Aqua Paradise Club", "Paradise S.A."],
  ]

  const clientRecords = await Promise.all(
    clientNames.map(([name, company], i) =>
      prisma.client.create({
        data: {
          tenantId: tenant.id,
          name,
          company,
          phone: `+502 5${String(5000 + i).padStart(7, "0")}`,
        },
      })
    )
  )

  const dealId = (i: number, ownerInitials: string) =>
    `AQX-${String(i + 1).padStart(4, "0")}-${ownerInitials.toUpperCase().slice(0, 2)}-26`

  const today = new Date()
  const daysAgo = (n: number) => new Date(today.getTime() - n * 86_400_000)
  const daysFromNow = (n: number) => new Date(today.getTime() + n * 86_400_000)

  // [clientIdx, stageKey, value, equipmentKey, statusKey]
  const dealDefs: [number, string, number, string, string][] = [
    [0,  "prospecto",   12500,  "jacuzzi",   "activo"],
    [1,  "prospecto",   8000,   "bomba",     "activo"],
    [2,  "prospecto",   45000,  "sauna",     "activo"],
    [3,  "prospecto",   6500,   "filtro",    "seguimiento"],
    [4,  "prospecto",   22000,  "jacuzzi",   "activo"],
    [5,  "prospecto",   3800,   "calentador","activo"],
    [6,  "prospecto",   15000,  "hidrojet",  "frio"],
    [7,  "prospecto",   9200,   "bomba",     "activo"],
    [8,  "contactado",  28000,  "jacuzzi",   "seguimiento"],
    [9,  "contactado",  14000,  "sauna",     "activo"],
    [10, "contactado",  7500,   "calentador","activo"],
    [11, "contactado",  55000,  "jacuzzi",   "esperando"],
    [12, "contactado",  18000,  "iluminacion","activo"],
    [13, "contactado",  11000,  "filtro",    "seguimiento"],
    [14, "cotizacion",  32000,  "sauna",     "seguimiento"],
    [15, "cotizacion",  19500,  "jacuzzi",   "activo"],
    [16, "cotizacion",  8800,   "hidrojet",  "esperando"],
    [17, "cotizacion",  47000,  "jacuzzi",   "urgente"],
    [18, "cotizacion",  24000,  "calentador","activo"],
    [19, "cotizacion",  13500,  "bomba",     "seguimiento"],
    [20, "negociacion", 62000,  "jacuzzi",   "urgente"],
    [21, "negociacion", 38000,  "sauna",     "seguimiento"],
    [22, "negociacion", 17200,  "hidrojet",  "activo"],
    [23, "negociacion", 29000,  "iluminacion","esperando"],
    [24, "negociacion", 51000,  "jacuzzi",   "seguimiento"],
    [25, "ganado",      44000,  "sauna",     "activo"],
    [26, "ganado",      23500,  "jacuzzi",   "activo"],
    [27, "ganado",      67000,  "jacuzzi",   "activo"],
    [28, "ganado",      15800,  "hidrojet",  "activo"],
    [29, "perdido",     9000,   "filtro",    "frio"],
  ]

  const deals = await Promise.all(
    dealDefs.map(([clientIdx, stageKey, value, equipKey, statusKey], i) => {
      const o = owners[i % 4]
      const initials = o.name!.split(" ").map((w) => w[0]).join("").slice(0, 2)
      return prisma.deal.create({
        data: {
          id: dealId(i, initials),
          tenantId: tenant.id,
          pipelineId: pipeline.id,
          stageId: stageMap[stageKey],
          clientId: clientRecords[clientIdx].id,
          ownerId: o.id,
          channelKey: channels[i % 5],
          statusKey,
          name: clientRecords[clientIdx].name,
          company: clientRecords[clientIdx].company,
          phone: clientRecords[clientIdx].phone,
          value,
          createdAt: daysAgo(30 - i),
          stageEnteredAt: daysAgo(15 - Math.floor(i / 2)),
          equipment: { create: [{ equipmentKey: equipKey }] },
        },
      })
    })
  )

  // Quotes for cotizacion (14-19)
  for (let i = 14; i <= 19; i++) {
    await prisma.quote.create({
      data: {
        tenantId: tenant.id,
        dealId: deals[i].id,
        number: `COT-${String(i - 13).padStart(3, "0")}`,
        date: daysAgo(20 - i),
        isVoid: false,
      },
    })
  }

  // Quotes for negociacion (20-24)
  for (let i = 20; i <= 24; i++) {
    await prisma.quote.create({
      data: {
        tenantId: tenant.id,
        dealId: deals[i].id,
        number: `COT-${String(i - 13).padStart(3, "0")}`,
        date: daysAgo(20 - i),
        isVoid: false,
      },
    })
  }

  // Quotes + payments for ganado (25-28)
  for (let i = 25; i <= 28; i++) {
    await prisma.quote.create({
      data: {
        tenantId: tenant.id,
        dealId: deals[i].id,
        number: `COT-${String(i - 13).padStart(3, "0")}`,
        date: daysAgo(20 - i),
        isVoid: false,
      },
    })
    await prisma.payment.create({
      data: {
        tenantId: tenant.id,
        dealId: deals[i].id,
        number: `FAC-${String(i - 24).padStart(3, "0")}`,
        date: daysAgo(10 - i + 25),
        isVoid: false,
      },
    })
  }

  // Follow-ups: overdue (past, not completed), completed, future
  const followUpDefs: [number, string, boolean, Date | null][] = [
    // Overdue
    [0,  "no_responde",        false, null],
    [1,  "pide_informacion",   false, null],
    [8,  "revisar_cotizacion", false, null],
    // Completed
    [9,  "agendar_visita",     true,  daysAgo(3)],
    [14, "revisar_cotizacion", true,  daysAgo(5)],
    [20, "revisar_cotizacion", true,  daysAgo(2)],
    // Future
    [4,  "necesita_tiempo",    false, null],
    [10, "pide_informacion",   false, null],
    [17, "agendar_visita",     false, null],
    [21, "necesita_tiempo",    false, null],
  ]

  await Promise.all(
    followUpDefs.map(([dealIdx, reasonKey, completed, completedAt], j) => {
      const isPast = j < 3
      const isFuture = j >= 6
      const date = isPast ? daysAgo(3 + j) : isFuture ? daysFromNow(3 + j) : daysAgo(j)
      return prisma.followUp.create({
        data: {
          tenantId: tenant.id,
          dealId: deals[dealIdx].id,
          reasonKey,
          date,
          completed,
          completedAt,
          result: completed ? "Cliente confirmó interés, avanzar a siguiente etapa." : null,
        },
      })
    })
  )

  console.log(`✓ Tenant: ${tenant.slug} (${tenant.id})`)
  console.log(`✓ Users: roberto (PIN 1234), emanuel (2345), jhonatan (3456), leticia (4567)`)
  console.log(`✓ Deals: ${deals.length} total`)
  console.log(`✓ Quotes: 15 | Payments: 4 | FollowUps: ${followUpDefs.length}`)
}

seedDemo()
  .then(() => { console.log("Seed complete."); process.exit(0) })
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
