"use client"

import Link from "next/link"
import { signOut } from "next-auth/react"
import { useTenant } from "@/lib/tenant/context"
import { Button } from "@/components/ui/button"
import type { Membership, Tenant } from "@prisma/client"

type MembershipWithTenant = Membership & { tenant: Pick<Tenant, "slug" | "name"> }

interface Props {
  memberships: MembershipWithTenant[]
}

export function TenantHeader({ memberships }: Props) {
  const { tenant } = useTenant()

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
      <div className="ml-auto">
        <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/signin" })}>
          Salir
        </Button>
      </div>
    </header>
  )
}
