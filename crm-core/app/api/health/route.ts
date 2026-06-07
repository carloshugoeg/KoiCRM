import { prisma } from "@/lib/db/client";
import { NextResponse } from "next/server";

// Never pre-render at build time — DB is not available during `next build` on Vercel.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DB_PROBE_MS = 8_000;

export async function GET() {
  // Next may invoke route handlers during `next build`; DB is unavailable there.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return NextResponse.json({ ok: true, db: "skipped", ts: new Date().toISOString() });
  }

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("health db probe timeout")), DB_PROBE_MS),
      ),
    ]);
    return NextResponse.json({ ok: true, db: "ok", ts: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false, db: "error" }, { status: 503 });
  }
}
