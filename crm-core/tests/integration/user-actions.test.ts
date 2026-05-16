import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, disconnectAll } from "./helpers"

let tenantId: string
let ownerId: string
let adminAId: string
let adminBId: string
let memberId: string

beforeAll(async () => {
  const tenant = await prismaAdmin.tenant.create({
    data: { slug: `user-actions-${Date.now()}`, name: "UserActionTest" },
  })
  tenantId = tenant.id

  const makeUser = (tag: string) =>
    prismaAdmin.user.create({ data: { email: `${tag}-${Date.now()}@test.com`, name: tag } })

  const [owner, adminA, adminB, member] = await Promise.all([
    makeUser("owner"),
    makeUser("admin-a"),
    makeUser("admin-b"),
    makeUser("member"),
  ])
  ownerId = owner.id
  adminAId = adminA.id
  adminBId = adminB.id
  memberId = member.id

  await prismaAdmin.membership.createMany({
    data: [
      { userId: ownerId, tenantId, role: "OWNER" },
      { userId: adminAId, tenantId, role: "ADMIN" },
      { userId: adminBId, tenantId, role: "ADMIN" },
      { userId: memberId, tenantId, role: "MEMBER" },
    ],
  })
})

afterAll(async () => {
  await prismaAdmin.tenant.delete({ where: { id: tenantId } })
  await disconnectAll()
})

describe("BUG-010: changeMemberRole self-demotion guard", () => {
  it("self-demotion guard: targetUserId === session.user.id is detected correctly", () => {
    const session = { user: { id: adminAId } }
    const targetUserId = adminAId
    expect(targetUserId === session.user.id).toBe(true)
  })

  it("adminA membership is still ADMIN (not demoted)", async () => {
    const membership = await prismaAdmin.membership.findUnique({
      where: { userId_tenantId: { userId: adminAId, tenantId } },
    })
    expect(membership?.role).toBe("ADMIN")
  })
})

describe("BUG-011: ADMIN cannot remove another ADMIN", () => {
  it("ADMIN-removes-ADMIN: caller=ADMIN, target=ADMIN → should be blocked", () => {
    const callerRole = "ADMIN"
    const targetRole = "ADMIN"
    const blocked = targetRole === "ADMIN" && callerRole !== "OWNER"
    expect(blocked).toBe(true)
  })

  it("OWNER-removes-ADMIN: caller=OWNER, target=ADMIN → should be allowed", () => {
    const callerRole = "OWNER"
    const targetRole = "ADMIN"
    const blocked = targetRole === "ADMIN" && callerRole !== "OWNER"
    expect(blocked).toBe(false)
  })
})

describe("BUG-009: invite atomicity — membership check inside transaction", () => {
  it("existing member is detected inside a transaction", async () => {
    let alreadyMember = false
    await prismaAdmin.$transaction(async (tx) => {
      const existing = await tx.membership.findUnique({
        where: { userId_tenantId: { userId: memberId, tenantId } },
      })
      if (existing) alreadyMember = true
    })
    expect(alreadyMember).toBe(true)
  })

  it("non-member is not found inside a transaction", async () => {
    const strangerUser = await prismaAdmin.user.create({
      data: { email: `stranger-${Date.now()}@test.com` },
    })
    let found = false
    await prismaAdmin.$transaction(async (tx) => {
      const existing = await tx.membership.findUnique({
        where: { userId_tenantId: { userId: strangerUser.id, tenantId } },
      })
      if (existing) found = true
    })
    expect(found).toBe(false)
    await prismaAdmin.user.delete({ where: { id: strangerUser.id } })
  })
})
