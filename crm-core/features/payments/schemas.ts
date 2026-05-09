import { z } from "zod"

export const CreatePaymentSchema = z.object({
  dealId: z.string().cuid(),
  number: z.string().min(1).max(50),
  date: z.coerce.date(),
  fileUrl: z.string().url().optional(),
})

export const UpdatePaymentSchema = z.object({
  id: z.string().cuid(),
  number: z.string().min(1).max(50).optional(),
  date: z.coerce.date().optional(),
  fileUrl: z.string().url().nullable().optional(),
})

export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>
export type UpdatePaymentInput = z.infer<typeof UpdatePaymentSchema>
