import { describe, it, expect, beforeAll, afterAll, vi, type Mock } from "vitest";
import type { Session } from "next-auth";
import { prismaAdmin, cleanDatabase, disconnectAll } from "./helpers";

const TEST_FILE_URL = "https://cdn.example.com/tenant/deals/COT-001.pdf";

function makeDealId(seq: number): string {
  return `DEAL-${String(seq).padStart(4, "0")}-RO-26`;
}

// ── Mocks must be declared before any imports that use them ──────────────────

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Import actions AFTER mocks are declared
import {
  createQuote,
  voidQuote,
  deleteQuote,
} from "@/features/quotes/actions";
import { getPipelineDeals } from "@/features/deals/queries";
import { auth } from "@/lib/auth/auth";

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

// ── Test data ────────────────────────────────────────────────────────────────

let tenantId: string;
let userId: string;
let dealId: string;
let stage1Id: string;
let stage2Id: string;

// ── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await cleanDatabase();

  const tenant = await prismaAdmin.tenant.create({
    data: {
      slug: `quote-test-${Date.now()}`,
      name: "Quote Test Tenant",
      settings: {
        create: {
          storageUsedBytes: BigInt(0),
        },
      },
    },
  });
  tenantId = tenant.id;

  const user = await prismaAdmin.user.create({
    data: { email: `quote-user-${Date.now()}@test.com` },
  });
  userId = user.id;

  await prismaAdmin.membership.create({
    data: { userId, tenantId, role: "MEMBER" },
  });

  // Create pipeline + stages
  const pipeline = await prismaAdmin.pipeline.create({
    data: { tenantId, name: "Test Pipeline", isDefault: true },
  });

  const stage1 = await prismaAdmin.pipelineStage.create({
    data: {
      tenantId,
      pipelineId: pipeline.id,
      key: "contactado",
      label: "Contactado",
      color: "#3B82F6",
      iconKey: "circle",
      order: 0,
      requiresQuote: true,
      requiresPayment: false,
    },
  });
  stage1Id = stage1.id;

  const stage2 = await prismaAdmin.pipelineStage.create({
    data: {
      tenantId,
      pipelineId: pipeline.id,
      key: "nuevo",
      label: "Nuevo",
      color: "#6B7280",
      iconKey: "circle",
      order: 1,
      requiresQuote: false,
      requiresPayment: false,
    },
  });
  stage2Id = stage2.id;

  const deal = await prismaAdmin.deal.create({
    data: {
      id: makeDealId(1),
      tenantId,
      pipelineId: pipeline.id,
      stageId: stage1.id,
      ownerId: userId,
      name: "Deal for Quote Tests",
      channelKey: "web",
      statusKey: "active",
      value: 1000,
    },
  });
  dealId = deal.id;
});

afterAll(async () => {
  await cleanDatabase();
  await disconnectAll();
});

// ── createQuote tests ────────────────────────────────────────────────────────

describe("createQuote", () => {
  it("creates a quote and records quoteAdded Activity row", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: userId } } as Session);

    const result = await createQuote(tenantId, {
      dealId,
      number: "COT-001",
      date: new Date("2026-01-15"),
      fileUrl: TEST_FILE_URL,
    });

    expect(result.ok).toBe(true);

    // Verify quote row exists in DB
    const quote = await prismaAdmin.quote.findFirst({ where: { dealId, number: "COT-001" } });
    expect(quote).not.toBeNull();
    expect(quote!.tenantId).toBe(tenantId);
    expect(quote!.dealId).toBe(dealId);
    expect(quote!.number).toBe("COT-001");
    expect(quote!.isVoid).toBe(false);

    // Verify activity row was recorded
    const activity = await prismaAdmin.activity.findFirst({
      where: { entityId: dealId, type: "quoteAdded" },
    });
    expect(activity).not.toBeNull();
    expect(activity!.tenantId).toBe(tenantId);
    expect(activity!.entity).toBe("Deal");
  });

  it("returns unauthorized when session is missing", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const result = await createQuote(tenantId, {
      dealId,
      number: "COT-002",
      date: new Date(),
      fileUrl: TEST_FILE_URL,
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("unauthorized");
  });

  it("returns unauthorized when role is VIEWER", async () => {
    // Create a viewer user
    const viewerUser = await prismaAdmin.user.create({
      data: { email: `viewer-${Date.now()}@test.com` },
    });
    await prismaAdmin.membership.create({
      data: { userId: viewerUser.id, tenantId, role: "VIEWER" },
    });

    mockAuth.mockResolvedValueOnce({ user: { id: viewerUser.id } } as Session);

    const result = await createQuote(tenantId, {
      dealId,
      number: "COT-003",
      date: new Date(),
      fileUrl: TEST_FILE_URL,
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("unauthorized");
  });
});

// ── voidQuote tests ──────────────────────────────────────────────────────────

describe("voidQuote", () => {
  it("sets isVoid=true on existing quote", async () => {
    // Create a quote to void
    const quote = await prismaAdmin.quote.create({
      data: {
        tenantId,
        dealId,
        number: "COT-VOID-001",
        date: new Date("2026-02-01"),
      },
    });

    mockAuth.mockResolvedValueOnce({ user: { id: userId } } as Session);

    const result = await voidQuote(tenantId, quote.id);

    expect(result.ok).toBe(true);

    const updated = await prismaAdmin.quote.findUnique({ where: { id: quote.id } });
    expect(updated!.isVoid).toBe(true);
  });
});

// ── deleteQuote tests ────────────────────────────────────────────────────────

describe("deleteQuote", () => {
  it("MEMBER cannot delete (only ADMIN+ can)", async () => {
    const quote = await prismaAdmin.quote.create({
      data: {
        tenantId,
        dealId,
        number: "COT-DEL-MEMBER-001",
        date: new Date("2026-03-01"),
      },
    });

    mockAuth.mockResolvedValueOnce({ user: { id: userId } } as Session);

    const result = await deleteQuote(tenantId, quote.id);

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("unauthorized");

    // Row should still exist
    const still = await prismaAdmin.quote.findUnique({ where: { id: quote.id } });
    expect(still).not.toBeNull();
  });

  it("ADMIN can delete a quote (row is gone)", async () => {
    // Create an admin user
    const adminUser = await prismaAdmin.user.create({
      data: { email: `admin-${Date.now()}@test.com` },
    });
    await prismaAdmin.membership.create({
      data: { userId: adminUser.id, tenantId, role: "ADMIN" },
    });

    const quote = await prismaAdmin.quote.create({
      data: {
        tenantId,
        dealId,
        number: "COT-DEL-ADMIN-001",
        date: new Date("2026-03-15"),
      },
    });

    mockAuth.mockResolvedValueOnce({ user: { id: adminUser.id } } as Session);

    const result = await deleteQuote(tenantId, quote.id);

    expect(result.ok).toBe(true);

    const gone = await prismaAdmin.quote.findUnique({ where: { id: quote.id } });
    expect(gone).toBeNull();
  });
});

// ── hasQuoteAlert via deal query ──────────────────────────────────────────────

describe("hasQuoteAlert via deal query", () => {
  it("deal in requiresQuote stage with no quotes has hasQuoteAlert=true", async () => {
    // Ensure the deal is in stage1 (requiresQuote=true) with no active quotes
    await prismaAdmin.quote.deleteMany({ where: { dealId, isVoid: false } });
    await prismaAdmin.deal.update({ where: { id: dealId }, data: { stageId: stage1Id } });

    const deals = await getPipelineDeals(tenantId);
    const deal = deals.find((d) => d.id === dealId);
    expect(deal).toBeDefined();
    expect(deal!.hasQuoteAlert).toBe(true);
  });

  it("deal in requiresQuote stage with at least one non-void quote has hasQuoteAlert=false", async () => {
    // Ensure the deal is in stage1 (requiresQuote=true)
    await prismaAdmin.deal.update({ where: { id: dealId }, data: { stageId: stage1Id } });

    // Create a non-void quote
    await prismaAdmin.quote.create({
      data: { tenantId, dealId, number: "COT-ALERT-001", date: new Date("2026-04-01") },
    });

    const deals = await getPipelineDeals(tenantId);
    const deal = deals.find((d) => d.id === dealId);
    expect(deal).toBeDefined();
    expect(deal!.hasQuoteAlert).toBe(false);

    // Cleanup
    await prismaAdmin.quote.deleteMany({ where: { dealId, number: "COT-ALERT-001" } });
  });

  it("deal in non-requiresQuote stage has hasQuoteAlert=false regardless of quotes", async () => {
    // Move the deal to stage2 (requiresQuote=false)
    await prismaAdmin.deal.update({ where: { id: dealId }, data: { stageId: stage2Id } });

    const deals = await getPipelineDeals(tenantId);
    const deal = deals.find((d) => d.id === dealId);
    expect(deal).toBeDefined();
    expect(deal!.hasQuoteAlert).toBe(false);

    // Restore to stage1 for any subsequent tests
    await prismaAdmin.deal.update({ where: { id: dealId }, data: { stageId: stage1Id } });
  });
});
