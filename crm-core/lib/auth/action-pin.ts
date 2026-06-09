import "server-only"
import { cookies } from "next/headers"
import type { Role } from "@prisma/client"
import { prisma } from "@/lib/db/client"
import { auth } from "@/lib/auth/auth"
import { getUserRole } from "@/lib/auth/rbac"
import {
  hashActionPin,
  isValidPinFormat,
  signActorToken,
  readActorToken,
  actorTokenIsFresh,
} from "@/lib/auth/action-pin-token"

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

/**
 * Resolve WHO is performing a sensitive deal write. With the PIN feature enabled the
 * author is whoever owns the entered PIN (or an unexpired unlock cookie) — NOT necessarily
 * the logged-in account — so shared devices/accounts stay individually accountable.
 *
 * Returns `requiresPin: true` when the client must collect a PIN before retrying.
 * Capability checks (edit/archive/delete) must use the returned `actorRole`, not the session.
 */
export async function resolveActionActor(params: {
  tenantId: string
  pin?: string | null
}): Promise<ResolveActorResult> {
  const { tenantId } = params
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { pinEnabled: true, pinUnlockWindowSeconds: true },
  })

  // Feature off → the logged-in user is the author (legacy behaviour, safe rollout).
  if (!settings?.pinEnabled) {
    const role = await getUserRole(session, tenantId)
    if (!role) return { ok: false, error: "Acceso denegado." }
    return {
      ok: true,
      actor: { actorUserId: session.user.id, actorName: session.user.name ?? null, actorRole: role },
    }
  }

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
    setUnlockCookie(membership.userId, tenantId, settings.pinUnlockWindowSeconds)
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
