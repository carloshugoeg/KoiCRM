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

export async function isActiveCatalogItemKey(
  tenantId: string,
  catalogKey: CatalogKey,
  key: string,
): Promise<boolean> {
  const item = await withTenant(tenantId, (tx) =>
    tx.catalogItem.findFirst({
      where: { tenantId, catalogKey, key, active: true },
      select: { id: true },
    }),
  )
  return !!item
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
 * Parent-aware validity check for a subcategoría selection. Runs inside the caller's transaction so
 * it shares the RLS-scoped connection. The subcategoría must be active, belong to the given
 * categoría (by key), and that categoría must itself be active.
 */
export async function isActiveSubcategoryOfCategory(
  tx: PrismaTx,
  tenantId: string,
  categoryKey: string,
  subcategoryKey: string,
): Promise<boolean> {
  const sub = await tx.catalogItem.findFirst({
    where: {
      tenantId,
      catalogKey: "equipment",
      key: subcategoryKey,
      active: true,
      parentId: { not: null },
    },
    select: { parent: { select: { key: true, active: true } } },
  })
  return !!sub?.parent && sub.parent.active && sub.parent.key === categoryKey
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
