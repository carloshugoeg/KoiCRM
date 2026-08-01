import { type NextRequest, NextResponse } from "next/server"
import type { Role } from "@prisma/client"
import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/client"
import { withTenant } from "@/lib/db/rls"
import { getObject } from "@/lib/storage/s3"
import { isTenantMediaObjectKey, isDealObjectKey } from "@/lib/storage/media-url"
import { LOCKED_ROLES } from "@/lib/permissions/defaults"
import { assertDealInScopeInTx } from "@/features/deals/guards"

type Props = { params: { key: string[] } }

function notFound() {
  return NextResponse.json({ error: "not_found" }, { status: 404 })
}

/**
 * Deal-attachment keys carry a nanoid and are never listed for a caller outside their scope
 * (getDealAttachmentsAction), but a URL that already circulated is still a bare object key —
 * membership in the tenant was the only check below, so any member holding a stale link could
 * pull a colleague's file. The Attachment row is the authoritative link from key to deal (the
 * key's own `.../deals/{dealId}/...` segment is caller-controlled input to the bucket, not a
 * fact about the database), so we resolve scope from that row rather than by parsing the key.
 *
 * A key with no Attachment row (never confirmed, or deleted) and a key for a deal outside the
 * caller's scope both fail this check — deliberately indistinguishable, same as the 404 below
 * for a storage miss, so a leaked URL can't be used to probe which case it is.
 */
async function callerCanSeeDealAttachment(
  tenantId: string,
  role: Role,
  userId: string,
  key: string,
): Promise<boolean> {
  return withTenant(tenantId, async (tx) => {
    const attachment = await tx.attachment.findUnique({
      where: { tenantId_key: { tenantId, key } },
      select: { dealId: true },
    })
    if (!attachment) return false
    // Client-scoped attachments (dealId null, clientId set) and orphaned rows (both null) have
    // no per-user deal scope to enforce — clients themselves are visible tenant-wide (see
    // getClientWithDealsInTx), only the deals under them are scoped — so membership is enough.
    if (!attachment.dealId) return true

    // Same scope check every deal-read guard uses, run on this function's own open transaction
    // instead of re-inlining permissionsForInTx + scopeFromPermissions + the deal lookup here.
    return assertDealInScopeInTx(tx, tenantId, role, userId, attachment.dealId)
  })
}

export async function GET(_req: NextRequest, { params }: Props) {
  const key = params.key.map((s) => decodeURIComponent(s)).join("/")

  if (!isTenantMediaObjectKey(key)) {
    return notFound()
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const tenantId = key.split("/")[0]!
  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
    select: { role: true },
  })
  if (!membership) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  // LOCKED_ROLES (OWNER/ADMIN) short-circuits before opening a transaction, same as
  // permissionsFor/assertDealInScope — an administrator's scope was always "everything",
  // so their request pays zero extra database work for this check.
  if (isDealObjectKey(key) && !LOCKED_ROLES.includes(membership.role)) {
    const visible = await callerCanSeeDealAttachment(tenantId, membership.role, session.user.id, key)
    if (!visible) return notFound()
  }

  try {
    const { body, contentType } = await getObject(key)
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch {
    return notFound()
  }
}
