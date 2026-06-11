import { withTenant } from "@/lib/db/rls"
import type { CustomFieldDef, CustomFieldType } from "@/lib/config/custom-fields"

export type EntityType = "Deal" | "Client"

export async function getCustomFieldDefs(tenantId: string, entity: EntityType) {
  // CustomFieldDefinition is RLS-protected: a bare prisma read runs as app_user without
  // app.tenant_id set and returns []. Read through withTenant so the tenant context is set.
  return withTenant(tenantId, (tx) =>
    tx.customFieldDefinition.findMany({
      where: { tenantId, entity },
      orderBy: { order: "asc" },
    }),
  )
}

export function toCustomFieldDef(
  raw: Awaited<ReturnType<typeof getCustomFieldDefs>>[number]
): CustomFieldDef {
  return {
    key: raw.key,
    label: raw.label,
    type: raw.type as CustomFieldType,
    required: raw.required,
    options: Array.isArray(raw.options) ? (raw.options as string[]) : null,
  }
}
