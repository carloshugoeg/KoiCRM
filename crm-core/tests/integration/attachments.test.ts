import { describe, it, expect, beforeAll, afterAll, vi, type Mock } from "vitest";
import type { Session } from "next-auth";
import { prismaAdmin, cleanDatabase, disconnectAll } from "./helpers";

// ── Mocks must be declared before any imports that use them ──────────────────

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/storage/s3", () => ({
  deleteObject: vi.fn().mockResolvedValue(undefined),
  signUploadUrl: vi.fn(),
}));

// Import actions AFTER mocks are declared
import { confirmUpload, deleteAttachment } from "@/features/attachments/actions";
import { auth } from "@/lib/auth/auth";
import { deleteObject } from "@/lib/storage/s3";

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;
const mockDeleteObject = vi.mocked(deleteObject);

// ── Test data ────────────────────────────────────────────────────────────────

let tenantId: string;
let userId: string;

const fakeKey = "tenant-id/deals/deal-id/file.png";
const fakeUrl = "https://pub.example.com/tenant-id/deals/deal-id/file.png";
const fakeMimeType = "image/png";
const fakeSize = 2048;

// ── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await cleanDatabase();

  const tenant = await prismaAdmin.tenant.create({
    data: {
      slug: `attachment-test-${Date.now()}`,
      name: "Attachment Test Tenant",
      settings: {
        create: {
          storageUsedBytes: BigInt(0),
        },
      },
    },
  });
  tenantId = tenant.id;

  const user = await prismaAdmin.user.create({
    data: { email: `attachment-user-${Date.now()}@test.com` },
  });
  userId = user.id;

  await prismaAdmin.membership.create({
    data: { userId, tenantId, role: "MEMBER" },
  });
});

afterAll(async () => {
  await cleanDatabase();
  await disconnectAll();
});

// ── confirmUpload tests ──────────────────────────────────────────────────────

describe("confirmUpload", () => {
  it("returns { ok: false, code: 'unauthorized' } when session is missing", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const result = await confirmUpload(tenantId, {
      key: fakeKey,
      url: fakeUrl,
      mimeType: fakeMimeType,
      size: fakeSize,
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("unauthorized");
  });

  it("creates an Attachment row with correct fields", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: userId } } as Session);

    // Reset storage
    await prismaAdmin.tenantSettings.update({
      where: { tenantId },
      data: { storageUsedBytes: BigInt(0) },
    });

    const uniqueKey = `${tenantId}/deals/deal-id/file-${Date.now()}.png`;
    const result = await confirmUpload(tenantId, {
      key: uniqueKey,
      url: fakeUrl,
      mimeType: fakeMimeType,
      size: fakeSize,
    });

    expect(result.ok).toBe(true);
    const att = (result as { ok: true; data: { id: string } }).data;

    const dbRow = await prismaAdmin.attachment.findUnique({ where: { id: att.id } });
    expect(dbRow).not.toBeNull();
    expect(dbRow!.tenantId).toBe(tenantId);
    expect(dbRow!.key).toBe(uniqueKey);
    expect(dbRow!.url).toBe(fakeUrl);
    expect(dbRow!.mimeType).toBe(fakeMimeType);
    expect(dbRow!.size).toBe(BigInt(fakeSize));
    expect(dbRow!.dealId).toBeNull();
    expect(dbRow!.clientId).toBeNull();
  });

  it("increments TenantSettings.storageUsedBytes by the file size", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: userId } } as Session);

    await prismaAdmin.tenantSettings.update({
      where: { tenantId },
      data: { storageUsedBytes: BigInt(0) },
    });

    const uniqueKey = `${tenantId}/deals/deal-id/file-increment-${Date.now()}.png`;
    const result = await confirmUpload(tenantId, {
      key: uniqueKey,
      url: fakeUrl,
      mimeType: fakeMimeType,
      size: fakeSize,
    });

    expect(result.ok).toBe(true);

    const settings = await prismaAdmin.tenantSettings.findUnique({ where: { tenantId } });
    expect(settings!.storageUsedBytes).toBe(BigInt(fakeSize));
  });
});

// ── deleteAttachment tests ────────────────────────────────────────────────────

describe("deleteAttachment", () => {
  it("returns { ok: false, code: 'unauthorized' } when session is missing", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const result = await deleteAttachment(tenantId, "clxxxxxxxxxxxxxxxxxx01");

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("unauthorized");
  });

  it("returns { ok: false, code: 'not_found' } when attachment doesn't exist", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: userId } } as Session);

    // Use a valid cuid format but non-existent id
    const result = await deleteAttachment(tenantId, "clxxxxxxxxxxxxxxxxxx99");

    expect(result.ok).toBe(false);
    expect((result as { ok: false; code: string }).code).toBe("not_found");
  });

  it("deletes the Attachment row and decrements storageUsedBytes, calls deleteObject", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: userId } } as Session);

    // Reset storage
    await prismaAdmin.tenantSettings.update({
      where: { tenantId },
      data: { storageUsedBytes: BigInt(fakeSize) },
    });

    // Create an attachment to delete
    const uniqueKey = `${tenantId}/deals/deal-id/file-to-delete-${Date.now()}.png`;
    const attachment = await prismaAdmin.attachment.create({
      data: {
        tenantId,
        key: uniqueKey,
        url: fakeUrl,
        mimeType: fakeMimeType,
        size: BigInt(fakeSize),
      },
    });

    mockDeleteObject.mockResolvedValueOnce(undefined);

    const result = await deleteAttachment(tenantId, attachment.id);

    expect(result.ok).toBe(true);

    // Verify DB row is deleted
    const dbRow = await prismaAdmin.attachment.findUnique({ where: { id: attachment.id } });
    expect(dbRow).toBeNull();

    // Verify storageUsedBytes was decremented
    const settings = await prismaAdmin.tenantSettings.findUnique({ where: { tenantId } });
    expect(settings!.storageUsedBytes).toBe(BigInt(0));

    // Verify deleteObject was called with the correct key
    expect(mockDeleteObject).toHaveBeenCalledWith(uniqueKey);
  });
});
