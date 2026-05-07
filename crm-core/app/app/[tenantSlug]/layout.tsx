import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant, getUserMemberships } from "@/lib/tenant/resolve"
import { TenantProvider } from "@/lib/tenant/context"
import { TenantHeader } from "@/components/app/tenant-header"

interface Props {
  children: React.ReactNode
  params: { tenantSlug: string }
}

function buildCssVars(branding: {
  primaryColor?: string | null
  bgColorLight?: string | null
  bgColorDark?: string | null
  headerBgColor?: string | null
  kpiBgColor?: string | null
} | null): string {
  if (!branding) return ""
  const vars: string[] = []
  if (branding.primaryColor) vars.push(`--color-primary: ${branding.primaryColor};`)
  if (branding.bgColorLight) vars.push(`--color-bg-light: ${branding.bgColorLight};`)
  if (branding.bgColorDark) vars.push(`--color-bg-dark: ${branding.bgColorDark};`)
  if (branding.headerBgColor) vars.push(`--color-header-bg: ${branding.headerBgColor};`)
  if (branding.kpiBgColor) vars.push(`--color-kpi-bg: ${branding.kpiBgColor};`)
  return vars.length ? `:root { ${vars.join(" ")} }` : ""
}

export default async function TenantLayout({ children, params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const [resolved, memberships] = await Promise.all([
    resolveTenant(params.tenantSlug, session),
    getUserMemberships(session.user.id),
  ])

  if (!resolved) notFound()

  const cssVars = buildCssVars(resolved.tenant.branding)

  return (
    <TenantProvider value={resolved}>
      {cssVars && (
        <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      )}
      <div className="min-h-screen flex flex-col">
        <TenantHeader memberships={memberships} />
        <main className="flex-1">{children}</main>
      </div>
    </TenantProvider>
  )
}
