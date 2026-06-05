import { type NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { z } from "zod"
import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/client"
import { signUploadUrl } from "@/lib/storage/s3"

const AVATAR_MAX_BYTES = 2 * 1024 * 1024

const SignRequestSchema = z.object({
  tenantId: z.string().cuid(),
  targetUserId: z.string().cuid(),
  contentType: z.string(),
  size: z.number().int().positive().max(AVATAR_MAX_BYTES),
})

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

  const body = await req.json().catch(() => null)
  const parsed = SignRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  const { tenantId, targetUserId, contentType, size } = parsed.data

  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json({ error: "invalid_content_type" }, { status: 400 })
  }

  const callerMembership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
    select: { role: true },
  })
  if (!callerMembership) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const isSelf = session.user.id === targetUserId
  const canManageOthers = ["OWNER", "ADMIN"].includes(callerMembership.role)
  if (!isSelf && !canManageOthers) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const targetMembership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: targetUserId, tenantId } },
    select: { role: true },
  })
  if (!targetMembership) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const ext = EXT_MAP[contentType] ?? "bin"
  const key = `${tenantId}/avatars/${targetUserId}/${randomUUID()}.${ext}`
  const { signedUrl, publicUrl } = await signUploadUrl(key, contentType, size)

  return NextResponse.json({ signedUrl, key, publicUrl })
}
