import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prismaAdmin, withTenant, cleanDatabase, disconnectAll } from "./helpers"
import { bootstrapTenant } from "@/lib/tenant/bootstrap"
import { permissionsFor } from "@/lib/permissions/resolve"

/**
 * What a brand-new workspace gets on the day it is created.
 *
 * The permission system's compatibility migration backfilled `pipeline.viewAll` for MEMBER
 * in every tenant that already existed, so nobody noticed the restricted default landing.
 * A tenant created afterwards gets no such row from the migration — bootstrap has to seed
 * it, or a new customer's advisors would each see only their own deals on day one and read
 * it as the product being broken.
 */

let ownerId: string

beforeAll(async () => {
  await cleanDatabase()
  const owner = await prismaAdmin.user.create({
    data: { email: `bootstrap-owner-${Date.now()}@test.com` },
  })
  ownerId = owner.id
})

afterAll(async () => {
  await cleanDatabase()
  await disconnectAll()
})

async function newTenant(slug: string) {
  return bootstrapTenant({
    name: "Cliente Nuevo",
    slug,
    industrySlug: "aquasistemas",
    ownerUserId: ownerId,
  })
}

describe("bootstrapTenant", () => {
  it("gives a new workspace the open funnel, like every pre-existing tenant", async () => {
    const tenant = await newTenant(`boot-open-${Date.now()}`)
    const perms = await permissionsFor(tenant.id, "MEMBER", ownerId)
    expect(perms["pipeline.viewAll"]).toBe(true)
  })

  it("leaves the other permissions at their role defaults", async () => {
    const tenant = await newTenant(`boot-defaults-${Date.now()}`)
    const perms = await permissionsFor(tenant.id, "MEMBER", ownerId)
    // Only the funnel is opened. Money aggregates and reports stay closed, so an admin still
    // makes a deliberate choice about those rather than inheriting them by accident.
    expect(perms["pipeline.viewTotals"]).toBe(false)
    expect(perms["reports.viewAll"]).toBe(false)
    expect(perms["stats.viewTotals"]).toBe(false)
  })

  it("seeds exactly one permission row, not a whole matrix", async () => {
    const tenant = await newTenant(`boot-single-${Date.now()}`)
    const rows = await withTenant(tenant.id, (tx) =>
      tx.rolePermission.findMany({ where: { tenantId: tenant.id } }),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ role: "MEMBER", key: "pipeline.viewAll", allowed: true })
  })

  it("seeds the archive-reason catalogue, so archiving works from day one", async () => {
    const tenant = await newTenant(`boot-archive-${Date.now()}`)
    const reasons = await withTenant(tenant.id, (tx) =>
      tx.catalogItem.findMany({ where: { tenantId: tenant.id, catalogKey: "archiveReason" } }),
    )
    expect(reasons.length).toBeGreaterThan(0)
  })

  it("keeps one workspace's permissions out of another's", async () => {
    const ts = Date.now()
    const a = await newTenant(`boot-iso-a-${ts}`)
    const b = await newTenant(`boot-iso-b-${ts}`)

    await withTenant(a.id, (tx) =>
      tx.rolePermission.create({
        data: { tenantId: a.id, role: "MEMBER", key: "reports.viewAll", allowed: true },
      }),
    )

    expect((await permissionsFor(a.id, "MEMBER", ownerId))["reports.viewAll"]).toBe(true)
    expect((await permissionsFor(b.id, "MEMBER", ownerId))["reports.viewAll"]).toBe(false)
  })

  it("starts unvalidated, so a workspace cannot be used before its licence is granted", async () => {
    const tenant = await newTenant(`boot-licence-${Date.now()}`)
    const row = await prismaAdmin.tenant.findUnique({
      where: { id: tenant.id },
      select: { subscriptionValidated: true },
    })
    expect(row?.subscriptionValidated).toBe(false)
  })
})
