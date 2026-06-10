import "server-only"
import { cookies } from "next/headers"
import type { Role } from "@prisma/client"
import { prisma } from "@/lib/db/client"
import { withTenant } from "@/lib/db/rls"
import { auth } from "@/lib/auth/auth"
import { getUserRole } from "@/lib/auth/rbac"
import { isSessionPinLocked } from "@/lib/auth/session-pin-lock"
import {
  hashActionPin,
  isValidPinFormat,
  signActorToken,
  readActorToken,
  actorTokenIsFresh,
} from "@/lib/auth/action-pin-token"
import { isPinRequiredForDealAction } from "@/lib/auth/action-pin-policy"

export { isPinRequiredForDealAction } from "@/lib/auth/action-pin-policy"

const COOKIE_NAME = "koi_pin_actor"

export interface ActionActor {
  actorUserId: string
  actorName: string | null
  actorRole: Role
}

export type ResolveActorResult =
  | { ok: true; actor: ActionActor }
  | { ok: false; requiresPin?: boolean; error?: string }

function setUnlockCookie(actorUserId: string, tenantId: string, windowSeconds: number) {
  const exp = Math.floor(Date.now() / 1000) + windowSeconds
  cookies().set(COOKIE_NAME, signActorToken({ uid: actorUserId, t: tenantId, exp }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: windowSeconds,
  })
}

async function resolveDealOwnerId(
  tenantId: string,
  dealId?: string | null,
  targetOwnerId?: string | null,
): Promise<string | null | undefined> {
  if (targetOwnerId) return targetOwnerId
  if (!dealId) return null
  // Deal has RLS — bare prisma runs as app_user without app.tenant_id set and
  // returns null, which would force a PIN even on the user's own leads. Read
  // through withTenant so the tenant context is established.
  const deal = await withTenant(tenantId, (tx) =>
    tx.deal.findUnique({ where: { id: dealId, tenantId }, select: { ownerId: true } }),
  )
  return deal?.ownerId ?? null
}

/**
 * Resolve WHO is performing a sensitive deal write. When PIN is required the author is
 * whoever owns the entered PIN (or an unexpired unlock cookie) — NOT necessarily the
 * logged-in account — so shared devices/accounts stay individually accountable.
 *
 * Pass `dealId` for mutations on an existing deal, or `targetOwnerId` when creating one.
 *
 * Returns `requiresPin: true` when the client must collect a PIN before retrying.
 * Capability checks (edit/archive/delete) must use the returned `actorRole`, not the session.
 */
export async function resolveActionActor(params: {
  tenantId: string
  pin?: string | null
  dealId?: string | null
  targetOwnerId?: string | null
}): Promise<ResolveActorResult> {
  const { tenantId, dealId, targetOwnerId } = params
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { pinEnabled: true, pinUnlockWindowSeconds: true },
  })

  const pinEnabled = settings?.pinEnabled ?? false
  const sessionLocked = isSessionPinLocked(session.user.id, tenantId)
  const dealOwnerId = await resolveDealOwnerId(tenantId, dealId, targetOwnerId)
  const pinRequired = isPinRequiredForDealAction({
    pinEnabled,
    sessionLocked,
    sessionUserId: session.user.id,
    dealOwnerId,
  })

  // No PIN required — the logged-in user is the author and accountable for changes.
  if (!pinRequired) {
    const role = await getUserRole(session, tenantId)
    if (!role) return { ok: false, error: "Acceso denegado." }
    return {
      ok: true,
      actor: { actorUserId: session.user.id, actorName: session.user.name ?? null, actorRole: role },
    }
  }

  const unlockWindowSeconds = settings?.pinUnlockWindowSeconds ?? 300

  // 1) A freshly entered PIN identifies the author and (re)opens the unlock window.
  const pin = params.pin?.trim()
  if (pin) {
    // requiresPin on an invalid PIN so the client keeps the dialog open to retry.
    if (!isValidPinFormat(pin)) return { ok: false, requiresPin: true, error: "El PIN debe tener 4 dígitos." }
    const membership = await prisma.membership.findFirst({
      where: { tenantId, status: "ACTIVE", actionPinHash: hashActionPin(pin) },
      select: { userId: true, role: true, user: { select: { name: true } } },
    })
    if (!membership) return { ok: false, requiresPin: true, error: "PIN inválido." }
    setUnlockCookie(membership.userId, tenantId, unlockWindowSeconds)
    return {
      ok: true,
      actor: { actorUserId: membership.userId, actorName: membership.user.name, actorRole: membership.role },
    }
  }

  // 2) No PIN: an unexpired unlock cookie keeps the same author active for the window.
  const token = readActorToken(cookies().get(COOKIE_NAME)?.value)
  if (token && actorTokenIsFresh(token, tenantId)) {
    const membership = await prisma.membership.findUnique({
      where: { userId_tenantId: { userId: token.uid, tenantId } },
      select: { userId: true, role: true, status: true, user: { select: { name: true } } },
    })
    if (membership && membership.status === "ACTIVE") {
      return {
        ok: true,
        actor: { actorUserId: membership.userId, actorName: membership.user.name, actorRole: membership.role },
      }
    }
  }

  // 3) Otherwise the client must collect a PIN.
  return { ok: false, requiresPin: true }
}
