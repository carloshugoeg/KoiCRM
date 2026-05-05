"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { forgotPasswordAction } from "@/features/users/actions"

function ForgotForm() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const result = await forgotPasswordAction({ email: fd.get("email") })
    setPending(false)
    if (!result.ok) { setError(result.error ?? "Error al enviar."); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Revisa tu correo</h1>
        <p className="text-sm text-muted-foreground">
          Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.
        </p>
        <Link href="/signin" className="text-sm underline">Volver al inicio de sesión</Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Olvidé mi contraseña</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="email">Correo</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Enviando…" : "Enviar enlace"}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        <Link href="/signin" className="underline">Volver al inicio de sesión</Link>
      </p>
    </div>
  )
}

export default function ForgotPage() {
  return <Suspense><ForgotForm /></Suspense>
}
