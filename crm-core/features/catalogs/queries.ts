import { withTenant } from "@/lib/db/rls"

export type CatalogKey = "equipment" | "salesChannel" | "dealStatus" | "followupReason"

export const CATALOG_LABELS: Record<CatalogKey, string> = {
  equipment: "Equipos",
  salesChannel: "Canal de ventas",
  dealStatus: "Estado de oportunidad",
  followupReason: "Motivo de seguimiento",
}

export type GetCatalogItemsOptions = {
  activeOnly?: boolean
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

export async function getCatalogItemUsageCount(
  tenantId: string,
  catalogKey: CatalogKey,
  key: string,
): Promise<number> {
  return withTenant(tenantId, async (tx) => {
    if (catalogKey === "equipment") {
      return tx.dealEquipment.count({ where: { deal: { tenantId }, equipmentKey: key } })
    }
    if (catalogKey === "salesChannel") {
      return tx.deal.count({ where: { tenantId, channelKey: key } })
    }
    if (catalogKey === "dealStatus") {
      return tx.deal.count({ where: { tenantId, statusKey: key } })
    }
    if (catalogKey === "followupReason") {
      return tx.followUp.count({ where: { tenantId, reasonKey: key } })
    }
    return 0
  })
}
