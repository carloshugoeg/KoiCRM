import { prisma } from "@/lib/db/client"
import { withTenant } from "@/lib/db/rls"

export interface NoteEntry {
  id: string
  text: string
  createdAt: Date
  createdById: string | null
  authorName: string | null
}

export async function getDealNotes(tenantId: string, dealId: string): Promise<NoteEntry[]> {
  const notes = await withTenant(tenantId, (tx) =>
    tx.note.findMany({
      where: { tenantId, dealId },
      orderBy: { createdAt: "desc" },
    })
  )

  // Resolve author names in a single query
  const authorIds = [...new Set(notes.map((n) => n.createdById).filter(Boolean))] as string[]
  const users =
    authorIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true } })
      : []
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]))

  return notes.map((n) => ({
    id: n.id,
    text: n.text,
    createdAt: n.createdAt,
    createdById: n.createdById,
    authorName: n.createdById ? (userMap[n.createdById] ?? null) : null,
  }))
}

export async function getClientNotes(tenantId: string, clientId: string): Promise<NoteEntry[]> {
  const notes = await withTenant(tenantId, (tx) =>
    tx.note.findMany({
      where: { tenantId, clientId },
      orderBy: { createdAt: "desc" },
    })
  )

  const authorIds = [...new Set(notes.map((n) => n.createdById).filter(Boolean))] as string[]
  const users =
    authorIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true } })
      : []
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]))

  return notes.map((n) => ({
    id: n.id,
    text: n.text,
    createdAt: n.createdAt,
    createdById: n.createdById,
    authorName: n.createdById ? (userMap[n.createdById] ?? null) : null,
  }))
}
