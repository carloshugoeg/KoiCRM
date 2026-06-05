"use server"

import crypto from "crypto"
import { z } from "zod"
import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/client"
import { buildJoinLinkUrl } from "@/lib/tenant/join-link-url"

const JOIN_LINK_TTL_MS = 90 * 24 * 60 * 60 * 1000

function randomToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

async function requireCanManageJoinLinks(
  userId: string,
  tenantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const caller = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    select: { role: true },
  })
  if (!caller || !["OWNER", "ADMIN"].includes(caller.role)) {
    return { ok: false, error: "Sin permisos para gestionar enlaces de unión." }
  }
  return { ok: true }
}

const createJoinLinkSchema = z.object({
  tenantId: z.string().cuid(),
  role: z.enum(["ADMIN", "SUPERVISOR", "MEMBER", "VIEWER"]),
  label: z.string().max(80).optional(),
})

export async function createJoinLinkAction(
  raw: unknown,
): Promise<{ ok: boolean; error?: string; link?: { id: string; url: string; role: string } }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = createJoinLinkSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, role, label } = parsed.data
  const guard = await requireCanManageJoinLinks(session.user.id, tenantId)
  if (!guard.ok) return guard

  const token = randomToken()
  const link = await prisma.joinLink.create({
    data: {
      tenantId,
      token,
      role,
      label: label?.trim() || null,
      expiresAt: new Date(Date.now() + JOIN_LINK_TTL_MS),
    },
    select: { id: true, token: true, role: true },
  })

  return {
    ok: true,
    link: { id: link.id, url: buildJoinLinkUrl(link.token), role: link.role },
  }
}

const updateJoinLinkSchema = z.object({
  tenantId: z.string().cuid(),
  joinLinkId: z.string().cuid(),
  role: z.enum(["ADMIN", "SUPERVISOR", "MEMBER", "VIEWER"]).optional(),
  label: z.string().max(80).nullable().optional(),
  extendExpiry: z.boolean().optional(),
})

export async function updateJoinLinkAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = updateJoinLinkSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, joinLinkId, role, label, extendExpiry } = parsed.data
  const guard = await requireCanManageJoinLinks(session.user.id, tenantId)
  if (!guard.ok) return guard

  const existing = await prisma.joinLink.findFirst({
    where: { id: joinLinkId, tenantId, revokedAt: null },
  })
  if (!existing) return { ok: false, error: "Enlace no encontrado o revocado." }

  const data: {
    role?: typeof role
    label?: string | null
    expiresAt?: Date
  } = {}
  if (role !== undefined) data.role = role
  if (label !== undefined) data.label = label?.trim() || null
  if (extendExpiry) data.expiresAt = new Date(Date.now() + JOIN_LINK_TTL_MS)

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "Nada que actualizar." }
  }

  await prisma.joinLink.update({ where: { id: joinLinkId }, data })
  return { ok: true }
}

const revokeJoinLinkSchema = z.object({
  tenantId: z.string().cuid(),
  joinLinkId: z.string().cuid(),
})

export async function revokeJoinLinkAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = revokeJoinLinkSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, joinLinkId } = parsed.data
  const guard = await requireCanManageJoinLinks(session.user.id, tenantId)
  if (!guard.ok) return guard

  const updated = await prisma.joinLink.updateMany({
    where: { id: joinLinkId, tenantId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  if (updated.count === 0) return { ok: false, error: "Enlace no encontrado o ya revocado." }
  return { ok: true }
}
