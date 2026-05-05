"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { resetPasswordAction } from "@/features/users/actions"

function ResetForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get("token") ?? ""
  const email = params.get("email") ?? ""
  const [error, setError] = useState<string | null>(!token || !email ? "Enlace inválido." : null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const result = await resetPasswordAction({ email, token, password: fd.get("password") })
    setPending(false)
    if (!result.ok) { setError(result.error ?? "Error al restablecer."); return }
    router.push("/signin?reset=1")
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nueva contraseña</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="password">Nueva contraseña (mín. 8 caracteres)</Label>
          <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        </div>
        <Button type="submit" className="w-full" disabled={pending || !token || !email}>
          {pending ? "Guardando…" : "Guardar contraseña"}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        <Link href="/forgot" className="underline">Solicitar nuevo enlace</Link>
      </p>
    </div>
  )
}

export default function ResetPage() {
  return <Suspense><ResetForm /></Suspense>
}
