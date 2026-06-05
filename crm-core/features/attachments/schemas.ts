import { z } from "zod";
import { dealIdSchema } from "@/lib/schemas/deal-id";

export const ConfirmUploadSchema = z.object({
  dealId: dealIdSchema.optional(),
  clientId: z.string().cuid().optional(),
  key: z.string().min(1),
  url: z.string().url(),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
});

export const DeleteAttachmentSchema = z.object({
  id: z.string().cuid(),
});
