import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/client"
import { withEstablishedAppRole } from "@/lib/db/rls"
import { checkTenantEmbudoAccess } from "@/lib/tenant/access"
import { isJoinLinkActive } from "@/lib/tenant/join-link"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  if (!token) {
    return NextResponse.redirect(new URL("/signin?error=invalid_link", req.nextUrl.origin))
  }

  const joinLink = await prisma.joinLink.findUnique({ where: { token } })
  if (joinLink && isJoinLinkActive(joinLink)) {
    const session = await auth()
    if (!session?.user?.id) {
      const callbackUrl = `/api/join/accept?token=${token}`
      const url = new URL("/signin", req.nextUrl.origin)
      url.searchParams.set("callbackUrl", callbackUrl)
      return NextResponse.redirect(url)
    }

    const existing = await prisma.membership.findUnique({
      where: { userId_tenantId: { userId: session.user.id, tenantId: joinLink.tenantId } },
    })

    if (!existing) {
      await prisma.membership.create({
        data: {
          userId: session.user.id,
          tenantId: joinLink.tenantId,
          role: joinLink.role,
        },
      })
    }

    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: joinLink.tenantId },
      select: { slug: true },
    })

    const embudoAccess = await checkTenantEmbudoAccess(session.user.id, tenant.slug)
    if (!embudoAccess.allowed) {
      return NextResponse.redirect(
        new URL(`/app/access?reason=${embudoAccess.reason}`, req.nextUrl.origin),
      )
    }

    return NextResponse.redirect(new URL(`/app/${tenant.slug}/pipeline`, req.nextUrl.origin))
  }

  // Legacy email invitations
  const invitation = await prisma.invitation.findUnique({ where: { token } })
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    return NextResponse.redirect(new URL("/signin?error=link_expired", req.nextUrl.origin))
  }

  const session = await auth()
  if (!session?.user?.id) {
    const callbackUrl = `/api/join/accept?token=${token}`
    const url = new URL("/signin", req.nextUrl.origin)
    url.searchParams.set("callbackUrl", callbackUrl)
    return NextResponse.redirect(url)
  }

  if (session.user.email !== invitation.email) {
    return NextResponse.redirect(new URL("/signin?error=wrong_account", req.nextUrl.origin))
  }

  const existing = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId: invitation.tenantId } },
  })

  if (!existing) {
    await withEstablishedAppRole(() =>
      prisma.$transaction([
        prisma.membership.create({
          data: { userId: session.user.id, tenantId: invitation.tenantId, role: invitation.role },
        }),
        prisma.invitation.update({ where: { token }, data: { acceptedAt: new Date() } }),
      ]),
    )
  }

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: invitation.tenantId },
    select: { slug: true },
  })

  const embudoAccess = await checkTenantEmbudoAccess(session.user.id, tenant.slug)
  if (!embudoAccess.allowed) {
    return NextResponse.redirect(
      new URL(`/app/access?reason=${embudoAccess.reason}`, req.nextUrl.origin),
    )
  }

  return NextResponse.redirect(new URL(`/app/${tenant.slug}/pipeline`, req.nextUrl.origin))
}
