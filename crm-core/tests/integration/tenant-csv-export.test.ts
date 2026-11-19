import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { cleanDatabase, disconnectAll, prismaAdmin } from "./helpers";

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn() }));

import { GET } from "@/app/api/tenants/[tenantSlug]/export/route";
import { auth } from "@/lib/auth/auth";
import { buildTenantCsvExport } from "@/lib/export/tenant-csv";

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

const SHEET_NAMES = [
  "tenant.csv",
  "tenant_settings.csv",
  "tenant_branding.csv",
  "memberships.csv",
  "invitations.csv",
  "join_links.csv",
  "pipelines.csv",
  "pipeline_stages.csv",
  "catalog_items.csv",
  "custom_field_definitions.csv",
  "clients.csv",
  "deals.csv",
  "deal_equipment.csv",
  "deal_viewers.csv",
  "quotes.csv",
  "payments.csv",
  "attachments.csv",
  "follow_ups.csv",
  "notes.csv",
  "activities.csv",
  "saved_views.csv",
  "counters.csv",
  "role_permissions.csv",
  "user_permissions.csv",
];

const PASSWORD_SENTINEL = "password-sentinel-do-not-export";
const PIN_SENTINEL = "pin-hash-sentinel-do-not-export";
const INVITE_SENTINEL = "invite-token-sentinel-do-not-export";
const JOIN_SENTINEL = "join-token-sentinel-do-not-export";
const SECRETS = [PASSWORD_SENTINEL, PIN_SENTINEL, INVITE_SENTINEL, JOIN_SENTINEL];
const QUOTE_HEADER = "id,tenantId,dealId,number,date,fileUrl,isVoid,customData,createdAt";
const CUSTOM_DATA = { note: 'ONLY-A-CUSTOM, "q"' };
const JOIN_LABEL = "join-label-visible";

function quotedJson(value: object): string {
  return `"${JSON.stringify(value).replaceAll('"', '""')}"`;
}

type OpenedZip = {
  names: string[];
  files: Record<string, string>;
};

function unzipWithPython(bytes: Buffer): OpenedZip {
  const dir = mkdtempSync(join(tmpdir(), "tenant-csv-"));
  const zipPath = join(dir, "export.zip");
  try {
    writeFileSync(zipPath, bytes);
    const script = [
      "import json, sys, zipfile",
      "archive = zipfile.ZipFile(sys.argv[1])",
      "names = archive.namelist()",
      "files = {name: archive.read(name).decode('utf-8') for name in names}",
      "print(json.dumps({'names': names, 'files': files}))",
    ].join("\n");
    const raw = execFileSync("python3", ["-c", script, zipPath], { encoding: "utf-8" });
    return JSON.parse(raw) as OpenedZip;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function cellBoundary(value: string): RegExp {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|,)${escaped}(,|\\r|\\n|$)`);
}

function assertTenantAExport(zip: Buffer, ownerEmail: string, otherEmail: string) {
  const opened = unzipWithPython(zip);
  expect(opened.names).toEqual(SHEET_NAMES);

  for (const name of SHEET_NAMES) {
    expect(opened.files[name]?.startsWith("\uFEFF")).toBe(true);
  }

  const clients = opened.files["clients.csv"]!;
  expect(clients).toContain("ONLY-A");
  expect(clients).toContain(quotedJson(CUSTOM_DATA));
  expect(clients).not.toContain("ONLY-B");
  for (const text of Object.values(opened.files)) {
    expect(text).not.toContain("ONLY-B");
  }

  expect(dealValueText).toMatch(/^1999\.50?$/);
  expect(opened.files["deals.csv"]).toMatch(cellBoundary(dealValueText));
  expect(opened.files["tenant.csv"]).toContain(slugA);
  expect(opened.files["invitations.csv"]).toContain(inviteEmail);
  expect(opened.files["join_links.csv"]).toContain(JOIN_LABEL);
  expect(opened.files["memberships.csv"]).toContain(ownerEmail);
  expect(zip.includes(otherEmail)).toBe(false);

  for (const secret of SECRETS) {
    expect(zip.includes(secret)).toBe(false);
  }

  const quoteLines = opened.files["quotes.csv"]!.replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/);
  expect(quoteLines).toEqual([QUOTE_HEADER]);
}

function callGet(slug: string) {
  return GET(new NextRequest(`http://localhost/api/tenants/${slug}/export`), {
    params: { tenantSlug: slug },
  });
}

function session(userId: string): Session {
  return { user: { id: userId } } as Session;
}

let tenantAId = "";
let slugA = "";
let slugB = "";
let ownerAId = "";
let memberAId = "";
let adminAId = "";
let inactiveAId = "";
let ownerEmail = "";
let ownerBEmail = "";
let inviteEmail = "";
let dealValueText = "";

beforeAll(async () => {
  await cleanDatabase();

  const suffix = Date.now().toString(36);
  slugA = `csv-export-a-${suffix}`;
  slugB = `csv-export-b-${suffix}`;
  ownerEmail = `owner-a-${suffix}@csv-export.test`;
  ownerBEmail = `owner-b-${suffix}@csv-export.test`;
  inviteEmail = `invite-a-${suffix}@csv-export.test`;

  const tenantA = await prismaAdmin.tenant.create({ data: { slug: slugA, name: "Tenant A" } });
  const tenantB = await prismaAdmin.tenant.create({ data: { slug: slugB, name: "Tenant B" } });
  tenantAId = tenantA.id;

  const ownerA = await prismaAdmin.user.create({
    data: { email: ownerEmail, name: "Owner A", password: PASSWORD_SENTINEL },
  });
  ownerAId = ownerA.id;
  const memberA = await prismaAdmin.user.create({
    data: { email: `member-a-${suffix}@csv-export.test`, name: "Member A" },
  });
  memberAId = memberA.id;
  const ownerB = await prismaAdmin.user.create({
    data: { email: ownerBEmail, name: "Owner B" },
  });

  await prismaAdmin.membership.create({
    data: {
      userId: ownerAId,
      tenantId: tenantA.id,
      role: "OWNER",
      status: "ACTIVE",
      actionPinHash: PIN_SENTINEL,
    },
  });
  await prismaAdmin.membership.create({
    data: { userId: memberAId, tenantId: tenantA.id, role: "MEMBER", status: "ACTIVE" },
  });
  await prismaAdmin.membership.create({
    data: { userId: ownerB.id, tenantId: tenantB.id, role: "OWNER", status: "ACTIVE" },
  });

  const adminA = await prismaAdmin.user.create({
    data: { email: `admin-a-${suffix}@csv-export.test`, name: "Admin A" },
  });
  adminAId = adminA.id;
  await prismaAdmin.membership.create({
    data: { userId: adminAId, tenantId: tenantA.id, role: "ADMIN", status: "ACTIVE" },
  });

  const inactiveA = await prismaAdmin.user.create({
    data: { email: `inactive-a-${suffix}@csv-export.test`, name: "Inactive A" },
  });
  inactiveAId = inactiveA.id;
  await prismaAdmin.membership.create({
    data: { userId: inactiveAId, tenantId: tenantA.id, role: "OWNER", status: "INACTIVE" },
  });

  await prismaAdmin.invitation.create({
    data: {
      tenantId: tenantA.id,
      email: inviteEmail,
      role: "MEMBER",
      token: INVITE_SENTINEL,
      expiresAt: new Date("2026-12-31T00:00:00.000Z"),
    },
  });
  await prismaAdmin.joinLink.create({
    data: { tenantId: tenantA.id, token: JOIN_SENTINEL, role: "MEMBER", label: JOIN_LABEL },
  });

  const clientA = await prismaAdmin.client.create({
    data: {
      tenantId: tenantA.id,
      name: "ONLY-A",
      customData: CUSTOM_DATA,
    },
  });
  await prismaAdmin.client.create({
    data: { tenantId: tenantB.id, name: "ONLY-B" },
  });

  const pipeline = await prismaAdmin.pipeline.create({
    data: { tenantId: tenantA.id, name: "Embudo", isDefault: true },
  });
  const stage = await prismaAdmin.pipelineStage.create({
    data: {
      tenantId: tenantA.id,
      pipelineId: pipeline.id,
      order: 0,
      key: "nuevo",
      label: "Nuevo",
      color: "#6366f1",
      iconKey: "circle",
    },
  });
  const deal = await prismaAdmin.deal.create({
    data: {
      id: `c${randomBytes(12).toString("hex")}`,
      tenantId: tenantA.id,
      pipelineId: pipeline.id,
      stageId: stage.id,
      clientId: clientA.id,
      ownerId: ownerAId,
      name: "Deal A",
      channelKey: "web",
      statusKey: "active",
      value: "1999.50",
    },
  });
  dealValueText = deal.value.toString();
});

beforeEach(() => {
  mockAuth.mockReset();
});

afterAll(async () => {
  await cleanDatabase();
  await disconnectAll();
});

describe("GET /api/tenants/[tenantSlug]/export", () => {
  it("returns 401 when there is no user", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await callGet(slugA);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("returns 403 for a member of the tenant", async () => {
    mockAuth.mockResolvedValue(session(memberAId));
    const res = await callGet(slugA);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
  });

  it("returns 403 for an inactive owner", async () => {
    mockAuth.mockResolvedValue(session(inactiveAId));
    const res = await callGet(slugA);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
  });

  it("returns the zip for an active admin", async () => {
    mockAuth.mockResolvedValue(session(adminAId));
    const res = await callGet(slugA);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/zip");
    assertTenantAExport(Buffer.from(await res.arrayBuffer()), ownerEmail, ownerBEmail);
  });

  it("returns 404 when the owner asks for another tenant", async () => {
    mockAuth.mockResolvedValue(session(ownerAId));
    const res = await callGet(slugB);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("returns a zip of the current tenant for an owner", async () => {
    mockAuth.mockResolvedValue(session(ownerAId));
    const res = await callGet(slugA);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/zip");
    expect(res.headers.get("content-disposition")).toContain(slugA);

    const zip = Buffer.from(await res.arrayBuffer());
    assertTenantAExport(zip, ownerEmail, ownerBEmail);
  });
});

describe("buildTenantCsvExport", () => {
  it("exports tenant A without the other tenant or the secrets", async () => {
    const { zip } = await buildTenantCsvExport(tenantAId);
    assertTenantAExport(zip, ownerEmail, ownerBEmail);
  });
});
