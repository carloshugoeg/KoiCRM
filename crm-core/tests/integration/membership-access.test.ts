import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, cleanDatabase, disconnectAll } from "./helpers"
import {
  evaluateMembershipAccess,
  resolveUserAppDestination,
  resolvePostLoginPath,
  checkTenantEmbudoAccess,
} from "@/lib/tenant/access"
import { parseInviteToken } from "@/lib/tenant/parse-invite-token"
import { MembershipStatus } from "@prisma/client"

beforeAll(async () => {
  await cleanDatabase()
})

afterAll(async () => {
  await cleanDatabase()
  await disconnectAll()
})

describe("membership & tenant subscription access", () => {
  it("parseInviteToken extracts token from full URL", () => {
    const url =
      "http://localhost:3000/api/invite/accept?token=abc123xyz456"
    expect(parseInviteToken(url)).toBe("abc123xyz456")
  })

  it("parseInviteToken accepts raw token", () => {
    expect(parseInviteToken("abc1234567890abcd")).toBe("abc1234567890abcd")
  })

  it("blocks when user has no membership", async () => {
    const user = await prismaAdmin.user.create({
      data: { email: "solo@test.com", emailVerified: new Date() },
    })
    const dest = await resolveUserAppDestination(user.id)
    expect(dest).toEqual({ kind: "access", reason: "no_membership" })
  })

  it("blocks inactive membership", async () => {
    const tenant = await prismaAdmin.tenant.create({
      data: { slug: "inactive-m", name: "Inactive M", subscriptionValidated: true },
    })
    const user = await prismaAdmin.user.create({
      data: { email: "inactive@test.com", emailVerified: new Date() },
    })
    await prismaAdmin.membership.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        role: "MEMBER",
        status: MembershipStatus.INACTIVE,
      },
    })
    const dest = await resolveUserAppDestination(user.id)
    expect(dest).toEqual({ kind: "access", reason: "membership_inactive" })
  })

  it("blocks all members when owner tenant subscription is not validated", async () => {
    const tenant = await prismaAdmin.tenant.create({
      data: { slug: "unvalidated-org", name: "Unvalidated", subscriptionValidated: false },
    })
    const owner = await prismaAdmin.user.create({
      data: { email: "owner@test.com", emailVerified: new Date() },
    })
    const member = await prismaAdmin.user.create({
      data: { email: "member@test.com", emailVerified: new Date() },
    })
    await prismaAdmin.membership.createMany({
      data: [
        { tenantId: tenant.id, userId: owner.id, role: "OWNER" },
        { tenantId: tenant.id, userId: member.id, role: "MEMBER" },
      ],
    })

    const ownerAccess = await checkTenantEmbudoAccess(owner.id, tenant.slug)
    const memberAccess = await checkTenantEmbudoAccess(member.id, tenant.slug)
    expect(ownerAccess).toEqual({ allowed: false, reason: "tenant_subscription_inactive" })
    expect(memberAccess).toEqual({ allowed: false, reason: "tenant_subscription_inactive" })
  })

  it("allows embudo when membership active and tenant validated", async () => {
    const tenant = await prismaAdmin.tenant.create({
      data: { slug: "active-org", name: "Active", subscriptionValidated: true },
    })
    const user = await prismaAdmin.user.create({
      data: { email: "active@test.com", emailVerified: new Date() },
    })
    await prismaAdmin.membership.create({
      data: { tenantId: tenant.id, userId: user.id, role: "MEMBER" },
    })
    const dest = await resolveUserAppDestination(user.id)
    expect(dest).toEqual({ kind: "embudo", slug: "active-org" })
    expect(evaluateMembershipAccess({ status: "ACTIVE" }, { subscriptionValidated: true })).toEqual({
      allowed: true,
    })

    const path = await resolvePostLoginPath(user.id, "/app/koicrm/pipeline")
    expect(path).toBe("/app/active-org/pipeline")
  })
})
