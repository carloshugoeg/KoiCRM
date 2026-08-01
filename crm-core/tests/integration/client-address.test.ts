import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest"
import type { Session } from "next-auth"
import { prismaAdmin, cleanDatabase, disconnectAll } from "./helpers"

/**
 * Covers `Client.address` through every entry point that can set it:
 *  - createClientAction (create path — `features/clients/actions.ts`)
 *  - updateClientAction (the client profile's inline edit — same action backs "the client form")
 *  - createDealAction's detect-or-create (the quick-create flow ClientFormModal drives when a
 *    deal is opened for a client that doesn't exist yet)
 *
 * Leaves `@/lib/db/client` unmocked so these run against the real app_user connection with RLS
 * active, same as `clients-customfields-rls.test.ts` — Client is RLS-protected and a bare
 * `prisma.*` read/write would silently no-op as app_user.
 */

process.env.AUTH_SECRET ??= "test-client-address-secret"

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

// Import AFTER mocks.
import { createClientAction, updateClientAction } from "@/features/clients/actions"
import { createDealAction } from "@/features/deals/actions"
import { auth } from "@/lib/auth/auth"

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>

let tenantId: string
let tenantSlug: string
let userId: string

beforeAll(async () => {
  await cleanDatabase()

  const tenant = await prismaAdmin.tenant.create({
    data: { slug: `addr-${Date.now()}`, name: "Address Tenant" },
  })
  tenantId = tenant.id
  tenantSlug = tenant.slug

  const user = await prismaAdmin.user.create({
    data: { email: `addr-${Date.now()}@test.com`, name: "Asesor Uno" },
  })
  userId = user.id
  await prismaAdmin.membership.create({ data: { userId, tenantId, role: "OWNER", status: "ACTIVE" } })

  const pipeline = await prismaAdmin.pipeline.create({ data: { tenantId, name: "P", isDefault: true } })
  await prismaAdmin.pipelineStage.create({
    data: { tenantId, pipelineId: pipeline.id, order: 0, key: "nuevo", label: "Nuevo", color: "#6366f1", iconKey: "circle" },
  })

  // createDealAction validates channelKey against an active salesChannel catalog item, and
  // requires >=1 active categoría/subcategoría pair for equipo de interés.
  await prismaAdmin.catalogItem.create({
    data: { tenantId, catalogKey: "salesChannel", key: "telefono", label: "Teléfono", order: 0, active: true },
  })
  const category = await prismaAdmin.catalogItem.create({
    data: { tenantId, catalogKey: "equipment", key: "cat1", label: "Categoría 1", order: 0, active: true },
  })
  await prismaAdmin.catalogItem.create({
    data: {
      tenantId,
      catalogKey: "equipment",
      key: "sub1",
      label: "Subcategoría 1",
      order: 0,
      active: true,
      parentId: category.id,
    },
  })
})

afterAll(async () => {
  await cleanDatabase()
  await disconnectAll()
})

beforeEach(() => {
  mockAuth.mockReset()
  mockAuth.mockResolvedValue({ user: { id: userId } } as Session)
})

describe("Client.address persists through every entry point", () => {
  it("createClientAction persists the address", async () => {
    const res = await createClientAction({
      tenantId,
      tenantSlug,
      name: `Cliente Nuevo ${Date.now()}`,
      address: "5ta avenida 10-20, zona 10",
    })
    expect(res.ok).toBe(true)

    const created = await prismaAdmin.client.findUnique({ where: { id: res.id! } })
    expect(created?.address).toBe("5ta avenida 10-20, zona 10")
  })

  it("updateClientAction persists the address on an existing client (the client profile's edit form)", async () => {
    const client = await prismaAdmin.client.create({ data: { tenantId, name: `Cliente Editar ${Date.now()}` } })

    const res = await updateClientAction({
      tenantId,
      tenantSlug,
      id: client.id,
      name: client.name,
      address: "6a calle 4-56, zona 9",
    })
    expect(res.ok).toBe(true)

    const after = await prismaAdmin.client.findUnique({ where: { id: client.id } })
    expect(after?.address).toBe("6a calle 4-56, zona 9")
  })

  it("updateClientAction clears the address when saved blank — optional, never blocks a save", async () => {
    const client = await prismaAdmin.client.create({
      data: { tenantId, name: `Cliente Borrar ${Date.now()}`, address: "Dirección vieja" },
    })

    const res = await updateClientAction({ tenantId, tenantSlug, id: client.id, name: client.name, address: "" })
    expect(res.ok).toBe(true)

    const after = await prismaAdmin.client.findUnique({ where: { id: client.id } })
    expect(after?.address).toBeNull()
  })

  it("createDealAction's quick-create flow (ClientFormModal) writes the address onto the new Client", async () => {
    const name = `Prospecto Nuevo ${Date.now()}`
    const res = await createDealAction({
      tenantId,
      tenantSlug,
      ownerId: userId,
      channelKey: "telefono",
      name,
      phone: "5500-0000",
      address: "7a avenida 3-21, zona 4",
      equipment: [{ categoryKey: "cat1", subcategoryKeys: ["sub1"] }],
    })
    expect(res.ok).toBe(true)
    expect(res.dealId).toBeTruthy()

    const deal = await prismaAdmin.deal.findUnique({ where: { id: res.dealId! }, select: { clientId: true } })
    expect(deal?.clientId).toBeTruthy()

    const client = await prismaAdmin.client.findUnique({ where: { id: deal!.clientId! } })
    expect(client?.name).toBe(name)
    expect(client?.address).toBe("7a avenida 3-21, zona 4")
  })

  it("createDealAction leaves the address unset when the field is left blank", async () => {
    const name = `Prospecto Sin Dirección ${Date.now()}`
    const res = await createDealAction({
      tenantId,
      tenantSlug,
      ownerId: userId,
      channelKey: "telefono",
      name,
      phone: "5500-1111",
      equipment: [{ categoryKey: "cat1", subcategoryKeys: ["sub1"] }],
    })
    expect(res.ok).toBe(true)

    const deal = await prismaAdmin.deal.findUnique({ where: { id: res.dealId! }, select: { clientId: true } })
    const client = await prismaAdmin.client.findUnique({ where: { id: deal!.clientId! } })
    expect(client?.address).toBeNull()
  })
})
