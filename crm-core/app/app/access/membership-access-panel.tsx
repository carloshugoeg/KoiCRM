"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { parseInviteToken } from "@/lib/tenant/parse-invite-token"

type Props = {
  contactEmail: string
  contactPhone: string | null
  contactLabel: string
}

export function MembershipAccessPanel({ contactEmail, contactPhone, contactLabel }: Props) {
  const router = useRouter()
  const [inviteInput, setInviteInput] = useState("")
  const [inviteError, setInviteError] = useState<string | null>(null)

  function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault()
    setInviteError(null)
    const token = parseInviteToken(inviteInput)
    if (!token) {
      setInviteError("Pega el enlace completo de unión o el código que te compartió tu administrador.")
      return
    }
    router.push(`/api/join/accept?token=${encodeURIComponent(token)}`)
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Renovación o adquisición
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Para activar o renovar tu membresía, contacta a {contactLabel}:
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          <li>
            <span className="text-slate-500">Correo: </span>
            <a href={`mailto:${contactEmail}`} className="font-medium text-primary underline">
              {contactEmail}
            </a>
          </li>
          {contactPhone ? (
            <li>
              <span className="text-slate-500">Teléfono: </span>
              <a href={`tel:${contactPhone}`} className="font-medium text-primary underline">
                {contactPhone}
              </a>
            </li>
          ) : null}
        </ul>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Tengo un enlace de unión
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Si un administrador te compartió un enlace de unión, pégalo aquí para entrar a su espacio de
          trabajo con el permiso configurado en el enlace.
        </p>
        <form onSubmit={handleInviteSubmit} className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="invite-link">Enlace o código de unión</Label>
            <Input
              id="invite-link"
              name="invite"
              placeholder="https://…/api/join/accept?token=…"
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              autoComplete="off"
            />
          </div>
          {inviteError ? <p className="text-sm text-destructive">{inviteError}</p> : null}
          <Button type="submit">Unirme al espacio de trabajo</Button>
        </form>
      </section>
    </div>
  )
}
