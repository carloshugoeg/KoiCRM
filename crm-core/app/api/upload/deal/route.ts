import { type NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/client"
import { withTenant } from "@/lib/db/rls"
import { putObject } from "@/lib/storage/s3"
import { dealIdSchema } from "@/lib/schemas/deal-id"
import { extensionForMime, isDealUploadMimeType } from "@/lib/storage/upload-mime"

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await req.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  const file = formData.get("file")
  const tenantId = formData.get("tenantId")
  const dealIdRaw = formData.get("dealId")
  const contentTypeRaw = formData.get("contentType")

  if (!(file instanceof File) || typeof tenantId !== "string" || typeof dealIdRaw !== "string") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  const dealParsed = dealIdSchema.safeParse(dealIdRaw)
  if (!dealParsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }
  const dealId = dealParsed.data

  const contentType =
    typeof contentTypeRaw === "string" && contentTypeRaw
      ? contentTypeRaw
      : file.type || "application/octet-stream"

  if (!isDealUploadMimeType(contentType)) {
    return NextResponse.json({ error: "invalid_content_type" }, { status: 400 })
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, tenantId },
    select: { role: true },
  })
  if (!membership) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const settings = await withTenant(tenantId, (tx) =>
    tx.tenantSettings.findUniqueOrThrow({ where: { tenantId } }),
  )

  if (BigInt(file.size) > settings.fileSizeMaxBytes) {
    return NextResponse.json(
      { code: "file_too_large", error: "El archivo supera el tamaño máximo permitido." },
      { status: 400 },
    )
  }

  if (settings.storageUsedBytes + BigInt(file.size) > settings.storageMaxBytes) {
    return NextResponse.json(
      {
        code: "storage_limit_exceeded",
        error: "Has excedido el límite de almacenamiento. Elimina archivos o actualiza tu plan.",
      },
      { status: 403 },
    )
  }

  const deal = await withTenant(tenantId, (tx) =>
    tx.deal.findUnique({
      where: { id: dealId, tenantId },
      select: { id: true },
    }),
  )
  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 })
  }

  const ext = extensionForMime(contentType)
  const key = `${tenantId}/deals/${dealId}/${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const { publicUrl } = await putObject(key, buffer, contentType)
    return NextResponse.json({ signedUrl: null, key, publicUrl })
  } catch {
    return NextResponse.json({ error: "upload_failed" }, { status: 500 })
  }
}
