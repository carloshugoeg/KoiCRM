import { z } from "zod"

export const CreateQuoteSchema = z.object({
  dealId: z.string().cuid(),
  number: z.string().min(1).max(50),
  date: z.coerce.date(),
  fileUrl: z.string().url().optional(),
})

export const UpdateQuoteSchema = z.object({
  id: z.string().cuid(),
  number: z.string().min(1).max(50).optional(),
  date: z.coerce.date().optional(),
  fileUrl: z.string().url().nullable().optional(),
})

export type CreateQuoteInput = z.infer<typeof CreateQuoteSchema>
export type UpdateQuoteInput = z.infer<typeof UpdateQuoteSchema>
