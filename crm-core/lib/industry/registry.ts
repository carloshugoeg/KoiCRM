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

export interface SettingsConfig {
  dealIdPrefix?: string
  locale?: string
  currency?: string
  timezone?: string
}

export interface BrandingConfig {
  primaryColor?: string
  bgColorLight?: string
  bgColorDark?: string
  headerBgColor?: string
  kpiBgColor?: string
  productName?: string
}

export interface IndustryConfig {
  slug: string
  name: string
  stages: StageConfig[]
  catalogItems: CatalogItemConfig[]
  settings?: SettingsConfig
  branding?: BrandingConfig
}

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const AQUASISTEMAS: IndustryConfig = {
  slug: "aquasistemas",
  name: "Aquasistemas (Guatemala)",
  stages: [
    { key: "prospecto",   label: "Prospecto",       color: "#6366f1", iconKey: "circle",       order: 0 },
    { key: "contactado",  label: "Contactado",       color: "#f59e0b", iconKey: "phone",        order: 1 },
    { key: "cotizacion",  label: "Cotización",       color: "#3b82f6", iconKey: "file-text",    order: 2, requiresQuote: true },
    { key: "negociacion", label: "En negociación",   color: "#8b5cf6", iconKey: "handshake",    order: 3, requiresQuote: true },
    { key: "ganado",      label: "Ganado",           color: "#22c55e", iconKey: "check-circle", order: 4, locked: true, requiresQuote: true, requiresPayment: true },
    { key: "perdido",     label: "Perdido",          color: "#ef4444", iconKey: "x-circle",     order: 5, locked: true },
  ],
  catalogItems: [
    // Equipment (8)
    { catalogKey: "equipment", key: "bomba",            label: "Bomba",            order: 0 },
    { catalogKey: "equipment", key: "jacuzzi",          label: "Jacuzzi",          order: 1 },
    { catalogKey: "equipment", key: "sauna",            label: "Sauna",            order: 2 },
    { catalogKey: "equipment", key: "calentador",       label: "Calentador",       order: 3 },
    { catalogKey: "equipment", key: "filtro",           label: "Filtro",           order: 4 },
    { catalogKey: "equipment", key: "hidrojet",         label: "Hidrojet",         order: 5 },
    { catalogKey: "equipment", key: "servicio_tecnico", label: "Servicio Técnico", order: 6 },
    { catalogKey: "equipment", key: "iluminacion",      label: "Iluminación",      order: 7 },
    // Sales channels (5)
    { catalogKey: "salesChannel", key: "sala",      label: "Sala",      color: "#6366f1", order: 0 },
    { catalogKey: "salesChannel", key: "telefono",  label: "Teléfono",  color: "#f59e0b", order: 1 },
    { catalogKey: "salesChannel", key: "whatsapp",  label: "WhatsApp",  color: "#22c55e", order: 2 },
    { catalogKey: "salesChannel", key: "facebook",  label: "Facebook",  color: "#3b82f6", order: 3 },
    { catalogKey: "salesChannel", key: "instagram", label: "Instagram", color: "#ec4899", order: 4 },
    // Deal statuses (5)
    { catalogKey: "dealStatus", key: "activo",      label: "Activo",      color: "#22c55e", order: 0 },
    { catalogKey: "dealStatus", key: "seguimiento", label: "Seguimiento", color: "#f59e0b", order: 1 },
    { catalogKey: "dealStatus", key: "esperando",   label: "Esperando",   color: "#6366f1", order: 2 },
    { catalogKey: "dealStatus", key: "frio",        label: "Frío",        color: "#6b7280", order: 3 },
    { catalogKey: "dealStatus", key: "urgente",     label: "Urgente",     color: "#ef4444", order: 4 },
  ],
  settings: {
    dealIdPrefix: "AQX",
    locale: "es-GT",
    currency: "GTQ",
    timezone: "America/Guatemala",
  },
  branding: {
    primaryColor: "#0ea5e9",
    productName: "KoiCRM",
  },
}

const GENERIC: IndustryConfig = {
  slug: "generic",
  name: "Genérico",
  stages: [
    { key: "prospecto", label: "Prospecto", color: "#6366f1", iconKey: "circle", order: 0 },
    { key: "contactado", label: "Contactado", color: "#f59e0b", iconKey: "phone", order: 1 },
    {
      key: "cotizacion",
      label: "Cotización",
      color: "#3b82f6",
      iconKey: "file-text",
      order: 2,
      requiresQuote: true,
    },
    {
      key: "negociacion",
      label: "En negociación",
      color: "#8b5cf6",
      iconKey: "handshake",
      order: 3,
      requiresQuote: true,
    },
    {
      key: "ganado",
      label: "Ganado",
      color: "#22c55e",
      iconKey: "check-circle",
      order: 4,
      locked: true,
      requiresQuote: true,
      requiresPayment: true,
    },
    { key: "perdido", label: "Perdido", color: "#ef4444", iconKey: "x-circle", order: 5, locked: true },
  ],
  catalogItems: [
    { catalogKey: "salesChannel", key: "sala", label: "Sala", color: "#6366f1", order: 0 },
    { catalogKey: "salesChannel", key: "telefono", label: "Teléfono", color: "#f59e0b", order: 1 },
    { catalogKey: "salesChannel", key: "whatsapp", label: "WhatsApp", color: "#22c55e", order: 2 },
    { catalogKey: "salesChannel", key: "facebook", label: "Facebook", color: "#3b82f6", order: 3 },
    { catalogKey: "salesChannel", key: "instagram", label: "Instagram", color: "#ec4899", order: 4 },
    { catalogKey: "dealStatus", key: "activo", label: "Activo", color: "#22c55e", order: 0 },
    { catalogKey: "dealStatus", key: "seguimiento", label: "Seguimiento", color: "#f59e0b", order: 1 },
    { catalogKey: "dealStatus", key: "esperando", label: "Esperando", color: "#6366f1", order: 2 },
    { catalogKey: "dealStatus", key: "frio", label: "Frío", color: "#6b7280", order: 3 },
    { catalogKey: "dealStatus", key: "urgente", label: "Urgente", color: "#ef4444", order: 4 },
  ],
  settings: {
    dealIdPrefix: "TST",
    locale: "es-GT",
    currency: "GTQ",
    timezone: "America/Guatemala",
  },
  branding: {
    productName: "KoiCRM",
  },
}

export const INDUSTRY_REGISTRY: Record<string, IndustryConfig> = {
  generic: GENERIC,
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

  // Required for app_user (RLS): pipeline/catalog inserts are tenant-scoped.
  await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`

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
    create: {
      tenantId,
      defaultPipelineId: pipeline.id,
      ...(config.settings?.dealIdPrefix && { dealIdPrefix: config.settings.dealIdPrefix }),
      ...(config.settings?.locale       && { locale:       config.settings.locale }),
      ...(config.settings?.currency     && { currency:     config.settings.currency }),
      ...(config.settings?.timezone     && { timezone:     config.settings.timezone }),
    },
    update: {
      defaultPipelineId: pipeline.id,
      ...(config.settings?.dealIdPrefix && { dealIdPrefix: config.settings.dealIdPrefix }),
      ...(config.settings?.locale       && { locale:       config.settings.locale }),
      ...(config.settings?.currency     && { currency:     config.settings.currency }),
      ...(config.settings?.timezone     && { timezone:     config.settings.timezone }),
    },
  })

  if (config.branding) {
    await tx.tenantBranding.upsert({
      where:  { tenantId },
      create: { tenantId, ...config.branding },
      update: config.branding,
    })
  }
}
