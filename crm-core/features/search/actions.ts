"use server"

import { auth } from "@/lib/auth/auth"
import { getUserRole } from "@/lib/auth/rbac"
import { pipelineScopeFor } from "@/lib/permissions/resolve"
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

  // pipelineScopeFor opens its own tenant transaction; sequenced ahead of globalSearch's two
  // concurrent tenant transactions (deals + clients) rather than alongside them, so this
  // route's peak concurrent-transaction count stays at 2.
  const scope = await pipelineScopeFor(tenantId, role, session.user.id)
  const intl = await getSearchIntlSettings(tenantId)
  const results = await globalSearch(tenantId, query, intl, scope.visibleToUserId ?? undefined)
  return { ok: true, results }
}
