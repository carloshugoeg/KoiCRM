"use server"

import { auth } from "@/lib/auth/auth"
import { withTenant } from "@/lib/db/rls"
import { requireRole } from "@/lib/auth/rbac"

export interface SearchResult {
  type: "deal" | "client"
  id: string
  title: string
  subtitle: string | null
}

export async function globalSearchAction(
  tenantId: string,
  query: string,
): Promise<{ ok: boolean; results?: SearchResult[]; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN", "MEMBER", "VIEWER"])
  } catch {
    return { ok: false, error: "Acceso denegado." }
  }

  const q = query.trim()
  if (!q) return { ok: true, results: [] }

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
          ],
        },
        select: { id: true, name: true, company: true, stage: { select: { label: true } } },
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
          ],
        },
        select: { id: true, name: true, company: true },
        take: 10,
      }),
    ),
  ])

  const results: SearchResult[] = [
    ...deals.map((d) => ({
      type: "deal" as const,
      id: d.id,
      title: d.name,
      subtitle: d.company ?? d.stage.label,
    })),
    ...clients.map((c) => ({
      type: "client" as const,
      id: c.id,
      title: c.name,
      subtitle: c.company,
    })),
  ]

  return { ok: true, results }
}
