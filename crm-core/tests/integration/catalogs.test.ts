import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, disconnectAll } from "./helpers"
import { withTenant } from "@/lib/db/rls"
import { getCatalogItems, activeSubcategoryParentsInTx } from "@/features/catalogs/queries"

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

// FINDING-022: resolveEquipmentPairs used to call one findFirst per subcategoría in a loop.
// activeSubcategoryParentsInTx replaces that with a single findMany — these tests pin the
// exact validity rules it must preserve: active, correct parent categoría, parent itself active.
describe("activeSubcategoryParentsInTx", () => {
  let tenantId: string
  let categoryId: string
  let otherCategoryId: string

  beforeAll(async () => {
    const t = await prismaAdmin.tenant.create({
      data: { name: "Equipment Batch", slug: `equip-batch-${Date.now()}` },
    })
    tenantId = t.id

    const category = await prismaAdmin.catalogItem.create({
      data: { tenantId, catalogKey: "equipment", key: "bombas", label: "Bombas", order: 0 },
    })
    categoryId = category.id

    const otherCategory = await prismaAdmin.catalogItem.create({
      data: { tenantId, catalogKey: "equipment", key: "filtros", label: "Filtros", order: 1, active: false },
    })
    otherCategoryId = otherCategory.id

    await prismaAdmin.catalogItem.createMany({
      data: [
        { tenantId, catalogKey: "equipment", key: "sumergible", label: "Sumergible", order: 0, parentId: categoryId },
        { tenantId, catalogKey: "equipment", key: "inactiva", label: "Inactiva", order: 1, parentId: categoryId, active: false },
        { tenantId, catalogKey: "equipment", key: "de-arena", label: "De arena", order: 0, parentId: otherCategoryId },
      ],
    })
  })

  afterAll(async () => {
    await prismaAdmin.tenant.delete({ where: { id: tenantId } })
    await disconnectAll()
  })

  it("returns an empty map for an empty key list without querying", async () => {
    const result = await withTenant(tenantId, (tx) => activeSubcategoryParentsInTx(tx, tenantId, []))
    expect(result.size).toBe(0)
  })

  it("resolves every subcategoría's parent categoría in one call", async () => {
    const result = await withTenant(tenantId, (tx) =>
      activeSubcategoryParentsInTx(tx, tenantId, ["sumergible", "de-arena", "does-not-exist"]),
    )
    expect(result.get("sumergible")).toEqual({ categoryKey: "bombas", active: true })
    expect(result.get("de-arena")).toEqual({ categoryKey: "filtros", active: false })
    expect(result.has("does-not-exist")).toBe(false)
  })

  it("omits an inactive subcategoría (matches the old active:true filter)", async () => {
    const result = await withTenant(tenantId, (tx) =>
      activeSubcategoryParentsInTx(tx, tenantId, ["inactiva"]),
    )
    expect(result.has("inactiva")).toBe(false)
  })

  it("still lets the caller detect a parent-categoría mismatch and an inactive parent", async () => {
    const result = await withTenant(tenantId, (tx) =>
      activeSubcategoryParentsInTx(tx, tenantId, ["sumergible", "de-arena"]),
    )
    // Same validity rule resolveEquipmentPairs applies: valid only when the resolved parent
    // categoryKey matches what the caller claimed AND that parent is active.
    expect(result.get("sumergible")!.categoryKey === "filtros").toBe(false) // wrong category → invalid
    expect(result.get("de-arena")!.active).toBe(false) // right category, but it's inactive → invalid
  })
})
