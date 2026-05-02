import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prismaAdmin, cleanDatabase, disconnectAll } from "./helpers";

beforeAll(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await disconnectAll();
});

describe("T2.1 — Identity schema", () => {
  it("creates a Tenant with unique slug", async () => {
    const tenant = await prismaAdmin.tenant.create({
      data: { slug: "acme-test", name: "Acme Test" },
    });
    expect(tenant.id).toBeDefined();
    expect(tenant.slug).toBe("acme-test");
  });

  it("enforces unique slug on Tenant", async () => {
    await expect(
      prismaAdmin.tenant.create({
        data: { slug: "acme-test", name: "Duplicate" },
      }),
    ).rejects.toThrow();
  });

  it("creates a User with unique email", async () => {
    const user = await prismaAdmin.user.create({
      data: { email: "alice@test.com", name: "Alice" },
    });
    expect(user.id).toBeDefined();
    expect(user.email).toBe("alice@test.com");
  });

  it("creates a Membership linking User to Tenant", async () => {
    const tenant = await prismaAdmin.tenant.create({
      data: { slug: "beta-test", name: "Beta" },
    });
    const user = await prismaAdmin.user.create({
      data: { email: "bob@test.com" },
    });
    const membership = await prismaAdmin.membership.create({
      data: { tenantId: tenant.id, userId: user.id, role: "OWNER" },
    });
    expect(membership.role).toBe("OWNER");
  });

  it("enforces unique (userId, tenantId) on Membership", async () => {
    const tenant = await prismaAdmin.tenant.findFirstOrThrow({
      where: { slug: "beta-test" },
    });
    const user = await prismaAdmin.user.findFirstOrThrow({
      where: { email: "bob@test.com" },
    });
    await expect(
      prismaAdmin.membership.create({
        data: { tenantId: tenant.id, userId: user.id, role: "MEMBER" },
      }),
    ).rejects.toThrow();
  });

  it("creates TenantBranding for a tenant", async () => {
    const tenant = await prismaAdmin.tenant.create({
      data: { slug: "brand-test", name: "Brand Co" },
    });
    const branding = await prismaAdmin.tenantBranding.create({
      data: { tenantId: tenant.id, primaryColor: "#ff0000", productName: "KoiCRM" },
    });
    expect(branding.primaryColor).toBe("#ff0000");
  });

  it("creates TenantSettings with defaults", async () => {
    const tenant = await prismaAdmin.tenant.create({
      data: { slug: "settings-test", name: "Settings Co" },
    });
    const settings = await prismaAdmin.tenantSettings.create({
      data: { tenantId: tenant.id },
    });
    expect(settings.locale).toBe("es-GT");
    expect(settings.currency).toBe("GTQ");
    expect(settings.dealIdPrefix).toBe("DEAL");
    expect(settings.dealIdYearDigits).toBe(2);
  });

  it("creates an IndustryTemplate", async () => {
    const template = await prismaAdmin.industryTemplate.create({
      data: {
        slug: "aquasistemas",
        name: "Aquasistemas",
        config: { stages: ["prospecto", "cotizacion", "cerrado"] },
      },
    });
    expect(template.slug).toBe("aquasistemas");
  });

  it("cascades delete: removing Tenant deletes Membership", async () => {
    const tenant = await prismaAdmin.tenant.create({
      data: { slug: "cascade-test", name: "Cascade" },
    });
    const user = await prismaAdmin.user.create({
      data: { email: "cascade@test.com" },
    });
    const membership = await prismaAdmin.membership.create({
      data: { tenantId: tenant.id, userId: user.id, role: "MEMBER" },
    });
    await prismaAdmin.tenant.delete({ where: { id: tenant.id } });
    const found = await prismaAdmin.membership.findUnique({
      where: { id: membership.id },
    });
    expect(found).toBeNull();
  });
});
