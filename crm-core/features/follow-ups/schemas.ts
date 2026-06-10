import { z } from "zod"

export const addFollowUpSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  dealId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
  note: z.string().trim().max(500, "El texto del seguimiento es muy largo.").optional(),
  pin: z.string().regex(/^\d{4}$/, "El PIN debe tener 4 dígitos.").optional(),
})

export const completeFollowUpSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  followUpId: z.string().min(1),
  result: z.string().max(500).optional(),
  pin: z.string().regex(/^\d{4}$/, "El PIN debe tener 4 dígitos.").optional(),
})

export const deleteFollowUpSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  followUpId: z.string().min(1),
  pin: z.string().regex(/^\d{4}$/, "El PIN debe tener 4 dígitos.").optional(),
})

export type AddFollowUpInput = z.infer<typeof addFollowUpSchema>
