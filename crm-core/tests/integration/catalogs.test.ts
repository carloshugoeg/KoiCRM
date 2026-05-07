import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, disconnectAll } from "./helpers"
import { withTenant } from "@/lib/db/rls"

describe("CatalogItem CRUD", () => {
  let tenantId: string

  beforeAll(async () => {
    const t = await prismaAdmin.tenant.create({
      data: { name: "CatalogTest", slug: `catalog-test-${Date.now()}` },
    })
    tenantId = t.id
  })

  afterAll(async () => {
    await prismaAdmin.tenant.delete({ where: { id: tenantId } })
    await disconnectAll()
  })

  it("creates a catalog item", async () => {
    await withTenant(tenantId, async (tx) => {
      await tx.catalogItem.create({
        data: { tenantId, catalogKey: "equipment", key: "bomba", label: "Bomba", order: 0 },
      })
    })

    const items = await prismaAdmin.catalogItem.findMany({ where: { tenantId, catalogKey: "equipment" } })
    expect(items).toHaveLength(1)
    expect(items[0].key).toBe("bomba")
  })

  it("soft-disables a catalog item (active=false)", async () => {
    await withTenant(tenantId, async (tx) => {
      await tx.catalogItem.updateMany({
        where: { tenantId, catalogKey: "equipment", key: "bomba" },
        data: { active: false },
      })
    })

    const item = await prismaAdmin.catalogItem.findFirst({ where: { tenantId, catalogKey: "equipment", key: "bomba" } })
    expect(item?.active).toBe(false)
  })

  it("listing only active items filters inactive", async () => {
    await withTenant(tenantId, async (tx) => {
      await tx.catalogItem.create({
        data: { tenantId, catalogKey: "equipment", key: "jacuzzi", label: "Jacuzzi", order: 1 },
      })
    })

    const active = await prismaAdmin.catalogItem.findMany({
      where: { tenantId, catalogKey: "equipment", active: true },
    })
    expect(active.every((i) => i.active)).toBe(true)
    expect(active.some((i) => i.key === "bomba")).toBe(false)
    expect(active.some((i) => i.key === "jacuzzi")).toBe(true)
  })
})
