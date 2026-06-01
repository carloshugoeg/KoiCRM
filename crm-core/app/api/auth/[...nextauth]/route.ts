import { handlers } from "@/lib/auth/auth";
import { rateLimit } from "@/lib/auth/rate-limit";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";

export const GET = handlers.GET;

export async function POST(req: NextRequest, ctx: unknown) {
  const url = new URL(req.url);
  if (url.pathname.includes("/callback/credentials")) {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!(await rateLimit(`signin:ip:${ip}`, 10, 60_000))) {
      return Response.redirect(new URL("/signin?error=TooManyRequests", req.url));
    }
  }
  return (handlers.POST as (req: NextRequest, ctx: unknown) => Promise<Response>)(req, ctx);
}
