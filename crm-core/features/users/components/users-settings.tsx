"use client"

import { useState } from "react"
import { Edit3 } from "lucide-react"
import { EditMemberModal, type EditMemberData } from "@/features/users/components/EditMemberModal"
import { JoinLinksPanel } from "@/features/users/components/join-links-panel"
import { SettingsRowCard, SettingsSectionTitle } from "@/components/settings/settings-section"
import { avatarColor } from "@/lib/utils/avatar-color"
import { UserAvatar } from "@/components/ui/user-avatar"
import { ROLE_LABELS } from "@/lib/auth/rbac"
import { Badge } from "@/components/ui/badge"
import type { Membership, Tenant, User, JoinLink } from "@prisma/client"

type MemberWithUser = Membership & { user: Pick<User, "id" | "name" | "email" | "image"> }

interface Props {
  tenant: Tenant
  currentMembership: Membership
  members: MemberWithUser[]
  joinLinks: JoinLink[]
  canManage: boolean
}

function canEditMember(
  m: MemberWithUser,
  currentMembership: Membership,
  canManage: boolean,
): boolean {
  if (m.userId === currentMembership.userId) return true
  return canManage && m.role !== "OWNER"
}

export function UsersSettings({
  tenant,
  currentMembership,
  members,
  joinLinks,
  canManage,
}: Props) {
  const [editingMember, setEditingMember] = useState<EditMemberData | null>(null)

  function openEditModal(m: MemberWithUser) {
    setEditingMember({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      image: m.user.image,
      role: m.role,
      status: m.status,
    })
  }

  const editingIsSelf = editingMember?.userId === currentMembership.userId
  const editingCanManageRole =
    canManage && editingMember?.role !== "OWNER" && !editingIsSelf
  const editingCanDelete =
    canManage && editingMember?.role !== "OWNER" && !editingIsSelf

  const reassignTargets = members
    .filter((m) => m.status === "ACTIVE" && m.userId !== editingMember?.userId)
    .map((m) => ({ id: m.userId, name: m.user.name, email: m.user.email }))

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain">
      <SettingsSectionTitle>Colaboradores activos</SettingsSectionTitle>

      <div className="space-y-2">
        {members.map((m) => {
          const color = avatarColor(m.userId)
          const editable = canEditMember(m, currentMembership, canManage)

          return (
            <SettingsRowCard key={m.userId}>
              <UserAvatar
                userId={m.userId}
                name={m.user.name}
                email={m.user.email}
                imageUrl={m.user.image}
                size={32}
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold block truncate">
                  {m.user.name ?? m.user.email}
                </span>
                <span className="text-xs text-muted-foreground">
                  {ROLE_LABELS[m.role]}
                  {m.status === "INACTIVE" && (
                    <Badge variant="outline" className="ml-2 h-4 py-0 text-[10px] text-amber-600 border-amber-300">
                      Inactivo
                    </Badge>
                  )}
                </span>
              </div>
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: color }}
              />
              {editable ? (
                <button
                  type="button"
                  onClick={() => openEditModal(m)}
                  className="text-muted-foreground hover:opacity-70 transition-opacity"
                  aria-label="Editar colaborador"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </SettingsRowCard>
          )
        })}
      </div>

      {canManage && <JoinLinksPanel tenant={tenant} joinLinks={joinLinks} />}

      {editingMember && (
        <EditMemberModal
          key={editingMember.userId}
          open={!!editingMember}
          onOpenChange={(open) => {
            if (!open) setEditingMember(null)
          }}
          member={editingMember}
          tenantId={tenant.id}
          canManageRole={editingCanManageRole}
          canDelete={editingCanDelete}
          canManage={canManage && !editingIsSelf}
          reassignTargets={reassignTargets}
        />
      )}
    </div>
  )
}
