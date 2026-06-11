import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest"
import type { Session } from "next-auth"
import { randomBytes } from "crypto"
import { prismaAdmin, cleanDatabase, disconnectAll } from "./helpers"

/**
 * Regression test for bare-`prisma.*` reads on RLS-protected tables.
 *
 * `Client` and `CustomFieldDefinition` are RLS-protected. A bare `prisma.x.findUnique/
 * findMany/count` runs as app_user WITHOUT `app.tenant_id` set, so the policy
 * `USING (tenantId = current_setting('app.tenant_id', true))` matches nothing and the
 * read comes back empty — silently breaking the feature in production while passing
 * locally on a BYPASSRLS connection.
 *
 * This file leaves `@/lib/db/client` UNMOCKED, so the action code runs against the real
 * app_user connection (DATABASE_URL) with RLS active — the same as production. Setup uses
 * `prismaAdmin` (BYPASSRLS). The fix wraps each pre-check read in `withTenant`.
 */

process.env.AUTH_SECRET ??= "test-clients-cf-rls-secret"

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

// Import AFTER mocks.
import { getCustomFieldDefs } from "@/features/custom-fields/queries"
import { deleteCustomFieldAction, reorderCustomFieldsAction } from "@/features/custom-fields/actions"
import { updateClientAction, deleteClientAction } from "@/features/clients/actions"
import { auth } from "@/lib/auth/auth"

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>

function makeCuid(): string {
  return "c" + randomBytes(12).toString("hex")
}

let tenantId: string
let tenantSlug: string
let userId: string
let pipelineId: string
let stageId: string

beforeAll(async () => {
  await cleanDatabase()

  const tenant = await prismaAdmin.tenant.create({
    data: { slug: `cf-rls-${Date.now()}`, name: "CF RLS Tenant" },
  })
  tenantId = tenant.id
  tenantSlug = tenant.slug

  const user = await prismaAdmin.user.create({ data: { email: `cf-rls-${Date.now()}@test.com` } })
  userId = user.id
  await prismaAdmin.membership.create({ data: { userId, tenantId, role: "OWNER", status: "ACTIVE" } })

  const pipeline = await prismaAdmin.pipeline.create({ data: { tenantId, name: "P", isDefault: true } })
  pipelineId = pipeline.id
  const stage = await prismaAdmin.pipelineStage.create({
    data: { tenantId, pipelineId, order: 0, key: "nuevo", label: "Nuevo", color: "#6366f1", iconKey: "circle" },
  })
  stageId = stage.id
})

afterAll(async () => {
  await cleanDatabase()
  await disconnectAll()
})

beforeEach(() => {
  mockAuth.mockReset()
  mockAuth.mockResolvedValue({ user: { id: userId } } as Session)
})

async function seedClient(name: string): Promise<string> {
  const c = await prismaAdmin.client.create({ data: { tenantId, name } })
  return c.id
}

async function seedField(key: string, order = 0): Promise<string> {
  const f = await prismaAdmin.customFieldDefinition.create({
    data: { tenantId, entity: "Client", key, label: key, type: "text", required: false, order },
  })
  return f.id
}

describe("RLS reads on Client / CustomFieldDefinition run under tenant context", () => {
  it("getCustomFieldDefs returns the tenant's definitions", async () => {
    await seedField(`field_${Date.now()}`)
    const defs = await getCustomFieldDefs(tenantId, "Client")
    expect(defs.length).toBeGreaterThan(0)
  })

  it("updateClientAction updates an existing client", async () => {
    const id = await seedClient(`Client A ${Date.now()}`)
    const res = await updateClientAction({ tenantId, tenantSlug, id, name: "Client A renamed" })
    expect(res.ok).toBe(true)

    const after = await prismaAdmin.client.findUnique({ where: { id } })
    expect(after?.name).toBe("Client A renamed")
  })

  it("deleteClientAction deletes a client with no linked deals", async () => {
    const id = await seedClient(`Client B ${Date.now()}`)
    const res = await deleteClientAction({ tenantId, tenantSlug, id })
    expect(res.ok).toBe(true)

    const after = await prismaAdmin.client.findUnique({ where: { id } })
    expect(after).toBeNull()
  })

  it("deleteClientAction blocks deletion when deals are linked (linked-deal guard counts correctly)", async () => {
    const id = await seedClient(`Client C ${Date.now()}`)
    await prismaAdmin.deal.create({
      data: {
        id: makeCuid(),
        tenantId,
        pipelineId,
        stageId,
        ownerId: userId,
        clientId: id,
        name: "Linked deal",
        channelKey: "web",
        statusKey: "active",
        value: 100,
      },
    })
    const res = await deleteClientAction({ tenantId, tenantSlug, id })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/oportunidad/i)

    const after = await prismaAdmin.client.findUnique({ where: { id } })
    expect(after).not.toBeNull()
  })

  it("deleteCustomFieldAction deletes an existing field", async () => {
    const id = await seedField(`del_${Date.now()}`)
    const res = await deleteCustomFieldAction({ tenantId, tenantSlug, id })
    expect(res.ok).toBe(true)

    const after = await prismaAdmin.customFieldDefinition.findUnique({ where: { id } })
    expect(after).toBeNull()
  })

  it("reorderCustomFieldsAction reorders the tenant's fields", async () => {
    const ts = Date.now()
    const id1 = await seedField(`ord1_${ts}`, 0)
    const id2 = await seedField(`ord2_${ts}`, 1)
    const res = await reorderCustomFieldsAction({
      tenantId,
      tenantSlug,
      entity: "Client",
      orderedIds: [id2, id1],
    })
    expect(res.ok).toBe(true)

    const after = await prismaAdmin.customFieldDefinition.findUnique({ where: { id: id2 } })
    expect(after?.order).toBe(0)
  })
})
