import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest"
import type { Session } from "next-auth"
import { prismaAdmin, cleanDatabase, disconnectAll } from "./helpers"

/**
 * FINDING-029: "no test asserting authorization behaviour" for features/users/actions.ts is
 * exactly why FINDING-002 and FINDING-003 (cross-tenant reads, ADMIN resetting the OWNER's
 * password / reassigning their PIN) shipped while `vitest run` was green. This is a
 * table-driven matrix over every privileged action in that file: caller role × target
 * (self / other MEMBER / other ADMIN / OWNER / non-member), pinning the target-side guards
 * that are the actual fix for FINDING-003's bug class so a future refactor (FINDING-025/028,
 * which collapses the 28 duplicated role checks this file is full of) can't silently drop one.
 *
 * Every one of these actions shares the same skeleton: look up caller + target membership,
 * require caller role >= ADMIN, then apply *target-side* guards — nobody may act on OWNER
 * (unless acting on themselves, and even that is usually still blocked), and only OWNER may
 * act on another ADMIN. That second guard is the one FINDING-003 found missing.
 */

process.env.AUTH_SECRET ??= "test-user-actions-authz-secret"

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn() }))

// Import AFTER mocks.
import {
  removeMemberAction,
  changeMemberRoleAction,
  updateMemberAction,
  adminResetPasswordAction,
  deactivateMemberAction,
  reactivateMemberAction,
  setMemberPinAction,
  clearMemberPinAction,
} from "@/features/users/actions"
import { auth } from "@/lib/auth/auth"

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>

let tenantId: string
let ownerId: string
let adminAId: string
let adminBId: string
let supervisorId: string
let memberAId: string
let memberBId: string
let viewerId: string
let outsiderId: string // real user, but not a member of this tenant

function asCaller(userId: string) {
  mockAuth.mockResolvedValue({ user: { id: userId } } as Session)
}

async function membershipStatus(userId: string): Promise<string | undefined> {
  const m = await prismaAdmin.membership.findUnique({ where: { userId_tenantId: { userId, tenantId } } })
  return m?.status
}

async function membershipRole(userId: string): Promise<string | undefined> {
  const m = await prismaAdmin.membership.findUnique({ where: { userId_tenantId: { userId, tenantId } } })
  return m?.role
}

beforeAll(async () => {
  await cleanDatabase()

  const tenant = await prismaAdmin.tenant.create({ data: { slug: `user-authz-${Date.now()}`, name: "Authz" } })
  tenantId = tenant.id

  const makeUser = (tag: string) =>
    prismaAdmin.user.create({ data: { email: `${tag}-${Date.now()}-${Math.random()}@test.com`, name: tag } })

  const [owner, adminA, adminB, supervisor, memberA, memberB, viewer, outsider] = await Promise.all([
    makeUser("owner"),
    makeUser("adminA"),
    makeUser("adminB"),
    makeUser("supervisor"),
    makeUser("memberA"),
    makeUser("memberB"),
    makeUser("viewer"),
    makeUser("outsider"),
  ])
  ownerId = owner.id
  adminAId = adminA.id
  adminBId = adminB.id
  supervisorId = supervisor.id
  memberAId = memberA.id
  memberBId = memberB.id
  viewerId = viewer.id
  outsiderId = outsider.id

  await prismaAdmin.membership.createMany({
    data: [
      { userId: ownerId, tenantId, role: "OWNER", status: "ACTIVE" },
      { userId: adminAId, tenantId, role: "ADMIN", status: "ACTIVE" },
      { userId: adminBId, tenantId, role: "ADMIN", status: "ACTIVE" },
      { userId: supervisorId, tenantId, role: "SUPERVISOR", status: "ACTIVE" },
      { userId: memberAId, tenantId, role: "MEMBER", status: "ACTIVE" },
      { userId: memberBId, tenantId, role: "MEMBER", status: "ACTIVE" },
      { userId: viewerId, tenantId, role: "VIEWER", status: "ACTIVE" },
    ],
  })
})

afterAll(async () => {
  await cleanDatabase()
  await disconnectAll()
})

beforeEach(() => {
  mockAuth.mockReset()
})

describe("removeMemberAction authorization", () => {
  it("OWNER can remove a MEMBER", async () => {
    const target = await prismaAdmin.user.create({ data: { email: `rm-target-${Date.now()}@test.com` } })
    await prismaAdmin.membership.create({ data: { userId: target.id, tenantId, role: "MEMBER", status: "ACTIVE" } })
    asCaller(ownerId)
    const res = await removeMemberAction({ tenantId, targetUserId: target.id })
    expect(res.ok).toBe(true)
  })

  it("ADMIN can remove a MEMBER", async () => {
    const target = await prismaAdmin.user.create({ data: { email: `rm-target-${Date.now()}@test.com` } })
    await prismaAdmin.membership.create({ data: { userId: target.id, tenantId, role: "MEMBER", status: "ACTIVE" } })
    asCaller(adminAId)
    const res = await removeMemberAction({ tenantId, targetUserId: target.id })
    expect(res.ok).toBe(true)
  })

  it("ADMIN cannot remove another ADMIN (FINDING-003's bug class)", async () => {
    asCaller(adminAId)
    const res = await removeMemberAction({ tenantId, targetUserId: adminBId })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/propietario puede remover/)
    expect(await membershipRole(adminBId)).toBe("ADMIN") // unchanged
  })

  it("OWNER can remove an ADMIN", async () => {
    const target = await prismaAdmin.user.create({ data: { email: `rm-admin-${Date.now()}@test.com` } })
    await prismaAdmin.membership.create({ data: { userId: target.id, tenantId, role: "ADMIN", status: "ACTIVE" } })
    asCaller(ownerId)
    const res = await removeMemberAction({ tenantId, targetUserId: target.id })
    expect(res.ok).toBe(true)
  })

  it("nobody, including OWNER, can remove the OWNER", async () => {
    asCaller(adminAId)
    const res1 = await removeMemberAction({ tenantId, targetUserId: ownerId })
    expect(res1.ok).toBe(false)
    expect(res1.error).toMatch(/propietario/)
  })

  it("SUPERVISOR cannot remove anyone", async () => {
    asCaller(supervisorId)
    const res = await removeMemberAction({ tenantId, targetUserId: memberAId })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("Sin permisos.")
  })

  it("MEMBER cannot remove anyone", async () => {
    asCaller(memberAId)
    const res = await removeMemberAction({ tenantId, targetUserId: memberBId })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("Sin permisos.")
  })

  it("a non-member caller (no membership row in this tenant) is denied", async () => {
    asCaller(outsiderId)
    const res = await removeMemberAction({ tenantId, targetUserId: memberAId })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("Sin permisos.")
  })

  it("acting on a non-member target returns 'not a member', not a crash", async () => {
    asCaller(ownerId)
    const res = await removeMemberAction({ tenantId, targetUserId: outsiderId })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("El usuario no es miembro.")
  })

  it("cannot remove yourself, even as OWNER", async () => {
    asCaller(ownerId)
    const res = await removeMemberAction({ tenantId, targetUserId: ownerId })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("No puedes removerte a ti mismo.")
  })
})

describe("changeMemberRoleAction authorization", () => {
  it("ADMIN can change a MEMBER's role", async () => {
    const target = await prismaAdmin.user.create({ data: { email: `role-target-${Date.now()}@test.com` } })
    await prismaAdmin.membership.create({ data: { userId: target.id, tenantId, role: "MEMBER", status: "ACTIVE" } })
    asCaller(adminAId)
    const res = await changeMemberRoleAction({ tenantId, targetUserId: target.id, role: "SUPERVISOR" })
    expect(res.ok).toBe(true)
  })

  it("ADMIN cannot change another ADMIN's role", async () => {
    asCaller(adminAId)
    const res = await changeMemberRoleAction({ tenantId, targetUserId: adminBId, role: "MEMBER" })
    expect(res.ok).toBe(false)
    expect(await membershipRole(adminBId)).toBe("ADMIN")
  })

  it("cannot change the OWNER's role", async () => {
    asCaller(ownerId)
    const res = await changeMemberRoleAction({ tenantId, targetUserId: ownerId, role: "ADMIN" })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("No puedes cambiar tu propio rol.")
  })

  it("MEMBER cannot change anyone's role", async () => {
    asCaller(memberAId)
    const res = await changeMemberRoleAction({ tenantId, targetUserId: memberBId, role: "SUPERVISOR" })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("Sin permisos.")
  })
})

describe("updateMemberAction authorization", () => {
  it("a member can edit their own name without manage permission", async () => {
    asCaller(memberAId)
    const res = await updateMemberAction({ tenantId, targetUserId: memberAId, name: "Nuevo Nombre" })
    expect(res.ok).toBe(true)
  })

  it("a member cannot edit a colleague's name", async () => {
    asCaller(memberAId)
    const res = await updateMemberAction({ tenantId, targetUserId: memberBId, name: "Hackeado" })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("Sin permisos.")
  })

  it("ADMIN can edit a MEMBER's name", async () => {
    asCaller(adminAId)
    const res = await updateMemberAction({ tenantId, targetUserId: memberAId, name: "Editado por admin" })
    expect(res.ok).toBe(true)
  })

  it("nobody but the OWNER themself may edit the OWNER's profile", async () => {
    asCaller(adminAId)
    const res = await updateMemberAction({ tenantId, targetUserId: ownerId, name: "Hackeado" })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("No puedes editar al propietario.")
  })

  it("a member cannot grant themself a new role even though self-edit is allowed for name/image", async () => {
    asCaller(memberAId)
    const res = await updateMemberAction({ tenantId, targetUserId: memberAId, role: "ADMIN" })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("No puedes cambiar tu propio rol.")
    expect(await membershipRole(memberAId)).toBe("MEMBER")
  })

  it("ADMIN cannot change another ADMIN's role via updateMemberAction either", async () => {
    asCaller(adminAId)
    const res = await updateMemberAction({ tenantId, targetUserId: adminBId, role: "MEMBER" })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("Solo el propietario puede cambiar el rol de un administrador.")
    expect(await membershipRole(adminBId)).toBe("ADMIN")
  })
})

describe("adminResetPasswordAction authorization (FINDING-003)", () => {
  it("ADMIN can reset a MEMBER's password", async () => {
    asCaller(adminAId)
    const res = await adminResetPasswordAction({ tenantId, targetUserId: memberAId, newPassword: "Sup3rSecret!" })
    expect(res.ok).toBe(true)
  })

  it("ADMIN cannot reset the OWNER's password — this was the FINDING-003 bug", async () => {
    asCaller(adminAId)
    const res = await adminResetPasswordAction({ tenantId, targetUserId: ownerId, newPassword: "Takeover123!" })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("No puedes restablecer la contraseña del propietario.")
  })

  it("ADMIN cannot reset another ADMIN's password", async () => {
    asCaller(adminAId)
    const res = await adminResetPasswordAction({ tenantId, targetUserId: adminBId, newPassword: "Takeover123!" })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("Solo el propietario puede restablecer la contraseña de un administrador.")
  })

  it("OWNER can reset an ADMIN's password", async () => {
    asCaller(ownerId)
    const res = await adminResetPasswordAction({ tenantId, targetUserId: adminAId, newPassword: "Takeover123!" })
    expect(res.ok).toBe(true)
  })

  it("MEMBER cannot reset anyone's password", async () => {
    asCaller(memberAId)
    const res = await adminResetPasswordAction({ tenantId, targetUserId: memberBId, newPassword: "Takeover123!" })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("Sin permisos.")
  })
})

describe("setMemberPinAction / clearMemberPinAction authorization (FINDING-003: PIN reassignment)", () => {
  it("ADMIN cannot set the OWNER's PIN", async () => {
    asCaller(adminAId)
    const res = await setMemberPinAction({ tenantId, targetUserId: ownerId, pin: "9999" })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("No puedes cambiar el PIN del propietario.")
  })

  it("ADMIN cannot set another ADMIN's PIN", async () => {
    asCaller(adminAId)
    const res = await setMemberPinAction({ tenantId, targetUserId: adminBId, pin: "9998" })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("Solo el propietario puede cambiar el PIN de un administrador.")
  })

  it("ADMIN can set a MEMBER's PIN", async () => {
    asCaller(adminAId)
    const res = await setMemberPinAction({ tenantId, targetUserId: memberAId, pin: "1357" })
    expect(res.ok).toBe(true)
  })

  it("MEMBER cannot set anyone's PIN", async () => {
    asCaller(memberAId)
    const res = await setMemberPinAction({ tenantId, targetUserId: memberBId, pin: "2468" })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("Sin permisos.")
  })

  it("ADMIN cannot clear the OWNER's PIN", async () => {
    asCaller(adminAId)
    const res = await clearMemberPinAction({ tenantId, targetUserId: ownerId })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("No puedes quitar el PIN del propietario.")
  })

  it("ADMIN cannot clear another ADMIN's PIN", async () => {
    asCaller(adminAId)
    const res = await clearMemberPinAction({ tenantId, targetUserId: adminBId })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("Solo el propietario puede quitar el PIN de un administrador.")
  })
})

describe("deactivateMemberAction / reactivateMemberAction authorization", () => {
  it("ADMIN cannot deactivate another ADMIN", async () => {
    const reassignTo = await prismaAdmin.user.create({ data: { email: `deact-reassign-${Date.now()}@test.com` } })
    await prismaAdmin.membership.create({ data: { userId: reassignTo.id, tenantId, role: "MEMBER", status: "ACTIVE" } })
    asCaller(adminAId)
    const res = await deactivateMemberAction({ tenantId, targetUserId: adminBId, reassignToUserId: reassignTo.id })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("Solo el propietario puede dar de baja a un administrador.")
    expect(await membershipStatus(adminBId)).toBe("ACTIVE")
  })

  it("cannot deactivate the OWNER", async () => {
    const reassignTo = await prismaAdmin.user.create({ data: { email: `deact-reassign-${Date.now()}@test.com` } })
    await prismaAdmin.membership.create({ data: { userId: reassignTo.id, tenantId, role: "MEMBER", status: "ACTIVE" } })
    asCaller(adminAId)
    const res = await deactivateMemberAction({ tenantId, targetUserId: ownerId, reassignToUserId: reassignTo.id })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("No puedes dar de baja al propietario.")
  })

  it("MEMBER cannot deactivate anyone", async () => {
    const target = await prismaAdmin.user.create({ data: { email: `deact-target-${Date.now()}@test.com` } })
    await prismaAdmin.membership.create({ data: { userId: target.id, tenantId, role: "MEMBER", status: "ACTIVE" } })
    const reassignTo = await prismaAdmin.user.create({ data: { email: `deact-reassign-${Date.now()}@test.com` } })
    await prismaAdmin.membership.create({ data: { userId: reassignTo.id, tenantId, role: "MEMBER", status: "ACTIVE" } })
    asCaller(memberAId)
    const res = await deactivateMemberAction({ tenantId, targetUserId: target.id, reassignToUserId: reassignTo.id })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("Sin permisos.")
  })

  it("MEMBER cannot reactivate anyone", async () => {
    const target = await prismaAdmin.user.create({ data: { email: `react-target-${Date.now()}@test.com` } })
    await prismaAdmin.membership.create({ data: { userId: target.id, tenantId, role: "MEMBER", status: "INACTIVE" } })
    asCaller(memberAId)
    const res = await reactivateMemberAction({ tenantId, targetUserId: target.id })
    expect(res.ok).toBe(false)
    expect(res.error).toBe("Sin permisos.")
    expect(await membershipStatus(target.id)).toBe("INACTIVE")
  })

  it("ADMIN can reactivate a MEMBER", async () => {
    const target = await prismaAdmin.user.create({ data: { email: `react-target-${Date.now()}@test.com` } })
    await prismaAdmin.membership.create({ data: { userId: target.id, tenantId, role: "MEMBER", status: "INACTIVE" } })
    asCaller(adminAId)
    const res = await reactivateMemberAction({ tenantId, targetUserId: target.id })
    expect(res.ok).toBe(true)
    expect(await membershipStatus(target.id)).toBe("ACTIVE")
  })
})
