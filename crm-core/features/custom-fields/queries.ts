import { prisma } from "@/lib/db/client"
import type { CustomFieldDef } from "@/lib/config/custom-fields"

export type EntityType = "Deal" | "Client"

export async function getCustomFieldDefs(tenantId: string, entity: EntityType) {
  return prisma.customFieldDefinition.findMany({
    where: { tenantId, entity },
    orderBy: { order: "asc" },
  })
}

export function toCustomFieldDef(
  raw: Awaited<ReturnType<typeof getCustomFieldDefs>>[number]
): CustomFieldDef {
  return {
    key: raw.key,
    label: raw.label,
    type: raw.type as import("@/lib/config/custom-fields").CustomFieldType,
    required: raw.required,
    options: Array.isArray(raw.options) ? (raw.options as string[]) : null,
  }
}
