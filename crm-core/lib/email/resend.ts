// crm-core/lib/email/resend.ts
import { Resend } from "resend"

interface EmailPayload {
  to: string
  subject: string
  html: string
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[EMAIL] To: ${payload.to} | Subject: ${payload.subject}`)
    return
  }
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "noreply@example.com",
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  })
}

export function buildVerificationEmail(url: string): string {
  return `<p>Verifica tu correo haciendo clic en el siguiente enlace:</p>
<p><a href="${url}">${url}</a></p>
<p>Este enlace expira en 24 horas.</p>`
}

export function buildPasswordResetEmail(url: string): string {
  return `<p>Haz clic en el siguiente enlace para restablecer tu contraseña:</p>
<p><a href="${url}">${url}</a></p>
<p>Este enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.</p>`
}

export function buildInvitationEmail(url: string, tenantName: string): string {
  return `<p>Te han invitado a unirte a <strong>${tenantName}</strong> en Koi CRM.</p>
<p><a href="${url}">Aceptar invitación</a></p>
<p>Este enlace expira en 7 días.</p>`
}
