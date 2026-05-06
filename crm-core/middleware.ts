import { auth } from "@/lib/auth/auth"

export default auth((req) => {
  const isAuthenticated = !!req.auth
  const { pathname } = req.nextUrl

  if (pathname.startsWith("/app") && !isAuthenticated) {
    const url = new URL("/signin", req.nextUrl.origin)
    url.searchParams.set("callbackUrl", pathname)
    return Response.redirect(url)
  }
})

export const config = {
  matcher: ["/app/:path*"],
}
