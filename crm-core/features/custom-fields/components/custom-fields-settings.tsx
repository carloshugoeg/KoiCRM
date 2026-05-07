"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  createCustomFieldAction,
  deleteCustomFieldAction,
} from "@/features/custom-fields/actions"
import type { CustomFieldDefinition, Tenant } from "@prisma/client"
import type { CustomFieldType } from "@/lib/config/custom-fields"

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Texto",
  number: "Número",
  date: "Fecha",
  select: "Selección única",
  multiselect: "Selección múltiple",
  boolean: "Sí/No",
  url: "URL",
}

const FIELD_TYPES: CustomFieldType[] = ["text", "number", "date", "select", "multiselect", "boolean", "url"]

interface Props {
  tenant: Tenant
  dealFields: CustomFieldDefinition[]
  clientFields: CustomFieldDefinition[]
  canManage: boolean
}

function FieldList({
  entity,
  fields,
  tenant,
  canManage,
}: {
  entity: "Deal" | "Client"
  fields: CustomFieldDefinition[]
  tenant: Tenant
  canManage: boolean
}) {
  const router = useRouter()
  const [type, setType] = useState<CustomFieldType>("text")
  const [key, setKey] = useState("")
  const [fieldLabel, setFieldLabel] = useState("")
  const [optionsRaw, setOptionsRaw] = useState("")
  const [required, setRequired] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const needsOptions = type === "select" || type === "multiselect"

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setError(null)
    const options = needsOptions
      ? optionsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : null

    const result = await createCustomFieldAction({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      entity,
      key,
      label: fieldLabel,
      type,
      options,
      required,
      order: fields.length,
    })
    setAdding(false)
    if (!result.ok) { setError(result.error ?? "Error."); return }
    setKey("")
    setFieldLabel("")
    setOptionsRaw("")
    setRequired(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este campo? Los datos existentes no se borrarán del customData.")) return
    const result = await deleteCustomFieldAction({ tenantId: tenant.id, tenantSlug: tenant.slug, id })
    if (!result.ok) { alert(result.error ?? "Error."); return }
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y border rounded-lg">
        {fields.map((f) => (
          <li key={f.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{f.label}</p>
              <p className="text-xs text-muted-foreground font-mono">
                {f.key} · {FIELD_TYPE_LABELS[f.type as CustomFieldType]}{f.required ? " · requerido" : ""}
              </p>
              {Array.isArray(f.options) && (f.options as string[]).length > 0 && (
                <p className="text-xs text-muted-foreground">Opciones: {(f.options as string[]).join(", ")}</p>
              )}
            </div>
            {canManage && (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(f.id)}>
                Eliminar
              </Button>
            )}
          </li>
        ))}
        {fields.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">Sin campos personalizados</li>
        )}
      </ul>
      {canManage && (
        <form onSubmit={handleAdd} className="space-y-3 border rounded-lg p-4">
          <p className="text-sm font-medium">Agregar campo</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`${entity}-key`}>Clave (snake_case)</Label>
              <Input
                id={`${entity}-key`}
                value={key}
                onChange={(e) => setKey(e.target.value.toLowerCase().replace(/\s/g, "_"))}
                placeholder="numero_contrato"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${entity}-label`}>Etiqueta visible</Label>
              <Input
                id={`${entity}-label`}
                value={fieldLabel}
                onChange={(e) => setFieldLabel(e.target.value)}
                placeholder="Número de contrato"
                required
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${entity}-type`}>Tipo</Label>
            <select
              id={`${entity}-type`}
              value={type}
              onChange={(e) => setType(e.target.value as CustomFieldType)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          {needsOptions && (
            <div className="space-y-1">
              <Label htmlFor={`${entity}-options`}>Opciones (separadas por coma)</Label>
              <Input
                id={`${entity}-options`}
                value={optionsRaw}
                onChange={(e) => setOptionsRaw(e.target.value)}
                placeholder="opción1, opción2, opción3"
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
            Requerido
          </label>
          <Button type="submit" disabled={adding}>
            {adding ? "Agregando…" : "Agregar campo"}
          </Button>
        </form>
      )}
    </div>
  )
}

export function CustomFieldsSettings({ tenant, dealFields, clientFields, canManage }: Props) {
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Campos personalizados</h1>
      <Tabs defaultValue="Deal">
        <TabsList>
          <TabsTrigger value="Deal">Oportunidades</TabsTrigger>
          <TabsTrigger value="Client">Clientes</TabsTrigger>
        </TabsList>
        <TabsContent value="Deal" className="pt-4">
          <FieldList entity="Deal" fields={dealFields} tenant={tenant} canManage={canManage} />
        </TabsContent>
        <TabsContent value="Client" className="pt-4">
          <FieldList entity="Client" fields={clientFields} tenant={tenant} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
