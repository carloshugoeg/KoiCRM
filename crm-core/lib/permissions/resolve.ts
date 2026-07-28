import "server-only"
import type { Role } from "@prisma/client"
import { withTenant } from "@/lib/db/rls"
import {
  defaultMatrix,
  defaultPermission,
  isPermissionKey,
  LOCKED_ROLES,
  PERMISSION_KEYS,
  type PermissionKey,
  type PermissionMatrix,
} from "@/lib/permissions/defaults"

export type { PermissionKey, PermissionMatrix } from "@/lib/permissions/defaults"

/**
 * Effective permissions resolve in three layers, each overriding the previous:
 *
 *   1. built-in default for the role   (lib/permissions/defaults.ts)
 *   2. RolePermission                  (the workspace's role matrix)
 *   3. UserPermission                  (a per-person exception)
 *
 * OWNER and ADMIN short-circuit to full access at every layer — neither the matrix
 * nor a per-user exception can lock an administrator out of their own workspace.
 */

/** Layer 1 + 2. Role-level only; used by the settings matrix. */
export async function permissionsForRole(
  tenantId: string,
  role: Role,
): Promise<Record<PermissionKey, boolean>> {
  if (LOCKED_ROLES.includes(role)) return defaultMatrix()[role]

  const rows = await withTenant(tenantId, (tx) =>
    tx.rolePermission.findMany({ where: { tenantId, role }, select: { key: true, allowed: true } }),
  )

  const effective = { ...defaultMatrix()[role] }
  for (const row of rows) {
    if (isPermissionKey(row.key)) effective[row.key] = row.allowed
  }
  return effective
}

/** All three layers. This is what feature code should call. */
export async function permissionsFor(
  tenantId: string,
  role: Role,
  userId: string,
): Promise<Record<PermissionKey, boolean>> {
  if (LOCKED_ROLES.includes(role)) return defaultMatrix()[role]

  const { roleRows, userRows } = await withTenant(tenantId, async (tx) => ({
    roleRows: await tx.rolePermission.findMany({
      where: { tenantId, role },
      select: { key: true, allowed: true },
    }),
    userRows: await tx.userPermission.findMany({
      where: { tenantId, userId },
      select: { key: true, allowed: true },
    }),
  }))

  const effective = { ...defaultMatrix()[role] }
  for (const row of roleRows) {
    if (isPermissionKey(row.key)) effective[row.key] = row.allowed
  }
  for (const row of userRows) {
    if (isPermissionKey(row.key)) effective[row.key] = row.allowed
  }
  return effective
}

export async function can(
  tenantId: string,
  role: Role,
  userId: string,
  key: PermissionKey,
): Promise<boolean> {
  if (LOCKED_ROLES.includes(role)) return defaultPermission(role, key)
  return (await permissionsFor(tenantId, role, userId))[key]
}

/** Whole role matrix for the settings screen. */
export async function permissionMatrix(tenantId: string): Promise<PermissionMatrix> {
  const rows = await withTenant(tenantId, (tx) =>
    tx.rolePermission.findMany({
      where: { tenantId },
      select: { role: true, key: true, allowed: true },
    }),
  )

  const matrix = defaultMatrix()
  for (const row of rows) {
    if (isPermissionKey(row.key) && !LOCKED_ROLES.includes(row.role)) {
      matrix[row.role][row.key] = row.allowed
    }
  }
  return matrix
}

/** `null` = inherits the role; `true`/`false` = an explicit per-person exception. */
export type UserOverrides = Record<PermissionKey, boolean | null>

export interface MemberPermissions {
  userId: string
  overrides: UserOverrides
  /** Role-level baseline, so the UI can show what "hereda" actually resolves to. */
  inherited: Record<PermissionKey, boolean>
  overrideCount: number
}

/**
 * Per-person exceptions for every member, for the settings screen. Reads the whole
 * tenant's rows in one pass rather than one query per member.
 */
export async function memberPermissions(
  tenantId: string,
  members: { userId: string; role: Role }[],
): Promise<MemberPermissions[]> {
  const { roleRows, userRows } = await withTenant(tenantId, async (tx) => ({
    roleRows: await tx.rolePermission.findMany({
      where: { tenantId },
      select: { role: true, key: true, allowed: true },
    }),
    userRows: await tx.userPermission.findMany({
      where: { tenantId },
      select: { userId: true, key: true, allowed: true },
    }),
  }))

  const matrix = defaultMatrix()
  for (const row of roleRows) {
    if (isPermissionKey(row.key) && !LOCKED_ROLES.includes(row.role)) {
      matrix[row.role][row.key] = row.allowed
    }
  }

  return members.map((m) => {
    const overrides = Object.fromEntries(
      PERMISSION_KEYS.map((k) => [k, null]),
    ) as UserOverrides
    let overrideCount = 0

    if (!LOCKED_ROLES.includes(m.role)) {
      for (const row of userRows) {
        if (row.userId === m.userId && isPermissionKey(row.key)) {
          overrides[row.key] = row.allowed
          overrideCount += 1
        }
      }
    }

    return { userId: m.userId, overrides, inherited: matrix[m.role], overrideCount }
  })
}

/**
 * Pipeline-visibility scope for one person. When `visibleToUserId` is set, callers must pin
 * their query to what that user may see — their own deals plus anything ceded to them via
 * DealViewer. That is what `dealVisibilityWhere` already expresses, and what archive, search
 * and stats/listado already use; a bare `ownerId` here would hide ceded deals from the funnel
 * while leaving them visible everywhere else.
 *
 * Named for the permission it reads — `pipeline.viewAll`. Reports and stats have their own
 * keys and diverge the moment a workspace overrides one and not the other, so they must
 * read those directly rather than reuse this.
 */
export interface PipelineScope {
  visibleToUserId: string | null
  canSeeTotals: boolean
}

export async function pipelineScopeFor(
  tenantId: string,
  role: Role,
  userId: string,
): Promise<PipelineScope> {
  const perms = await permissionsFor(tenantId, role, userId)
  return {
    visibleToUserId: perms["pipeline.viewAll"] ? null : userId,
    canSeeTotals: perms["pipeline.viewTotals"],
  }
}
