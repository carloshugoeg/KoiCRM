import { z } from "zod"

/** Deal primary keys use tenant prefix format (e.g. AQX-0032-RO-26), not CUIDs. */
export const dealIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "ID de oportunidad inválido.")
