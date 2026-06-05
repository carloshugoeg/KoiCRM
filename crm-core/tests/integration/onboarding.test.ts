import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, cleanDatabase, disconnectAll } from "./helpers"
import { bootstrapTenant } from "@/lib/tenant/bootstrap"

let userId: string
const tenantSlug = `onboard-${Date.now()}`

beforeAll(async () => {
  await cleanDatabase()
  const user = await prismaAdmin.user.create({
    data: { email: "onboard@test.local", name: "Onboard User", emailVerified: new Date() },
  })
  userId = user.id
})

afterAll(async () => {
  await cleanDatabase()
  await disconnectAll()
})

describe("onboarding — bootstrapTenant (admin, no RLS)", () => {
  it("creates tenant, membership, pipeline and catalogs", async () => {
    await bootstrapTenant({
      name: "Empresa prueba",
      slug: tenantSlug,
      industrySlug: "aquasistemas",
      ownerUserId: userId,
    })

    const tenant = await prismaAdmin.tenant.findUniqueOrThrow({ where: { slug: tenantSlug } })
    const pipelines = await prismaAdmin.pipeline.findMany({ where: { tenantId: tenant.id } })
    const catalogs = await prismaAdmin.catalogItem.findMany({ where: { tenantId: tenant.id } })
    const settings = await prismaAdmin.tenantSettings.findUnique({ where: { tenantId: tenant.id } })
    const membership = await prismaAdmin.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId: tenant.id } },
    })

    expect(membership?.role).toBe("OWNER")
    expect(pipelines).toHaveLength(1)
    expect(catalogs.length).toBeGreaterThan(0)
    expect(settings?.defaultPipelineId).toBe(pipelines[0]!.id)
  })
})
