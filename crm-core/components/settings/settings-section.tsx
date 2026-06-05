import { cn } from "@/lib/utils"

export function SettingsSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
      {children}
    </p>
  )
}

export function SettingsCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 bg-muted/30 border-border/80",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SettingsRowCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl p-3 border bg-muted/20 border-border/80",
        className,
      )}
    >
      {children}
    </div>
  )
}
