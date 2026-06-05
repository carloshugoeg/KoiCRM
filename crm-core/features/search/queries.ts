import { withTenant } from "@/lib/db/rls"
import { formatCurrency, type IntlSettings } from "@/lib/intl/format"
import { prisma } from "@/lib/db/client"

export type SearchMatchVia =
  | "name"
  | "company"
  | "phone"
  | "id"
  | "quote"
  | "payment"

export interface SearchResultMeta {
  company: string | null
  phone: string | null
  value: number | null
  valueFormatted: string | null
  stageLabel: string | null
  ownerName: string | null
  dealCount?: number
  matchedVia?: SearchMatchVia
  matchedQuoteNumber?: string
  matchedPaymentNumber?: string
}

export interface SearchResult {
  type: "deal" | "client"
  id: string
  title: string
  subtitle: string | null
  meta: SearchResultMeta
}

const DEFAULT_INTL: IntlSettings = {
  locale: "es-GT",
  currency: "GTQ",
  timezone: "America/Guatemala",
}

function detectDealMatchVia(
  q: string,
  deal: {
    id: string
    name: string
    company: string | null
    phone: string | null
    quotes: { number: string }[]
    payments: { number: string }[]
  },
): SearchMatchVia {
  const lower = q.toLowerCase()
  if (deal.id.toLowerCase().includes(lower)) return "id"
  if (deal.quotes.some((x) => x.number.toLowerCase().includes(lower))) return "quote"
  if (deal.payments.some((x) => x.number.toLowerCase().includes(lower))) return "payment"
  if (deal.phone?.toLowerCase().includes(lower)) return "phone"
  if (deal.company?.toLowerCase().includes(lower)) return "company"
  return "name"
}

export async function getSearchIntlSettings(tenantId: string): Promise<IntlSettings> {
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } })
  return {
    locale: settings?.locale ?? DEFAULT_INTL.locale,
    currency: settings?.currency ?? DEFAULT_INTL.currency,
    timezone: settings?.timezone ?? DEFAULT_INTL.timezone,
  }
}

export async function globalSearch(
  tenantId: string,
  query: string,
  intl: IntlSettings = DEFAULT_INTL,
  visibleToUserId?: string,
): Promise<SearchResult[]> {
  const q = query.trim().slice(0, 200)
  if (!q) return []

  const [deals, clients] = await Promise.all([
    withTenant(tenantId, (tx) =>
      tx.deal.findMany({
        where: {
          tenantId,
          isArchived: false,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { id: { contains: q, mode: "insensitive" } },
            {
              client: {
                OR: [
                  { phone: { contains: q, mode: "insensitive" } },
                  { whatsapp: { contains: q, mode: "insensitive" } },
                ],
              },
            },
            {
              quotes: {
                some: {
                  isVoid: false,
                  number: { contains: q, mode: "insensitive" },
                },
              },
            },
            {
              payments: {
                some: {
                  isVoid: false,
                  number: { contains: q, mode: "insensitive" },
                },
              },
            },
          ],
          // Asesores only match their own deals (or those ceded to them).
          ...(visibleToUserId
            ? { AND: [{ OR: [{ ownerId: visibleToUserId }, { viewers: { some: { userId: visibleToUserId } } }] }] }
            : {}),
        },
        select: {
          id: true,
          name: true,
          company: true,
          phone: true,
          value: true,
          stage: { select: { label: true } },
          owner: { select: { name: true } },
          client: { select: { phone: true, whatsapp: true } },
          quotes: {
            where: { isVoid: false, number: { contains: q, mode: "insensitive" } },
            select: { number: true },
            take: 1,
          },
          payments: {
            where: { isVoid: false, number: { contains: q, mode: "insensitive" } },
            select: { number: true },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
    ),
    withTenant(tenantId, (tx) =>
      tx.client.findMany({
        where: {
          tenantId,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { whatsapp: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          company: true,
          phone: true,
          whatsapp: true,
          _count: { select: { deals: true } },
        },
        orderBy: { name: "asc" },
        take: 10,
      }),
    ),
  ])

  const dealResults: SearchResult[] = deals.map((d) => {
    const matchedVia = detectDealMatchVia(q, {
      id: d.id,
      name: d.name,
      company: d.company,
      phone: d.phone ?? d.client?.phone ?? d.client?.whatsapp ?? null,
      quotes: d.quotes,
      payments: d.payments,
    })
    const value = Number(d.value)
    const phone = d.phone ?? d.client?.phone ?? d.client?.whatsapp ?? null

    return {
      type: "deal" as const,
      id: d.id,
      title: d.name,
      subtitle: d.company ?? d.stage.label,
      meta: {
        company: d.company,
        phone,
        value,
        valueFormatted: formatCurrency(value, intl),
        stageLabel: d.stage.label,
        ownerName: d.owner.name,
        matchedVia,
        matchedQuoteNumber: d.quotes[0]?.number,
        matchedPaymentNumber: d.payments[0]?.number,
      },
    }
  })

  const clientResults: SearchResult[] = clients.map((c) => ({
    type: "client" as const,
    id: c.id,
    title: c.name,
    subtitle: c.company,
    meta: {
      company: c.company,
      phone: c.phone ?? c.whatsapp,
      value: null,
      valueFormatted: null,
      stageLabel: null,
      ownerName: null,
      dealCount: c._count.deals,
    },
  }))

  return [...dealResults, ...clientResults]
}
