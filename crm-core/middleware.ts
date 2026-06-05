import { auth } from "@/lib/auth/auth"

export default auth((req) => {
  const isAuthenticated = !!req.auth?.user
  const { pathname } = req.nextUrl

  if (pathname.startsWith("/app") && !isAuthenticated) {
    const url = new URL("/signin", req.nextUrl.origin)
    // Always resolve tenant via /app after login to avoid stale slug 404s (e.g. old bookmarks).
    url.searchParams.set("callbackUrl", "/app")
    return Response.redirect(url)
  }
})

export const config = {
  matcher: ["/app/:path*"],
}
