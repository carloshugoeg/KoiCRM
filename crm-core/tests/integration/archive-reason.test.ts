import { describe, it, expect, beforeAll, afterAll, vi, type Mock } from "vitest"
import type { Session } from "next-auth"
import { prismaAdmin, disconnectAll } from "./helpers"
import { withTenant } from "@/lib/db/rls"
import { getCatalogItems } from "@/features/catalogs/queries"

/**
 * Workstream 1 (archive reason): archiving a deal now requires a tenant-configured reason and
 * accepts an optional note; unarchiving restores the deal but keeps both as history. The
 * "archiveReason" catalog is a new CatalogItem key, so it inherits CatalogItem's existing RLS
 * policy — this suite proves that inheritance rather than assuming it.
 */

process.env.AUTH_SECRET ??= "test-archive-reason-secret"

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

// Import AFTER the mocks above.
import { auth } from "@/lib/auth/auth"
import { archiveDealAction, unarchiveDealAction } from "@/features/deals/actions"

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>

let tenantId: string
let otherTenantId: string
let ownerId: string
let pipelineId: string
let stageId: string

async function makeDeal(id: string) {
  return prismaAdmin.deal.create({
    data: {
      id,
      tenantId,
      pipelineId,
      stageId,
      ownerId,
      channelKey: "telefono",
      statusKey: "activo",
      name: "Deal " + id,
      value: 100,
    },
  })
}

beforeAll(async () => {
  const tenant = await prismaAdmin.tenant.create({
    data: { name: "ArchiveReasonTest", slug: `archive-reason-${Date.now()}` },
  })
  tenantId = tenant.id

  const other = await prismaAdmin.tenant.create({
    data: { name: "ArchiveReasonOther", slug: `archive-reason-other-${Date.now()}` },
  })
  otherTenantId = other.id

  const owner = await prismaAdmin.user.create({
    data: { email: `archive-owner-${Date.now()}@test.com`, name: "Owner", emailVerified: new Date() },
  })
  ownerId = owner.id
  // OWNER is a LOCKED_ROLE — scope checks short-circuit to "everything visible", which keeps
  // this suite focused on the archive-reason behavior rather than re-proving scope enforcement
  // (already covered by pipeline-scope.test.ts).
  await prismaAdmin.membership.create({ data: { userId: ownerId, tenantId, role: "OWNER", status: "ACTIVE" } })

  const pipeline = await prismaAdmin.pipeline.create({
    data: {
      tenantId,
      name: "Default",
      isDefault: true,
      stages: { create: [{ tenantId, key: "prospecto", label: "Prospecto", color: "#6366f1", iconKey: "circle", order: 0 }] },
    },
    include: { stages: true },
  })
  pipelineId = pipeline.id
  stageId = pipeline.stages[0]!.id

  await withTenant(tenantId, (tx) =>
    tx.catalogItem.createMany({
      data: [
        { tenantId, catalogKey: "archiveReason", key: "sin_respuesta", label: "Sin respuesta", order: 0 },
        { tenantId, catalogKey: "archiveReason", key: "precio", label: "Precio", order: 1 },
        { tenantId, catalogKey: "archiveReason", key: "inactivo", label: "Inactivo", order: 2, active: false },
      ],
    }),
  )

  mockAuth.mockResolvedValue({ user: { id: ownerId, email: "owner@test.com" } } as Session)
})

afterAll(async () => {
  await prismaAdmin.tenant.delete({ where: { id: tenantId } })
  await prismaAdmin.tenant.delete({ where: { id: otherTenantId } })
  await disconnectAll()
})

describe("archiveDealAction — requires a reason", () => {
  it("rejects archiving with no archiveReasonKey", async () => {
    const deal = await makeDeal(`arv-${Date.now()}-1`)
    const res = await archiveDealAction({
      tenantId, tenantSlug: "archive-reason", dealId: deal.id, archiveReasonKey: "",
    })
    expect(res.ok).toBe(false)

    const stored = await prismaAdmin.deal.findUnique({ where: { id: deal.id } })
    expect(stored?.isArchived).toBe(false)
  })

  it("rejects an archiveReasonKey that doesn't match any active catalog item", async () => {
    const deal = await makeDeal(`arv-${Date.now()}-2`)
    const res = await archiveDealAction({
      tenantId, tenantSlug: "archive-reason", dealId: deal.id, archiveReasonKey: "not_a_real_reason",
    })
    expect(res.ok).toBe(false)

    const stored = await prismaAdmin.deal.findUnique({ where: { id: deal.id } })
    expect(stored?.isArchived).toBe(false)
    expect(stored?.archiveReasonKey).toBeNull()
  })

  it("rejects an archiveReasonKey belonging to a deactivated reason", async () => {
    const deal = await makeDeal(`arv-${Date.now()}-3`)
    const res = await archiveDealAction({
      tenantId, tenantSlug: "archive-reason", dealId: deal.id, archiveReasonKey: "inactivo",
    })
    expect(res.ok).toBe(false)
  })
})

describe("archiveDealAction — reason and note persist", () => {
  it("archives with a valid reason and an optional note", async () => {
    const deal = await makeDeal(`arv-${Date.now()}-4`)
    const res = await archiveDealAction({
      tenantId, tenantSlug: "archive-reason", dealId: deal.id,
      archiveReasonKey: "sin_respuesta", archiveNote: "Llamé 3 veces, sin respuesta.",
    })
    expect(res.ok).toBe(true)

    const stored = await prismaAdmin.deal.findUnique({ where: { id: deal.id } })
    expect(stored?.isArchived).toBe(true)
    expect(stored?.archiveReasonKey).toBe("sin_respuesta")
    expect(stored?.archiveNote).toBe("Llamé 3 veces, sin respuesta.")
  })

  it("archives with a valid reason and no note — archiveNote stays null", async () => {
    const deal = await makeDeal(`arv-${Date.now()}-5`)
    const res = await archiveDealAction({
      tenantId, tenantSlug: "archive-reason", dealId: deal.id, archiveReasonKey: "precio",
    })
    expect(res.ok).toBe(true)

    const stored = await prismaAdmin.deal.findUnique({ where: { id: deal.id } })
    expect(stored?.archiveReasonKey).toBe("precio")
    expect(stored?.archiveNote).toBeNull()
  })

  it("trims a blank note down to null", async () => {
    const deal = await makeDeal(`arv-${Date.now()}-6`)
    const res = await archiveDealAction({
      tenantId, tenantSlug: "archive-reason", dealId: deal.id,
      archiveReasonKey: "precio", archiveNote: "   ",
    })
    expect(res.ok).toBe(true)

    const stored = await prismaAdmin.deal.findUnique({ where: { id: deal.id } })
    expect(stored?.archiveNote).toBeNull()
  })
})

describe("unarchiveDealAction — restores the deal, keeps the reason as history", () => {
  it("clears isArchived but leaves archiveReasonKey/archiveNote untouched", async () => {
    const deal = await makeDeal(`arv-${Date.now()}-7`)
    const archiveRes = await archiveDealAction({
      tenantId, tenantSlug: "archive-reason", dealId: deal.id,
      archiveReasonKey: "sin_respuesta", archiveNote: "Se enfrió el lead.",
    })
    expect(archiveRes.ok).toBe(true)

    const unarchiveRes = await unarchiveDealAction({ tenantId, tenantSlug: "archive-reason", dealId: deal.id })
    expect(unarchiveRes.ok).toBe(true)

    const stored = await prismaAdmin.deal.findUnique({ where: { id: deal.id } })
    expect(stored?.isArchived).toBe(false)
    // History, not cleared — the whole point of the design decision.
    expect(stored?.archiveReasonKey).toBe("sin_respuesta")
    expect(stored?.archiveNote).toBe("Se enfrió el lead.")
  })

  it("re-archiving after an unarchive overwrites the reason/note with the new archival", async () => {
    const deal = await makeDeal(`arv-${Date.now()}-8`)
    await archiveDealAction({
      tenantId, tenantSlug: "archive-reason", dealId: deal.id, archiveReasonKey: "sin_respuesta", archiveNote: "Primero",
    })
    await unarchiveDealAction({ tenantId, tenantSlug: "archive-reason", dealId: deal.id })
    const res = await archiveDealAction({
      tenantId, tenantSlug: "archive-reason", dealId: deal.id, archiveReasonKey: "precio", archiveNote: "Segundo",
    })
    expect(res.ok).toBe(true)

    const stored = await prismaAdmin.deal.findUnique({ where: { id: deal.id } })
    expect(stored?.isArchived).toBe(true)
    expect(stored?.archiveReasonKey).toBe("precio")
    expect(stored?.archiveNote).toBe("Segundo")
  })
})

describe("the archiveReason catalog is tenant-isolated (RLS)", () => {
  it("withTenant(tenantId) does not see the other tenant's archiveReason items", async () => {
    await withTenant(otherTenantId, (tx) =>
      tx.catalogItem.create({
        data: { tenantId: otherTenantId, catalogKey: "archiveReason", key: "foreign_reason", label: "Foreign" },
      }),
    )

    const mine = await getCatalogItems(tenantId, "archiveReason")
    expect(mine.some((i) => i.key === "foreign_reason")).toBe(false)

    const theirs = await getCatalogItems(otherTenantId, "archiveReason")
    expect(theirs.some((i) => i.key === "foreign_reason")).toBe(true)
    expect(theirs.some((i) => i.key === "sin_respuesta")).toBe(false)
  })

  it("a bare prisma call (no withTenant/app.tenant_id) returns nothing under RLS — the bug class this house rule guards against", async () => {
    // prismaApp mirrors what a bare `prisma.catalogItem.findMany()` would see: no app.tenant_id
    // set, so RLS admits zero rows. Exercised directly (not through withTenant) to prove the
    // catalog inherited CatalogItem's existing policy instead of assuming it.
    const { prismaApp } = await import("./helpers")
    const rows = await prismaApp.catalogItem.findMany({ where: { tenantId, catalogKey: "archiveReason" } })
    expect(rows).toHaveLength(0)
  })
})

describe("archiveDealAction — permission gate", () => {
  it("a MEMBER (below the SUPERVISOR archive threshold) is denied", async () => {
    const member = await prismaAdmin.user.create({
      data: { email: `archive-member-${Date.now()}@test.com`, name: "Member", emailVerified: new Date() },
    })
    await prismaAdmin.membership.create({ data: { userId: member.id, tenantId, role: "MEMBER", status: "ACTIVE" } })
    mockAuth.mockResolvedValueOnce({ user: { id: member.id, email: "member@test.com" } } as Session)

    const deal = await makeDeal(`arv-${Date.now()}-9`)
    const res = await archiveDealAction({
      tenantId, tenantSlug: "archive-reason", dealId: deal.id, archiveReasonKey: "sin_respuesta",
    })
    expect(res.ok).toBe(false)

    const stored = await prismaAdmin.deal.findUnique({ where: { id: deal.id } })
    expect(stored?.isArchived).toBe(false)
  })
})
