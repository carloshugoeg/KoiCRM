import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { canManageSettings } from "@/lib/auth/rbac"
import { getCatalogItems } from "@/features/catalogs/queries"
import { CatalogSettings } from "@/features/catalogs/components/catalog-settings"
import type { CatalogKey } from "@/features/catalogs/queries"

const CATALOG_KEYS: CatalogKey[] = ["equipment", "salesChannel", "dealStatus"]

interface Props {
  params: { tenantSlug: string }
}

export default async function CatalogsSettingsPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/signin")

  const resolved = await resolveTenant(params.tenantSlug, session)
  if (!resolved) notFound()

  const { tenant, membership } = resolved

  const allItems = await Promise.all(
    CATALOG_KEYS.map((k) => getCatalogItems(tenant.id, k))
  )

  const itemsByKey = Object.fromEntries(
    CATALOG_KEYS.map((k, i) => [k, allItems[i]])
  ) as Record<CatalogKey, Awaited<ReturnType<typeof getCatalogItems>>>

  return (
    <CatalogSettings
      tenant={tenant}
      itemsByKey={itemsByKey}
      canManage={canManageSettings(membership.role)}
    />
  )
}
