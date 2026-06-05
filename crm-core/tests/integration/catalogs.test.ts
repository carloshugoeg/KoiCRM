import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, disconnectAll } from "./helpers"
import { withTenant } from "@/lib/db/rls"
import { getCatalogItems } from "@/features/catalogs/queries"

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

    const active = await getCatalogItems(tenantId, "equipment", { activeOnly: true })
    expect(active.every((i) => i.active)).toBe(true)
    expect(active.some((i) => i.key === "bomba")).toBe(false)
    expect(active.some((i) => i.key === "jacuzzi")).toBe(true)
  })
})

describe("getCatalogItems — RLS and tenant isolation", () => {
  let tenantAId: string
  let tenantBId: string
  const suffix = Date.now()

  beforeAll(async () => {
    const [a, b] = await Promise.all([
      prismaAdmin.tenant.create({
        data: { name: "Catalog RLS A", slug: `catalog-rls-a-${suffix}` },
      }),
      prismaAdmin.tenant.create({
        data: { name: "Catalog RLS B", slug: `catalog-rls-b-${suffix}` },
      }),
    ])
    tenantAId = a.id
    tenantBId = b.id

    await withTenant(tenantAId, (tx) =>
      tx.catalogItem.create({
        data: {
          tenantId: tenantAId,
          catalogKey: "equipment",
          key: "equipo_a",
          label: "Equipo A",
          order: 0,
        },
      }),
    )
    await withTenant(tenantBId, (tx) =>
      tx.catalogItem.create({
        data: {
          tenantId: tenantBId,
          catalogKey: "equipment",
          key: "equipo_b",
          label: "Equipo B",
          order: 0,
        },
      }),
    )
  })

  afterAll(async () => {
    await prismaAdmin.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } })
    await disconnectAll()
  })

  it("reads items created under withTenant", async () => {
    const items = await getCatalogItems(tenantAId, "equipment")
    expect(items).toHaveLength(1)
    expect(items[0].key).toBe("equipo_a")
  })

  it("does not leak catalog items across tenants", async () => {
    const [itemsA, itemsB] = await Promise.all([
      getCatalogItems(tenantAId, "equipment"),
      getCatalogItems(tenantBId, "equipment"),
    ])
    expect(itemsA.map((i) => i.key)).toEqual(["equipo_a"])
    expect(itemsB.map((i) => i.key)).toEqual(["equipo_b"])
  })

  it("activeOnly excludes inactive items", async () => {
    await withTenant(tenantAId, (tx) =>
      tx.catalogItem.create({
        data: {
          tenantId: tenantAId,
          catalogKey: "equipment",
          key: "inactivo",
          label: "Inactivo",
          order: 1,
          active: false,
        },
      }),
    )

    const all = await getCatalogItems(tenantAId, "equipment")
    const active = await getCatalogItems(tenantAId, "equipment", { activeOnly: true })
    expect(all.some((i) => i.key === "inactivo")).toBe(true)
    expect(active.some((i) => i.key === "inactivo")).toBe(false)
    expect(active.some((i) => i.key === "equipo_a")).toBe(true)
  })
})
