import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest";
import type { Session } from "next-auth";
import { randomBytes } from "crypto";
import { prismaAdmin, disconnectAll, cleanDatabase } from "./helpers";

/**
 * Regression test for the PIN gate against REAL row-level security.
 *
 * The bug: `resolveDealOwnerId` read the deal with a bare `prisma.deal.findUnique`.
 * `Deal` is RLS-protected, so app_user (without `app.tenant_id` set) gets NULL back,
 * making the owner unknown for EVERY deal → a PIN was forced on every action, including
 * the user's own leads.
 *
 * The other integration suites mock `@/lib/db/client` → `prismaAdmin` (BYPASSRLS), which
 * hides this entirely (bare prisma and withTenant both return the row). This file mocks
 * the client to `prismaApp` (RLS active) on purpose, so the bare-prisma-vs-withTenant
 * difference is real and the regression cannot creep back in unnoticed.
 */

// hashActionPin/signActorToken read AUTH_SECRET at call time; .env doesn't set it here.
process.env.AUTH_SECRET ??= "test-action-pin-secret";

function makeCuid(): string {
  return "c" + randomBytes(12).toString("hex");
}

// ── Mocks (declared before importing the code under test) ────────────────────

// In-memory cookie jar so resolveActionActor's cookies() calls work outside a request.
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn() }));

// RLS ACTIVE: use the app_user client (the opposite of the other suites).
vi.mock("@/lib/db/client", async () => {
  const { prismaApp } = await import("./helpers");
  return { prisma: prismaApp };
});

// Import AFTER mocks are declared.
import { resolveActionActor } from "@/lib/auth/action-pin";
import { hashActionPin } from "@/lib/auth/action-pin-token";
import { auth } from "@/lib/auth/auth";

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

// ── Test data ────────────────────────────────────────────────────────────────

let tenantId: string;
let userA: string; // the logged-in user (session)
let userB: string; // a different member
let dealOwnedByA: string;
let dealOwnedByB: string;
const PIN_B = "4321";

beforeAll(async () => {
  await cleanDatabase();

  const tenant = await prismaAdmin.tenant.create({
    data: {
      slug: `pin-rls-${Date.now()}`,
      name: "PIN RLS Test Tenant",
      industrySlug: "aquasistemas",
      settings: { create: { storageUsedBytes: BigInt(0), pinEnabled: true } },
    },
  });
  tenantId = tenant.id;

  const a = await prismaAdmin.user.create({ data: { email: `pin-a-${Date.now()}@test.com` } });
  const b = await prismaAdmin.user.create({ data: { email: `pin-b-${Date.now()}@test.com` } });
  userA = a.id;
  userB = b.id;

  await prismaAdmin.membership.create({ data: { userId: userA, tenantId, role: "MEMBER", status: "ACTIVE" } });
  await prismaAdmin.membership.create({
    data: { userId: userB, tenantId, role: "MEMBER", status: "ACTIVE", actionPinHash: hashActionPin(PIN_B) },
  });

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

  const makeDeal = (ownerId: string, name: string) =>
    prismaAdmin.deal.create({
      data: {
        id: makeCuid(),
        tenantId,
        pipelineId: pipeline.id,
        stageId: stage.id,
        ownerId,
        name,
        channelKey: "web",
        statusKey: "active",
        value: 100,
      },
    });

  dealOwnedByA = (await makeDeal(userA, "Deal owned by A")).id;
  dealOwnedByB = (await makeDeal(userB, "Deal owned by B")).id;
});

afterAll(async () => {
  await cleanDatabase();
  await disconnectAll();
});

beforeEach(() => {
  cookieJar.clear();
  mockAuth.mockReset();
  mockAuth.mockResolvedValue({ user: { id: userA } } as Session);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("resolveActionActor under RLS (PIN enabled, session lock off)", () => {
  it("does NOT require a PIN on the logged-in user's own lead", async () => {
    // Regression guard: with bare prisma this returns requiresPin because the RLS-protected
    // Deal lookup yields a null owner. withTenant resolves the real owner → no PIN.
    const result = await resolveActionActor({ tenantId, dealId: dealOwnedByA });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.actor.actorUserId).toBe(userA);
    }
  });

  it("requires a PIN on another member's lead", async () => {
    const result = await resolveActionActor({ tenantId, dealId: dealOwnedByB });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.requiresPin).toBe(true);
    }
  });

  it("attributes the action to the PIN owner when a valid PIN is entered on another's lead", async () => {
    const result = await resolveActionActor({ tenantId, dealId: dealOwnedByB, pin: PIN_B });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // The PIN — not the session — is the author.
      expect(result.actor.actorUserId).toBe(userB);
    }
  });

  it("rejects an unknown PIN and keeps asking", async () => {
    const result = await resolveActionActor({ tenantId, dealId: dealOwnedByB, pin: "0000" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.requiresPin).toBe(true);
    }
  });
});
