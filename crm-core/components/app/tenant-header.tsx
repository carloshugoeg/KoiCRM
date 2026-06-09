"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  Search,
  Settings,
  LayoutDashboard,
  Users,
  Calendar,
  Archive,
  BarChart2,
  Droplets,
  type LucideIcon,
} from "lucide-react"
import { useTenant } from "@/lib/tenant/context"
import { Button } from "@/components/ui/button"
import { CommandMenu, openCommandMenu } from "@/components/CommandMenu"
import { UserAvatar } from "@/components/ui/user-avatar"
import { SessionPinToggle } from "@/features/auth/components/session-pin-toggle"
import type { Membership, Tenant } from "@prisma/client"

type MembershipWithTenant = Membership & { tenant: Pick<Tenant, "slug" | "name"> }

interface Props {
  tenantId: string
  memberships: MembershipWithTenant[]
  clientsCount: number
  /** Stats are a supervisory view — hidden from asesores. */
  canViewStats: boolean
  sessionPinLocked: boolean
  hasActionPin: boolean
  currentUser: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  }
}

export function TenantHeader({
  tenantId,
  memberships,
  clientsCount,
  canViewStats,
  sessionPinLocked,
  hasActionPin,
  currentUser,
}: Props) {
  const { tenant } = useTenant()
  const pathname = usePathname()
  function navClass(href: string) {
    return pathname.startsWith(href)
      ? "flex items-center gap-1.5 text-sm font-semibold"
      : "flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
  }

  const base = `/app/${tenant.slug}`
  const productName = tenant.branding?.productName ?? tenant.name
  const logoUrl = tenant.branding?.logoUrl ?? null

  const navItems: { href: string; label: string; icon: LucideIcon; badge?: number }[] = [
    { href: `${base}/pipeline`, label: "Embudo", icon: LayoutDashboard },
    { href: `${base}/clients`, label: "Clientes", icon: Users, badge: clientsCount },
    { href: `${base}/calendar`, label: "Calendario", icon: Calendar },
    { href: `${base}/archive`, label: "Archivo", icon: Archive },
    ...(canViewStats
      ? [{ href: `${base}/stats`, label: "Estadísticas", icon: BarChart2 }]
      : []),
  ]

  return (
    <header
      className="print:hidden sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 px-4 backdrop-blur-sm"
      style={{ background: "var(--header-bg)", borderBottom: "1px solid var(--header-border)" }}
    >
      <UserAvatar
        userId={currentUser.id}
        name={currentUser.name}
        email={currentUser.email}
        imageUrl={currentUser.image}
        size={32}
        className="shrink-0 shadow-sm"
      />
      <Link
        href={`${base}/pipeline`}
        className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title={productName}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={productName}
            className="h-8 max-w-[160px] object-contain object-left"
          />
        ) : (
          <>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-700">
              <Droplets className="h-4 w-4 text-white" aria-hidden />
            </span>
            <span className="font-semibold">{productName}</span>
          </>
        )}
      </Link>
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
        {navItems.map(({ href, label, icon: Icon, badge }) => (
          <Link key={href} href={href} className={navClass(href)}>
            <Icon className="h-4 w-4" />
            {label}
            {badge != null && badge > 0 && (
              <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold leading-none text-muted-foreground">
                {badge}
              </span>
            )}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <SessionPinToggle
          tenantId={tenantId}
          initialLocked={sessionPinLocked}
          hasPin={hasActionPin}
        />
        <Link
          href={`${base}/settings/appearance`}
          className={navClass(`${base}/settings`)}
          title="Configuración"
        >
          <Settings className="h-4 w-4" />
        </Link>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs text-muted-foreground"
          onClick={() => openCommandMenu()}
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
