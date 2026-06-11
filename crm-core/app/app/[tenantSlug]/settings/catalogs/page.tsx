import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { resolveTenant } from "@/lib/tenant/resolve"
import { canManageSettings } from "@/lib/auth/rbac"
import { getCatalogItems, getEquipmentHierarchy } from "@/features/catalogs/queries"
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

  const [allItems, equipmentCategories] = await Promise.all([
    Promise.all(CATALOG_KEYS.map((k) => getCatalogItems(tenant.id, k))),
    getEquipmentHierarchy(tenant.id),
  ])

  const itemsByKey = Object.fromEntries(
    CATALOG_KEYS.map((k, i) => [k, allItems[i]])
  ) as Record<CatalogKey, Awaited<ReturnType<typeof getCatalogItems>>>

  return (
    <CatalogSettings
      tenant={tenant}
      itemsByKey={itemsByKey}
      equipmentCategories={equipmentCategories}
      canManage={canManageSettings(membership.role)}
    />
  )
}
