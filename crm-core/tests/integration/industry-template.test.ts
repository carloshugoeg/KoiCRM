import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, cleanDatabase, disconnectAll } from "./helpers"
import { applyIndustryTemplate } from "@/lib/industry/registry"

let tenantId: string

beforeAll(async () => {
  await cleanDatabase()
  const t = await prismaAdmin.tenant.create({
    data: {
      slug: `aqx-template-test-${Date.now()}`,
      name: "AQX Template Test",
      industrySlug: "aquasistemas",
      settings: { create: { storageUsedBytes: BigInt(0) } },
    },
  })
  tenantId = t.id
  await prismaAdmin.$transaction(async (tx) => {
    await applyIndustryTemplate(tenantId, "aquasistemas", tx)
  })
})

afterAll(async () => {
  await cleanDatabase()
  await disconnectAll()
})

// ── Pipeline ──────────────────────────────────────────────────────────────────

describe("T9.1 — pipeline and stages", () => {
  it("creates exactly one default pipeline named 'Pipeline principal'", async () => {
    const pipelines = await prismaAdmin.pipeline.findMany({ where: { tenantId } })
    expect(pipelines).toHaveLength(1)
    expect(pipelines[0]!.isDefault).toBe(true)
    expect(pipelines[0]!.name).toBe("Pipeline principal")
  })

  it("pipeline has exactly 6 stages", async () => {
    const stages = await prismaAdmin.pipelineStage.findMany({
      where: { tenantId },
      orderBy: { order: "asc" },
    })
    expect(stages).toHaveLength(6)
  })

  it("stage keys in order are prospecto/contactado/cotizacion/negociacion/ganado/perdido", async () => {
    const stages = await prismaAdmin.pipelineStage.findMany({
      where: { tenantId },
      orderBy: { order: "asc" },
    })
    expect(stages.map((s) => s.key)).toEqual([
      "prospecto",
      "contactado",
      "cotizacion",
      "negociacion",
      "ganado",
      "perdido",
    ])
  })

  it("ganado and perdido are locked; others are not", async () => {
    const stages = await prismaAdmin.pipelineStage.findMany({
      where: { tenantId },
      orderBy: { order: "asc" },
    })
    const byKey = Object.fromEntries(stages.map((s) => [s.key, s]))
    expect(byKey["ganado"]!.locked).toBe(true)
    expect(byKey["perdido"]!.locked).toBe(true)
    expect(byKey["prospecto"]!.locked).toBe(false)
    expect(byKey["contactado"]!.locked).toBe(false)
    expect(byKey["cotizacion"]!.locked).toBe(false)
    expect(byKey["negociacion"]!.locked).toBe(false)
  })

  it("cotizacion, negociacion, ganado require a quote; others do not", async () => {
    const stages = await prismaAdmin.pipelineStage.findMany({ where: { tenantId } })
    const byKey = Object.fromEntries(stages.map((s) => [s.key, s]))
    expect(byKey["prospecto"]!.requiresQuote).toBe(false)
    expect(byKey["contactado"]!.requiresQuote).toBe(false)
    expect(byKey["cotizacion"]!.requiresQuote).toBe(true)
    expect(byKey["negociacion"]!.requiresQuote).toBe(true)
    expect(byKey["ganado"]!.requiresQuote).toBe(true)
    expect(byKey["perdido"]!.requiresQuote).toBe(false)
  })

  it("only ganado requires payment", async () => {
    const stages = await prismaAdmin.pipelineStage.findMany({ where: { tenantId } })
    const byKey = Object.fromEntries(stages.map((s) => [s.key, s]))
    expect(byKey["ganado"]!.requiresPayment).toBe(true)
    for (const key of ["prospecto", "contactado", "cotizacion", "negociacion", "perdido"]) {
      expect(byKey[key]!.requiresPayment).toBe(false)
    }
  })

  it("no stage has key 'nuevo' or 'propuesta'", async () => {
    const stages = await prismaAdmin.pipelineStage.findMany({ where: { tenantId } })
    const keys = stages.map((s) => s.key)
    expect(keys).not.toContain("nuevo")
    expect(keys).not.toContain("propuesta")
  })
})

// ── Catalog items ─────────────────────────────────────────────────────────────

describe("T9.1 — catalog items", () => {
  it("equipment catalog has exactly 8 items with correct keys", async () => {
    const items = await prismaAdmin.catalogItem.findMany({
      where: { tenantId, catalogKey: "equipment" },
      orderBy: { order: "asc" },
    })
    expect(items).toHaveLength(8)
    const keys = items.map((i) => i.key)
    for (const k of [
      "bomba", "jacuzzi", "sauna", "calentador",
      "filtro", "hidrojet", "servicio_tecnico", "iluminacion",
    ]) {
      expect(keys).toContain(k)
    }
  })

  it("salesChannel catalog has exactly 5 items: sala/telefono/whatsapp/facebook/instagram", async () => {
    const items = await prismaAdmin.catalogItem.findMany({
      where: { tenantId, catalogKey: "salesChannel" },
    })
    expect(items).toHaveLength(5)
    const keys = items.map((i) => i.key)
    for (const k of ["sala", "telefono", "whatsapp", "facebook", "instagram"]) {
      expect(keys).toContain(k)
    }
    expect(keys).not.toContain("referral")
    expect(keys).not.toContain("web")
  })

  it("dealStatus catalog has exactly 5 items: activo/seguimiento/esperando/frio/urgente", async () => {
    const items = await prismaAdmin.catalogItem.findMany({
      where: { tenantId, catalogKey: "dealStatus" },
    })
    expect(items).toHaveLength(5)
    const keys = items.map((i) => i.key)
    for (const k of ["activo", "seguimiento", "esperando", "frio", "urgente"]) {
      expect(keys).toContain(k)
    }
    expect(keys).not.toContain("active")
    expect(keys).not.toContain("on_hold")
    expect(keys).not.toContain("closed")
  })

  it("followupReason catalog has exactly 6 items", async () => {
    const items = await prismaAdmin.catalogItem.findMany({
      where: { tenantId, catalogKey: "followupReason" },
    })
    expect(items).toHaveLength(6)
    const keys = items.map((i) => i.key)
    for (const k of [
      "no_responde", "pide_informacion", "necesita_tiempo",
      "revisar_cotizacion", "agendar_visita", "otro",
    ]) {
      expect(keys).toContain(k)
    }
  })

  it("no catalog items exist under 'channel' or 'status' (wrong catalogKeys)", async () => {
    const bad = await prismaAdmin.catalogItem.findMany({
      where: { tenantId, catalogKey: { in: ["channel", "status"] } },
    })
    expect(bad).toHaveLength(0)
  })
})

// ── TenantSettings + TenantBranding ──────────────────────────────────────────

describe("T9.1 — settings and branding", () => {
  it("TenantSettings.dealIdPrefix is AQX", async () => {
    const s = await prismaAdmin.tenantSettings.findUniqueOrThrow({ where: { tenantId } })
    expect(s.dealIdPrefix).toBe("AQX")
  })

  it("TenantSettings.locale is es-GT", async () => {
    const s = await prismaAdmin.tenantSettings.findUniqueOrThrow({ where: { tenantId } })
    expect(s.locale).toBe("es-GT")
  })

  it("TenantSettings.currency is GTQ", async () => {
    const s = await prismaAdmin.tenantSettings.findUniqueOrThrow({ where: { tenantId } })
    expect(s.currency).toBe("GTQ")
  })

  it("TenantSettings.defaultPipelineId points to the created pipeline", async () => {
    const s = await prismaAdmin.tenantSettings.findUniqueOrThrow({ where: { tenantId } })
    const pipeline = await prismaAdmin.pipeline.findFirst({ where: { tenantId } })
    expect(s.defaultPipelineId).toBe(pipeline!.id)
  })

  it("TenantBranding row exists for the tenant", async () => {
    const branding = await prismaAdmin.tenantBranding.findUnique({ where: { tenantId } })
    expect(branding).not.toBeNull()
  })

  it("TenantBranding.primaryColor is set (not null)", async () => {
    const branding = await prismaAdmin.tenantBranding.findUniqueOrThrow({ where: { tenantId } })
    expect(branding.primaryColor).not.toBeNull()
  })

  it("TenantBranding.productName is set to KoiCRM", async () => {
    const branding = await prismaAdmin.tenantBranding.findUniqueOrThrow({ where: { tenantId } })
    expect(branding.productName).toBe("KoiCRM")
  })
})
