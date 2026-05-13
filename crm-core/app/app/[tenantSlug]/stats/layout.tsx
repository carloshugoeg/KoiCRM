import { Suspense } from "react"
import { StatsShell } from "@/features/stats/components/StatsShell"

interface Props {
  children: React.ReactNode
  params: { tenantSlug: string }
}

export default function StatsLayout({ children, params }: Props) {
  return (
    <div className="flex flex-col h-full">
      <Suspense>
        <StatsShell tenantSlug={params.tenantSlug} />
      </Suspense>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}
