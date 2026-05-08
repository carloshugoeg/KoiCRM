import { z } from "zod"

const clientBaseFields = {
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  name: z.string().min(1, "El nombre es requerido.").max(200),
  company: z.string().max(200).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  whatsapp: z.string().max(40).optional().nullable(),
  email: z.string().email("Email inválido.").optional().nullable().or(z.literal("")),
  customData: z.record(z.string(), z.unknown()).optional(),
}

export const createClientSchema = z.object(clientBaseFields)

export const updateClientSchema = z.object({
  ...clientBaseFields,
  id: z.string().min(1),
})

export const deleteClientSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  id: z.string().min(1),
})

export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
