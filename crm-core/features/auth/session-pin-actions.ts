"use server"

import { z } from "zod"
import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/client"
import { hashActionPin, isValidPinFormat } from "@/lib/auth/action-pin-token"
import { clearActorUnlockCookie } from "@/lib/auth/session-pin-lock"
import { getSessionPinLockState, setSessionPinLock } from "@/lib/auth/session-pin-lock"

const toggleSchema = z.object({
  tenantId: z.string().min(1),
  enable: z.boolean(),
  pin: z.string().regex(/^\d{4}$/, "El PIN debe tener 4 dígitos."),
})

export async function getSessionPinLockStatusAction(tenantId: string): Promise<{
  locked: boolean
  hasPin: boolean
}> {
  const session = await auth()
  if (!session?.user?.id) return { locked: false, hasPin: false }

  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
    select: { actionPinHash: true },
  })

  return {
    locked: getSessionPinLockState(session.user.id, tenantId),
    hasPin: !!membership?.actionPinHash,
  }
}

/** Enable or disable personal session PIN lock. Always verifies the logged-in user's PIN. */
export async function toggleSessionPinLockAction(
  raw: unknown,
): Promise<{ ok: boolean; locked?: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = toggleSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, enable, pin } = parsed.data

  if (!isValidPinFormat(pin)) return { ok: false, error: "El PIN debe tener 4 dígitos." }

  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
    select: { actionPinHash: true, status: true },
  })

  if (!membership || membership.status !== "ACTIVE") {
    return { ok: false, error: "Acceso denegado." }
  }

  if (!membership.actionPinHash) {
    return {
      ok: false,
      error: "No tienes PIN configurado. Pide a un administrador que te asigne uno en Configuración → Usuarios.",
    }
  }

  if (membership.actionPinHash !== hashActionPin(pin)) {
    return { ok: false, error: "PIN inválido." }
  }

  setSessionPinLock(session.user.id, tenantId, enable)
  clearActorUnlockCookie()

  return { ok: true, locked: enable }
}
