import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, withTenant, cleanDatabase, disconnectAll } from "./helpers"
import { formatCurrency, formatDate } from "@/lib/intl/format"

describe("TenantSettings", () => {
  let tenantId: string

  beforeAll(async () => {
    await cleanDatabase()
    const t = await prismaAdmin.tenant.create({
      data: { name: "SettingsTest", slug: `settings-test-${Date.now()}` },
    })
    tenantId = t.id
  })

  afterAll(async () => {
    await cleanDatabase()
    await disconnectAll()
  })

  it("upserts settings and reads them back", async () => {
    await withTenant(tenantId, async (tx) => {
      await tx.tenantSettings.upsert({
        where: { tenantId },
        create: { tenantId, currency: "USD", locale: "en-US", dealIdPrefix: "TST" },
        update: { currency: "USD", locale: "en-US", dealIdPrefix: "TST" },
      })
    })

    const settings = await prismaAdmin.tenantSettings.findUnique({ where: { tenantId } })
    expect(settings?.currency).toBe("USD")
    expect(settings?.dealIdPrefix).toBe("TST")
  })

  it("formatCurrency uses provided locale and currency", () => {
    const result = formatCurrency(1500, { locale: "es-GT", currency: "GTQ" })
    expect(result).toMatch(/1[,.]?500/)
    expect(result).toMatch(/Q|GTQ/)
  })

  it("formatCurrency formats USD correctly", () => {
    const result = formatCurrency(1500, { locale: "en-US", currency: "USD" })
    expect(result).toMatch(/1[,.]?500/)
    expect(result).toMatch(/\$|USD/)
  })
})
