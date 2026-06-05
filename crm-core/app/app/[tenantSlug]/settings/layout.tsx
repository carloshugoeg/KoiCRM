import React from "react"
import Link from "next/link"
import { SettingsNav } from "./_nav"

interface Props {
  children: React.ReactNode
  params: { tenantSlug: string }
}

export default function SettingsLayout({ children, params }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <SettingsNav tenantSlug={params.tenantSlug} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col overflow-hidden px-5 pt-4">
          {children}
        </div>
        <div className="mx-auto w-full max-w-lg shrink-0 border-t border-border/40 px-5 py-3">
          <Link
            href={`/app/${params.tenantSlug}/pipeline`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:brightness-110"
          >
            Volver al embudo
          </Link>
        </div>
      </div>
    </div>
  )
}
