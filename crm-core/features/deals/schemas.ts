import { z } from "zod"

export const createDealSchema = z
  .object({
    tenantId: z.string().min(1),
    tenantSlug: z.string().min(1),
    ownerId: z.string().min(1, "El asesor es requerido."),
    channelKey: z.string().min(1, "El canal es requerido."),
    name: z.string().min(1, "El nombre es requerido.").max(200),
    company: z.string().max(200).optional().nullable(),
    phone: z.string().max(30).optional().nullable(),
    whatsapp: z.string().max(40).optional().nullable(),
    email: z.string().email("Email inválido.").optional().nullable().or(z.literal("")),
    equipment: z.array(z.string()).default([]),
    equipmentCustom: z.string().max(300).optional().nullable(),
    value: z.coerce.number().min(0).default(0),
    statusKey: z.string().min(1).default("activo"),
    customData: z.record(z.string(), z.unknown()).optional(),
    clientId: z.string().optional(),
  })
  .refine(
    (d) => d.equipment.length > 0 || (d.equipmentCustom?.trim() ?? "").length > 0,
    { message: "Selecciona al menos un equipo o escribe uno personalizado." }
  )

export const updateDealSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  dealId: z.string().min(1),
  ownerId: z.string().min(1).optional(),
  channelKey: z.string().min(1).optional(),
  name: z.string().min(1).max(200).optional(),
  company: z.string().max(200).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  whatsapp: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  equipment: z.array(z.string()).optional(),
  equipmentCustom: z.string().max(300).optional().nullable(),
  value: z.coerce.number().min(0).optional(),
  statusKey: z.string().min(1).optional(),
  customData: z.record(z.string(), z.unknown()).optional(),
})

export const moveDealSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  dealId: z.string().min(1),
  toStageId: z.string().min(1),
  force: z.boolean().default(false), // bypass locked check for explicit win/lose buttons
})

export const archiveDealSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  dealId: z.string().min(1),
})

export const updateDealFieldSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  dealId: z.string().min(1),
  field: z.enum(["value", "statusKey", "phone", "whatsapp", "email", "name", "company"]),
  value: z.union([z.string(), z.coerce.number()]),
})

export type CreateDealInput = z.infer<typeof createDealSchema>
export type UpdateDealInput = z.infer<typeof updateDealSchema>
export type MoveDealInput = z.infer<typeof moveDealSchema>
