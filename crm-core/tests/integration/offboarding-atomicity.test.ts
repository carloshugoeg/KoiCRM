import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest"
import type { Session } from "next-auth"
import { randomBytes } from "crypto"
import { prismaAdmin, cleanDatabase, disconnectAll } from "./helpers"

/**
 * FINDING-014: deactivateMemberAction ran the deal reassignment and the membership
 * status change as two independent transactions with no compensating action. If the
 * second one failed, deals were already reassigned but the offboarded employee stayed
 * ACTIVE and could still sign in.
 *
 * We can't reproduce "the second write throws" with a canned mock, because the fix
 * moves that write inside the same `withTenant` transaction as the reassignment —
 * spying on the top-level `prisma.membership.update` does not intercept a call made
 * on the transaction-bound `tx` client (Prisma builds a fresh delegate per
 * interactive transaction; verified empirically, see git history of this file).
 *
 * Instead we force a *real* failure at the moment the row is touched: a hook inside
 * `recordActivities` (which both the old and new code call, after the deal
 * reassignment and before the membership write) deletes the target's membership row
 * from a second, independent connection. That delete commits immediately, so the
 * subsequent membership write — wherever it happens to live — hits a real "record not
 * found" from Postgres, not a simulated one.
 */

process.env.AUTH_SECRET ??= "test-offboarding-atomicity-secret"

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("@/features/activity/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/activity/queries")>()
  return { ...actual, recordActivities: vi.fn(actual.recordActivities) }
})

// Import AFTER mocks.
import { deactivateMemberAction } from "@/features/users/actions"
import { auth } from "@/lib/auth/auth"
import { recordActivities } from "@/features/activity/queries"

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>
const mockRecordActivities = recordActivities as unknown as Mock<typeof recordActivities>

function makeCuid(): string {
  return "c" + randomBytes(12).toString("hex")
}

let tenantId: string
let ownerId: string
let targetId: string
let reassignToId: string
let pipelineId: string
let stageId: string
let clientId: string

beforeAll(async () => {
  await cleanDatabase()

  const tenant = await prismaAdmin.tenant.create({ data: { slug: `offboard-${Date.now()}`, name: "Offboard" } })
  tenantId = tenant.id

  const owner = await prismaAdmin.user.create({ data: { email: `owner-${Date.now()}@test.com` } })
  ownerId = owner.id
  await prismaAdmin.membership.create({ data: { userId: ownerId, tenantId, role: "OWNER", status: "ACTIVE" } })

  const pipeline = await prismaAdmin.pipeline.create({ data: { tenantId, name: "P", isDefault: true } })
  pipelineId = pipeline.id
  const stage = await prismaAdmin.pipelineStage.create({
    data: { tenantId, pipelineId, order: 0, key: "nuevo", label: "Nuevo", color: "#6366f1", iconKey: "circle" },
  })
  stageId = stage.id

  const client = await prismaAdmin.client.create({ data: { tenantId, name: "Cliente Offboard" } })
  clientId = client.id
})

afterAll(async () => {
  await cleanDatabase()
  await disconnectAll()
})

let targetDealId: string

beforeEach(async () => {
  mockAuth.mockReset()
  mockAuth.mockResolvedValue({ user: { id: ownerId } } as Session)
  mockRecordActivities.mockReset()

  // Fresh target + reassign-to member per test, since the failure path deletes the
  // target's membership row for real.
  const target = await prismaAdmin.user.create({ data: { email: `target-${Date.now()}-${Math.random()}@test.com` } })
  targetId = target.id
  await prismaAdmin.membership.create({ data: { userId: targetId, tenantId, role: "MEMBER", status: "ACTIVE" } })

  const reassignTo = await prismaAdmin.user.create({ data: { email: `reassign-${Date.now()}-${Math.random()}@test.com` } })
  reassignToId = reassignTo.id
  await prismaAdmin.membership.create({ data: { userId: reassignToId, tenantId, role: "MEMBER", status: "ACTIVE" } })

  const deal = await prismaAdmin.deal.create({
    data: {
      id: makeCuid(),
      tenantId,
      pipelineId,
      stageId,
      clientId,
      ownerId: targetId,
      name: "Deal a reasignar",
      channelKey: "web",
      statusKey: "active",
      value: 100,
    },
  })
  targetDealId = deal.id
})

describe("deactivateMemberAction atomicity", () => {
  it("happy path: reassigns deals and deactivates the membership together", async () => {
    const res = await deactivateMemberAction({ tenantId, targetUserId: targetId, reassignToUserId: reassignToId })
    expect(res.ok).toBe(true)

    const deal = await prismaAdmin.deal.findUnique({ where: { id: targetDealId } })
    expect(deal?.ownerId).toBe(reassignToId)

    const membership = await prismaAdmin.membership.findUnique({
      where: { userId_tenantId: { userId: targetId, tenantId } },
    })
    expect(membership?.status).toBe("INACTIVE")
  })

  it("rolls back the deal reassignment when the membership write fails, instead of leaving deals reassigned to a still-ACTIVE offboarded member", async () => {
    // Simulate the membership write failing for real: delete the target's row from an
    // independent connection right after the deal reassignment, before the status
    // change is attempted. Neither the old nor the new code swallows a DB error here
    // (see setMemberPinAction's P2002-only catch for the house style: catch specific,
    // expected codes, let everything else propagate) — so this rejects rather than
    // resolving to { ok: false }.
    mockRecordActivities.mockImplementationOnce(async (tx, inputs) => {
      await prismaAdmin.membership.delete({ where: { userId_tenantId: { userId: targetId, tenantId } } })
      const actual = await vi.importActual<typeof import("@/features/activity/queries")>("@/features/activity/queries")
      return actual.recordActivities(tx, inputs)
    })

    await expect(
      deactivateMemberAction({ tenantId, targetUserId: targetId, reassignToUserId: reassignToId }),
    ).rejects.toThrow()

    // The deal must NOT have been reassigned — the whole operation is one unit or none of it happened.
    const deal = await prismaAdmin.deal.findUnique({ where: { id: targetDealId } })
    expect(deal?.ownerId).toBe(targetId)
  })
})
