import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { checkTenantEmbudoAccess } from "@/lib/tenant/access"
import { resolveTenant, getUserMemberships } from "@/lib/tenant/resolve"
import { canSeeAllDeals } from "@/lib/auth/rbac"
import { TenantProvider } from "@/lib/tenant/context"
import { TenantHeader } from "@/components/app/tenant-header"
import { buildCssVars } from "@/lib/branding/css-vars"
import { countClients } from "@/features/clients/queries"
import { getFollowUpAlerts } from "@/features/follow-ups/queries"
import {
  countFollowUpBannerItems,
  toFollowUpBannerItems,
} from "@/features/follow-ups/banner-items"
import { FollowUpBanners } from "@/features/follow-ups/components/follow-up-banners"
import { getSessionPinLockStatusAction } from "@/features/auth/session-pin-actions"
import { PinProvider } from "@/features/auth/pin-gate"

interface Props {
  children: React.ReactNode
  params: { tenantSlug: string }
}

export default async function TenantLayout({ children, params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const [resolved, memberships] = await Promise.all([
    resolveTenant(params.tenantSlug, session),
    getUserMemberships(session.user.id),
  ])

  if (!resolved) {
    notFound()
  }

  const embudoAccess = await checkTenantEmbudoAccess(session.user.id, params.tenantSlug)
  if (!embudoAccess.allowed) {
    redirect(`/app/access?reason=${embudoAccess.reason}`)
  }

  const tenantId = resolved.tenant.id
  const canSeeAll = canSeeAllDeals(resolved.membership.role)
  const ownerFilter = canSeeAll ? undefined : session.user.id

  const [clientsCount, followUpAlerts, sessionPin] = await Promise.all([
    countClients(tenantId),
    getFollowUpAlerts(tenantId, ownerFilter),
    getSessionPinLockStatusAction(tenantId),
  ])

  const followUpBannerItems = toFollowUpBannerItems(followUpAlerts)
  const followUpBannerTotal = countFollowUpBannerItems(followUpAlerts)

  const cssVars = buildCssVars(resolved.tenant.branding)

  return (
    <TenantProvider value={resolved}>
      {cssVars && <style dangerouslySetInnerHTML={{ __html: cssVars }} />}
      <PinProvider>
      <div
        className="flex h-dvh flex-col overflow-hidden print:h-auto print:min-h-screen print:overflow-visible"
        style={{ background: "var(--app-bg)" }}
      >
        <TenantHeader
          tenantId={tenantId}
          memberships={memberships}
          clientsCount={clientsCount}
          canViewStats={canSeeAllDeals(resolved.membership.role)}
          sessionPinLocked={sessionPin.locked}
          hasActionPin={sessionPin.hasPin}
          currentUser={{
            id: session.user.id,
            name: session.user.name ?? null,
            email: session.user.email ?? null,
            image: session.user.image ?? null,
          }}
        />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-14 print:min-h-0 print:overflow-visible print:pb-0">
          {children}
        </main>
        <FollowUpBanners
          tenantSlug={params.tenantSlug}
          items={followUpBannerItems}
          totalCount={followUpBannerTotal}
        />
        <footer className="print:hidden fixed inset-x-0 bottom-0 z-40 w-full border-t border-slate-200/50 bg-[#f8faff] py-4 text-center text-[11px] font-medium text-slate-400">
          Diseñado por Vértice y Desarrollado por Koi Software 2026
        </footer>
      </div>
      </PinProvider>
    </TenantProvider>
  )
}
