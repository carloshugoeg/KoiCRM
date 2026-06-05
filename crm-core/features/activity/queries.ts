import { withTenant, type PrismaTx } from "@/lib/db/rls"
import type { Prisma } from "@prisma/client"

export type ActivityType =
  | "created"
  | "stageChanged"
  | "ownerChanged"
  | "valueChanged"
  | "quoteAdded"
  | "paymentAdded"
  | "archived"
  | "deleted"
  | "followUpAdded"
  | "followUpCompleted"
  | "noteAdded"

export interface RecordActivityInput {
  tenantId: string
  entity: "Deal" | "Client"
  entityId: string
  type: ActivityType
  payload: Record<string, unknown>
  userId?: string
}

/**
 * Record an audit activity entry.
 * Must be called inside an active withTenant() transaction — takes `tx` directly.
 */
export async function recordActivity(tx: PrismaTx, input: RecordActivityInput): Promise<void> {
  await tx.activity.create({
    data: {
      tenantId: input.tenantId,
      entity: input.entity,
      entityId: input.entityId,
      type: input.type,
      payload: input.payload as Prisma.InputJsonValue,
      userId: input.userId ?? null,
    },
  })
}

export async function getDealActivity(tenantId: string, dealId: string, limit = 50) {
  return withTenant(tenantId, (tx) =>
    tx.activity.findMany({
      where: { tenantId, entity: "Deal", entityId: dealId },
      orderBy: { createdAt: "desc" },
      take: limit,
    })
  )
}

export async function getClientActivity(tenantId: string, clientId: string, limit = 50) {
  return withTenant(tenantId, (tx) =>
    tx.activity.findMany({
      where: { tenantId, entity: "Client", entityId: clientId },
      orderBy: { createdAt: "desc" },
      take: limit,
    })
  )
}

export type ActivityEntry = Awaited<ReturnType<typeof getDealActivity>>[number]

// Human-readable labels for each activity type (Spanish)
export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  created: "Oportunidad creada",
  stageChanged: "Etapa cambiada",
  ownerChanged: "Asesor cambiado",
  valueChanged: "Valor actualizado",
  quoteAdded: "Cotización agregada",
  paymentAdded: "Pago agregado",
  archived: "Archivado",
  deleted: "Oportunidad eliminada",
  followUpAdded: "Seguimiento programado",
  followUpCompleted: "Seguimiento completado",
  noteAdded: "Nota agregada",
}

// Unused at runtime but useful for ad-hoc queries during development
export async function _countActivitiesForDeal(
  tenantId: string,
  dealId: string,
): Promise<number> {
  return withTenant(tenantId, (tx) =>
    tx.activity.count({ where: { tenantId, entity: "Deal", entityId: dealId } })
  )
}
