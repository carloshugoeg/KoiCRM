import { type NextRequest, NextResponse } from "next/server"

/** Legacy redirect — email invitations used /api/invite/accept. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  const url = new URL("/api/join/accept", req.nextUrl.origin)
  if (token) url.searchParams.set("token", token)
  return NextResponse.redirect(url)
}
