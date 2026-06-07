"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Copy, Link2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  SettingsCard,
  SettingsRowCard,
} from "@/components/settings/settings-section"
import {
  createJoinLinkAction,
  updateJoinLinkAction,
  revokeJoinLinkAction,
} from "@/features/users/join-link-actions"
import { buildJoinLinkUrl } from "@/lib/tenant/join-link-url"
import { toastMessages, toastErrorFromResult } from "@/lib/ui/toast-messages"
import { ROLE_LABELS, ASSIGNABLE_ROLES } from "@/lib/auth/permissions"
import type { JoinLink, Tenant } from "@prisma/client"

type AssignableRole = "ADMIN" | "SUPERVISOR" | "MEMBER" | "VIEWER"

type Props = {
  tenant: Tenant
  joinLinks: JoinLink[]
}

export function JoinLinksPanel({ tenant, joinLinks }: Props) {
  const router = useRouter()
  const [newRole, setNewRole] = useState<AssignableRole>("MEMBER")
  const [newLabel, setNewLabel] = useState("")
  const [creating, setCreating] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    const result = await createJoinLinkAction({
      tenantId: tenant.id,
      role: newRole,
      label: newLabel.trim() || undefined,
    })
    setCreating(false)
    if (!result.ok || !result.link) {
      toast.error(toastErrorFromResult(result.error, toastMessages.user.errorJoinLink))
      return
    }
    try {
      await navigator.clipboard.writeText(result.link.url)
      toast.success(toastMessages.user.joinLinkCreatedCopied)
    } catch {
      toast.success(toastMessages.user.joinLinkCreated)
    }
    setNewLabel("")
    router.refresh()
  }

  async function handleRoleChange(linkId: string, role: AssignableRole) {
    setUpdatingId(linkId)
    const result = await updateJoinLinkAction({ tenantId: tenant.id, joinLinkId: linkId, role })
    setUpdatingId(null)
    if (!result.ok) {
      toast.error(toastErrorFromResult(result.error, toastMessages.user.errorJoinLinkUpdate))
      return
    }
    toast.success(toastMessages.user.joinLinkUpdated)
    router.refresh()
  }

  async function handleRevoke(linkId: string) {
    setRevokingId(linkId)
    const result = await revokeJoinLinkAction({ tenantId: tenant.id, joinLinkId: linkId })
    setRevokingId(null)
    if (!result.ok) {
      toast.error(toastErrorFromResult(result.error, toastMessages.user.errorJoinLinkRevoke))
      return
    }
    toast.success(toastMessages.user.joinLinkRevoked)
    router.refresh()
  }

  async function copyUrl(token: string) {
    try {
      await navigator.clipboard.writeText(buildJoinLinkUrl(token))
      toast.success(toastMessages.user.joinLinkCopied)
    } catch {
      toast.error("No se pudo copiar el enlace.")
    }
  }

  return (
    <div className="space-y-3">
      {joinLinks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Enlaces de unión activos</p>
          {joinLinks.map((link) => {
            const expiresLabel = link.expiresAt
              ? new Date(link.expiresAt).toLocaleDateString("es-GT", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "Sin vencimiento"
            return (
              <SettingsRowCard key={link.id} className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-sm font-medium truncate">
                    {link.label ?? "Enlace de unión"}
                  </p>
                  <p className="text-xs text-muted-foreground">Vence: {expiresLabel}</p>
                </div>
                <select
                  value={link.role}
                  disabled={updatingId === link.id}
                  onChange={(e) =>
                    handleRoleChange(
                      link.id,
                      e.target.value as AssignableRole,
                    )
                  }
                  className="text-sm border rounded-lg px-2 py-1.5 bg-background shrink-0"
                  aria-label={`Permiso del enlace ${link.label ?? link.id}`}
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <div className="flex gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => copyUrl(link.token)}
                    aria-label="Copiar enlace"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    disabled={revokingId === link.id}
                    onClick={() => handleRevoke(link.id)}
                    aria-label="Revocar enlace"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </SettingsRowCard>
            )
          })}
          <p className="text-xs text-muted-foreground">
            Al cambiar el permiso, los nuevos usuarios que entren por el enlace recibirán ese rol.
            Los colaboradores ya unidos se editan en la lista de arriba.
          </p>
        </div>
      )}

      <SettingsCard className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground">Generar enlace de unión</p>
        <form onSubmit={handleCreate} className="space-y-2">
          <div className="space-y-1.5">
            <Label htmlFor="join-label" className="text-xs text-muted-foreground">
              Nombre (opcional)
            </Label>
            <Input
              id="join-label"
              placeholder="Ej. Equipo de ventas"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="text-sm"
              maxLength={80}
            />
          </div>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as AssignableRole)}
            className="w-full text-sm border rounded-lg px-3 py-2 bg-background"
            aria-label="Permiso por defecto del enlace"
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <Button
            type="submit"
            disabled={creating}
            variant="ghost"
            className="w-full text-xs font-bold text-indigo-400 bg-indigo-500/15 border border-indigo-500/40 hover:bg-indigo-500/25 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            {creating ? "Generando…" : "Generar enlace de unión"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Link2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          Cualquier persona con el enlace puede unirse con el permiso configurado. El enlace dura 90
          días y puedes revocarlo cuando quieras.
        </p>
      </SettingsCard>
    </div>
  )
}
