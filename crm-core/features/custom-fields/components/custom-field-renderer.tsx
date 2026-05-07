"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CustomFieldDef } from "@/lib/config/custom-fields"

interface Props {
  defs: CustomFieldDef[]
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  disabled?: boolean
  errors?: Record<string, string>
}

export function CustomFieldRenderer({ defs, values, onChange, disabled, errors }: Props) {
  if (defs.length === 0) return null

  return (
    <div className="space-y-4">
      {defs.map((def) => {
        const value = values[def.key]
        const error = errors?.[def.key]

        return (
          <div key={def.key} className="space-y-1">
            <Label htmlFor={`cf-${def.key}`}>
              {def.label}
              {def.required && <span className="text-destructive ml-1">*</span>}
            </Label>

            {(def.type === "text" || def.type === "url") && (
              <Input
                id={`cf-${def.key}`}
                type={def.type === "url" ? "url" : "text"}
                value={(value as string) ?? ""}
                onChange={(e) => onChange(def.key, e.target.value)}
                disabled={disabled}
              />
            )}

            {def.type === "number" && (
              <Input
                id={`cf-${def.key}`}
                type="number"
                value={(value as number) ?? ""}
                onChange={(e) => onChange(def.key, e.target.valueAsNumber)}
                disabled={disabled}
              />
            )}

            {def.type === "date" && (
              <Input
                id={`cf-${def.key}`}
                type="date"
                value={(value as string) ?? ""}
                onChange={(e) => onChange(def.key, e.target.value)}
                disabled={disabled}
              />
            )}

            {def.type === "boolean" && (
              <div className="flex items-center gap-2">
                <input
                  id={`cf-${def.key}`}
                  type="checkbox"
                  checked={(value as boolean) ?? false}
                  onChange={(e) => onChange(def.key, e.target.checked)}
                  disabled={disabled}
                  className="h-4 w-4"
                />
              </div>
            )}

            {def.type === "select" && (
              <select
                id={`cf-${def.key}`}
                value={(value as string) ?? ""}
                onChange={(e) => onChange(def.key, e.target.value)}
                disabled={disabled}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">— Seleccionar —</option>
                {(def.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}

            {def.type === "multiselect" && (
              <div className="space-y-1 border rounded p-2">
                {(def.options ?? []).map((opt) => {
                  const selected = Array.isArray(value) && (value as string[]).includes(opt)
                  return (
                    <label key={opt} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          const current = Array.isArray(value) ? (value as string[]) : []
                          onChange(
                            def.key,
                            e.target.checked
                              ? [...current, opt]
                              : current.filter((v) => v !== opt)
                          )
                        }}
                        disabled={disabled}
                      />
                      {opt}
                    </label>
                  )
                })}
              </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )
      })}
    </div>
  )
}
