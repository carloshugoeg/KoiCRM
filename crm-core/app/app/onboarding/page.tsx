"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { createTenantAction } from "@/features/tenants/actions"
import { listIndustries } from "@/lib/industry/registry"

const INDUSTRIES = listIndustries()

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 50)
}

export default function OnboardingPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const result = await createTenantAction({
      name: fd.get("name"),
      slug: fd.get("slug"),
      industrySlug: fd.get("industrySlug"),
    })
    setPending(false)
    if (!result.ok) { setError(result.error ?? "Error al crear el espacio de trabajo."); return }
    router.push(`/app/${result.slug}/pipeline`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Bienvenido</h1>
          <p className="text-muted-foreground mt-1">Crea tu espacio de trabajo para comenzar.</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Nombre de la empresa</Label>
            <Input
              id="name"
              name="name"
              required
              minLength={2}
              onChange={(e) => {
                const slugInput = document.getElementById("slug") as HTMLInputElement | null
                if (slugInput && !slugInput.dataset.touched) {
                  slugInput.value = toSlug(e.target.value)
                }
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="slug">Identificador único</Label>
            <Input
              id="slug"
              name="slug"
              required
              pattern="[a-z0-9-]+"
              minLength={2}
              maxLength={50}
              onInput={(e) => { (e.currentTarget as HTMLInputElement).dataset.touched = "1" }}
            />
            <p className="text-xs text-muted-foreground">Solo letras minúsculas, números y guiones.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="industrySlug">Industria</Label>
            <select
              id="industrySlug"
              name="industrySlug"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {INDUSTRIES.map((i) => (
                <option key={i.slug} value={i.slug}>{i.name}</option>
              ))}
            </select>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creando…" : "Crear espacio de trabajo"}
          </Button>
        </form>
      </div>
    </div>
  )
}
