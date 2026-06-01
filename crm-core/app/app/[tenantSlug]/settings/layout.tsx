import React from "react"
import { SettingsNav } from "./_nav"

// ---------------------------------------------------------------------------
// SettingsLayout — server component
// ---------------------------------------------------------------------------

interface Props {
  children: React.ReactNode
  params: { tenantSlug: string }
}

export default function SettingsLayout({ children, params }: Props) {
  return (
    <div className="flex gap-0 min-h-[calc(100vh-3.5rem)]">
      <SettingsNav tenantSlug={params.tenantSlug} />
      <div className="flex-1 min-w-0 overflow-auto">{children}</div>
    </div>
  )
}
