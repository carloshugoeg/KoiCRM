import type { Role } from "@prisma/client"

/**
 * Permission catalogue. Keys are stable strings stored in RolePermission.key;
 * labels and descriptions drive the settings matrix, so adding a permission here
 * is all it takes for it to appear in the UI.
 */
export const PERMISSION_KEYS = [
  "pipeline.viewAll",
  "pipeline.viewTotals",
  "reports.viewAll",
  "stats.viewTotals",
  "catalog.manage",
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export const ROLES: Role[] = ["OWNER", "ADMIN", "SUPERVISOR", "MEMBER", "VIEWER"]

export interface PermissionDef {
  key: PermissionKey
  group: string
  label: string
  description: string
}

export const PERMISSION_DEFS: PermissionDef[] = [
  {
    key: "pipeline.viewAll",
    group: "Embudo",
    label: "Ver el embudo de todo el equipo",
    description:
      "Sin este permiso, la persona solo ve las oportunidades de las que es responsable.",
  },
  {
    key: "pipeline.viewTotals",
    group: "Embudo",
    label: "Ver totales del embudo",
    description:
      "Controla los totales por etapa y las tarjetas de KPI. El valor de cada oportunidad sigue visible en su tarjeta.",
  },
  {
    key: "reports.viewAll",
    group: "Reportes",
    label: "Ver reportes de todo el equipo",
    description:
      "Sin este permiso, los reportes se limitan a las oportunidades propias y no aparece el filtro por asesor.",
  },
  {
    key: "stats.viewTotals",
    group: "Estadísticas",
    label: "Ver montos en estadísticas",
    description: "Oculta las cifras de dinero en los paneles de estadísticas cuando está apagado.",
  },
  {
    key: "catalog.manage",
    group: "Catálogos",
    label: "Gestionar catálogo",
    description:
      "Permite agregar o quitar categorías y subcategorías de equipos. Sin este permiso solo un Superadministrador puede hacerlo.",
  },
]

/**
 * Built-in defaults. Only supervisor, admin and superadmin see funnel totals; an asesor
 * sees their own funnel. Every key here must have a consumer somewhere in the app — a
 * toggle the settings screen renders but nothing reads is worse than no toggle at all.
 */
const DEFAULTS: Record<Role, Record<PermissionKey, boolean>> = {
  OWNER: {
    "pipeline.viewAll": true,
    "pipeline.viewTotals": true,
    "reports.viewAll": true,
    "stats.viewTotals": true,
    "catalog.manage": true,
  },
  ADMIN: {
    "pipeline.viewAll": true,
    "pipeline.viewTotals": true,
    "reports.viewAll": true,
    "stats.viewTotals": true,
    "catalog.manage": true,
  },
  SUPERVISOR: {
    "pipeline.viewAll": true,
    "pipeline.viewTotals": true,
    "reports.viewAll": true,
    "stats.viewTotals": true,
    "catalog.manage": false,
  },
  MEMBER: {
    "pipeline.viewAll": false,
    "pipeline.viewTotals": false,
    "reports.viewAll": false,
    "stats.viewTotals": false,
    "catalog.manage": false,
  },
  VIEWER: {
    "pipeline.viewAll": true,
    "pipeline.viewTotals": false,
    "reports.viewAll": false,
    "stats.viewTotals": false,
    "catalog.manage": false,
  },
}

export function defaultPermission(role: Role, key: PermissionKey): boolean {
  return DEFAULTS[role]?.[key] ?? false
}

export type PermissionMatrix = Record<Role, Record<PermissionKey, boolean>>

export function defaultMatrix(): PermissionMatrix {
  return JSON.parse(JSON.stringify(DEFAULTS)) as PermissionMatrix
}

/** OWNER and ADMIN always keep full access — the UI renders their row locked. */
export const LOCKED_ROLES: Role[] = ["OWNER", "ADMIN"]

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value)
}
