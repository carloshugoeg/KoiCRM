"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { Droplets, Moon, Palette, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { updateBrandingAction } from "@/features/branding/actions"
import {
  SettingsCard,
  SettingsSectionTitle,
} from "@/components/settings/settings-section"
import {
  readShowArchivedPreference,
  writeShowArchivedPreference,
} from "@/lib/settings/preferences"
import type { Tenant, TenantBranding } from "@prisma/client"
import { toastMessages } from "@/lib/ui/toast-messages"

const DEFAULT_BG_DARK = "#050910"
const DEFAULT_BG_LIGHT = "#f0f4ff"

interface Props {
  tenant: Tenant
  branding: TenantBranding | null
  canManage: boolean
}

async function uploadBrandingFile(
  tenantId: string,
  kind: "logo" | "background",
  file: File,
): Promise<string> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("tenantId", tenantId)
  formData.append("kind", kind)

  const res = await fetch("/api/upload/branding", { method: "POST", body: formData })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    if (err.error === "file_too_large") throw new Error("La imagen supera el tamaño máximo (5 MB).")
    if (err.error === "invalid_content_type") throw new Error("Tipo de archivo no permitido.")
    throw new Error("Error al subir la imagen.")
  }
  const data = await res.json()
  return data.publicUrl as string
}

export function BrandingSettings({ tenant, branding, canManage }: Props) {
  const router = useRouter()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const logoInputRef = useRef<HTMLInputElement>(null)
  const bgInputRef = useRef<HTMLInputElement>(null)

  const [bgColorDark, setBgColorDark] = useState(branding?.bgColorDark ?? DEFAULT_BG_DARK)
  const [bgColorLight, setBgColorLight] = useState(branding?.bgColorLight ?? DEFAULT_BG_LIGHT)
  const [logoUrl, setLogoUrl] = useState(branding?.logoUrl ?? "")
  const [bgImageUrl, setBgImageUrl] = useState(branding?.bgImageUrl ?? "")
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<"logo" | "background" | null>(null)

  const isDark = (resolvedTheme ?? theme) === "dark"

  useEffect(() => {
    setShowArchived(readShowArchivedPreference())
  }, [])

  async function persistBranding(partial: {
    bgColorDark?: string | null
    bgColorLight?: string | null
    logoUrl?: string | null
    bgImageUrl?: string | null
  }) {
    setSaving(true)
    setError(null)
    const result = await updateBrandingAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      bgColorDark: partial.bgColorDark ?? bgColorDark,
      bgColorLight: partial.bgColorLight ?? bgColorLight,
      logoUrl: partial.logoUrl !== undefined ? partial.logoUrl : logoUrl || null,
      bgImageUrl: partial.bgImageUrl !== undefined ? partial.bgImageUrl : bgImageUrl || null,
      primaryColor: branding?.primaryColor ?? "#818cf8",
      headerBgColor: branding?.headerBgColor ?? null,
      kpiBgColor: branding?.kpiBgColor ?? null,
      productName: branding?.productName ?? null,
    })
    setSaving(false)
    if (!result.ok) {
      const msg = result.error ?? toastMessages.branding.errorSave
      setError(msg)
      toast.error(msg)
      return false
    }
    toast.success(toastMessages.branding.saved)
    router.refresh()
    return true
  }

  async function handleThemeChange(dark: boolean) {
    setTheme(dark ? "dark" : "light")
    await persistBranding({})
  }

  async function handleBgColorChange(which: "dark" | "light", value: string) {
    if (which === "dark") setBgColorDark(value)
    else setBgColorLight(value)
    await persistBranding({
      bgColorDark: which === "dark" ? value : bgColorDark,
      bgColorLight: which === "light" ? value : bgColorLight,
    })
  }

  async function handleClearBgColor(which: "dark" | "light") {
    const def = which === "dark" ? DEFAULT_BG_DARK : DEFAULT_BG_LIGHT
    if (which === "dark") setBgColorDark(def)
    else setBgColorLight(def)
    await persistBranding({
      bgColorDark: which === "dark" ? def : bgColorDark,
      bgColorLight: which === "light" ? def : bgColorLight,
    })
  }

  async function handleFileUpload(kind: "logo" | "background", file: File) {
    if (!canManage) return
    setUploading(kind)
    setError(null)
    try {
      const url = await uploadBrandingFile(tenant.id, kind, file)
      if (kind === "logo") {
        setLogoUrl(url)
        await persistBranding({ logoUrl: url })
      } else {
        setBgImageUrl(url)
        await persistBranding({ bgImageUrl: url })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir.")
    } finally {
      setUploading(null)
    }
  }

  function handleShowArchivedToggle(next: boolean) {
    setShowArchived(next)
    writeShowArchivedPreference(next)
    router.refresh()
  }

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {saving && <p className="text-xs text-muted-foreground">Guardando…</p>}

      <div>
        <SettingsSectionTitle>Modo de pantalla</SettingsSectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {[
            { dark: true, label: "Oscuro", icon: Moon },
            { dark: false, label: "Claro", icon: Sun },
          ].map((opt) => (
            <button
              key={String(opt.dark)}
              type="button"
              disabled={!canManage}
              onClick={() => handleThemeChange(opt.dark)}
              className={`flex flex-col items-center gap-3 py-6 rounded-xl border transition-all ${
                isDark === opt.dark
                  ? "bg-indigo-500/15 border-indigo-400 ring-1 ring-indigo-500/40"
                  : "bg-muted/30 border-border"
              }`}
            >
              <opt.icon
                className={`h-[22px] w-[22px] ${isDark === opt.dark ? "text-indigo-400" : "text-muted-foreground"}`}
              />
              <span
                className={`text-sm font-semibold ${isDark === opt.dark ? "text-indigo-400" : "text-muted-foreground"}`}
              >
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <SettingsSectionTitle>Fondo oscuro</SettingsSectionTitle>
          <div className="flex gap-3 items-center">
            <input
              type="color"
              value={bgColorDark}
              disabled={!canManage}
              onChange={(e) => handleBgColorChange("dark", e.target.value)}
              className="w-[34px] h-[34px] rounded cursor-pointer border-none p-0"
            />
            {branding?.bgColorDark && canManage && (
              <button
                type="button"
                onClick={() => handleClearBgColor("dark")}
                className="text-[10px] text-red-500 hover:underline"
              >
                Restaurar
              </button>
            )}
          </div>
        </div>
        <div>
          <SettingsSectionTitle>Fondo claro</SettingsSectionTitle>
          <div className="flex gap-3 items-center">
            <input
              type="color"
              value={bgColorLight}
              disabled={!canManage}
              onChange={(e) => handleBgColorChange("light", e.target.value)}
              className="w-[34px] h-[34px] rounded cursor-pointer border-none p-0"
            />
            {branding?.bgColorLight && canManage && (
              <button
                type="button"
                onClick={() => handleClearBgColor("light")}
                className="text-[10px] text-red-500 hover:underline"
              >
                Restaurar
              </button>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <SettingsSectionTitle>Imagen de fondo</SettingsSectionTitle>
          {bgImageUrl && canManage && (
            <button
              type="button"
              onClick={async () => {
                setBgImageUrl("")
                await persistBranding({ bgImageUrl: null })
              }}
              className="text-xs text-red-500 hover:underline"
            >
              Quitar imagen
            </button>
          )}
        </div>
        <SettingsCard className="flex flex-col items-center justify-center gap-3 py-4">
          <input
            ref={bgInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFileUpload("background", file)
            }}
          />
          {bgImageUrl ? (
            <div
              className="h-16 w-full bg-cover bg-center rounded"
              style={{ backgroundImage: `url(${bgImageUrl})` }}
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-400 to-slate-700 flex items-center justify-center">
              <Palette className="h-4 w-4 text-white" />
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canManage || uploading === "background"}
            className="text-xs font-bold text-indigo-400 bg-indigo-500/15 hover:bg-indigo-500/25"
            onClick={() => bgInputRef.current?.click()}
          >
            {uploading === "background" ? "Subiendo…" : "Subir fondo"}
          </Button>
        </SettingsCard>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <SettingsSectionTitle>Logotipo de la empresa</SettingsSectionTitle>
          {logoUrl && canManage && (
            <button
              type="button"
              onClick={async () => {
                setLogoUrl("")
                await persistBranding({ logoUrl: null })
              }}
              className="text-xs text-red-500 hover:underline"
            >
              Quitar logo
            </button>
          )}
        </div>
        <SettingsCard className="flex flex-col items-center justify-center gap-3 py-4">
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFileUpload("logo", file)
            }}
          />
          {logoUrl ? (
            <div className="h-10 w-auto min-w-[80px] max-w-[160px] bg-white rounded flex items-center justify-center p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt="Logo"
                className="max-h-full w-auto object-contain"
              />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-blue-700 flex items-center justify-center">
              <Droplets className="h-4 w-4 text-white" />
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canManage || uploading === "logo"}
            className="text-xs font-bold text-indigo-400 bg-indigo-500/15 hover:bg-indigo-500/25"
            onClick={() => logoInputRef.current?.click()}
          >
            {uploading === "logo" ? "Subiendo…" : "Subir imagen (4:2)"}
          </Button>
        </SettingsCard>
      </div>

      <SettingsCard>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">Mostrar oportunidades archivadas</p>
          <button
            type="button"
            role="switch"
            aria-checked={showArchived}
            disabled={!canManage}
            onClick={() => handleShowArchivedToggle(!showArchived)}
            className="w-[34px] h-[20px] rounded-full relative transition-colors shrink-0"
            style={{ background: showArchived ? "#6366f1" : "var(--muted-foreground)" }}
          >
            <div
              className="w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all"
              style={{ left: showArchived ? "16px" : "2px" }}
            />
          </button>
        </div>
      </SettingsCard>

      <p className="text-xs text-muted-foreground pt-2">
        <a href={`/app/${tenant.slug}/settings/catalogs`} className="text-indigo-400 hover:underline">
          Catálogos avanzados
        </a>
        {" · "}
        <a href={`/app/${tenant.slug}/settings/general`} className="text-indigo-400 hover:underline">
          Configuración regional
        </a>
      </p>
    </div>
  )
}
