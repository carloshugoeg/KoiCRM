import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, withTenant, cleanDatabase, disconnectAll } from "./helpers"

describe("TenantBranding", () => {
  let tenantId: string

  beforeAll(async () => {
    await cleanDatabase()
    const t = await prismaAdmin.tenant.create({
      data: { name: "BrandTest", slug: `brand-test-${Date.now()}` },
    })
    tenantId = t.id
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectAll()
  })

  it("upserts branding fields for a tenant", async () => {
    await withTenant(tenantId, async (tx) => {
      await tx.tenantBranding.upsert({
        where: { tenantId },
        create: { tenantId, primaryColor: "#FF0000", productName: "TestCRM" },
        update: { primaryColor: "#FF0000", productName: "TestCRM" },
      })
    })

    const branding = await prismaAdmin.tenantBranding.findUnique({ where: { tenantId } })
    expect(branding?.primaryColor).toBe("#FF0000")
    expect(branding?.productName).toBe("TestCRM")
  })

  it("updating branding replaces only specified fields", async () => {
    await withTenant(tenantId, async (tx) => {
      await tx.tenantBranding.upsert({
        where: { tenantId },
        create: { tenantId, primaryColor: "#00FF00" },
        update: { primaryColor: "#00FF00" },
      })
    })

    const branding = await prismaAdmin.tenantBranding.findUnique({ where: { tenantId } })
    expect(branding?.primaryColor).toBe("#00FF00")
    expect(branding?.productName).toBe("TestCRM") // unchanged from previous
  })
})
