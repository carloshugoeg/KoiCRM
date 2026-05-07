import { z } from "zod"

export type CustomFieldType = "text" | "number" | "date" | "select" | "multiselect" | "boolean" | "url"

export type CustomFieldDef = {
  key: string
  label: string
  type: CustomFieldType
  required: boolean
  options: string[] | null
}

function buildFieldSchema(def: CustomFieldDef): z.ZodTypeAny {
  switch (def.type) {
    case "text": {
      const base = z.string()
      return def.required ? base.min(1, `${def.label} es requerido`) : base.optional()
    }
    case "number": {
      const base = z.coerce.number({ message: `${def.label} es requerido` })
      return def.required ? base : base.optional()
    }
    case "date": {
      const base = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${def.label}: formato YYYY-MM-DD`)
      return def.required ? base : base.optional()
    }
    case "boolean": {
      const base = z.coerce.boolean()
      return def.required ? base : base.optional()
    }
    case "url": {
      const base = z.string().url(`${def.label}: URL inválida`)
      return def.required ? base : base.optional()
    }
    case "select": {
      const opts = def.options ?? []
      if (opts.length === 0) return def.required ? z.string().min(1) : z.string().optional()
      const [first, ...rest] = opts as [string, ...string[]]
      const base = z.enum([first, ...rest])
      return def.required ? base : base.optional()
    }
    case "multiselect": {
      const opts = def.options ?? []
      if (opts.length === 0) {
        const base = z.array(z.string())
        return def.required ? base : base.optional()
      }
      const [first, ...rest] = opts as [string, ...string[]]
      const base = z.array(z.enum([first, ...rest]))
      return def.required ? base : base.optional()
    }
    default:
      return z.unknown()
  }
}

export function buildCustomFieldSchema(defs: CustomFieldDef[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const def of defs) {
    shape[def.key] = buildFieldSchema(def)
  }
  return z.object(shape)
}
