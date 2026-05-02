import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prismaAdmin, cleanDatabase, disconnectAll } from "./helpers";

let tenantId: string;
let userId: string;
let pipelineId: string;
let stageId: string;

beforeAll(async () => {
  await cleanDatabase();

  const tenant = await prismaAdmin.tenant.create({
    data: {
      slug: "biz-test",
      name: "Biz Test Tenant",
      settings: { create: { dealIdPrefix: "BIZ" } },
    },
  });
  tenantId = tenant.id;

  const user = await prismaAdmin.user.create({
    data: { email: "owner@biz.com" },
  });
  userId = user.id;
});

afterAll(async () => {
  await cleanDatabase();
  await disconnectAll();
});

describe("T2.2 — Business schema", () => {
  it("creates Pipeline with PipelineStages", async () => {
    const pipeline = await prismaAdmin.pipeline.create({
      data: {
        tenantId,
        name: "Main Pipeline",
        isDefault: true,
        stages: {
          create: [
            { tenantId, order: 0, key: "prospecto", label: "Prospecto", color: "#blue", iconKey: "circle" },
            { tenantId, order: 1, key: "cotizacion", label: "Cotización", color: "#yellow", iconKey: "file" },
            { tenantId, order: 2, key: "cerrado", label: "Cerrado", color: "#green", iconKey: "check" },
          ],
        },
      },
      include: { stages: true },
    });
    pipelineId = pipeline.id;
    stageId = pipeline.stages[0].id;
    expect(pipeline.stages).toHaveLength(3);
  });

  it("enforces unique (pipelineId, key) on PipelineStage", async () => {
    await expect(
      prismaAdmin.pipelineStage.create({
        data: {
          tenantId,
          pipelineId,
          order: 99,
          key: "prospecto",
          label: "Dupe",
          color: "#red",
          iconKey: "x",
        },
      }),
    ).rejects.toThrow();
  });

  it("creates CatalogItems", async () => {
    await prismaAdmin.catalogItem.createMany({
      data: [
        { tenantId, catalogKey: "salesChannel", key: "whatsapp", label: "WhatsApp" },
        { tenantId, catalogKey: "dealStatus", key: "active", label: "Active" },
        { tenantId, catalogKey: "followupReason", key: "call", label: "Llamada" },
        { tenantId, catalogKey: "equipment", key: "bomba", label: "Bomba" },
      ],
    });
    const items = await prismaAdmin.catalogItem.findMany({ where: { tenantId } });
    expect(items).toHaveLength(4);
  });

  it("enforces unique (tenantId, catalogKey, key) on CatalogItem", async () => {
    await expect(
      prismaAdmin.catalogItem.create({
        data: { tenantId, catalogKey: "salesChannel", key: "whatsapp", label: "Dup" },
      }),
    ).rejects.toThrow();
  });

  it("creates a Client", async () => {
    const client = await prismaAdmin.client.create({
      data: { tenantId, name: "Juan Pérez", company: "Piscinas SA" },
    });
    expect(client.id).toBeDefined();
  });

  it("creates a Deal with all relations", async () => {
    const client = await prismaAdmin.client.findFirstOrThrow({ where: { tenantId } });
    const dealId = `BIZ-0001-OW-26`;

    const deal = await prismaAdmin.deal.create({
      data: {
        id: dealId,
        tenantId,
        pipelineId,
        stageId,
        clientId: client.id,
        ownerId: userId,
        channelKey: "whatsapp",
        statusKey: "active",
        name: "Instalación Bomba",
        value: 5000,
        equipment: { create: [{ equipmentKey: "bomba" }] },
        quotes: {
          create: [{ tenantId, number: "COT-001", date: new Date() }],
        },
        payments: {
          create: [{ tenantId, number: "FAC-001", date: new Date() }],
        },
        followUps: {
          create: [{ tenantId, date: new Date(), reasonKey: "call" }],
        },
        notes: {
          create: [{ tenantId, text: "Primera nota del deal" }],
        },
      },
      include: {
        equipment: true,
        quotes: true,
        payments: true,
        followUps: true,
        notes: true,
      },
    });

    expect(deal.id).toBe(dealId);
    expect(deal.equipment).toHaveLength(1);
    expect(deal.quotes).toHaveLength(1);
    expect(deal.payments).toHaveLength(1);
    expect(deal.followUps).toHaveLength(1);
    expect(deal.notes).toHaveLength(1);
  });

  it("creates SavedView for a tenant", async () => {
    const view = await prismaAdmin.savedView.create({
      data: {
        tenantId,
        userId,
        entity: "Deal",
        name: "Mi vista",
        config: { filters: [], sort: "createdAt", columns: ["name", "value"] },
      },
    });
    expect(view.entity).toBe("Deal");
  });

  it("creates CustomFieldDefinition", async () => {
    const field = await prismaAdmin.customFieldDefinition.create({
      data: {
        tenantId,
        entity: "Deal",
        key: "num_peces",
        label: "Número de peces",
        type: "number",
      },
    });
    expect(field.key).toBe("num_peces");
  });

  it("enforces unique (tenantId, entity, key) on CustomFieldDefinition", async () => {
    await expect(
      prismaAdmin.customFieldDefinition.create({
        data: { tenantId, entity: "Deal", key: "num_peces", label: "Dup", type: "text" },
      }),
    ).rejects.toThrow();
  });

  it("creates Counter for tenant", async () => {
    const counter = await prismaAdmin.counter.create({
      data: { tenantId, key: "deal", value: 0 },
    });
    expect(counter.value).toBe(0);
  });

  it("creates Activity log entry", async () => {
    const activity = await prismaAdmin.activity.create({
      data: {
        tenantId,
        entity: "Deal",
        entityId: "BIZ-0001-OW-26",
        type: "created",
        payload: { by: userId },
      },
    });
    expect(activity.type).toBe("created");
  });

  it("cascades delete: removing Deal deletes DealEquipment", async () => {
    const deal = await prismaAdmin.deal.findFirstOrThrow({
      where: { tenantId },
      include: { equipment: true },
    });
    expect(deal.equipment).toHaveLength(1);
    await prismaAdmin.deal.delete({ where: { id: deal.id } });
    const eq = await prismaAdmin.dealEquipment.findFirst({
      where: { dealId: deal.id },
    });
    expect(eq).toBeNull();
  });
});
