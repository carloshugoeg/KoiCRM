import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/client"
import { getObject } from "@/lib/storage/s3"
import { isAvatarObjectKey } from "@/lib/storage/media-url"

type Props = { params: { key: string[] } }

export async function GET(_req: NextRequest, { params }: Props) {
  const key = params.key.map((s) => decodeURIComponent(s)).join("/")

  if (!isAvatarObjectKey(key)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const tenantId = key.split("/")[0]!
  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
    select: { id: true },
  })
  if (!membership) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  try {
    const { body, contentType } = await getObject(key)
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
}
