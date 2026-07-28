"use server";

import { auth } from "@/lib/auth/auth";
import { withTenant } from "@/lib/db/rls";
import { getUserRole } from "@/lib/auth/rbac";
import { deleteObject } from "@/lib/storage/s3";
import type { Role } from "@prisma/client";
import { ConfirmUploadSchema, DeleteAttachmentSchema } from "./schemas";
import { listDealAttachments } from "./queries";
import { requireDealReaderInScope, assertDealInScopeInTx } from "@/features/deals/guards";

const ATTACHMENT_EDITOR_ROLES: readonly Role[] = ["OWNER", "ADMIN", "SUPERVISOR", "MEMBER"];

export interface DealAttachmentDTO {
  id: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export async function getDealAttachmentsAction(
  tenantId: string,
  dealId: string,
): Promise<DealAttachmentDTO[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  try {
    // listDealAttachments filters {tenantId, dealId} alone — without the scope check below,
    // any tenant member could read a colleague's attachment list (and the file `url`s it
    // returns) by supplying a foreign dealId. Same guard as the deal-read actions in
    // features/deals/actions.ts.
    await requireDealReaderInScope(session, session.user.id, tenantId, dealId);
  } catch {
    return [];
  }
  const rows = await listDealAttachments(tenantId, dealId);
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    mimeType: r.mimeType,
    size: Number(r.size),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function confirmUpload(tenantId: string, input: unknown) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: "Unauthorized", code: "unauthorized" };
  }
  const role = await getUserRole(session, tenantId);
  if (!role || !ATTACHMENT_EDITOR_ROLES.includes(role)) {
    return { ok: false as const, error: "Unauthorized", code: "unauthorized" };
  }

  const parsed = ConfirmUploadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid input", code: "invalid_input" };
  }
  const data = parsed.data;

  // Fix 5: Validate the key belongs to this tenant before any DB work
  if (!data.key.startsWith(`${tenantId}/`)) {
    return { ok: false as const, error: "Invalid key", code: "invalid_input" };
  }

  // Fix 3: Re-enforce quota inside the transaction to prevent race conditions. The scope check
  // (when the attachment is tied to a deal) runs in the same transaction — a restricted caller
  // cannot attach a file to a deal they cannot see, and gets the same "not found" shape as
  // naming a deal that doesn't exist.
  try {
    const attachment = await withTenant(tenantId, async (tx) => {
      if (data.dealId) {
        const inScope = await assertDealInScopeInTx(tx, tenantId, role, session.user.id, data.dealId);
        if (!inScope) {
          throw Object.assign(new Error("not_found"), { code: "not_found" });
        }
      }

      const settings = await tx.tenantSettings.findUniqueOrThrow({
        where: { tenantId },
      });
      if (settings.storageUsedBytes + BigInt(data.size) > settings.storageMaxBytes) {
        throw Object.assign(new Error("storage_limit_exceeded"), {
          code: "storage_limit_exceeded",
        });
      }

      const att = await tx.attachment.create({
        data: {
          tenantId,
          dealId: data.dealId ?? null,
          clientId: data.clientId ?? null,
          key: data.key,
          url: data.url,
          mimeType: data.mimeType,
          size: BigInt(data.size),
        },
      });
      await tx.tenantSettings.update({
        where: { tenantId },
        data: { storageUsedBytes: { increment: BigInt(data.size) } },
      });
      return att;
    });

    return { ok: true as const, data: attachment };
  } catch (e) {
    if (e instanceof Error && (e as { code?: string }).code === "not_found") {
      return { ok: false as const, error: "Deal not found", code: "not_found" };
    }
    if (
      e instanceof Error &&
      (e as { code?: string }).code === "storage_limit_exceeded"
    ) {
      return {
        ok: false as const,
        error: "Storage limit exceeded",
        code: "storage_limit_exceeded",
      };
    }
    throw e;
  }
}

export async function deleteAttachment(tenantId: string, attachmentId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: "Unauthorized", code: "unauthorized" };
  }
  const role = await getUserRole(session, tenantId);
  if (!role || !ATTACHMENT_EDITOR_ROLES.includes(role)) {
    return { ok: false as const, error: "Unauthorized", code: "unauthorized" };
  }

  const parsed = DeleteAttachmentSchema.safeParse({ id: attachmentId });
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid input", code: "invalid_input" };
  }

  // Fix 1 & 2: Capture key inside transaction, call deleteObject AFTER commit. The scope check
  // (for a deal attachment) runs in the same transaction, right alongside the lookup it already
  // needed for `att.size` — an out-of-scope attachment is rejected the same way as one that
  // doesn't exist, so a foreign attachment id isn't an existence oracle.
  let keyToDelete: string;
  try {
    keyToDelete = await withTenant(tenantId, async (tx) => {
      const att = await tx.attachment.findUnique({
        where: { id: attachmentId, tenantId },
      });
      if (!att) throw Object.assign(new Error("not_found"), { code: "not_found" });
      if (att.dealId) {
        const inScope = await assertDealInScopeInTx(tx, tenantId, role, session.user.id, att.dealId);
        if (!inScope) throw Object.assign(new Error("not_found"), { code: "not_found" });
      }
      await tx.attachment.delete({ where: { id: attachmentId } });
      await tx.tenantSettings.update({
        where: { tenantId },
        data: { storageUsedBytes: { decrement: att.size } },
      });
      return att.key;
    });
  } catch (e) {
    if (e instanceof Error && (e as { code?: string }).code === "not_found") {
      return { ok: false as const, error: "Not found", code: "not_found" };
    }
    throw e;
  }

  // S3 delete runs AFTER transaction commits — an orphaned S3 object is
  // preferable to a deleted S3 object whose DB row still exists.
  await deleteObject(keyToDelete);
  return { ok: true as const };
}
