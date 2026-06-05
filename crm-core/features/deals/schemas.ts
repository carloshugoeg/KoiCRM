import { z } from "zod"

const PHONE_RE = /^\d{4}-\d{4}$/
const WA_RE = /^\+502 \d{4}-\d{4}$/

export const createDealSchema = z
  .object({
    tenantId: z.string().min(1),
    tenantSlug: z.string().min(1),
    ownerId: z.string().min(1, "El asesor es requerido."),
    channelKey: z.string().min(1, "El canal es requerido."),
    name: z.string().min(1, "El nombre es requerido.").max(200),
    company: z.string().max(200).optional().nullable(),
    phone: z.string({ error: "El teléfono es requerido." }).min(1, "El teléfono es requerido.").regex(PHONE_RE, "El teléfono debe tener el formato XXXX-XXXX."),
    whatsapp: z
      .string()
      .regex(WA_RE, "El WhatsApp debe tener el formato +502 XXXX-XXXX.")
      .optional()
      .nullable()
      .or(z.literal("")),
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
  phone: z
    .string()
    .regex(PHONE_RE, "El teléfono debe tener el formato XXXX-XXXX.")
    .optional()
    .nullable()
    .or(z.literal("")),
  whatsapp: z
    .string()
    .regex(WA_RE, "El WhatsApp debe tener el formato +502 XXXX-XXXX.")
    .optional()
    .nullable()
    .or(z.literal("")),
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
  force: z.boolean().default(false),
})

export const archiveDealSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  dealId: z.string().min(1),
})

export const transferDealSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  dealId: z.string().min(1),
  toUserId: z.string().min(1, "Selecciona un asesor."),
})

export const deleteDealSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  dealId: z.string().min(1),
})

export const updateDealFieldSchema = z
  .object({
    tenantId: z.string().min(1),
    tenantSlug: z.string().min(1),
    dealId: z.string().min(1),
    field: z.enum(["value", "statusKey", "phone", "whatsapp", "email", "name", "company"]),
    value: z.union([z.string(), z.coerce.number()]),
  })
  .superRefine((data, ctx) => {
    const { field, value } = data
    const addErr = (message: string) => ctx.addIssue({ code: "custom", message, path: ["value"] })

    const STRING_FIELDS = ["phone", "whatsapp", "name", "company", "email", "statusKey"] as const
    if (STRING_FIELDS.includes(field as typeof STRING_FIELDS[number]) && typeof value !== "string") {
      addErr("Se esperaba un texto.")
      return
    }

    if (field === "email" && typeof value === "string" && value !== "") {
      if (!z.string().email().safeParse(value).success) addErr("Email inválido.")
    }
    if (field === "phone" && typeof value === "string") {
      if (value.length === 0) addErr("El teléfono es requerido.")
      else if (!PHONE_RE.test(value)) addErr("El teléfono debe tener el formato XXXX-XXXX.")
    }
    if (field === "whatsapp" && typeof value === "string" && value !== "") {
      if (!WA_RE.test(value)) addErr("El WhatsApp debe tener el formato +502 XXXX-XXXX.")
    }
    if (field === "name") {
      if (typeof value !== "string" || value.trim().length === 0) addErr("El nombre es requerido.")
      else if (value.length > 200) addErr("Nombre demasiado largo (máx. 200 caracteres).")
    }
    if (field === "company" && typeof value === "string" && value.length > 200) {
      addErr("Empresa demasiado larga (máx. 200 caracteres).")
    }
    if (field === "value") {
      const num = typeof value === "number" ? value : Number(value)
      if (isNaN(num) || num < 0) addErr("El valor debe ser un número positivo.")
    }
    if (field === "statusKey" && (typeof value !== "string" || value.trim().length === 0)) {
      addErr("El estado es requerido.")
    }
  })

export type CreateDealInput = z.infer<typeof createDealSchema>
export type UpdateDealInput = z.infer<typeof updateDealSchema>
export type MoveDealInput = z.infer<typeof moveDealSchema>
