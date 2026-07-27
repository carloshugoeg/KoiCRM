import { withTenant, type PrismaTx } from "@/lib/db/rls"
import type { Prisma } from "@prisma/client"
import { getCatalogItemsInTx, getEquipmentHierarchyInTx } from "@/features/catalogs/queries"
import { getDefaultPipeline } from "@/features/pipeline/queries"

export type ClientWithDealCount = Awaited<ReturnType<typeof listClients>>["items"][number]

/** Default page size for the bounded clients list (cursor pagination). */
export const CLIENTS_PAGE_SIZE = 50

/**
 * Detect-or-create a Client by name+company (case-insensitive).
 * Must run inside a withTenant() transaction — takes tx directly.
 */
export async function findOrCreateClient(
  tx: PrismaTx,
  tenantId: string,
  input: {
    name: string
    company?: string | null
    phone?: string | null
    whatsapp?: string | null
    email?: string | null
  }
) {
  const name = input.name.trim()
  const company = input.company?.trim() || null

  // Case-insensitive look-up first
  const existing = await tx.client.findFirst({
    where: {
      tenantId,
      name: { equals: name, mode: "insensitive" },
      company: company ? { equals: company, mode: "insensitive" } : null,
    },
  })
  if (existing) return existing

  return tx.client.create({
    data: {
      tenantId,
      name,
      company,
      phone: input.phone?.trim() || null,
      whatsapp: input.whatsapp?.trim() || null,
      email: input.email?.trim() || null,
    },
  })
}

export async function getClient(tenantId: string, clientId: string) {
  return withTenant(tenantId, (tx) => tx.client.findUnique({ where: { id: clientId, tenantId } }))
}

/** Total client count for the tenant — used for the nav badge (mirrors demo "Clientes N"). */
export async function countClientsInTx(tx: PrismaTx, tenantId: string) {
  return tx.client.count({ where: { tenantId } })
}

export async function countClients(tenantId: string) {
  return withTenant(tenantId, (tx) => countClientsInTx(tx, tenantId))
}

export async function listClientsInTx(
  tx: PrismaTx,
  tenantId: string,
  opts: { search?: string; sort?: "name" | "recent"; cursor?: string; limit?: number } = {}
) {
  const { search, sort = "name", cursor, limit = CLIENTS_PAGE_SIZE } = opts

  const where: Prisma.ClientWhereInput = { tenantId }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ]
  }

  // Stable order for cursor paging: primary sort + id tiebreaker.
  const orderBy: Prisma.ClientOrderByWithRelationInput[] =
    sort === "name"
      ? [{ name: "asc" }, { id: "asc" }]
      : [{ updatedAt: "desc" }, { id: "asc" }]

  const clients = await tx.client.findMany({
    where,
    orderBy,
    include: {
      _count: {
        select: {
          deals: { where: { isArchived: false } },
        },
      },
    },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = clients.length > limit
  const items = hasMore ? clients.slice(0, limit) : clients
  const nextCursor = hasMore ? items[items.length - 1]!.id : null

  return { items, nextCursor }
}

export async function listClients(
  tenantId: string,
  opts: { search?: string; sort?: "name" | "recent"; cursor?: string; limit?: number } = {}
) {
  return withTenant(tenantId, (tx) => listClientsInTx(tx, tenantId, opts))
}

export async function getClientWithDealsInTx(tx: PrismaTx, tenantId: string, clientId: string) {
  return tx.client.findUnique({
    where: { id: clientId, tenantId },
    include: {
      deals: {
        where: { isArchived: false },
        include: {
          stage: true,
          owner: { select: { id: true, name: true, email: true } },
          equipment: true,
        },
        orderBy: { createdAt: "desc" },
      },
      clientNotes: {
        orderBy: { createdAt: "desc" },
      },
    },
  })
}

export async function getClientWithDeals(tenantId: string, clientId: string) {
  return withTenant(tenantId, (tx) => getClientWithDealsInTx(tx, tenantId, clientId))
}

export async function getClientKpisInTx(
  tx: PrismaTx,
  tenantId: string,
  clientId: string,
  dateRange?: { from: Date; to: Date }
) {
  const dateFilter = dateRange ? { createdAt: { gte: dateRange.from, lte: dateRange.to } } : {}

  const [allDeals, wonDeals] = await Promise.all([
    tx.deal.findMany({
      where: { tenantId, clientId, ...dateFilter },
      select: { id: true, isArchived: true, stage: { select: { key: true } }, value: true },
    }),
    tx.deal.findMany({
      where: { tenantId, clientId, stage: { key: "ganado" }, ...dateFilter },
      select: { value: true },
    }),
  ])

  const totalOpps = allDeals.length
  const activeOpps = allDeals.filter(
    (d) => !d.isArchived && d.stage.key !== "ganado" && d.stage.key !== "perdido"
  ).length
  const wonCount = wonDeals.length
  const totalValue = wonDeals.reduce((sum, d) => sum + Number(d.value), 0)

  return { totalOpps, activeOpps, wonCount, totalValue }
}

export async function getClientKpis(
  tenantId: string,
  clientId: string,
  dateRange?: { from: Date; to: Date }
) {
  return withTenant(tenantId, (tx) => getClientKpisInTx(tx, tenantId, clientId, dateRange))
}

/**
 * Every query the clients page needs, in one transaction.
 *
 * Previously the page opened six concurrent withTenant() transactions (plus two more when a
 * client was selected), each holding its own pooled connection for the life of the request.
 * Against the Supabase session pooler's shared 15-connection cap that starved the pool and
 * produced P2028 "Transaction already closed"/"Unable to start a transaction in the given
 * time". Mirrors loadPipelineKanbanData, which already had this shape.
 */
async function loadClientPageChromeInTx(tx: PrismaTx, tenantId: string) {
  const [pipeline, members, settings, channels, equipmentHierarchy, statuses] = await Promise.all([
    getDefaultPipeline(tx, tenantId),
    tx.membership.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    }),
    tx.tenantSettings.findUnique({ where: { tenantId } }),
    getCatalogItemsInTx(tx, tenantId, "salesChannel", true),
    getEquipmentHierarchyInTx(tx, tenantId, true),
    getCatalogItemsInTx(tx, tenantId, "dealStatus", true),
  ])
  return { pipeline, members, settings, channels, equipmentHierarchy, statuses }
}

// Matches loadPipelineKanbanData: pooler latency can exceed Prisma's 5s default.
const CLIENTS_TX_TIMEOUT_MS = 30_000

export async function loadClientsPageData(
  tenantId: string,
  opts: {
    search?: string
    sort?: "name" | "recent"
    cursor?: string
    selectedClientId?: string
  },
) {
  return withTenant(
    tenantId,
    async (tx) => {
      const [chrome, clientList] = await Promise.all([
        loadClientPageChromeInTx(tx, tenantId),
        listClientsInTx(tx, tenantId, {
          search: opts.search,
          sort: opts.sort,
          cursor: opts.cursor,
        }),
      ])

      const selected = opts.selectedClientId
        ? await Promise.all([
            getClientWithDealsInTx(tx, tenantId, opts.selectedClientId),
            getClientKpisInTx(tx, tenantId, opts.selectedClientId),
          ])
        : null

      return {
        ...chrome,
        clients: clientList.items,
        nextCursor: clientList.nextCursor,
        selectedClient: selected?.[0] ?? null,
        selectedClientKpis: selected?.[1] ?? null,
      }
    },
    { timeout: CLIENTS_TX_TIMEOUT_MS },
  )
}

/** Same chrome as the clients list page, for the standalone client detail route. */
export async function loadClientDetailPageData(tenantId: string, clientId: string) {
  return withTenant(
    tenantId,
    async (tx) => {
      const [chrome, client, kpis] = await Promise.all([
        loadClientPageChromeInTx(tx, tenantId),
        getClientWithDealsInTx(tx, tenantId, clientId),
        getClientKpisInTx(tx, tenantId, clientId),
      ])
      return { ...chrome, client, kpis }
    },
    { timeout: CLIENTS_TX_TIMEOUT_MS },
  )
}
