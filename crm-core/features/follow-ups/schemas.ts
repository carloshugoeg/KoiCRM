import { z } from "zod"

export const addFollowUpSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  dealId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
  reasonKey: z.string().min(1, "El motivo es requerido."),
})

export const completeFollowUpSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  followUpId: z.string().min(1),
  result: z.string().max(500).optional(),
})

export const deleteFollowUpSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  followUpId: z.string().min(1),
})

export type AddFollowUpInput = z.infer<typeof addFollowUpSchema>
