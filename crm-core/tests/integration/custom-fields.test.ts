import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, disconnectAll } from "./helpers"
import { withTenant } from "@/lib/db/rls"
import { buildCustomFieldSchema } from "@/lib/config/custom-fields"
import type { CustomFieldDef } from "@/lib/config/custom-fields"

describe("Custom fields engine", () => {
  let tenantId: string

  beforeAll(async () => {
    const t = await prismaAdmin.tenant.create({
      data: { name: "CFTest", slug: `cf-test-${Date.now()}` },
    })
    tenantId = t.id
  })

  afterAll(async () => {
    await prismaAdmin.tenant.delete({ where: { id: tenantId } })
    await disconnectAll()
  })

  it("creates a text custom field definition", async () => {
    await withTenant(tenantId, async (tx) => {
      await tx.customFieldDefinition.create({
        data: { tenantId, entity: "Deal", key: "contract_number", label: "Número de contrato", type: "text", required: false, order: 0 },
      })
    })

    const defs = await prismaAdmin.customFieldDefinition.findMany({ where: { tenantId, entity: "Deal" } })
    expect(defs).toHaveLength(1)
    expect(defs[0].key).toBe("contract_number")
  })

  it("buildCustomFieldSchema validates a text field correctly", () => {
    const defs = [
      { key: "contract_number", label: "Número de contrato", type: "text" as const, required: true, options: null },
    ]
    const schema = buildCustomFieldSchema(defs)
    const good = schema.safeParse({ contract_number: "CT-001" })
    expect(good.success).toBe(true)
    const bad = schema.safeParse({ contract_number: "" })
    expect(bad.success).toBe(false)
  })

  it("buildCustomFieldSchema validates a select field with options", () => {
    const defs = [
      { key: "priority", label: "Prioridad", type: "select" as const, required: false, options: ["alta", "media", "baja"] },
    ]
    const schema = buildCustomFieldSchema(defs)
    const good = schema.safeParse({ priority: "alta" })
    expect(good.success).toBe(true)
    const bad = schema.safeParse({ priority: "invalido" })
    expect(bad.success).toBe(false)
  })

  it("custom field data round-trips through Deal.customData JSONB", async () => {
    const user = await prismaAdmin.user.create({
      data: { email: `cftest-${Date.now()}@test.com`, emailVerified: new Date() },
    })
    const pipeline = await prismaAdmin.pipeline.create({ data: { tenantId, name: "Default", isDefault: true } })
    const stage = await prismaAdmin.pipelineStage.create({
      data: { tenantId, pipelineId: pipeline.id, order: 0, key: "nuevo", label: "Nuevo", color: "#3b82f6", iconKey: "circle" },
    })

    const dealId = `TEST-0001-CF-25`
    await withTenant(tenantId, async (tx) => {
      await tx.deal.create({
        data: {
          id: dealId,
          tenantId,
          pipelineId: pipeline.id,
          stageId: stage.id,
          ownerId: user.id,
          channelKey: "sala",
          statusKey: "activo",
          name: "Test Deal",
          value: 1000,
          customData: { contract_number: "CT-001" },
        },
      })
    })

    const deal = await prismaAdmin.deal.findUnique({ where: { id: dealId } })
    expect((deal?.customData as Record<string, unknown>)?.contract_number).toBe("CT-001")

    // cleanup
    await prismaAdmin.deal.delete({ where: { id: dealId } })
    await prismaAdmin.user.delete({ where: { id: user.id } })
  })

  it("buildCustomFieldSchema validates multiselect with options", () => {
    const defs: CustomFieldDef[] = [
      { key: "tags", label: "Etiquetas", type: "multiselect", required: false, options: ["urgente", "vip", "nuevo"] },
    ]
    const schema = buildCustomFieldSchema(defs)
    const good = schema.safeParse({ tags: ["urgente", "vip"] })
    expect(good.success).toBe(true)
    const bad = schema.safeParse({ tags: ["invalido"] })
    expect(bad.success).toBe(false)
  })

  it("buildCustomFieldSchema rejects empty required number field", () => {
    const defs: CustomFieldDef[] = [
      { key: "qty", label: "Cantidad", type: "number", required: true, options: null },
    ]
    const schema = buildCustomFieldSchema(defs)
    const bad = schema.safeParse({ qty: NaN })
    expect(bad.success).toBe(false)
    const good = schema.safeParse({ qty: 5 })
    expect(good.success).toBe(true)
  })
})
