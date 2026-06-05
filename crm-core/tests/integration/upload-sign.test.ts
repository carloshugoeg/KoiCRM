import { describe, it, expect, beforeAll, afterAll, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { prismaAdmin, cleanDatabase, disconnectAll } from "./helpers";

// ── Mocks must be declared before any imports that use them ──────────────────

// Mock auth — will be configured per test via mockResolvedValue
vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(),
}));

// Mock signUploadUrl so we never hit real R2
vi.mock("@/lib/storage/s3", () => ({
  signUploadUrl: vi.fn().mockResolvedValue({
    signedUrl: "https://r2.example.com/presigned-put-url",
    publicUrl: "https://pub.example.com/tenant/deals/deal/file.png",
  }),
}));

// Import route handler AFTER mocks are declared
import { POST } from "@/app/api/upload/sign/route";
import { auth } from "@/lib/auth/auth";
import { signUploadUrl } from "@/lib/storage/s3";

// Cast to Mock<() => Promise<Session | null>> to avoid next-auth overload confusion
const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;
const mockSignUploadUrl = vi.mocked(signUploadUrl);

// ── Test data ────────────────────────────────────────────────────────────────

let tenantId: string;
let userId: string;
const fakeDealId = "DEAL-0001-RO-26";

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/upload/sign", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await cleanDatabase();

  const tenant = await prismaAdmin.tenant.create({
    data: {
      slug: `upload-sign-test-${Date.now()}`,
      name: "Upload Sign Test Tenant",
      settings: {
        create: {
          storageMaxBytes: BigInt(10 * 1024 * 1024), // 10 MB cap for testing
          storageUsedBytes: BigInt(0),
        },
      },
    },
  });
  tenantId = tenant.id;

  const user = await prismaAdmin.user.create({
    data: { email: `upload-sign-user-${Date.now()}@test.com` },
  });
  userId = user.id;

  await prismaAdmin.membership.create({
    data: { userId, tenantId, role: "MEMBER" },
  });

  const pipeline = await prismaAdmin.pipeline.create({
    data: {
      tenantId,
      name: "Default",
      isDefault: true,
      stages: {
        create: [
          { tenantId, key: "prospecto", label: "Prospecto", color: "#6366f1", iconKey: "circle", order: 0 },
        ],
      },
    },
    include: { stages: true },
  });
  const pipelineId = pipeline.id;
  const stageId = pipeline.stages[0]!.id;

  await prismaAdmin.deal.create({
    data: {
      id: fakeDealId,
      tenantId,
      pipelineId,
      stageId,
      ownerId: userId,
      channelKey: "web",
      statusKey: "active",
      name: "Test Deal",
      value: 1000,
    },
  });
});

afterAll(async () => {
  await cleanDatabase();
  await disconnectAll();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/upload/sign", () => {
  it("returns 401 when unauthenticated (no session)", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const req = makeRequest({
      contentType: "image/png",
      size: 1024,
      dealId: fakeDealId,
      tenantId,
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 403 with code storage_limit_exceeded when over storage limit", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: userId } } as Session);

    // Set storageUsedBytes to just under the max, then request a size that exceeds it
    await prismaAdmin.tenantSettings.update({
      where: { tenantId },
      data: { storageUsedBytes: BigInt(10 * 1024 * 1024 - 100) }, // 10 MB - 100 bytes used
    });

    const req = makeRequest({
      contentType: "image/png",
      size: 200, // 200 bytes would push it over the 10 MB cap
      dealId: fakeDealId,
      tenantId,
    });
    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("storage_limit_exceeded");
  });

  it("returns 400 for a disallowed content type", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: userId } } as Session);

    // Reset storage so storage limit is not triggered
    await prismaAdmin.tenantSettings.update({
      where: { tenantId },
      data: { storageUsedBytes: BigInt(0) },
    });

    const req = makeRequest({
      contentType: "video/mp4",
      size: 1024,
      dealId: fakeDealId,
      tenantId,
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 400 with file_too_large when single file exceeds fileSizeMaxBytes", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: userId } } as Session);
    // Set fileSizeMaxBytes to 500 bytes on the test tenant's settings
    await prismaAdmin.tenantSettings.update({
      where: { tenantId },
      data: { fileSizeMaxBytes: BigInt(500) },
    });
    const req = new NextRequest("http://localhost/api/upload/sign", {
      method: "POST",
      body: JSON.stringify({
        contentType: "image/png",
        size: 1000, // exceeds 500-byte limit
        dealId: fakeDealId,
        tenantId,
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("file_too_large");
    // Reset for other tests
    await prismaAdmin.tenantSettings.update({
      where: { tenantId },
      data: { fileSizeMaxBytes: BigInt(104857600) },
    });
  });

  it("returns 200 with signedUrl, key, and publicUrl for a valid authenticated request", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: userId } } as Session);

    // Ensure storage is not exceeded
    await prismaAdmin.tenantSettings.update({
      where: { tenantId },
      data: { storageUsedBytes: BigInt(0) },
    });

    mockSignUploadUrl.mockResolvedValueOnce({
      signedUrl: "https://r2.example.com/presigned",
      publicUrl: "https://pub.example.com/file.png",
    });

    const req = makeRequest({
      contentType: "image/png",
      size: 1024,
      dealId: fakeDealId,
      tenantId,
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signedUrl).toBe("https://r2.example.com/presigned");
    expect(body.key).toMatch(new RegExp(`^${tenantId}/deals/${fakeDealId}/`));
    expect(body.key).toMatch(/\.png$/);
    expect(body.publicUrl).toBe("https://pub.example.com/file.png");
  });
});
