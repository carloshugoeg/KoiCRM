import { z } from "zod"

export const pipelineFiltersSchema = z.object({
  owner: z.string().optional(),
  channel: z.string().optional(),
  equipment: z.string().optional(),
  alerts: z.enum(["missingQuote", "missingPayment", "overdueFollowUp"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

export type PipelineFiltersParams = z.infer<typeof pipelineFiltersSchema>

export const updateStageSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  id: z.string().min(1),
  label: z.string().min(1).max(60),
  sublabel: z.string().max(60).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido"),
  iconKey: z.string().min(1).max(30),
})

export const reorderStagesSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  pipelineId: z.string().min(1),
  orderedIds: z.array(z.string()),
})

export const deleteStageSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  id: z.string().min(1),
})

export const createStageSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  pipelineId: z.string().min(1),
  label: z.string().min(1).max(60),
  sublabel: z.string().max(60).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido"),
  iconKey: z.string().min(1).max(30),
})
