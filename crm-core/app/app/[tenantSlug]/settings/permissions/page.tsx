import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { canManageSettings } from "@/lib/auth/rbac"
import { permissionMatrix, memberPermissions } from "@/lib/permissions/resolve"
import { getTenantMembers } from "@/features/tenants/queries"
import { PermissionsSettings } from "@/features/permissions/components/permissions-settings"
import {
  UserPermissions,
  type MemberRow,
} from "@/features/permissions/components/user-permissions"

interface Props {
  params: { tenantSlug: string }
}

export default async function PermissionsSettingsPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant, membership } = resolved
  if (!canManageSettings(membership.role)) notFound()

  const matrix = await permissionMatrix(tenant.id)
  const members = await getTenantMembers(tenant.id)
  const perUser = await memberPermissions(
    tenant.id,
    members.map((m) => ({ userId: m.userId, role: m.role })),
  )
  const byUser = new Map(perUser.map((p) => [p.userId, p]))

  const rows: MemberRow[] = members.flatMap((m) => {
    const found = byUser.get(m.userId)
    if (!found) return []
    return [
      {
        userId: m.userId,
        name: m.user.name ?? "",
        email: m.user.email,
        role: m.role,
        overrides: found.overrides,
        inherited: found.inherited,
      },
    ]
  })

  return (
    // The settings shell clips its children (`overflow-hidden` in settings/layout.tsx) and
    // expects each page to own its scrolling, the way Apariencia does. This page is the only
    // one that renders two sections instead of a single client component, so the scroll
    // belongs here rather than inside either of them — otherwise nothing scrolls at all and
    // "Excepciones por persona" is unreachable below the fold.
    <div className="min-h-0 flex-1 space-y-8 overflow-y-auto overscroll-contain pb-6">
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Permisos por rol</h2>
          <p className="text-xs text-muted-foreground">
            La base para todo el equipo. Cada persona hereda estos permisos según su rol.
          </p>
        </div>
        <PermissionsSettings tenantId={tenant.id} matrix={matrix} canManage />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Excepciones por persona</h2>
          <p className="text-xs text-muted-foreground">
            Ajusta a alguien en particular sin cambiarle el rol. Lo que definas aquí manda sobre
            la tabla de arriba.
          </p>
        </div>
        <UserPermissions tenantId={tenant.id} members={rows} canManage />
      </section>
    </div>
  )
}
