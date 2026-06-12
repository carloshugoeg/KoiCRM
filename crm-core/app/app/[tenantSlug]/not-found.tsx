import Link from "next/link"

export default function TenantNotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">
        Espacio de trabajo no encontrado
      </h1>
      <p className="text-sm text-slate-600">
        El espacio de trabajo que buscas no existe o no tienes acceso a él.
      </p>
      <Link
        href="/app"
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
      >
        Volver al inicio
      </Link>
    </div>
  )
}
