import { z } from "zod"

export const createCatalogItemSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  catalogKey: z.enum(["equipment", "salesChannel", "dealStatus"]),
  key: z.string().min(1).max(120).regex(/^[a-z0-9_-]+$/, "Solo minúsculas, números, guiones o guión bajo"),
  label: z.string().min(1).max(80),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  order: z.number().int().min(0).default(0),
  // Set for an equipment subcategoría (the parent categoría's CatalogItem.id); null/omitted = categoría.
  parentId: z.string().optional().nullable(),
})

export const updateCatalogItemSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  id: z.string().min(1),
  label: z.string().min(1).max(80),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  active: z.boolean(),
})

export const deleteCatalogItemSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  id: z.string().min(1),
})

export const reorderCatalogItemsSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  catalogKey: z.enum(["equipment", "salesChannel", "dealStatus"]),
  orderedIds: z.array(z.string()),
})
