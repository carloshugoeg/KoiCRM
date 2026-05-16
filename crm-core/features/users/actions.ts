"use server"

import crypto from "crypto"
import { z } from "zod"
import { prisma } from "@/lib/db/client"
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

// ─── Signup ──────────────────────────────────────────────────────────────────

const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
})

export async function signupAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  if (!rateLimit("signup:global", 10, 60_000)) {
    return { ok: false, error: "Demasiados intentos. Intenta más tarde." }
  }

  const parsed = signupSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  const { name, email, password } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return { ok: false, error: "Este correo ya está registrado." }

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
  if (!rateLimit("forgot:global", 20, 60_000)) {
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
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
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
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
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
