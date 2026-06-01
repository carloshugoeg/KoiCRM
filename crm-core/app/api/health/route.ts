import { prisma } from "@/lib/db/client";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "ok", ts: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false, db: "error" }, { status: 503 });
  }
}
