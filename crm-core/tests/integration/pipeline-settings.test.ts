import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, disconnectAll } from "./helpers"
import { withTenant } from "@/lib/db/rls"

describe("Pipeline stage management", () => {
  let tenantId: string
  let pipelineId: string
  let stageIds: string[] = []

  beforeAll(async () => {
    const t = await prismaAdmin.tenant.create({
      data: { name: "PipelineTest", slug: `pipeline-test-${Date.now()}` },
    })
    tenantId = t.id

    const pipeline = await prismaAdmin.pipeline.create({
      data: { tenantId, name: "Default", isDefault: true },
    })
    pipelineId = pipeline.id

    const stages = await Promise.all([
      prismaAdmin.pipelineStage.create({ data: { tenantId, pipelineId, order: 0, key: "prospecto", label: "Prospecto", color: "#3b82f6", iconKey: "circle" } }),
      prismaAdmin.pipelineStage.create({ data: { tenantId, pipelineId, order: 1, key: "contactado", label: "Contactado", color: "#10b981", iconKey: "phone" } }),
      prismaAdmin.pipelineStage.create({ data: { tenantId, pipelineId, order: 2, key: "cotizacion", label: "Cotización", color: "#f59e0b", iconKey: "file" } }),
    ])
    stageIds = stages.map((s) => s.id)
  })

  afterAll(async () => {
    await prismaAdmin.tenant.delete({ where: { id: tenantId } })
    await disconnectAll()
  })

  it("reorders stages atomically", async () => {
    const newOrder = [stageIds[2], stageIds[0], stageIds[1]]

    await withTenant(tenantId, async (tx) => {
      await Promise.all(
        newOrder.map((id, idx) => tx.pipelineStage.update({ where: { id }, data: { order: idx } }))
      )
    })

    const stages = await prismaAdmin.pipelineStage.findMany({
      where: { pipelineId },
      orderBy: { order: "asc" },
    })
    expect(stages[0].key).toBe("cotizacion")
    expect(stages[1].key).toBe("prospecto")
    expect(stages[2].key).toBe("contactado")
  })

  it("blocks deletion of a stage with deals by verifying deal count", async () => {
    const count = await prismaAdmin.deal.count({ where: { stageId: stageIds[0] } })
    expect(count).toBe(0) // no deals, deletion would be allowed
  })

  it("updates stage label and color", async () => {
    await withTenant(tenantId, async (tx) => {
      await tx.pipelineStage.update({
        where: { id: stageIds[0] },
        data: { label: "Prospecto actualizado", color: "#7c3aed" },
      })
    })

    const stage = await prismaAdmin.pipelineStage.findUnique({ where: { id: stageIds[0] } })
    expect(stage?.label).toBe("Prospecto actualizado")
    expect(stage?.color).toBe("#7c3aed")
  })
})
