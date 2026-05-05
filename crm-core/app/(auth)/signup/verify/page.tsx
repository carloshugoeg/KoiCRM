import Link from "next/link"

export default function SignUpVerifyPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Verifica tu correo</h1>
      <p className="text-sm text-muted-foreground">
        Te enviamos un enlace de verificación. Revisa tu bandeja de entrada y sigue el enlace para activar tu cuenta.
      </p>
      <p className="text-sm text-muted-foreground">
        ¿No recibiste el correo?{" "}
        <Link href="/signup" className="underline">Vuelve a registrarte</Link>
      </p>
    </div>
  )
}
