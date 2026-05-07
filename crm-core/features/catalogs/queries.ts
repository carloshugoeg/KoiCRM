import { prisma } from "@/lib/db/client"

export type CatalogKey = "equipment" | "salesChannel" | "dealStatus" | "followupReason"

export const CATALOG_LABELS: Record<CatalogKey, string> = {
  equipment: "Equipos",
  salesChannel: "Canal de ventas",
  dealStatus: "Estado de oportunidad",
  followupReason: "Motivo de seguimiento",
}

export async function getCatalogItems(tenantId: string, catalogKey: CatalogKey) {
  return prisma.catalogItem.findMany({
    where: { tenantId, catalogKey },
    orderBy: { order: "asc" },
  })
}

export async function getCatalogItemUsageCount(
  tenantId: string,
  catalogKey: CatalogKey,
  key: string,
): Promise<number> {
  if (catalogKey === "equipment") {
    return prisma.dealEquipment.count({ where: { deal: { tenantId }, equipmentKey: key } })
  }
  if (catalogKey === "salesChannel") {
    return prisma.deal.count({ where: { tenantId, channelKey: key } })
  }
  if (catalogKey === "dealStatus") {
    return prisma.deal.count({ where: { tenantId, statusKey: key } })
  }
  if (catalogKey === "followupReason") {
    return prisma.followUp.count({ where: { tenantId, reasonKey: key } })
  }
  return 0
}
