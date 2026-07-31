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
  FileText,
  Menu,
  LogOut,
  type LucideIcon,
} from "lucide-react"
import { useTenant } from "@/lib/tenant/context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  // Same active/inactive distinction as navClass, sized as a full-width dropdown row
  // with a 44px minimum touch target for the collapsed (below-`board`) menu.
  function menuItemClass(href: string) {
    return cn(
      "flex min-h-11 w-full cursor-pointer items-center gap-2.5",
      pathname.startsWith(href) ? "font-semibold" : "text-muted-foreground",
    )
  }

  const base = `/app/${tenant.slug}`
  const productName = tenant.branding?.productName ?? tenant.name
  const logoUrl = tenant.branding?.logoUrl ?? null

  const navItems: { href: string; label: string; icon: LucideIcon; badge?: number }[] = [
    { href: `${base}/pipeline`, label: "Embudo", icon: LayoutDashboard },
    { href: `${base}/clients`, label: "Clientes", icon: Users, badge: clientsCount },
    { href: `${base}/reports`, label: "Reportes", icon: FileText },
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
        className="flex min-w-0 shrink items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            <span className="truncate font-semibold">{productName}</span>
          </>
        )}
      </Link>

      {/* board and above: full horizontal chrome, unchanged. Below `board` this whole
          block is replaced by the hamburger menu further down — every destination it
          holds (tenant switcher, nav links, PIN toggle, settings, search, salir) is
          reproduced there so nothing is dropped. */}
      {memberships.length > 1 && (
        <nav className="hidden gap-2 text-sm board:flex">
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
      <nav className="hidden gap-4 board:flex">
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
      <div className="ml-auto hidden items-center gap-2 board:flex">
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

      {/* Below `board`: hamburger + dropdown. Holds every destination the inline chrome
          above holds — nothing is dropped, including the right-hand items. */}
      <div className="ml-auto board:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Abrir menú"
              className="h-11 w-11 text-muted-foreground hover:text-foreground"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-64">
            {memberships.length > 1 && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Empresas
                </DropdownMenuLabel>
                {memberships.map((m) => (
                  <DropdownMenuItem key={m.tenant.slug} asChild>
                    <Link
                      href={`/app/${m.tenant.slug}/pipeline`}
                      className={cn(
                        "flex min-h-11 w-full cursor-pointer items-center",
                        m.tenant.slug === tenant.slug ? "font-semibold" : "text-muted-foreground",
                      )}
                    >
                      {m.tenant.name}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}

            {navItems.map(({ href, label, icon: Icon, badge }) => (
              <DropdownMenuItem key={href} asChild>
                <Link href={href} className={menuItemClass(href)}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="flex-1">{label}</span>
                  {badge != null && badge > 0 && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold leading-none text-muted-foreground">
                      {badge}
                    </span>
                  )}
                </Link>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            <div className="flex min-h-11 w-full items-center justify-between px-2 py-1.5">
              <span className="text-sm text-muted-foreground">Protección con PIN</span>
              <SessionPinToggle
                tenantId={tenantId}
                initialLocked={sessionPinLocked}
                hasPin={hasActionPin}
              />
            </div>

            <DropdownMenuItem asChild>
              <Link href={`${base}/settings/appearance`} className={menuItemClass(`${base}/settings`)}>
                <Settings className="h-4 w-4 shrink-0" aria-hidden />
                Configuración
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 text-muted-foreground"
              onSelect={() => openCommandMenu()}
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden />
              Buscar
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 text-destructive focus:text-destructive"
              onSelect={() => signOut({ callbackUrl: "/signin" })}
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              Salir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandMenu tenantId={tenant.id} tenantSlug={tenant.slug} />
    </header>
  )
}
