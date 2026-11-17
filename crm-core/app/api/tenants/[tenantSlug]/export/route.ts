import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { canManageSettings } from "@/lib/auth/rbac";
import { buildTenantCsvExport } from "@/lib/export/tenant-csv";
import { resolveTenant } from "@/lib/tenant/resolve";

type Props = { params: { tenantSlug: string } };

function jsonError(error: "unauthorized" | "not_found" | "forbidden", status: 401 | 404 | 403) {
  return NextResponse.json({ error }, { status });
}

function safeSlug(slug: string): string {
  const cleaned = slug.replace(/[^a-z0-9-]/g, "");
  return cleaned || "tenant";
}

export async function GET(_req: NextRequest, { params }: Props) {
  const session = await auth();
  if (!session?.user?.id) return jsonError("unauthorized", 401);

  const resolved = await resolveTenant(params.tenantSlug, session);
  if (!resolved) return jsonError("not_found", 404);

  const { membership, tenant } = resolved;
  if (membership.status !== "ACTIVE" || !canManageSettings(membership.role)) {
    return jsonError("forbidden", 403);
  }

  const { zip } = await buildTenantCsvExport(tenant.id);
  const filename = `${safeSlug(tenant.slug)}-crm.zip`;
  return new NextResponse(new Uint8Array(zip), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
