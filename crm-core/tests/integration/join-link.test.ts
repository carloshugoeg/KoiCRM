import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, disconnectAll } from "./helpers"
import { isJoinLinkActive } from "@/lib/tenant/join-link"
import { buildJoinLinkUrl } from "@/lib/tenant/join-link-url"

let tenantId: string
let ownerId: string
let strangerId: string
let linkId: string
let linkToken: string

beforeAll(async () => {
  const tenant = await prismaAdmin.tenant.create({
    data: {
      slug: `join-link-${Date.now()}`,
      name: "JoinLinkTest",
      subscriptionValidated: true,
    },
  })
  tenantId = tenant.id

  const owner = await prismaAdmin.user.create({
    data: { email: `join-owner-${Date.now()}@test.com`, name: "Owner" },
  })
  ownerId = owner.id

  const stranger = await prismaAdmin.user.create({
    data: { email: `join-stranger-${Date.now()}@test.com`, name: "Stranger" },
  })
  strangerId = stranger.id

  await prismaAdmin.membership.create({
    data: { userId: ownerId, tenantId, role: "OWNER" },
  })

  const link = await prismaAdmin.joinLink.create({
    data: {
      tenantId,
      token: `tok-${Date.now()}${"a".repeat(48)}`,
      role: "MEMBER",
      label: "Equipo",
      expiresAt: new Date(Date.now() + 86400000),
    },
  })
  linkId = link.id
  linkToken = link.token
})

afterAll(async () => {
  await prismaAdmin.tenant.delete({ where: { id: tenantId } })
  await prismaAdmin.user.deleteMany({ where: { id: { in: [ownerId, strangerId] } } })
  await disconnectAll()
})

describe("JoinLink model", () => {
  it("buildJoinLinkUrl includes token", () => {
    expect(buildJoinLinkUrl(linkToken, "https://app.test")).toContain(linkToken)
    expect(buildJoinLinkUrl(linkToken, "https://app.test")).toContain("/api/join/accept")
  })

  it("isJoinLinkActive rejects revoked links", async () => {
    const link = await prismaAdmin.joinLink.findUniqueOrThrow({ where: { id: linkId } })
    expect(isJoinLinkActive(link)).toBe(true)
    await prismaAdmin.joinLink.update({
      where: { id: linkId },
      data: { revokedAt: new Date() },
    })
    const revoked = await prismaAdmin.joinLink.findUniqueOrThrow({ where: { id: linkId } })
    expect(isJoinLinkActive(revoked)).toBe(false)
  })

  it("stranger can join via membership create with link role", async () => {
    const freshLink = await prismaAdmin.joinLink.create({
      data: {
        tenantId,
        token: `tok-join-${Date.now()}${"b".repeat(40)}`,
        role: "VIEWER",
        expiresAt: new Date(Date.now() + 86400000),
      },
    })

    await prismaAdmin.membership.create({
      data: { userId: strangerId, tenantId, role: freshLink.role },
    })

    const membership = await prismaAdmin.membership.findUnique({
      where: { userId_tenantId: { userId: strangerId, tenantId } },
    })
    expect(membership?.role).toBe("VIEWER")

    await prismaAdmin.joinLink.update({
      where: { id: freshLink.id },
      data: { role: "ADMIN" },
    })
    const updatedLink = await prismaAdmin.joinLink.findUniqueOrThrow({
      where: { id: freshLink.id },
    })
    expect(updatedLink.role).toBe("ADMIN")
    expect(membership?.role).toBe("VIEWER")
  })
})
