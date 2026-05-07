import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  const email = req.nextUrl.searchParams.get("email")

  if (!token || !email) {
    return NextResponse.redirect(new URL("/signin?error=invalid_link", req.nextUrl.origin))
  }

  const record = await prisma.verificationToken.findUnique({ where: { token } })

  if (!record || record.identifier !== email || record.expires < new Date()) {
    return NextResponse.redirect(new URL("/signin?error=link_expired", req.nextUrl.origin))
  }

  await prisma.$transaction([
    prisma.user.update({ where: { email }, data: { emailVerified: new Date() } }),
    prisma.verificationToken.delete({ where: { token } }),
  ])

  return NextResponse.redirect(new URL("/signin?verified=1", req.nextUrl.origin))
}
