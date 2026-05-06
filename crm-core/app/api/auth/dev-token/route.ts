import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/client"

// Dev-only: returns the latest verification token for a given email.
// Gated behind NODE_ENV — never reaches production.
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 })
  }

  const email = req.nextUrl.searchParams.get("email")
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 })

  const record = await prisma.verificationToken.findFirst({
    where: { identifier: email },
    orderBy: { expires: "desc" },
  })

  if (!record) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({ token: record.token })
}
