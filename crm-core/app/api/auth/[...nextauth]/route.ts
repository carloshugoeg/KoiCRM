import { handlers } from "@/lib/auth/auth";
import { rateLimit } from "@/lib/auth/rate-limit";
import { getClientIp } from "@/lib/auth/client-ip";
import type { NextRequest } from "next/server";

export const GET = handlers.GET;

export async function POST(req: NextRequest, ctx: unknown) {
  const url = new URL(req.url);
  if (url.pathname.includes("/callback/credentials")) {
    // Keyed on a platform-set address, not the caller-appendable x-forwarded-for head.
    const ip = getClientIp();
    if (!(await rateLimit(`signin:ip:${ip}`, 10, 60_000))) {
      return Response.redirect(new URL("/signin?error=TooManyRequests", req.url));
    }
  }
  return (handlers.POST as (req: NextRequest, ctx: unknown) => Promise<Response>)(req, ctx);
}
