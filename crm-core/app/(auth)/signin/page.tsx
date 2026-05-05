"use client"

import { useState, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

function SignInForm() {
  const router = useRouter()
  const params = useSearchParams()

  const errorParam = params.get("error")
  const initialError =
    errorParam === "link_expired"
      ? "El enlace expiró. Solicita uno nuevo."
      : errorParam
        ? "Error al iniciar sesión."
        : null

  const verified = params.get("verified") === "1"
  const reset = params.get("reset") === "1"
  const [error, setError] = useState<string | null>(initialError)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const res = await signIn("credentials", {
      email: fd.get("email"),
      password: fd.get("password"),
      redirect: false,
    })
    setPending(false)
    if (res?.error) {
      setError("Correo o contraseña incorrectos.")
      return
    }
    router.push(params.get("callbackUrl") ?? "/app")
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
      {verified && <p className="text-sm text-green-600">Correo verificado. Ya puedes iniciar sesión.</p>}
      {reset && <p className="text-sm text-green-600">Contraseña restablecida. Ya puedes iniciar sesión.</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="email">Correo</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        <Link href="/forgot" className="underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </p>
      <p className="text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link href="/signup" className="underline">
          Regístrate
        </Link>
      </p>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}
