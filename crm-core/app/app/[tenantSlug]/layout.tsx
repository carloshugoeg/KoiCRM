import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant, getUserMemberships } from "@/lib/tenant/resolve"
import { TenantProvider } from "@/lib/tenant/context"
import { TenantHeader } from "@/components/app/tenant-header"

interface Props {
  children: React.ReactNode
  params: { tenantSlug: string }
}

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/

function buildCssVars(branding: {
  primaryColor?: string | null
  bgColorLight?: string | null
  bgColorDark?: string | null
  headerBgColor?: string | null
  kpiBgColor?: string | null
} | null): string {
  if (!branding) return ""
  const valid = (v: string | null | undefined): v is string => v != null && HEX_COLOR_RE.test(v)
  const vars: string[] = []
  if (valid(branding.primaryColor)) vars.push(`--color-primary: ${branding.primaryColor};`)
  if (valid(branding.bgColorLight)) vars.push(`--color-bg-light: ${branding.bgColorLight};`)
  if (valid(branding.bgColorDark)) vars.push(`--color-bg-dark: ${branding.bgColorDark};`)
  if (valid(branding.headerBgColor)) vars.push(`--color-header-bg: ${branding.headerBgColor};`)
  if (valid(branding.kpiBgColor)) vars.push(`--color-kpi-bg: ${branding.kpiBgColor};`)
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
      <div className="min-h-screen flex flex-col" style={{ background: "var(--app-bg)" }}>
        <TenantHeader memberships={memberships} />
        <main className="flex-1">{children}</main>
        <footer className="py-4 text-center text-[11px] font-medium text-slate-400 bg-[#f8faff] w-full mt-auto border-t border-slate-200/50">
          Diseñado por Vértice y Desarrollado por Koi Software 2026
        </footer>
      </div>
    </TenantProvider>
  )
}

