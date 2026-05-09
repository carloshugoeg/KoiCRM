"use server";

import { auth } from "@/lib/auth/auth";
import { withTenant } from "@/lib/db/rls";
import { requireRole } from "@/lib/auth/rbac";
import { deleteObject } from "@/lib/storage/s3";
import { Prisma } from "@prisma/client";
import { ConfirmUploadSchema, DeleteAttachmentSchema } from "./schemas";

export async function confirmUpload(tenantId: string, input: unknown) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: "Unauthorized", code: "unauthorized" };
  }
  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN", "MEMBER"]);
  } catch {
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

  // Fix 3: Re-enforce quota inside the transaction to prevent race conditions
  try {
    const attachment = await withTenant(tenantId, async (tx) => {
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
  try {
    await requireRole(session, tenantId, ["OWNER", "ADMIN", "MEMBER"]);
  } catch {
    return { ok: false as const, error: "Unauthorized", code: "unauthorized" };
  }

  const parsed = DeleteAttachmentSchema.safeParse({ id: attachmentId });
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid input", code: "invalid_input" };
  }

  // Fix 1 & 2: Capture key inside transaction, call deleteObject AFTER commit
  let keyToDelete: string;
  try {
    keyToDelete = await withTenant(tenantId, async (tx) => {
      const att = await tx.attachment.findUniqueOrThrow({
        where: { id: attachmentId, tenantId },
      });
      await tx.attachment.delete({ where: { id: attachmentId } });
      await tx.tenantSettings.update({
        where: { tenantId },
        data: { storageUsedBytes: { decrement: att.size } },
      });
      return att.key;
    });
  } catch (e) {
    // Fix 2: Only handle P2025 (not found); rethrow everything else
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return { ok: false as const, error: "Not found", code: "not_found" };
    }
    throw e;
  }

  // S3 delete runs AFTER transaction commits — an orphaned S3 object is
  // preferable to a deleted S3 object whose DB row still exists.
  await deleteObject(keyToDelete);
  return { ok: true as const };
}
