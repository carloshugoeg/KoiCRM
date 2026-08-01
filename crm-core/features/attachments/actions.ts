"use server";

import * as Sentry from "@sentry/nextjs";
import { auth } from "@/lib/auth/auth";
import { withTenant } from "@/lib/db/rls";
import { getUserRole } from "@/lib/auth/rbac";
import { deleteObject, getObjectSize } from "@/lib/storage/s3";
import type { Role } from "@prisma/client";
import { ConfirmUploadSchema, DeleteAttachmentSchema } from "./schemas";
import { listDealAttachments } from "./queries";
import { requireDealReaderInScope, assertDealInScopeInTx } from "@/features/deals/guards";

const ATTACHMENT_EDITOR_ROLES: readonly Role[] = ["OWNER", "ADMIN", "SUPERVISOR", "MEMBER"];

const HEAD_OBJECT_ATTEMPTS = 3;
const HEAD_OBJECT_RETRY_DELAYS_MS = [100, 300];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The authoritative size of an uploaded object, or `null` if S3 could not confirm it after
 * retrying transient failures. `null` is a distinct outcome from "0 bytes" — callers must not
 * treat it as a size, only as "verification unavailable right now".
 *
 * FINDING-005: `confirmUpload` used to trust the client-supplied `size` for both the quota
 * check and the `storageUsedBytes` increment, so declaring `size: 0` for a large file stored
 * it while accounting for none of it. Retrying here absorbs the transient network blips that
 * are the overwhelmingly common HEAD failure mode; a real S3 outage still must not block the
 * upload for a live user (the object is already durably stored) or silently fall back to the
 * declared size (that fallback IS the bypass) — see confirmUpload for how the `null` case is
 * handled instead.
 */
async function verifiedObjectSize(key: string): Promise<bigint | null> {
  for (let attempt = 0; attempt < HEAD_OBJECT_ATTEMPTS; attempt++) {
    try {
      return await getObjectSize(key);
    } catch (e) {
      if (attempt < HEAD_OBJECT_ATTEMPTS - 1) {
        await sleep(HEAD_OBJECT_RETRY_DELAYS_MS[attempt]);
        continue;
      }
      Sentry.captureException(e, {
        tags: { area: "attachments.confirmUpload.head_object" },
        extra: { key },
      });
      return null;
    }
  }
  return null;
}

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

  // FINDING-005: read the real size from S3 instead of trusting `data.size` — a client can
  // declare any size for an object it already PUT to the presigned URL, and `data.size` was
  // used for both the quota check and the storageUsedBytes increment, so `size: 0` stored a
  // large object while accounting for none of it. Resolved BEFORE the transaction: this is a
  // network call (with retries), and holding a pooled interactive transaction open across it
  // would fan out connection hold time under connection_limit=1.
  const verifiedSize = await verifiedObjectSize(data.key);

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

      if (verifiedSize !== null) {
        if (verifiedSize > settings.fileSizeMaxBytes) {
          throw Object.assign(new Error("file_too_large"), { code: "file_too_large" });
        }
        if (settings.storageUsedBytes + verifiedSize > settings.storageMaxBytes) {
          throw Object.assign(new Error("storage_limit_exceeded"), {
            code: "storage_limit_exceeded",
          });
        }
      } else {
        // S3 couldn't confirm the size (see verifiedObjectSize — already retried and logged
        // to Sentry). Falling back to the declared size here would be exactly the bypass
        // we're closing, so don't: only refuse outright if the tenant is already at/over
        // quota with numbers we DO trust, and otherwise let the upload through unaccounted
        // rather than break it for a live user. The Sentry event is how this gets noticed
        // and reconciled — see FINDING-005 in docs/AUDIT_BACKLOG.md for why there's no
        // automated reconciliation job in this change.
        if (settings.storageUsedBytes >= settings.storageMaxBytes) {
          throw Object.assign(new Error("storage_limit_exceeded"), {
            code: "storage_limit_exceeded",
          });
        }
      }

      const att = await tx.attachment.create({
        data: {
          tenantId,
          dealId: data.dealId ?? null,
          clientId: data.clientId ?? null,
          key: data.key,
          url: data.url,
          mimeType: data.mimeType,
          // Best-effort display value when unverified — never what accounting is based on.
          size: verifiedSize ?? BigInt(data.size),
        },
      });

      if (verifiedSize !== null) {
        await tx.tenantSettings.update({
          where: { tenantId },
          data: { storageUsedBytes: { increment: verifiedSize } },
        });
      } else {
        Sentry.captureMessage("attachment stored without verified size — storage accounting skipped", {
          level: "warning",
          tags: { area: "attachments.confirmUpload", tenantId, attachmentId: att.id },
          extra: { key: data.key, declaredSize: data.size },
        });
      }

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
    if (e instanceof Error && (e as { code?: string }).code === "file_too_large") {
      return {
        ok: false as const,
        error: "File too large",
        code: "file_too_large",
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
