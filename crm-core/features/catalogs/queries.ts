import { withTenant, type PrismaTx } from "@/lib/db/rls"
import type { CatalogItem } from "@prisma/client"

export type CatalogKey = "equipment" | "salesChannel" | "dealStatus"

export const CATALOG_LABELS: Record<CatalogKey, string> = {
  equipment: "Equipos",
  salesChannel: "Canal de ventas",
  dealStatus: "Estado de oportunidad",
}

export type GetCatalogItemsOptions = {
  activeOnly?: boolean
}

/** A categoría (equipo de interés) with its subcategorías. */
export type EquipmentCategory = {
  category: CatalogItem
  subcategories: CatalogItem[]
}

export async function getCatalogItems(
  tenantId: string,
  catalogKey: CatalogKey,
  options?: GetCatalogItemsOptions,
) {
  const activeOnly = options?.activeOnly ?? false
  return withTenant(tenantId, (tx) =>
    tx.catalogItem.findMany({
      where: {
        tenantId,
        catalogKey,
        ...(activeOnly ? { active: true } : {}),
      },
      orderBy: { order: "asc" },
    }),
  )
}

/** Catalog fetch inside an existing tenant transaction — shares the caller's RLS connection. */
export async function getCatalogItemsInTx(
  tx: PrismaTx,
  tenantId: string,
  catalogKey: CatalogKey,
  activeOnly: boolean,
) {
  return tx.catalogItem.findMany({
    where: {
      tenantId,
      catalogKey,
      ...(activeOnly ? { active: true } : {}),
    },
    orderBy: { order: "asc" },
  })
}

/** Validity check inside an existing tenant transaction — shares the caller's RLS connection. */
export async function isActiveCatalogItemKeyInTx(
  tx: PrismaTx,
  tenantId: string,
  catalogKey: CatalogKey,
  key: string,
): Promise<boolean> {
  const item = await tx.catalogItem.findFirst({
    where: { tenantId, catalogKey, key, active: true },
    select: { id: true },
  })
  return !!item
}

/**
 * Standalone variant — opens its own transaction. Never call this from inside a withTenant()
 * callback: production runs connection_limit=1, so a nested transaction waits on a connection
 * the caller is already holding (P2024/P2028). Use isActiveCatalogItemKeyInTx(tx, …) there.
 */
export async function isActiveCatalogItemKey(
  tenantId: string,
  catalogKey: CatalogKey,
  key: string,
): Promise<boolean> {
  return withTenant(tenantId, (tx) => isActiveCatalogItemKeyInTx(tx, tenantId, catalogKey, key))
}

/**
 * Groups the flat "equipment" catalog into the 2-level taxonomy:
 * parentId null → categoría; parentId set → subcategoría of that categoría.
 * Categorías and their subcategorías are each ordered by `order` (the input must already be sorted).
 */
function groupEquipmentHierarchy(items: CatalogItem[]): EquipmentCategory[] {
  const byParent = new Map<string, CatalogItem[]>()
  for (const item of items) {
    if (item.parentId === null) continue
    const list = byParent.get(item.parentId) ?? []
    list.push(item)
    byParent.set(item.parentId, list)
  }
  return items
    .filter((i) => i.parentId === null)
    .map((category) => ({ category, subcategories: byParent.get(category.id) ?? [] }))
}

/** Loads the equipment categoría/subcategoría tree inside an existing tenant transaction. */
export async function getEquipmentHierarchyInTx(
  tx: PrismaTx,
  tenantId: string,
  activeOnly: boolean,
): Promise<EquipmentCategory[]> {
  const items = await tx.catalogItem.findMany({
    where: { tenantId, catalogKey: "equipment", ...(activeOnly ? { active: true } : {}) },
    orderBy: { order: "asc" },
  })
  return groupEquipmentHierarchy(items)
}

export async function getEquipmentHierarchy(
  tenantId: string,
  options?: GetCatalogItemsOptions,
): Promise<EquipmentCategory[]> {
  const activeOnly = options?.activeOnly ?? false
  return withTenant(tenantId, (tx) => getEquipmentHierarchyInTx(tx, tenantId, activeOnly))
}

/**
 * Batched variant of isActiveSubcategoryOfCategory — validates every subcategoría in one
 * round trip instead of one `findFirst` per subcategoría. `resolveEquipmentPairs` used to
 * call the single-pair check inside a nested loop, meaning N queries in the same
 * transaction for a deal with N equipment selections (FINDING-022). Runs inside the
 * caller's transaction, same as the single-pair check.
 */
export async function activeSubcategoryParentsInTx(
  tx: PrismaTx,
  tenantId: string,
  subcategoryKeys: string[],
): Promise<Map<string, { categoryKey: string; active: boolean }>> {
  const result = new Map<string, { categoryKey: string; active: boolean }>()
  if (subcategoryKeys.length === 0) return result
  const rows = await tx.catalogItem.findMany({
    where: {
      tenantId,
      catalogKey: "equipment",
      key: { in: subcategoryKeys },
      active: true,
      parentId: { not: null },
    },
    select: { key: true, parent: { select: { key: true, active: true } } },
  })
  for (const row of rows) {
    if (!row.parent) continue
    result.set(row.key, { categoryKey: row.parent.key, active: row.parent.active })
  }
  return result
}

export async function getCatalogItemUsageCount(
  tenantId: string,
  catalogKey: CatalogKey,
  key: string,
  /** For equipment, pass the item's parentId: set → count as subcategoría, null → as categoría. */
  parentId?: string | null,
): Promise<number> {
  return withTenant(tenantId, async (tx) => {
    if (catalogKey === "equipment") {
      // A subcategoría is in use when deals link its subcategoryKey; a categoría is in use when
      // deals link its categoryKey (covering every subcategoría beneath it).
      return parentId
        ? tx.dealEquipment.count({ where: { deal: { tenantId }, subcategoryKey: key } })
        : tx.dealEquipment.count({ where: { deal: { tenantId }, categoryKey: key } })
    }
    if (catalogKey === "salesChannel") {
      return tx.deal.count({ where: { tenantId, channelKey: key } })
    }
    if (catalogKey === "dealStatus") {
      return tx.deal.count({ where: { tenantId, statusKey: key } })
    }
    return 0
  })
}
