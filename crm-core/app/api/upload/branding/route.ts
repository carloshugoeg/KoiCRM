import { type NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/client"
import { putObject } from "@/lib/storage/s3"

const BRANDING_MAX_BYTES = 5 * 1024 * 1024

const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}

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
  const kind = formData.get("kind")

  if (
    !(file instanceof File) ||
    typeof tenantId !== "string" ||
    (kind !== "logo" && kind !== "background")
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  const contentType = file.type || "image/jpeg"
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json({ error: "invalid_content_type" }, { status: 400 })
  }
  if (file.size <= 0 || file.size > BRANDING_MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 })
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
    select: { role: true },
  })
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const ext = EXT_MAP[contentType] ?? "bin"
  const key = `${tenantId}/branding/${kind}/${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const { publicUrl } = await putObject(key, buffer, contentType)
    return NextResponse.json({ publicUrl, key })
  } catch {
    return NextResponse.json({ error: "upload_failed" }, { status: 500 })
  }
}
