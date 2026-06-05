"use server"

import crypto from "crypto"
import { z } from "zod"
import { headers } from "next/headers"
import { prisma } from "@/lib/db/client"
import { withTenant } from "@/lib/db/rls"
import { recordActivity } from "@/features/activity/queries"
import { hashPassword } from "@/lib/auth/password"
import { sendEmail, buildVerificationEmail, buildPasswordResetEmail, buildInvitationEmail } from "@/lib/email/resend"
import { rateLimit } from "@/lib/auth/rate-limit"
import { auth } from "@/lib/auth/auth"

const VERIFY_WINDOW_MS = 24 * 60 * 60 * 1000
const RESET_WINDOW_MS = 60 * 60 * 1000

function baseUrl(): string {
  return process.env.AUTH_URL ?? "http://localhost:3000"
}

function randomToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

function getClientIp(): string {
  const h = headers()
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown"
}

// ─── Signup ──────────────────────────────────────────────────────────────────

const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
})

export async function signupAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const ip = getClientIp()
  if (!await rateLimit(`signup:ip:${ip}`, 10, 60_000)) {
    return { ok: false, error: "Demasiados intentos. Intenta más tarde." }
  }

  const parsed = signupSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { name, email, password } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return { ok: true }

  const hashed = await hashPassword(password)
  await prisma.user.create({ data: { name, email, password: hashed } })

  const token = randomToken()
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires: new Date(Date.now() + VERIFY_WINDOW_MS),
    },
  })

  const url = `${baseUrl()}/api/auth/verify?token=${token}&email=${encodeURIComponent(email)}`
  await sendEmail({
    to: email,
    subject: "Verifica tu correo — Koi CRM",
    html: buildVerificationEmail(url),
  })

  return { ok: true }
}

// ─── Forgot password ─────────────────────────────────────────────────────────

const forgotSchema = z.object({ email: z.string().email() })

export async function forgotPasswordAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const ip = getClientIp()
  if (!await rateLimit(`forgot:ip:${ip}`, 5, 60_000)) {
    return { ok: false, error: "Demasiados intentos. Intenta más tarde." }
  }

  const parsed = forgotSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { email } = parsed.data
  const user = await prisma.user.findUnique({ where: { email } })
  // Always return ok to avoid email enumeration
  if (!user) return { ok: true }

  await prisma.verificationToken.deleteMany({ where: { identifier: `reset:${email}` } })

  const token = randomToken()
  await prisma.verificationToken.create({
    data: {
      identifier: `reset:${email}`,
      token,
      expires: new Date(Date.now() + RESET_WINDOW_MS),
    },
  })

  const url = `${baseUrl()}/reset?token=${token}&email=${encodeURIComponent(email)}`
  await sendEmail({
    to: email,
    subject: "Restablece tu contraseña — Koi CRM",
    html: buildPasswordResetEmail(url),
  })

  return { ok: true }
}

// ─── Reset password ──────────────────────────────────────────────────────────

const resetSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  password: z.string().min(8).max(100),
})

export async function resetPasswordAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = resetSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { email, token, password } = parsed.data

  const record = await prisma.verificationToken.findUnique({ where: { token } })
  if (!record || record.identifier !== `reset:${email}` || record.expires < new Date()) {
    return { ok: false, error: "Enlace inválido o expirado." }
  }

  const hashed = await hashPassword(password)
  await prisma.$transaction([
    prisma.user.update({ where: { email }, data: { password: hashed } }),
    prisma.verificationToken.delete({ where: { token } }),
  ])

  return { ok: true }
}

// ─── Invite user ─────────────────────────────────────────────────────────────

const inviteSchema = z.object({
  tenantId: z.string().cuid(),
  email: z.string().email(),
  role: z.enum(["ADMIN", "SUPERVISOR", "MEMBER", "VIEWER"]),
})

export async function inviteUserAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = inviteSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, email, role } = parsed.data

  const caller = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
    select: { role: true },
  })
  if (!caller || !["OWNER", "ADMIN"].includes(caller.role)) {
    return { ok: false, error: "Sin permisos para invitar." }
  }

  const token = randomToken()
  try {
    await prisma.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({ where: { email } })
      if (targetUser) {
        const existing = await tx.membership.findUnique({
          where: { userId_tenantId: { userId: targetUser.id, tenantId } },
        })
        if (existing) throw new Error("ALREADY_MEMBER")
      }
      await tx.invitation.upsert({
        where: { tenantId_email: { tenantId, email } },
        create: { tenantId, email, role, token, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        update: { role, token, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), acceptedAt: null },
      })
    })
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_MEMBER") {
      return { ok: false, error: "El usuario ya es miembro." }
    }
    throw e
  }

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } })
  await sendEmail({
    to: email,
    subject: `Invitación a ${tenant.name} — Koi CRM`,
    html: buildInvitationEmail(`${baseUrl()}/api/invite/accept?token=${token}`, tenant.name),
  })

  return { ok: true }
}

// ─── Remove member ────────────────────────────────────────────────────────────

const removeMemberSchema = z.object({
  tenantId: z.string().cuid(),
  targetUserId: z.string().cuid(),
})

export async function removeMemberAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = removeMemberSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, targetUserId } = parsed.data

  if (targetUserId === session.user.id) return { ok: false, error: "No puedes removerte a ti mismo." }

  const [caller, target] = await Promise.all([
    prisma.membership.findUnique({ where: { userId_tenantId: { userId: session.user.id, tenantId } }, select: { role: true } }),
    prisma.membership.findUnique({ where: { userId_tenantId: { userId: targetUserId, tenantId } }, select: { role: true } }),
  ])

  if (!caller || !["OWNER", "ADMIN"].includes(caller.role)) return { ok: false, error: "Sin permisos." }
  if (!target) return { ok: false, error: "El usuario no es miembro." }
  if (target.role === "OWNER") return { ok: false, error: "No puedes remover al propietario." }
  if (target.role === "ADMIN" && caller.role !== "OWNER") {
    return { ok: false, error: "Solo el propietario puede remover a un administrador." }
  }

  await prisma.membership.delete({ where: { userId_tenantId: { userId: targetUserId, tenantId } } })
  return { ok: true }
}

// ─── Change member role ───────────────────────────────────────────────────────

const changeRoleSchema = z.object({
  tenantId: z.string().cuid(),
  targetUserId: z.string().cuid(),
  role: z.enum(["ADMIN", "SUPERVISOR", "MEMBER", "VIEWER"]),
})

export async function changeMemberRoleAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = changeRoleSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, targetUserId, role } = parsed.data

  if (targetUserId === session.user.id) {
    return { ok: false, error: "No puedes cambiar tu propio rol." }
  }

  const [caller, target] = await Promise.all([
    prisma.membership.findUnique({ where: { userId_tenantId: { userId: session.user.id, tenantId } }, select: { role: true } }),
    prisma.membership.findUnique({ where: { userId_tenantId: { userId: targetUserId, tenantId } } }),
  ])

  if (!caller || !["OWNER", "ADMIN"].includes(caller.role)) return { ok: false, error: "Sin permisos." }
  if (!target) return { ok: false, error: "El usuario no es miembro." }
  if (target.role === "OWNER") return { ok: false, error: "No puedes cambiar el rol del propietario." }

  await prisma.membership.update({
    where: { userId_tenantId: { userId: targetUserId, tenantId } },
    data: { role },
  })
  return { ok: true }
}

// ─── Update member profile ────────────────────────────────────────────────────

const updateMemberSchema = z.object({
  tenantId: z.string().cuid(),
  targetUserId: z.string().cuid(),
  name: z.string().min(2).max(100).optional(),
  image: z.string().max(500).nullable().optional(),
  role: z.enum(["ADMIN", "SUPERVISOR", "MEMBER", "VIEWER"]).optional(),
})

export async function updateMemberAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = updateMemberSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, targetUserId, name, image, role } = parsed.data
  const isSelf = session.user.id === targetUserId

  const [caller, target] = await Promise.all([
    prisma.membership.findUnique({
      where: { userId_tenantId: { userId: session.user.id, tenantId } },
      select: { role: true },
    }),
    prisma.membership.findUnique({
      where: { userId_tenantId: { userId: targetUserId, tenantId } },
      select: { role: true },
    }),
  ])

  if (!caller || !target) return { ok: false, error: "El usuario no es miembro." }
  if (target.role === "OWNER" && !isSelf) {
    return { ok: false, error: "No puedes editar al propietario." }
  }

  const canManage = ["OWNER", "ADMIN"].includes(caller.role)
  if (!isSelf && !canManage) return { ok: false, error: "Sin permisos." }

  if (role !== undefined) {
    if (isSelf) return { ok: false, error: "No puedes cambiar tu propio rol." }
    if (target.role === "OWNER") return { ok: false, error: "No puedes cambiar el rol del propietario." }
    if (!canManage) return { ok: false, error: "Sin permisos para cambiar rol." }
  }

  const userData: { name?: string; image?: string | null } = {}
  if (name !== undefined) userData.name = name
  if (image !== undefined) userData.image = image

  await prisma.$transaction(async (tx) => {
    if (Object.keys(userData).length > 0) {
      await tx.user.update({ where: { id: targetUserId }, data: userData })
    }
    if (role !== undefined) {
      await tx.membership.update({
        where: { userId_tenantId: { userId: targetUserId, tenantId } },
        data: { role },
      })
    }
  })

  return { ok: true }
}

// ─── Admin password reset ──────────────────────────────────────────────────────

const adminResetPasswordSchema = z.object({
  tenantId: z.string().cuid(),
  targetUserId: z.string().cuid(),
  newPassword: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(100),
})

/**
 * Superadmin-only password reset. Users cannot recover their own password beyond the
 * email self-service flow; a superadmin sets a temporary password directly.
 */
export async function adminResetPasswordAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = adminResetPasswordSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, targetUserId, newPassword } = parsed.data

  const [caller, target] = await Promise.all([
    prisma.membership.findUnique({ where: { userId_tenantId: { userId: session.user.id, tenantId } }, select: { role: true } }),
    prisma.membership.findUnique({ where: { userId_tenantId: { userId: targetUserId, tenantId } }, select: { role: true } }),
  ])

  if (!caller || !["OWNER", "ADMIN"].includes(caller.role)) return { ok: false, error: "Sin permisos." }
  if (!target) return { ok: false, error: "El usuario no es miembro." }

  const user = await prisma.user.findUnique({ where: { id: targetUserId }, select: { emailVerified: true } })
  const hashed = await hashPassword(newPassword)
  await prisma.user.update({
    where: { id: targetUserId },
    // Setting a password also verifies the account so the user can sign in immediately.
    data: { password: hashed, ...(user?.emailVerified ? {} : { emailVerified: new Date() }) },
  })

  return { ok: true }
}

// ─── Deactivate / reactivate member ─────────────────────────────────────────────

const deactivateMemberSchema = z.object({
  tenantId: z.string().cuid(),
  targetUserId: z.string().cuid(),
  reassignToUserId: z.string().cuid(),
})

/**
 * Deactivate an advisor (resignation / dismissal): the user stays in the system but can no
 * longer sign in, and all of their opportunities are reassigned to another active advisor.
 */
export async function deactivateMemberAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = deactivateMemberSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, targetUserId, reassignToUserId } = parsed.data

  if (targetUserId === session.user.id) return { ok: false, error: "No puedes darte de baja a ti mismo." }
  if (targetUserId === reassignToUserId) return { ok: false, error: "Elige un asesor distinto para reasignar las oportunidades." }

  const [caller, target, reassignTarget] = await Promise.all([
    prisma.membership.findUnique({ where: { userId_tenantId: { userId: session.user.id, tenantId } }, select: { role: true } }),
    prisma.membership.findUnique({ where: { userId_tenantId: { userId: targetUserId, tenantId } }, select: { role: true } }),
    prisma.membership.findUnique({ where: { userId_tenantId: { userId: reassignToUserId, tenantId } }, select: { status: true } }),
  ])

  if (!caller || !["OWNER", "ADMIN"].includes(caller.role)) return { ok: false, error: "Sin permisos." }
  if (!target) return { ok: false, error: "El usuario no es miembro." }
  if (target.role === "OWNER") return { ok: false, error: "No puedes dar de baja al propietario." }
  if (target.role === "ADMIN" && caller.role !== "OWNER") {
    return { ok: false, error: "Solo el propietario puede dar de baja a un administrador." }
  }
  if (!reassignTarget || reassignTarget.status !== "ACTIVE") {
    return { ok: false, error: "El asesor destino no es válido o está inactivo." }
  }

  // Reassign the deals under RLS, then deactivate the membership.
  await withTenant(tenantId, async (tx) => {
    const deals = await tx.deal.findMany({ where: { tenantId, ownerId: targetUserId }, select: { id: true } })
    if (deals.length > 0) {
      await tx.deal.updateMany({ where: { tenantId, ownerId: targetUserId }, data: { ownerId: reassignToUserId } })
      for (const d of deals) {
        await recordActivity(tx, {
          tenantId,
          entity: "Deal",
          entityId: d.id,
          type: "ownerChanged",
          payload: { from: targetUserId, to: reassignToUserId, reason: "deactivation" },
          userId: session.user!.id,
        })
      }
    }
  })

  await prisma.membership.update({
    where: { userId_tenantId: { userId: targetUserId, tenantId } },
    data: { status: "INACTIVE" },
  })

  return { ok: true }
}

const reactivateMemberSchema = z.object({
  tenantId: z.string().cuid(),
  targetUserId: z.string().cuid(),
})

export async function reactivateMemberAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const parsed = reactivateMemberSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { tenantId, targetUserId } = parsed.data

  const [caller, target] = await Promise.all([
    prisma.membership.findUnique({ where: { userId_tenantId: { userId: session.user.id, tenantId } }, select: { role: true } }),
    prisma.membership.findUnique({ where: { userId_tenantId: { userId: targetUserId, tenantId } }, select: { role: true } }),
  ])

  if (!caller || !["OWNER", "ADMIN"].includes(caller.role)) return { ok: false, error: "Sin permisos." }
  if (!target) return { ok: false, error: "El usuario no es miembro." }

  await prisma.membership.update({
    where: { userId_tenantId: { userId: targetUserId, tenantId } },
    data: { status: "ACTIVE" },
  })

  return { ok: true }
}
