import { PanelFilters } from "@/features/stats/components/PanelFilters"
import type {
  PanelFilterKey,
  PanelFilterValues,
  StatsFilterOptions,
} from "@/features/stats/panel-filters"

interface StatsPanelProps {
  title: string
  panelId: string
  /**
   * Dimensions offered by this panel. Rule of thumb across the screens: a panel never offers a
   * filter on the dimension it already breaks down by (no asesor filter on "por asesor", no canal
   * filter on "por canal") — that slice is already the panel's own axis.
   */
  filterKeys: readonly PanelFilterKey[]
  options: StatsFilterOptions
  values: PanelFilterValues
  /** `card` matches the bordered chart boxes; `plain` the table sections with a bare heading. */
  variant?: "card" | "plain"
  aside?: React.ReactNode
  children: React.ReactNode
}

/** A single stats panel: heading, its own filter control, and the rendered figures. */
export function StatsPanel({
  title,
  panelId,
  filterKeys,
  options,
  values,
  variant = "card",
  aside,
  children,
}: StatsPanelProps) {
  const header = (
    <div
      className={`flex items-center justify-between gap-3 flex-wrap ${
        variant === "card" ? "mb-4" : "mb-3"
      }`}
    >
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="flex items-center gap-2">
        {aside}
        <PanelFilters panelId={panelId} keys={filterKeys} options={options} values={values} />
      </div>
    </div>
  )

  if (variant === "plain") {
    return (
      <section>
        {header}
        {children}
      </section>
    )
  }

  return (
    <section className="rounded-lg border p-4">
      {header}
      {children}
    </section>
  )
}
