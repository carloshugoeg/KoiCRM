import type { prisma } from "@/lib/db/client"

export interface StageConfig {
  key: string
  label: string
  sublabel?: string
  color: string
  iconKey: string
  order: number
  locked?: boolean
  requiresQuote?: boolean
  requiresPayment?: boolean
}

export interface CatalogItemConfig {
  catalogKey: string
  key: string
  label: string
  color?: string
  order: number
}

export interface IndustryConfig {
  slug: string
  name: string
  stages: StageConfig[]
  catalogItems: CatalogItemConfig[]
}

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const AQUASISTEMAS: IndustryConfig = {
  slug: "aquasistemas",
  name: "Sistemas de agua y piscinas",
  stages: [
    { key: "nuevo",        label: "Nuevo",              color: "#6366f1", iconKey: "circle",       order: 0, requiresQuote: false, requiresPayment: false },
    { key: "contactado",   label: "Contactado",          color: "#f59e0b", iconKey: "phone",        order: 1, requiresQuote: true, requiresPayment: false },
    { key: "propuesta",    label: "Propuesta enviada",   color: "#3b82f6", iconKey: "file-text",    order: 2, requiresQuote: true, requiresPayment: false },
    { key: "negociacion",  label: "En negociación",      color: "#8b5cf6", iconKey: "handshake",    order: 3, requiresQuote: true, requiresPayment: false },
    { key: "ganado",       label: "Ganado",              color: "#22c55e", iconKey: "check-circle", order: 4, locked: true, requiresQuote: true, requiresPayment: true },
    { key: "perdido",      label: "Perdido",             color: "#ef4444", iconKey: "x-circle",     order: 5, locked: true, requiresQuote: false, requiresPayment: false },
  ],
  catalogItems: [
    { catalogKey: "channel", key: "whatsapp", label: "WhatsApp",  color: "#22c55e", order: 0 },
    { catalogKey: "channel", key: "referral", label: "Referido",  color: "#6366f1", order: 1 },
    { catalogKey: "channel", key: "web",      label: "Web",       color: "#3b82f6", order: 2 },
    { catalogKey: "channel", key: "phone",    label: "Teléfono",  color: "#f59e0b", order: 3 },
    { catalogKey: "status",  key: "active",   label: "Activo",    color: "#22c55e", order: 0 },
    { catalogKey: "status",  key: "on_hold",  label: "En espera", color: "#f59e0b", order: 1 },
    { catalogKey: "status",  key: "closed",   label: "Cerrado",   color: "#6b7280", order: 2 },
  ],
}

export const INDUSTRY_REGISTRY: Record<string, IndustryConfig> = {
  aquasistemas: AQUASISTEMAS,
}

export function getIndustry(slug: string): IndustryConfig | undefined {
  return INDUSTRY_REGISTRY[slug]
}

export function listIndustries(): Pick<IndustryConfig, "slug" | "name">[] {
  return Object.values(INDUSTRY_REGISTRY).map(({ slug, name }) => ({ slug, name }))
}

export async function applyIndustryTemplate(
  tenantId: string,
  industrySlug: string,
  tx: PrismaTx,
): Promise<void> {
  const config = getIndustry(industrySlug)
  if (!config) throw new Error(`Unknown industry: ${industrySlug}`)

  const pipeline = await tx.pipeline.create({
    data: {
      tenantId,
      name: "Pipeline principal",
      isDefault: true,
      stages: {
        create: config.stages.map((s) => ({
          tenantId,
          key: s.key,
          label: s.label,
          sublabel: s.sublabel ?? null,
          color: s.color,
          iconKey: s.iconKey,
          order: s.order,
          locked: s.locked ?? false,
          requiresQuote: s.requiresQuote ?? false,
          requiresPayment: s.requiresPayment ?? false,
        })),
      },
    },
  })

  if (config.catalogItems.length > 0) {
    await tx.catalogItem.createMany({
      data: config.catalogItems.map((c) => ({
        tenantId,
        catalogKey: c.catalogKey,
        key: c.key,
        label: c.label,
        color: c.color ?? null,
        order: c.order,
      })),
    })
  }

  await tx.tenantSettings.upsert({
    where:  { tenantId },
    create: { tenantId, defaultPipelineId: pipeline.id },
    update: { defaultPipelineId: pipeline.id },
  })
}
