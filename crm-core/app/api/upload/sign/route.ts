import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/client";
import { withTenant } from "@/lib/db/rls";
import { rateLimit } from "@/lib/auth/rate-limit";
import { signUploadUrl } from "@/lib/storage/s3";
import { dealIdSchema } from "@/lib/schemas/deal-id";
import { extensionForMime, isDealUploadMimeType } from "@/lib/storage/upload-mime";
import { assertDealInScopeInTx } from "@/features/deals/guards";
import { randomUUID } from "crypto";
import { z } from "zod";

const SignRequestSchema = z.object({
  contentType: z.string(),
  size: z.number().int().positive(),
  dealId: dealIdSchema,
  tenantId: z.string().cuid(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await rateLimit(`upload:${session.user.id}`, 60, 60_000))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SignRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { contentType, size, dealId, tenantId } = parsed.data;

  if (!isDealUploadMimeType(contentType)) {
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

  // Scope check runs in the same transaction as the existence lookup — a restricted member
  // naming a foreign dealId gets the identical 404 a nonexistent deal would produce.
  const deal = await withTenant(tenantId, async (tx) => {
    const found = await tx.deal.findUnique({
      where: { id: dealId, tenantId },
      select: { id: true },
    });
    if (!found) return null;
    const inScope = await assertDealInScopeInTx(tx, tenantId, membership.role, session.user.id, dealId);
    return inScope ? found : null;
  });
  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const ext = extensionForMime(contentType);
  const key = `${tenantId}/deals/${dealId}/${randomUUID()}.${ext}`;
  let signed;
  try {
    signed = await signUploadUrl(key, contentType, size);
  } catch {
    return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  }
  const { signedUrl, publicUrl } = signed;

  return NextResponse.json({ signedUrl, key, publicUrl });
}
