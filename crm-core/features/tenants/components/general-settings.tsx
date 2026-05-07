"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { updateTenantSettingsAction } from "@/features/tenants/settings"
import type { Tenant, TenantSettings } from "@prisma/client"

const LOCALES = [
  { value: "es-GT", label: "Español (Guatemala)" },
  { value: "es-MX", label: "Español (México)" },
  { value: "es-CO", label: "Español (Colombia)" },
  { value: "en-US", label: "English (US)" },
]

const CURRENCIES = [
  { value: "GTQ", label: "GTQ — Quetzal guatemalteco" },
  { value: "USD", label: "USD — Dólar americano" },
  { value: "MXN", label: "MXN — Peso mexicano" },
  { value: "COP", label: "COP — Peso colombiano" },
]

const TIMEZONES = [
  { value: "America/Guatemala", label: "Guatemala (UTC-6)" },
  { value: "America/Mexico_City", label: "México (UTC-6)" },
  { value: "America/Bogota", label: "Colombia (UTC-5)" },
  { value: "America/New_York", label: "Eastern (UTC-5)" },
]

interface Props {
  tenant: Tenant
  settings: TenantSettings | null
  canManage: boolean
}

const defaultSettings = {
  locale: "es-GT",
  currency: "GTQ",
  timezone: "America/Guatemala",
  phoneFormat: "XXXX-XXXX",
  whatsappCountryCode: "+502",
  dealIdPrefix: "DEAL",
  dealIdYearDigits: 2,
}

export function GeneralSettings({ tenant, settings, canManage }: Props) {
  const router = useRouter()
  const s = settings ?? defaultSettings
  const [locale, setLocale] = useState(s.locale)
  const [currency, setCurrency] = useState(s.currency)
  const [timezone, setTimezone] = useState(s.timezone)
  const [phoneFormat, setPhoneFormat] = useState(s.phoneFormat)
  const [whatsappCountryCode, setWhatsappCountryCode] = useState(s.whatsappCountryCode)
  const [dealIdPrefix, setDealIdPrefix] = useState(s.dealIdPrefix)
  const [dealIdYearDigits, setDealIdYearDigits] = useState(s.dealIdYearDigits)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const result = await updateTenantSettingsAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      locale,
      currency,
      timezone,
      phoneFormat,
      whatsappCountryCode,
      dealIdPrefix,
      dealIdYearDigits: Number(dealIdYearDigits),
    })
    setSaving(false)
    if (!result.ok) { setError(result.error ?? "Error al guardar."); return }
    setSaved(true)
    setTimeout(() => { setSaved(false); router.refresh() }, 1500)
  }

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      <h1 className="text-2xl font-semibold">General</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-green-600">Guardado correctamente.</p>}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="locale">Idioma / Locale</Label>
          <select
            id="locale"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            disabled={!canManage}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            {LOCALES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">Moneda</Label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={!canManage}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="timezone">Zona horaria</Label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            disabled={!canManage}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phoneFormat">Formato de teléfono</Label>
          <Input id="phoneFormat" value={phoneFormat} onChange={(e) => setPhoneFormat(e.target.value)} disabled={!canManage} placeholder="XXXX-XXXX" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsapp">Código de país WhatsApp</Label>
          <Input id="whatsapp" value={whatsappCountryCode} onChange={(e) => setWhatsappCountryCode(e.target.value)} disabled={!canManage} placeholder="+502" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dealIdPrefix">Prefijo de ID de oportunidad</Label>
            <Input id="dealIdPrefix" value={dealIdPrefix} onChange={(e) => setDealIdPrefix(e.target.value.toUpperCase())} disabled={!canManage} maxLength={10} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dealIdYearDigits">Dígitos del año (2 o 4)</Label>
            <select
              id="dealIdYearDigits"
              value={dealIdYearDigits}
              onChange={(e) => setDealIdYearDigits(Number(e.target.value))}
              disabled={!canManage}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value={2}>2 (ej. 25)</option>
              <option value={4}>4 (ej. 2025)</option>
            </select>
          </div>
        </div>
        {canManage && (
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : "Guardar configuración"}
          </Button>
        )}
      </form>
    </div>
  )
}
