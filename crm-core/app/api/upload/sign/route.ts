import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/client";
import { withTenant } from "@/lib/db/rls";
import { signUploadUrl } from "@/lib/storage/s3";
import { randomUUID } from "crypto";
import { z } from "zod";

const SignRequestSchema = z.object({
  contentType: z.string(),
  size: z.number().int().positive(),
  dealId: z.string().cuid(),
  tenantId: z.string().cuid(),
});

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SignRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { contentType, size, dealId, tenantId } = parsed.data;

  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json({ error: "invalid_content_type" }, { status: 400 });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, tenantId },
    select: { role: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const settings = await withTenant(tenantId, (tx) =>
    tx.tenantSettings.findUniqueOrThrow({ where: { tenantId } }),
  );

  if (BigInt(size) > settings.fileSizeMaxBytes) {
    return NextResponse.json(
      { code: "file_too_large", error: "El archivo supera el tamaño máximo permitido." },
      { status: 400 },
    );
  }

  if (settings.storageUsedBytes + BigInt(size) > settings.storageMaxBytes) {
    return NextResponse.json(
      {
        code: "storage_limit_exceeded",
        error: "Has excedido el límite de almacenamiento. Elimina archivos o actualiza tu plan.",
      },
      { status: 403 },
    );
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealId, tenantId },
    select: { id: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const ext = EXT_MAP[contentType] ?? "bin";
  const key = `${tenantId}/deals/${dealId}/${randomUUID()}.${ext}`;
  const { signedUrl, publicUrl } = await signUploadUrl(key, contentType, size);

  return NextResponse.json({ signedUrl, key, publicUrl });
}
