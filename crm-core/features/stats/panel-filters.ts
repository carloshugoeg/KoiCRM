/**
 * Per-panel filtering for the Estadísticas screens.
 *
 * Every panel owns a namespaced slice of the query string (`<panelId>.<key>`), so narrowing one
 * panel never disturbs its neighbours and the whole view stays shareable / refresh-safe — the same
 * URL-driven mechanism the date RangePicker already uses. The page-level `from`/`to` range stays
 * global and composes with whatever each panel adds on top.
 *
 * Isomorphic on purpose: the client filter control and the server pages both read from here, so no
 * server-only imports are allowed in this file.
 */

export const PANEL_FILTER_KEYS = ["owner", "channel", "category", "status"] as const

export type PanelFilterKey = (typeof PANEL_FILTER_KEYS)[number]

export type PanelFilterValues = Partial<Record<PanelFilterKey, string>>

export interface FilterOption {
  value: string
  label: string
}

/** Catalogue of choices shared by every panel control on a page. */
export interface StatsFilterOptions {
  owner: FilterOption[]
  channel: FilterOption[]
  category: FilterOption[]
  status: FilterOption[]
}

export const PANEL_FILTER_LABELS: Record<PanelFilterKey, string> = {
  owner: "Asesor",
  channel: "Canal de venta",
  category: "Categoría de equipo",
  status: "Estado",
}

export const PANEL_FILTER_ALL_LABELS: Record<PanelFilterKey, string> = {
  owner: "Todos los asesores",
  channel: "Todos los canales",
  category: "Todas las categorías",
  status: "Todos los estados",
}

/** Filters accepted by every stats aggregation. */
export interface StatsFilters {
  from?: Date
  to?: Date
  ownerId?: string
  channelKey?: string
  equipmentCategoryKey?: string
  statusKey?: string
}

export function panelParamName(panelId: string, key: PanelFilterKey): string {
  return `${panelId}.${key}`
}

function readParam(
  searchParams: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const raw = searchParams[name]
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === "string" && value.trim() ? value : undefined
}

/** Pull one panel's filter values out of the page search params. */
export function readPanelFilters(
  searchParams: Record<string, string | string[] | undefined>,
  panelId: string,
  keys: readonly PanelFilterKey[],
): PanelFilterValues {
  const values: PanelFilterValues = {}
  for (const key of keys) {
    const value = readParam(searchParams, panelParamName(panelId, key))
    if (value) values[key] = value
  }
  return values
}

/** Merge the global date range with a panel's own filters. */
export function toStatsFilters(
  range: { from?: Date; to?: Date },
  values: PanelFilterValues,
): StatsFilters {
  return {
    from: range.from,
    to: range.to,
    ownerId: values.owner,
    channelKey: values.channel,
    equipmentCategoryKey: values.category,
    statusKey: values.status,
  }
}

function filterCacheKey(filters: StatsFilters): string {
  return [
    filters.from?.getTime() ?? "",
    filters.to?.getTime() ?? "",
    filters.ownerId ?? "",
    filters.channelKey ?? "",
    filters.equipmentCategoryKey ?? "",
    filters.statusKey ?? "",
  ].join("|")
}

/**
 * Resolve one dataset per panel, sequentially and de-duplicated: panels that end up with identical
 * filters (the common case — nobody has narrowed anything yet) share a single round trip, and we
 * never fan out concurrent tenant transactions against a small connection pool.
 */
export async function loadPanelData<T>(
  filtersList: StatsFilters[],
  load: (filters: StatsFilters) => Promise<T>,
): Promise<T[]> {
  const cache = new Map<string, T>()
  const results: T[] = []
  for (const filters of filtersList) {
    const key = filterCacheKey(filters)
    if (!cache.has(key)) cache.set(key, await load(filters))
    results.push(cache.get(key) as T)
  }
  return results
}
