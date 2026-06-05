"use server"

import { auth } from "@/lib/auth/auth"
import { getUserRole, canSeeAllDeals } from "@/lib/auth/rbac"
import {
  globalSearch,
  getSearchIntlSettings,
  type SearchResult,
  type SearchResultMeta,
  type SearchMatchVia,
} from "@/features/search/queries"

export type { SearchResult, SearchResultMeta, SearchMatchVia }

export async function globalSearchAction(
  tenantId: string,
  query: string,
): Promise<{ ok: boolean; results?: SearchResult[]; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "No autenticado." }

  const role = await getUserRole(session, tenantId)
  if (!role) return { ok: false, error: "Acceso denegado." }

  const intl = await getSearchIntlSettings(tenantId)
  const results = await globalSearch(
    tenantId,
    query,
    intl,
    canSeeAllDeals(role) ? undefined : session.user.id,
  )
  return { ok: true, results }
}
