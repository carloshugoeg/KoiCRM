import { withTenant } from "@/lib/db/rls"

export async function listDealAttachments(tenantId: string, dealId: string) {
  return withTenant(tenantId, (tx) =>
    tx.attachment.findMany({
      where: { tenantId, dealId },
      orderBy: { createdAt: "desc" },
      select: { id: true, url: true, mimeType: true, size: true, createdAt: true },
    }),
  )
}
