import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prismaAdmin, cleanDatabase, disconnectAll } from "./helpers";
import { generateDealId } from "@/lib/id/deal-id";

let tenantId: string;
let pipelineId: string;
let stageId: string;
let userId: string;

beforeAll(async () => {
  await cleanDatabase();

  const tenant = await prismaAdmin.tenant.create({
    data: {
      slug: "dealid-test",
      name: "Deal ID Test",
      settings: { create: { dealIdPrefix: "TST", dealIdYearDigits: 2 } },
    },
  });
  tenantId = tenant.id;

  const user = await prismaAdmin.user.create({ data: { email: "owner@dealid.com" } });
  userId = user.id;

  const pipeline = await prismaAdmin.pipeline.create({
    data: {
      tenantId,
      name: "Test Pipeline",
      stages: {
        create: [{ tenantId, order: 0, key: "open", label: "Open", color: "#blue", iconKey: "circle" }],
      },
    },
    include: { stages: true },
  });
  pipelineId = pipeline.id;
  stageId = pipeline.stages[0].id;

  await prismaAdmin.counter.create({ data: { tenantId, key: "deal", value: 0 } });
});

afterAll(async () => {
  await cleanDatabase();
  await disconnectAll();
});

describe("T2.4 — Deal ID generator", () => {
  it("generates correctly formatted ID", async () => {
    const id = await prismaAdmin.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return generateDealId(tx as any, tenantId, "RO");
    });

    const year = new Date().getFullYear().toString().slice(-2);
    expect(id).toMatch(/^TST-\d{4}-RO-\d{2}$/);
    expect(id).toContain(`-RO-${year}`);
  });

  it("increments counter on each call", async () => {
    const id1 = await prismaAdmin.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return generateDealId(tx as any, tenantId, "AB");
    });
    const id2 = await prismaAdmin.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return generateDealId(tx as any, tenantId, "AB");
    });

    const seq1 = parseInt(id1.split("-")[1]);
    const seq2 = parseInt(id2.split("-")[1]);
    expect(seq2).toBe(seq1 + 1);
  });

  it("50 concurrent generations produce 50 unique sequential IDs", async () => {
    // Reset counter for clean concurrency test
    await prismaAdmin.counter.upsert({
      where: { tenantId_key: { tenantId, key: "deal" } },
      update: { value: 0 },
      create: { tenantId, key: "deal", value: 0 },
    });

    const ids = await Promise.all(
      Array.from({ length: 50 }, () =>
        prismaAdmin.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
          return generateDealId(tx as any, tenantId, "CC");
        }),
      ),
    );

    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(50);

    const sequences = ids.map((id) => parseInt(id.split("-")[1])).sort((a, b) => a - b);
    // All 50 sequence numbers should be present (1..50)
    expect(sequences[0]).toBe(1);
    expect(sequences[49]).toBe(50);
    expect(new Set(sequences).size).toBe(50);
  });
});
