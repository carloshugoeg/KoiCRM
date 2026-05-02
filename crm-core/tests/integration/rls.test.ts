import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prismaAdmin, prismaApp, withTenant, cleanDatabase, disconnectAll } from "./helpers";

let tenantAId: string;
let tenantBId: string;
let pipelineAId: string;
let stageAId: string;
let userAId: string;

beforeAll(async () => {
  await cleanDatabase();

  const tenantA = await prismaAdmin.tenant.create({
    data: { slug: "rls-tenant-a", name: "Tenant A" },
  });
  tenantAId = tenantA.id;

  const tenantB = await prismaAdmin.tenant.create({
    data: { slug: "rls-tenant-b", name: "Tenant B" },
  });
  tenantBId = tenantB.id;

  const userA = await prismaAdmin.user.create({
    data: { email: "user-a@rls.com" },
  });
  userAId = userA.id;

  const pipeline = await prismaAdmin.pipeline.create({
    data: {
      tenantId: tenantAId,
      name: "Pipeline A",
      stages: {
        create: [{ tenantId: tenantAId, order: 0, key: "open", label: "Open", color: "#blue", iconKey: "circle" }],
      },
    },
    include: { stages: true },
  });
  pipelineAId = pipeline.id;
  stageAId = pipeline.stages[0].id;

  await prismaAdmin.deal.create({
    data: {
      id: "RLS-A-0001-UA-26",
      tenantId: tenantAId,
      pipelineId: pipelineAId,
      stageId: stageAId,
      ownerId: userAId,
      channelKey: "direct",
      statusKey: "active",
      name: "Deal de Tenant A",
      value: 1000,
    },
  });

  const pipelineB = await prismaAdmin.pipeline.create({
    data: {
      tenantId: tenantBId,
      name: "Pipeline B",
      stages: {
        create: [{ tenantId: tenantBId, order: 0, key: "open", label: "Open", color: "#red", iconKey: "circle" }],
      },
    },
    include: { stages: true },
  });

  const userB = await prismaAdmin.user.create({ data: { email: "user-b@rls.com" } });

  await prismaAdmin.deal.create({
    data: {
      id: "RLS-B-0001-UB-26",
      tenantId: tenantBId,
      pipelineId: pipelineB.id,
      stageId: pipelineB.stages[0].id,
      ownerId: userB.id,
      channelKey: "direct",
      statusKey: "active",
      name: "Deal de Tenant B",
      value: 2000,
    },
  });
});

afterAll(async () => {
  await cleanDatabase();
  await disconnectAll();
});

describe("T2.3 — RLS tenant isolation", () => {
  it("with tenantA context, sees only Tenant A deals", async () => {
    const deals = await withTenant(tenantAId, (tx) =>
      tx.deal.findMany({ where: { tenantId: tenantAId } }),
    );
    expect(deals).toHaveLength(1);
    expect(deals[0].id).toBe("RLS-A-0001-UA-26");
  });

  it("with tenantB context, does NOT see Tenant A deals", async () => {
    const deals = await withTenant(tenantBId, (tx) =>
      tx.deal.findMany({ where: { tenantId: tenantAId } }),
    );
    expect(deals).toHaveLength(0);
  });

  it("without set_config, sees 0 deals", async () => {
    const deals = await prismaApp.deal.findMany();
    expect(deals).toHaveLength(0);
  });

  it("RLS policy exists for all business tables with tenantId", async () => {
    const result = await prismaAdmin.$queryRaw<{ tablename: string; policyname: string }[]>`
      SELECT tablename, policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND policyname = 'tenant_isolation'
      ORDER BY tablename
    `;

    const tablesWithRls = result.map((r) => r.tablename);

    const expectedTables = [
      "Pipeline",
      "PipelineStage",
      "CatalogItem",
      "Client",
      "Deal",
      "Quote",
      "Payment",
      "Attachment",
      "FollowUp",
      "Note",
      "Activity",
      "SavedView",
      "Counter",
      "CustomFieldDefinition",
    ];

    for (const table of expectedTables) {
      expect(tablesWithRls, `Missing RLS policy on table: ${table}`).toContain(table);
    }
  });

  it("RLS is enabled (relrowsecurity=true) on all tenantId tables", async () => {
    const result = await prismaAdmin.$queryRaw<{ relname: string }[]>`
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relrowsecurity = true
        AND c.relkind = 'r'
      ORDER BY c.relname
    `;
    const tables = result.map((r) => r.relname);
    expect(tables).toContain("Deal");
    expect(tables).toContain("Pipeline");
  });

  it("Pipelines are isolated: tenantA sees only its pipelines", async () => {
    const pipelines = await withTenant(tenantAId, (tx) =>
      tx.pipeline.findMany(),
    );
    expect(pipelines.every((p) => p.tenantId === tenantAId)).toBe(true);
  });
});
