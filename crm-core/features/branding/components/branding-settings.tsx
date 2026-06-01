"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { updateBrandingAction } from "@/features/branding/actions"
import type { Tenant, TenantBranding } from "@prisma/client"

interface Props {
  tenant: Tenant
  branding: TenantBranding | null
  canManage: boolean
}

export function BrandingSettings({ tenant, branding, canManage }: Props) {
  const router = useRouter()
  const [primaryColor, setPrimaryColor] = useState(branding?.primaryColor ?? "#2563eb")
  const [bgColorLight, setBgColorLight] = useState(branding?.bgColorLight ?? "#ffffff")
  const [bgColorDark, setBgColorDark] = useState(branding?.bgColorDark ?? "#0f172a")
  const [headerBgColor, setHeaderBgColor] = useState(branding?.headerBgColor ?? "#1e293b")
  const [kpiBgColor, setKpiBgColor] = useState(branding?.kpiBgColor ?? "#f8fafc")
  const [productName, setProductName] = useState(branding?.productName ?? "")
  const [logoUrl, setLogoUrl] = useState(branding?.logoUrl ?? "")
  const [bgImageUrl, setBgImageUrl] = useState(branding?.bgImageUrl ?? "")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const result = await updateBrandingAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      primaryColor,
      bgColorLight,
      bgColorDark,
      headerBgColor,
      kpiBgColor,
      productName: productName || null,
      logoUrl: logoUrl || null,
      bgImageUrl: bgImageUrl || null,
    })
    setSaving(false)
    if (!result.ok) { setError(result.error ?? "Error al guardar."); return }
    setSaved(true)
    setTimeout(() => { setSaved(false); router.refresh() }, 1500)
  }

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      <h1 className="text-2xl font-semibold">Apariencia</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-green-600">Guardado correctamente.</p>}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="productName">Nombre del producto</Label>
          <Input
            id="productName"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Mi CRM"
            disabled={!canManage}
            maxLength={50}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { id: "primaryColor", label: "Color primario", value: primaryColor, set: setPrimaryColor },
            { id: "headerBgColor", label: "Fondo del header", value: headerBgColor, set: setHeaderBgColor },
            { id: "bgColorLight", label: "Fondo claro", value: bgColorLight, set: setBgColorLight },
            { id: "kpiBgColor", label: "Fondo KPIs", value: kpiBgColor, set: setKpiBgColor },
            { id: "bgColorDark", label: "Fondo oscuro", value: bgColorDark, set: setBgColorDark },
          ].map(({ id, label, value, set }) => (
            <div key={id} className="space-y-1">
              <Label htmlFor={id}>{label}</Label>
              <div className="flex gap-2 items-center">
                <input
                  id={id}
                  type="color"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  disabled={!canManage}
                  className="h-9 w-12 cursor-pointer rounded border"
                />
                <Input
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  disabled={!canManage}
                  className="font-mono text-sm"
                  maxLength={7}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Label htmlFor="logoUrl">Logo (URL de imagen)</Label>
          <Input
            id="logoUrl"
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://ejemplo.com/logo.png"
            disabled={!canManage}
            maxLength={500}
          />
          {logoUrl && (
            <div className="mt-2 p-3 border rounded-lg bg-muted/30 flex items-center justify-center" style={{ minHeight: "4rem" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt="Logo preview"
                className="max-h-16 max-w-xs object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
              />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="bgImageUrl">Imagen de fondo (URL)</Label>
          <Input
            id="bgImageUrl"
            type="url"
            value={bgImageUrl}
            onChange={(e) => setBgImageUrl(e.target.value)}
            placeholder="https://ejemplo.com/fondo.jpg"
            disabled={!canManage}
            maxLength={500}
          />
        </div>
        {canManage && (
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : "Guardar apariencia"}
          </Button>
        )}
      </form>
    </div>
  )
}
