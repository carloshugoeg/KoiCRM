"use server";

import { auth } from "@/lib/auth/auth";
import { withTenant } from "@/lib/db/rls";
import { requireRole } from "@/lib/auth/rbac";
import { deleteObject } from "@/lib/storage/s3";
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

  const attachment = await withTenant(tenantId, async (tx) => {
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

  try {
    await withTenant(tenantId, async (tx) => {
      const att = await tx.attachment.findUniqueOrThrow({
        where: { id: attachmentId, tenantId },
      });
      await deleteObject(att.key);
      await tx.attachment.delete({ where: { id: attachmentId } });
      await tx.tenantSettings.update({
        where: { tenantId },
        data: { storageUsedBytes: { decrement: att.size } },
      });
    });
  } catch {
    return { ok: false as const, error: "Not found", code: "not_found" };
  }

  return { ok: true as const };
}
