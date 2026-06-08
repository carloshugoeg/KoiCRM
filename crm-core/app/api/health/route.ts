import { prisma } from "@/lib/db/client";
import { probeStorage } from "@/lib/storage/s3-health";
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
    const [dbResult, storage] = await Promise.all([
      Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("health db probe timeout")), DB_PROBE_MS),
        ),
      ]).then(() => "ok" as const).catch(() => "error" as const),
      probeStorage(),
    ]);

    if (dbResult === "error") {
      return NextResponse.json({ ok: false, db: "error", storage }, { status: 503 });
    }

    return NextResponse.json({
      ok: storage !== "error",
      db: dbResult,
      storage,
      ts: new Date().toISOString(),
    }, { status: storage === "error" ? 503 : 200 });
  } catch {
    return NextResponse.json({ ok: false, db: "error", storage: "error" }, { status: 503 });
  }
}
