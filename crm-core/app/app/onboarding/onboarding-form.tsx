"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createTenantAction } from "@/features/tenants/actions"
import { slugifyName } from "@/lib/tenant/slugify"

type IndustryOption = { slug: string; name: string }

type Props = {
  industries: IndustryOption[]
  defaultIndustrySlug: string
}

export function OnboardingForm({ industries, defaultIndustrySlug }: Props) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [industrySlug, setIndustrySlug] = useState(defaultIndustrySlug)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function handleNameChange(value: string) {
    setName(value)
    if (!slugTouched) {
      setSlug(slugifyName(value))
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const result = await createTenantAction({ name, slug, industrySlug })
    setPending(false)
    if (!result.ok) {
      setError(result.error ?? "No se pudo crear el espacio de trabajo.")
      return
    }
    router.push(`/app/${result.slug}/pipeline`)
    router.refresh()
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Crea tu espacio de trabajo</h1>
        <p className="text-sm text-muted-foreground">
          Configura tu CRM. Puedes cambiar el branding y catálogos después en ajustes.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="tenant-name">Nombre de la empresa</Label>
          <Input
            id="tenant-name"
            name="name"
            required
            minLength={2}
            maxLength={100}
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tenant-slug">URL (slug)</Label>
          <Input
            id="tenant-slug"
            name="slug"
            required
            minLength={2}
            maxLength={50}
            pattern="[a-z0-9-]+"
            title="Solo letras minúsculas, números y guiones"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value.toLowerCase())
            }}
          />
          <p className="text-xs text-muted-foreground">Tu app estará en /app/{slug || "…"}</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="industry">Industria</Label>
          <Select value={industrySlug} onValueChange={setIndustrySlug}>
            <SelectTrigger id="industry">
              <SelectValue placeholder="Elige una industria" />
            </SelectTrigger>
            <SelectContent>
              {industries.map((industry) => (
                <SelectItem key={industry.slug} value={industry.slug}>
                  {industry.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creando…" : "Crear espacio de trabajo"}
        </Button>
      </form>
    </div>
  )
}
