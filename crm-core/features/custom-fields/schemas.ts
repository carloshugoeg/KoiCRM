import { z } from "zod"

const FIELD_TYPES = ["text", "number", "date", "select", "multiselect", "boolean", "url"] as const

export const createCustomFieldSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  entity: z.enum(["Deal", "Client"]),
  key: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/, "Solo minúsculas, números y guión bajo"),
  label: z.string().min(1).max(80),
  type: z.enum(FIELD_TYPES),
  options: z.array(z.string()).optional().nullable(),
  required: z.boolean().default(false),
  order: z.number().int().min(0).default(0),
})

export const deleteCustomFieldSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  id: z.string().min(1),
})

export const reorderCustomFieldsSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  entity: z.enum(["Deal", "Client"]),
  orderedIds: z.array(z.string()).min(1),
})
