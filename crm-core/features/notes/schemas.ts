import { z } from "zod"

export const addNoteSchema = z
  .object({
    tenantId: z.string().min(1),
    tenantSlug: z.string().min(1),
    body: z.string().min(1, "La nota no puede estar vacía.").max(5000),
    dealId: z.string().optional(),
    clientId: z.string().optional(),
    pin: z.string().regex(/^\d{4}$/, "El PIN debe tener 4 dígitos.").optional(),
  })
  .refine((d) => d.dealId || d.clientId, {
    message: "Se requiere dealId o clientId.",
  })

export const deleteNoteSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  noteId: z.string().min(1),
  pin: z.string().regex(/^\d{4}$/, "El PIN debe tener 4 dígitos.").optional(),
})

export type AddNoteInput = z.infer<typeof addNoteSchema>
export type DeleteNoteInput = z.infer<typeof deleteNoteSchema>
