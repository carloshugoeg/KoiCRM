"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { Search } from "lucide-react"
import { useTenant } from "@/lib/tenant/context"
import { Button } from "@/components/ui/button"
import { CommandMenu } from "@/components/CommandMenu"
import type { Membership, Tenant } from "@prisma/client"

type MembershipWithTenant = Membership & { tenant: Pick<Tenant, "slug" | "name"> }

interface Props {
  memberships: MembershipWithTenant[]
}

export function TenantHeader({ memberships }: Props) {
  const { tenant } = useTenant()
  const pathname = usePathname()
  function navClass(href: string) {
    return pathname.startsWith(href)
      ? "text-sm font-semibold"
      : "text-sm text-muted-foreground hover:text-foreground transition-colors"
  }

  return (
    <header className="h-14 border-b flex items-center px-4 gap-4 shrink-0">
      <span className="font-semibold">{tenant.branding?.productName ?? tenant.name}</span>
      {memberships.length > 1 && (
        <nav className="flex gap-2 text-sm">
          {memberships.map((m) => (
            <Link
              key={m.tenant.slug}
              href={`/app/${m.tenant.slug}/pipeline`}
              className={
                m.tenant.slug === tenant.slug
                  ? "font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }
            >
              {m.tenant.name}
            </Link>
          ))}
        </nav>
      )}
      <nav className="flex gap-4">
        <Link href={`/app/${tenant.slug}/pipeline`} className={navClass(`/app/${tenant.slug}/pipeline`)}>
          Embudo
        </Link>
        <Link href={`/app/${tenant.slug}/calendar`} className={navClass(`/app/${tenant.slug}/calendar`)}>
          Calendario
        </Link>
        <Link href={`/app/${tenant.slug}/stats`} className={navClass(`/app/${tenant.slug}/stats`)}>
          Alertas
        </Link>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="text-muted-foreground text-xs gap-2"
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))}
        >
          <Search className="h-3.5 w-3.5" />
          Buscar
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            ⌘K
          </kbd>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/signin" })}>
          Salir
        </Button>
      </div>
      <CommandMenu tenantId={tenant.id} tenantSlug={tenant.slug} />
    </header>
  )
}
