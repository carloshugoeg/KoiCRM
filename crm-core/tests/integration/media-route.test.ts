import { describe, it, expect, beforeAll, beforeEach, afterAll, vi, type Mock } from "vitest"
import { NextRequest } from "next/server"
import type { Session } from "next-auth"
import { randomBytes } from "crypto"
import { prismaAdmin, withTenant, cleanDatabase, disconnectAll } from "./helpers"

/**
 * GET /api/media/[...key] authenticated the caller and checked tenant membership only — it
 * never asked which deal the file belongs to. Any member holding a circulated attachment URL
 * could download a colleague's file, including one on a deal outside their scope. The route
 * must resolve the file's owning deal (via the Attachment row, the authoritative key→deal
 * link) and apply the caller's pipeline scope before serving bytes, the same rule
 * requireDealReaderInScope already applies to the deal-read actions.
 */

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/storage/s3", () => ({
  getObject: vi.fn().mockResolvedValue({
    body: Buffer.from("file-bytes"),
    contentType: "application/pdf",
  }),
}))

// Import route handler AFTER mocks are declared.
import { GET } from "@/app/api/media/[...key]/route"
import { auth } from "@/lib/auth/auth"
import { getObject } from "@/lib/storage/s3"

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>
const mockGetObject = vi.mocked(getObject)

function makeCuid(): string {
  return "c" + randomBytes(12).toString("hex")
}

function callGet(key: string) {
  return GET(new NextRequest(`http://localhost/api/media/${key}`), {
    params: { key: key.split("/") },
  })
}

let tenantId: string
let memberId: string
let otherId: string
let ownerRoleUserId: string
let ownDealId: string
let foreignDealId: string
let cededDealId: string

let ownKey: string
let foreignKey: string
let cededKey: string
/** Matches the deal-attachment key shape but has no Attachment row — never confirmed / deleted. */
let noRowKey: string

beforeAll(async () => {
  await cleanDatabase()

  const tenant = await prismaAdmin.tenant.create({
    data: { slug: `media-route-${Date.now()}`, name: "Media Route Test" },
  })
  tenantId = tenant.id

  const member = await prismaAdmin.user.create({ data: { email: `media-member-${Date.now()}@test.com` } })
  memberId = member.id
  await prismaAdmin.membership.create({
    data: { userId: memberId, tenantId, role: "MEMBER", status: "ACTIVE" },
  })

  const other = await prismaAdmin.user.create({ data: { email: `media-other-${Date.now()}@test.com` } })
  otherId = other.id
  await prismaAdmin.membership.create({
    data: { userId: otherId, tenantId, role: "MEMBER", status: "ACTIVE" },
  })

  const owner = await prismaAdmin.user.create({ data: { email: `media-owner-${Date.now()}@test.com` } })
  ownerRoleUserId = owner.id
  await prismaAdmin.membership.create({
    data: { userId: ownerRoleUserId, tenantId, role: "OWNER", status: "ACTIVE" },
  })

  const pipeline = await prismaAdmin.pipeline.create({
    data: { tenantId, name: "P", isDefault: true },
  })
  const stage = await prismaAdmin.pipelineStage.create({
    data: {
      tenantId,
      pipelineId: pipeline.id,
      order: 0,
      key: "nuevo",
      label: "Nuevo",
      color: "#6366f1",
      iconKey: "circle",
    },
  })

  const own = await prismaAdmin.deal.create({
    data: {
      id: makeCuid(),
      tenantId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      ownerId: memberId,
      name: "Propia",
      channelKey: "web",
      statusKey: "active",
      value: 100,
    },
  })
  ownDealId = own.id

  const foreign = await prismaAdmin.deal.create({
    data: {
      id: makeCuid(),
      tenantId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      ownerId: otherId,
      name: "Ajena",
      channelKey: "web",
      statusKey: "active",
      value: 200,
    },
  })
  foreignDealId = foreign.id

  // Owned by someone else but ceded to the member through DealViewer — must behave like one
  // of their own, same as the pipeline/notes/attachments scope guards.
  const ceded = await prismaAdmin.deal.create({
    data: {
      id: makeCuid(),
      tenantId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      ownerId: otherId,
      name: "Cedida",
      channelKey: "web",
      statusKey: "active",
      value: 300,
    },
  })
  cededDealId = ceded.id
  await prismaAdmin.dealViewer.create({ data: { tenantId, dealId: cededDealId, userId: memberId } })

  ownKey = `${tenantId}/deals/${ownDealId}/own-file.pdf`
  foreignKey = `${tenantId}/deals/${foreignDealId}/foreign-file.pdf`
  cededKey = `${tenantId}/deals/${cededDealId}/ceded-file.pdf`
  noRowKey = `${tenantId}/deals/${foreignDealId}/no-row-file.pdf`

  for (const [dealId, key] of [
    [ownDealId, ownKey],
    [foreignDealId, foreignKey],
    [cededDealId, cededKey],
  ] as const) {
    await prismaAdmin.attachment.create({
      data: { tenantId, dealId, key, url: `/api/media/${key}`, mimeType: "application/pdf", size: 100 },
    })
  }
  // noRowKey is deliberately never confirmed — no Attachment row exists for it.
})

afterAll(async () => {
  await cleanDatabase()
  await disconnectAll()
})

beforeEach(async () => {
  mockAuth.mockReset()
  mockGetObject.mockClear()
  mockGetObject.mockResolvedValue({ body: Buffer.from("file-bytes"), contentType: "application/pdf" })
  await withTenant(tenantId, (tx) => tx.rolePermission.deleteMany({ where: { tenantId } }))
})

describe("GET /api/media/[...key] deal-attachment scope", () => {
  it("returns 404 not_found for an attachment on a deal outside the caller's scope", async () => {
    mockAuth.mockResolvedValue({ user: { id: memberId } } as Session)

    const res = await callGet(foreignKey)

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "not_found" })
    expect(mockGetObject).not.toHaveBeenCalled()
  })

  it("serves the file for the caller's own deal", async () => {
    mockAuth.mockResolvedValue({ user: { id: memberId } } as Session)

    const res = await callGet(ownKey)

    expect(res.status).toBe(200)
    expect(await res.text()).toBe("file-bytes")
    expect(mockGetObject).toHaveBeenCalledWith(ownKey)
  })

  it("serves the file for a deal ceded to the caller", async () => {
    mockAuth.mockResolvedValue({ user: { id: memberId } } as Session)

    const res = await callGet(cededKey)

    expect(res.status).toBe(200)
    expect(await res.text()).toBe("file-bytes")
    expect(mockGetObject).toHaveBeenCalledWith(cededKey)
  })

  it("returns a byte-identical response for a foreign deal and for a key with no Attachment row", async () => {
    mockAuth.mockResolvedValue({ user: { id: memberId } } as Session)

    const foreign = await callGet(foreignKey)
    const missing = await callGet(noRowKey)

    expect(foreign.status).toBe(missing.status)
    expect(await foreign.text()).toBe(await missing.text())
    expect(mockGetObject).not.toHaveBeenCalled()
  })

  it("resolves the foreign deal once the role is granted pipeline.viewAll", async () => {
    await withTenant(tenantId, (tx) =>
      tx.rolePermission.create({
        data: { tenantId, role: "MEMBER", key: "pipeline.viewAll", allowed: true },
      }),
    )
    mockAuth.mockResolvedValue({ user: { id: memberId } } as Session)

    const res = await callGet(foreignKey)

    expect(res.status).toBe(200)
    expect(mockGetObject).toHaveBeenCalledWith(foreignKey)
  })

  it("serves any deal's attachment to an OWNER without a scope check", async () => {
    mockAuth.mockResolvedValue({ user: { id: ownerRoleUserId } } as Session)

    const res = await callGet(foreignKey)

    expect(res.status).toBe(200)
    expect(mockGetObject).toHaveBeenCalledWith(foreignKey)
  })

  it("still returns 401 for an unauthenticated request", async () => {
    mockAuth.mockResolvedValue(null)

    const res = await callGet(foreignKey)

    expect(res.status).toBe(401)
  })

  it("still returns 403 for a non-member of the tenant", async () => {
    const stranger = await prismaAdmin.user.create({ data: { email: `media-stranger-${Date.now()}@test.com` } })
    mockAuth.mockResolvedValue({ user: { id: stranger.id } } as Session)

    const res = await callGet(ownKey)

    expect(res.status).toBe(403)
  })
})
