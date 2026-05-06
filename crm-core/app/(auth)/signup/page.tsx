"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { signupAction } from "@/features/users/actions"

export default function SignUpPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const result = await signupAction({
      name: fd.get("name"),
      email: fd.get("email"),
      password: fd.get("password"),
    })
    setPending(false)
    if (!result.ok) {
      setError(result.error ?? "Error al registrarse.")
      return
    }
    router.push("/signup/verify")
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Crear cuenta</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" required minLength={2} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="email">Correo</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">Contraseña (mín. 8 caracteres)</Label>
          <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creando cuenta…" : "Crear cuenta"}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/signin" className="underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
