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

// Mock @/lib/db/client to use admin client (bypasses RLS for integration tests)
vi.mock("@/lib/db/client", async () => {
  const { prismaAdmin } = await import("./helpers");
  return { prisma: prismaAdmin };
});

// Import actions AFTER mocks are declared
import {
  addFollowUpAction,
  completeFollowUpAction,
  deleteFollowUpAction,
} from "@/features/follow-ups/actions";
import { applyIndustryTemplate } from "@/lib/industry/registry";
import { auth } from "@/lib/auth/auth";

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

// ── Test data ────────────────────────────────────────────────────────────────

let tenantId: string;
let tenantSlug: string;
let userId: string;
let dealId: string;

// ── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await cleanDatabase();

  const tenant = await prismaAdmin.tenant.create({
    data: {
      slug: `followup-test-${Date.now()}`,
      name: "FollowUp Test Tenant",
      industrySlug: "aquasistemas",
      settings: {
        create: {
          storageUsedBytes: BigInt(0),
        },
      },
    },
  });
  tenantId = tenant.id;
  tenantSlug = tenant.slug;

  const user = await prismaAdmin.user.create({
    data: { email: `followup-user-${Date.now()}@test.com` },
  });
  userId = user.id;

  await prismaAdmin.membership.create({
    data: { userId, tenantId, role: "MEMBER" },
  });

  // Create pipeline + stage
  const pipeline = await prismaAdmin.pipeline.create({
    data: { tenantId, name: "Test Pipeline", isDefault: true },
  });

  const stage = await prismaAdmin.pipelineStage.create({
    data: {
      tenantId,
      pipelineId: pipeline.id,
      key: "nuevo",
      label: "Nuevo",
      color: "#6366f1",
      iconKey: "circle",
      order: 0,
      requiresQuote: false,
      requiresPayment: false,
    },
  });

  // Create a deal
  const deal = await prismaAdmin.deal.create({
    data: {
      id: makeCuid(),
      tenantId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      ownerId: userId,
      name: "Deal for FollowUp Tests",
      channelKey: "web",
      statusKey: "active",
      value: 500,
    },
  });
  dealId = deal.id;
});

afterAll(async () => {
  await cleanDatabase();
  await disconnectAll();
});

// ── industry registry — catalog seeding ──────────────────────────────────────

describe("industry registry — catalog seeding", () => {
  let seedTenantId: string;

  beforeAll(async () => {
    const t = await prismaAdmin.tenant.create({
      data: {
        slug: `registry-seed-test-${Date.now()}`,
        name: "Registry Seed Test Tenant",
        industrySlug: "aquasistemas",
        settings: { create: { storageUsedBytes: BigInt(0) } },
      },
    });
    seedTenantId = t.id;

    // Run applyIndustryTemplate using the admin client in a transaction
    await prismaAdmin.$transaction(async (tx) => {
      await applyIndustryTemplate(seedTenantId, "aquasistemas", tx);
    });
  });

  afterAll(async () => {
    await prismaAdmin.catalogItem.deleteMany({ where: { tenantId: seedTenantId } });
    await prismaAdmin.pipelineStage.deleteMany({ where: { tenantId: seedTenantId } });
    await prismaAdmin.pipeline.deleteMany({ where: { tenantId: seedTenantId } });
    await prismaAdmin.tenantSettings.deleteMany({ where: { tenantId: seedTenantId } });
    await prismaAdmin.tenant.delete({ where: { id: seedTenantId } });
  });

  it("applyIndustryTemplate seeds 6 followupReason items", async () => {
    const items = await prismaAdmin.catalogItem.findMany({
      where: { tenantId: seedTenantId, catalogKey: "followupReason" },
      orderBy: { order: "asc" },
    });
    expect(items).toHaveLength(6);
    const keys = items.map((i) => i.key);
    expect(keys).toContain("no_responde");
    expect(keys).toContain("pide_informacion");
    expect(keys).toContain("necesita_tiempo");
    expect(keys).toContain("revisar_cotizacion");
    expect(keys).toContain("agendar_visita");
    expect(keys).toContain("otro");
  });

  it("applyIndustryTemplate seeds items under salesChannel key (not channel)", async () => {
    const salesChannelItems = await prismaAdmin.catalogItem.findMany({
      where: { tenantId: seedTenantId, catalogKey: "salesChannel" },
    });
    const channelItems = await prismaAdmin.catalogItem.findMany({
      where: { tenantId: seedTenantId, catalogKey: "channel" },
    });
    expect(salesChannelItems.length).toBeGreaterThan(0);
    expect(channelItems).toHaveLength(0);
  });

  it("applyIndustryTemplate seeds items under dealStatus key (not status)", async () => {
    const dealStatusItems = await prismaAdmin.catalogItem.findMany({
      where: { tenantId: seedTenantId, catalogKey: "dealStatus" },
    });
    const statusItems = await prismaAdmin.catalogItem.findMany({
      where: { tenantId: seedTenantId, catalogKey: "status" },
    });
    expect(dealStatusItems.length).toBeGreaterThan(0);
    expect(statusItems).toHaveLength(0);
  });
});

// ── addFollowUpAction ─────────────────────────────────────────────────────────

describe("addFollowUpAction", () => {
  it("creates a follow-up and records followUpAdded activity", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: userId } } as Session);

    const result = await addFollowUpAction({
      tenantId,
      tenantSlug,
      dealId,
      date: "2026-06-15",
      reasonKey: "no_responde",
    });

    expect(result.ok).toBe(true);

    // Verify follow-up row exists
    const followUp = await prismaAdmin.followUp.findFirst({
      where: { dealId, reasonKey: "no_responde" },
    });
    expect(followUp).not.toBeNull();
    expect(followUp!.tenantId).toBe(tenantId);
    expect(followUp!.completed).toBe(false);
    expect(followUp!.completedAt).toBeNull();

    // Verify activity was recorded
    const activity = await prismaAdmin.activity.findFirst({
      where: { entityId: dealId, type: "followUpAdded" },
    });
    expect(activity).not.toBeNull();
    expect(activity!.tenantId).toBe(tenantId);
    expect(activity!.entity).toBe("Deal");
  });

  it("returns auth error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const result = await addFollowUpAction({
      tenantId,
      tenantSlug,
      dealId,
      date: "2026-06-20",
      reasonKey: "otro",
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toBe("No autenticado.");
  });
});

// ── completeFollowUpAction ────────────────────────────────────────────────────

describe("completeFollowUpAction", () => {
  let followUpId: string;

  beforeAll(async () => {
    const fu = await prismaAdmin.followUp.create({
      data: {
        tenantId,
        dealId,
        date: new Date("2026-07-01T12:00:00"),
        reasonKey: "pide_informacion",
        createdById: userId,
      },
    });
    followUpId = fu.id;
  });

  it("marks follow-up completed with completedAt and optional result", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: userId } } as Session);

    const result = await completeFollowUpAction({
      tenantId,
      tenantSlug,
      followUpId,
      result: "Cliente confirmó interés",
    });

    expect(result.ok).toBe(true);

    const updated = await prismaAdmin.followUp.findUnique({ where: { id: followUpId } });
    expect(updated!.completed).toBe(true);
    expect(updated!.completedAt).not.toBeNull();
    expect(updated!.result).toBe("Cliente confirmó interés");
  });

  it("records followUpCompleted activity", async () => {
    const activity = await prismaAdmin.activity.findFirst({
      where: { entityId: dealId, type: "followUpCompleted" },
      orderBy: { id: "desc" },
    });
    expect(activity).not.toBeNull();
    expect(activity!.tenantId).toBe(tenantId);
    expect(activity!.entity).toBe("Deal");
  });
});

// ── deleteFollowUpAction ──────────────────────────────────────────────────────

describe("deleteFollowUpAction", () => {
  it("deletes the follow-up", async () => {
    const fu = await prismaAdmin.followUp.create({
      data: {
        tenantId,
        dealId,
        date: new Date("2026-08-01T12:00:00"),
        reasonKey: "agendar_visita",
        createdById: userId,
      },
    });

    mockAuth.mockResolvedValueOnce({ user: { id: userId } } as Session);

    const result = await deleteFollowUpAction({
      tenantId,
      tenantSlug,
      followUpId: fu.id,
    });

    expect(result.ok).toBe(true);

    const gone = await prismaAdmin.followUp.findUnique({ where: { id: fu.id } });
    expect(gone).toBeNull();
  });
});
