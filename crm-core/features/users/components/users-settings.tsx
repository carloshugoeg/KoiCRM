"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { inviteUserAction, removeMemberAction, changeMemberRoleAction } from "@/features/users/actions"
import type { Membership, Tenant, User, Invitation, Role } from "@prisma/client"

type MemberWithUser = Membership & { user: Pick<User, "id" | "name" | "email"> }

interface Props {
  tenant: Tenant
  currentMembership: Membership
  members: MemberWithUser[]
  pendingInvitations: Invitation[]
  canManage: boolean
}

const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Propietario",
  ADMIN: "Admin",
  MEMBER: "Miembro",
  VIEWER: "Lector",
}

export function UsersSettings({ tenant, currentMembership, members, pendingInvitations, canManage }: Props) {
  const router = useRouter()
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER" | "VIEWER">("MEMBER")
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [invitePending, setInvitePending] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInvitePending(true)
    setInviteError(null)
    const result = await inviteUserAction({ tenantId: tenant.id, email: inviteEmail, role: inviteRole })
    setInvitePending(false)
    if (!result.ok) { setInviteError(result.error ?? "Error al invitar."); return }
    setInviteSent(true)
    setInviteEmail("")
    setTimeout(() => { setInviteSent(false); router.refresh() }, 2000)
  }

  async function handleRemove(targetUserId: string) {
    if (!confirm("¿Remover este miembro?")) return
    await removeMemberAction({ tenantId: tenant.id, targetUserId })
    router.refresh()
  }

  async function handleRoleChange(targetUserId: string, role: "ADMIN" | "MEMBER" | "VIEWER") {
    await changeMemberRoleAction({ tenantId: tenant.id, targetUserId, role })
    router.refresh()
  }

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      <h1 className="text-2xl font-semibold">Usuarios</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Miembros</h2>
        <ul className="divide-y border rounded-lg">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{m.user.name ?? m.user.email}</p>
                <p className="text-sm text-muted-foreground truncate">{m.user.email}</p>
              </div>
              {canManage && m.role !== "OWNER" && m.userId !== currentMembership.userId ? (
                <>
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.userId, e.target.value as "ADMIN" | "MEMBER" | "VIEWER")}
                    className="text-sm border rounded px-2 py-1"
                  >
                    {(["ADMIN", "MEMBER", "VIEWER"] as const).map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                  <Button variant="ghost" size="sm" onClick={() => handleRemove(m.userId)}>
                    Remover
                  </Button>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">{ROLE_LABELS[m.role]}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {pendingInvitations.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Invitaciones pendientes</h2>
          <ul className="divide-y border rounded-lg">
            {pendingInvitations.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 px-4 py-3">
                <p className="flex-1 text-sm">{inv.email}</p>
                <span className="text-xs text-muted-foreground">{ROLE_LABELS[inv.role]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canManage && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Invitar usuario</h2>
          {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
          {inviteSent && <p className="text-sm text-green-600">Invitación enviada.</p>}
          <form onSubmit={handleInvite} className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="invite-email" className="sr-only">Correo</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="correo@ejemplo.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "ADMIN" | "MEMBER" | "VIEWER")}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="MEMBER">Miembro</option>
              <option value="ADMIN">Admin</option>
              <option value="VIEWER">Lector</option>
            </select>
            <Button type="submit" disabled={invitePending}>
              {invitePending ? "Enviando…" : "Invitar"}
            </Button>
          </form>
        </section>
      )}
    </div>
  )
}
