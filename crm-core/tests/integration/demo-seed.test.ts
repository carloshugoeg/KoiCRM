import path from "path"
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, disconnectAll } from "./helpers"

// Import seedDemo — note: the seed file also calls seedDemo() at module level when run via tsx.
// For import in tests, we need to avoid that side effect.
// Solution: the seed file calls seedDemo() unconditionally — this is fine because the
// integration test calls seedDemo() explicitly in beforeAll and the re-run tests idempotency.

describe("demo-aquasistemas seed", () => {
  let tenantId: string

  beforeAll(async () => {
    // Run the seed by executing it directly (avoids ESM/CJS import issues with the auto-run code)
    const { execSync } = await import("child_process")
    execSync("pnpm seed:demo", {
      cwd: path.resolve(__dirname, "../.."),
      stdio: "inherit",
    })
    const tenant = await prismaAdmin.tenant.findUnique({ where: { slug: "demo-aqua" } })
    tenantId = tenant!.id
  }, 60_000)

  afterAll(async () => {
    const demoEmails = [
      "admin@aquasistemas.demo",
      "ventas@aquasistemas.demo",
      "ops@aquasistemas.demo",
      "soporte@aquasistemas.demo",
    ]
    await prismaAdmin.tenant.deleteMany({ where: { slug: "demo-aqua" } })
    await prismaAdmin.user.deleteMany({ where: { email: { in: demoEmails } } })
    await disconnectAll()
  })

  it("creates the demo-aqua tenant", async () => {
    const tenant = await prismaAdmin.tenant.findUnique({ where: { slug: "demo-aqua" } })
    expect(tenant).not.toBeNull()
    expect(tenant!.name).toBe("Aquasistemas Demo")
  })

  it("creates exactly 4 members", async () => {
    const members = await prismaAdmin.membership.findMany({ where: { tenantId } })
    expect(members).toHaveLength(4)
    expect(members.map((m) => m.role)).toContain("OWNER")
  })

  it("creates exactly 30 deals", async () => {
    const count = await prismaAdmin.deal.count({ where: { tenantId } })
    expect(count).toBe(30)
  })

  it("creates 6 pipeline stages", async () => {
    const stages = await prismaAdmin.pipelineStage.findMany({ where: { tenantId } })
    expect(stages).toHaveLength(6)
    expect(stages.map((s) => s.key)).toContain("prospecto")
    expect(stages.map((s) => s.key)).toContain("ganado")
  })

  it("creates 15 quotes and 4 payments", async () => {
    const quotes = await prismaAdmin.quote.count({ where: { tenantId, isVoid: false } })
    const payments = await prismaAdmin.payment.count({ where: { tenantId, isVoid: false } })
    expect(quotes).toBe(15)
    expect(payments).toBe(4)
  })

  it("creates follow-ups with mix of states", async () => {
    const total = await prismaAdmin.followUp.count({ where: { tenantId } })
    const completed = await prismaAdmin.followUp.count({ where: { tenantId, completed: true } })
    const overdue = await prismaAdmin.followUp.count({
      where: { tenantId, completed: false, date: { lt: new Date() } },
    })
    expect(total).toBe(10)
    expect(completed).toBe(3)
    expect(overdue).toBe(3)
  })

  it("applies branding (primaryColor) and settings (dealIdPrefix)", async () => {
    const branding = await prismaAdmin.tenantBranding.findUnique({ where: { tenantId } })
    const settings = await prismaAdmin.tenantSettings.findUnique({ where: { tenantId } })
    expect(branding?.primaryColor).toBe("#0ea5e9")
    expect(settings?.dealIdPrefix).toBe("AQX")
    expect(settings?.locale).toBe("es-GT")
  })

  it("is idempotent — re-running produces exactly 30 deals", async () => {
    const { execSync } = await import("child_process")
    execSync("pnpm seed:demo", {
      cwd: path.resolve(__dirname, "../.."),
      stdio: "inherit",
    })
    const newTenant = await prismaAdmin.tenant.findUnique({ where: { slug: "demo-aqua" } })
    const count = await prismaAdmin.deal.count({ where: { tenantId: newTenant!.id } })
    expect(count).toBe(30)
    const tenants = await prismaAdmin.tenant.findMany({ where: { slug: "demo-aqua" } })
    expect(tenants).toHaveLength(1)
  }, 60_000)
})
