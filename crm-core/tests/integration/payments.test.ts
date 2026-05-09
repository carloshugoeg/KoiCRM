import { describe, it, expect, beforeAll, afterAll, vi, type Mock } from "vitest";
import type { Session } from "next-auth";
import { randomBytes } from "crypto";
import { prismaAdmin, cleanDatabase, disconnectAll } from "./helpers";

/** Generate a cuid-compatible string (starts with 'c', lowercase hex). */
function makeCuid(): string {
  return "c" + randomBytes(12).toString("hex");
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
  createPayment,
  voidPayment,
  deletePayment,
} from "@/features/payments/actions";
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
      slug: `payment-test-${Date.now()}`,
      name: "Payment Test Tenant",
      settings: {
        create: {
          storageUsedBytes: BigInt(0),
        },
      },
    },
  });
  tenantId = tenant.id;

  const user = await prismaAdmin.user.create({
    data: { email: `payment-user-${Date.now()}@test.com` },
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
      key: "ganado",
      label: "Ganado",
      color: "#10B981",
      iconKey: "circle",
      order: 0,
      requiresQuote: false,
      requiresPayment: true,
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

  // Create a Deal in Stage 1 — use a cuid-compatible ID (Deal.id has no @default)
  const deal = await prismaAdmin.deal.create({
    data: {
      id: makeCuid(),
      tenantId,
      pipelineId: pipeline.id,
      stageId: stage1.id,
      ownerId: userId,
      name: "Deal for Payment Tests",
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

// ── createPayment tests ──────────────────────────────────────────────────────

describe("createPayment", () => {
  it("creates a payment and records paymentAdded Activity row", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: userId } } as Session);

    const result = await createPayment(tenantId, {
      dealId,
      number: "FAC-001",
      date: new Date("2026-01-15"),
    });

    expect(result.ok).toBe(true);

    // Verify payment row exists in DB
    const payment = await prismaAdmin.payment.findFirst({ where: { dealId, number: "FAC-001" } });
    expect(payment).not.toBeNull();
    expect(payment!.tenantId).toBe(tenantId);
    expect(payment!.dealId).toBe(dealId);
    expect(payment!.number).toBe("FAC-001");
    expect(payment!.isVoid).toBe(false);

    // Verify activity row was recorded
    const activity = await prismaAdmin.activity.findFirst({
      where: { entityId: dealId, type: "paymentAdded" },
    });
    expect(activity).not.toBeNull();
    expect(activity!.tenantId).toBe(tenantId);
    expect(activity!.entity).toBe("Deal");
  });

  it("returns unauthorized when session is missing", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const result = await createPayment(tenantId, {
      dealId,
      number: "FAC-002",
      date: new Date(),
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("unauthorized");
  });

  it("returns unauthorized when role is VIEWER", async () => {
    // Create a viewer user
    const viewerUser = await prismaAdmin.user.create({
      data: { email: `payment-viewer-${Date.now()}@test.com` },
    });
    await prismaAdmin.membership.create({
      data: { userId: viewerUser.id, tenantId, role: "VIEWER" },
    });

    mockAuth.mockResolvedValueOnce({ user: { id: viewerUser.id } } as Session);

    const result = await createPayment(tenantId, {
      dealId,
      number: "FAC-003",
      date: new Date(),
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("unauthorized");
  });
});

// ── voidPayment tests ────────────────────────────────────────────────────────

describe("voidPayment", () => {
  it("sets isVoid=true on existing payment", async () => {
    // Create a payment to void
    const payment = await prismaAdmin.payment.create({
      data: {
        tenantId,
        dealId,
        number: "FAC-VOID-001",
        date: new Date("2026-02-01"),
      },
    });

    mockAuth.mockResolvedValueOnce({ user: { id: userId } } as Session);

    const result = await voidPayment(tenantId, payment.id);

    expect(result.ok).toBe(true);

    const updated = await prismaAdmin.payment.findUnique({ where: { id: payment.id } });
    expect(updated!.isVoid).toBe(true);
  });
});

// ── deletePayment tests ──────────────────────────────────────────────────────

describe("deletePayment", () => {
  it("MEMBER cannot delete (only ADMIN+ can)", async () => {
    const payment = await prismaAdmin.payment.create({
      data: {
        tenantId,
        dealId,
        number: "FAC-DEL-MEMBER-001",
        date: new Date("2026-03-01"),
      },
    });

    mockAuth.mockResolvedValueOnce({ user: { id: userId } } as Session);

    const result = await deletePayment(tenantId, payment.id);

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("unauthorized");

    // Row should still exist
    const still = await prismaAdmin.payment.findUnique({ where: { id: payment.id } });
    expect(still).not.toBeNull();
  });

  it("ADMIN can delete a payment (row is gone)", async () => {
    // Create an admin user
    const adminUser = await prismaAdmin.user.create({
      data: { email: `admin-${Date.now()}@test.com` },
    });
    await prismaAdmin.membership.create({
      data: { userId: adminUser.id, tenantId, role: "ADMIN" },
    });

    const payment = await prismaAdmin.payment.create({
      data: {
        tenantId,
        dealId,
        number: "FAC-DEL-ADMIN-001",
        date: new Date("2026-03-15"),
      },
    });

    mockAuth.mockResolvedValueOnce({ user: { id: adminUser.id } } as Session);

    const result = await deletePayment(tenantId, payment.id);

    expect(result.ok).toBe(true);

    const gone = await prismaAdmin.payment.findUnique({ where: { id: payment.id } });
    expect(gone).toBeNull();
  });
});

// ── hasPaymentAlert via deal query ───────────────────────────────────────────

describe("hasPaymentAlert via deal query", () => {
  it("deal in requiresPayment stage with no payments has hasPaymentAlert=true", async () => {
    // Ensure the deal is in stage1 (requiresPayment=true) with no active payments
    await prismaAdmin.payment.deleteMany({ where: { dealId, isVoid: false } });
    await prismaAdmin.deal.update({ where: { id: dealId }, data: { stageId: stage1Id } });

    const deals = await getPipelineDeals(tenantId);
    const deal = deals.find((d) => d.id === dealId);
    expect(deal).toBeDefined();
    expect(deal!.hasPaymentAlert).toBe(true);
  });

  it("deal in requiresPayment stage with at least one non-void payment has hasPaymentAlert=false", async () => {
    // Ensure the deal is in stage1 (requiresPayment=true)
    await prismaAdmin.deal.update({ where: { id: dealId }, data: { stageId: stage1Id } });

    // Create a non-void payment
    await prismaAdmin.payment.create({
      data: { tenantId, dealId, number: "FAC-ALERT-001", date: new Date("2026-04-01") },
    });

    const deals = await getPipelineDeals(tenantId);
    const deal = deals.find((d) => d.id === dealId);
    expect(deal).toBeDefined();
    expect(deal!.hasPaymentAlert).toBe(false);

    // Cleanup
    await prismaAdmin.payment.deleteMany({ where: { dealId, number: "FAC-ALERT-001" } });
  });

  it("deal in non-requiresPayment stage has hasPaymentAlert=false regardless of payments", async () => {
    // Move the deal to stage2 (requiresPayment=false)
    await prismaAdmin.deal.update({ where: { id: dealId }, data: { stageId: stage2Id } });

    const deals = await getPipelineDeals(tenantId);
    const deal = deals.find((d) => d.id === dealId);
    expect(deal).toBeDefined();
    expect(deal!.hasPaymentAlert).toBe(false);

    // Restore to stage1 for any subsequent tests
    await prismaAdmin.deal.update({ where: { id: dealId }, data: { stageId: stage1Id } });
  });
});
