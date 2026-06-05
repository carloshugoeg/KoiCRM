"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertDialog } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { UserAvatar } from "@/components/ui/user-avatar"
import {
  updateMemberAction,
  removeMemberAction,
  adminResetPasswordAction,
  deactivateMemberAction,
  reactivateMemberAction,
} from "@/features/users/actions"
import type { Role, MembershipStatus } from "@prisma/client"
import { ROLE_LABELS, ASSIGNABLE_ROLES } from "@/lib/auth/rbac"
import { toastMessages, toastErrorFromResult } from "@/lib/ui/toast-messages"

type AssignableRole = "ADMIN" | "SUPERVISOR" | "MEMBER" | "VIEWER"

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

export interface EditMemberData {
  userId: string
  name: string | null
  email: string
  image: string | null
  role: Role
  status: MembershipStatus
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: EditMemberData
  tenantId: string
  canManageRole: boolean
  canDelete: boolean
  /** Superadmin actions (password reset, deactivation) — false for self-edit / non-admins. */
  canManage?: boolean
  /** Active advisors available to receive the reassigned deals when deactivating. */
  reassignTargets?: { id: string; name: string | null; email: string }[]
}

export function EditMemberModal({
  open,
  onOpenChange,
  member,
  tenantId,
  canManageRole,
  canDelete,
  canManage = false,
  reassignTargets = [],
}: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(member.name ?? "")
  const [image, setImage] = useState<string | null>(member.image)
  const [role, setRole] = useState<AssignableRole>(
    member.role === "OWNER" ? "ADMIN" : (member.role as AssignableRole),
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [resettingPw, setResettingPw] = useState(false)
  const [reassignTo, setReassignTo] = useState("")
  const [deactivating, setDeactivating] = useState(false)
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false)

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Tipo de archivo no permitido. Usa JPG, PNG, WEBP o GIF.")
      return
    }

    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("tenantId", tenantId)
      formData.append("targetUserId", member.userId)

      const uploadRes = await fetch("/api/upload/avatar", {
        method: "POST",
        body: formData,
      })

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}))
        if (err.error === "file_too_large") {
          setError("La foto supera el tamaño máximo de 2 MB.")
        } else if (err.error === "invalid_content_type") {
          setError("Tipo de archivo no permitido. Usa JPG, PNG, WEBP o GIF.")
        } else {
          setError("Error al subir la foto. Intenta de nuevo.")
        }
        return
      }

      const { publicUrl } = await uploadRes.json()
      setImage(publicUrl)

      const saveResult = await updateMemberAction({
        tenantId,
        targetUserId: member.userId,
        image: publicUrl,
      })
      if (!saveResult.ok) {
        setError(saveResult.error ?? "La foto se subió pero no se pudo guardar.")
        return
      }
      router.refresh()
    } catch {
      setError("Error inesperado al subir la foto.")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleSave() {
    setPending(true)
    setError(null)

    const payload: {
      tenantId: string
      targetUserId: string
      name: string
      image: string | null
      role?: AssignableRole
    } = {
      tenantId,
      targetUserId: member.userId,
      name: name.trim(),
      image,
    }
    if (canManageRole && member.role !== "OWNER") {
      payload.role = role
    }

    const result = await updateMemberAction(payload)
    setPending(false)

    if (!result.ok) {
      const msg = toastErrorFromResult(result.error, toastMessages.user.errorUpdate)
      setError(msg)
      toast.error(msg)
      return
    }

    toast.success(toastMessages.user.memberUpdated)
    onOpenChange(false)
    router.refresh()
  }

  async function handleDelete() {
    setPending(true)
    setError(null)
    const result = await removeMemberAction({ tenantId, targetUserId: member.userId })
    setPending(false)

    if (!result.ok) {
      const msg = toastErrorFromResult(result.error, toastMessages.user.errorRemove)
      setError(msg)
      toast.error(msg)
      return
    }

    toast.success(toastMessages.user.memberRemoved)
    onOpenChange(false)
    router.refresh()
  }

  async function handleResetPassword() {
    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.")
      return
    }
    setResettingPw(true)
    setError(null)
    const result = await adminResetPasswordAction({ tenantId, targetUserId: member.userId, newPassword })
    setResettingPw(false)
    if (!result.ok) {
      const msg = result.error ?? "No se pudo restablecer la contraseña."
      setError(msg)
      toast.error(msg)
      return
    }
    toast.success("Contraseña restablecida.")
    setNewPassword("")
  }

  async function handleDeactivate() {
    if (!reassignTo) {
      setError("Selecciona un asesor para reasignar las oportunidades.")
      return
    }
    setDeactivating(true)
    setError(null)
    const result = await deactivateMemberAction({ tenantId, targetUserId: member.userId, reassignToUserId: reassignTo })
    setDeactivating(false)
    if (!result.ok) {
      const msg = result.error ?? "No se pudo dar de baja al asesor."
      setError(msg)
      toast.error(msg)
      return
    }
    toast.success("Asesor dado de baja y oportunidades reasignadas.")
    onOpenChange(false)
    router.refresh()
  }

  async function handleReactivate() {
    setDeactivating(true)
    setError(null)
    const result = await reactivateMemberAction({ tenantId, targetUserId: member.userId })
    setDeactivating(false)
    if (!result.ok) {
      const msg = result.error ?? "No se pudo reactivar al asesor."
      setError(msg)
      toast.error(msg)
      return
    }
    toast.success("Asesor reactivado.")
    onOpenChange(false)
    router.refresh()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar miembro</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex items-center gap-4">
              <UserAvatar
                userId={member.userId}
                name={name || member.name}
                email={member.email}
                imageUrl={image}
                size={64}
              />
              <div className="space-y-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_IMAGE_TYPES.join(",")}
                  className="hidden"
                  onChange={handlePhotoChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? "Subiendo…" : image ? "Cambiar foto" : "Agregar foto"}
                </Button>
                {image && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setImage(null)}
                  >
                    Quitar foto
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="member-name">Nombre</Label>
              <Input
                id="member-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre completo"
                required
              />
            </div>

            <div className="space-y-1">
              <Label>Correo</Label>
              <p className="text-sm text-muted-foreground">{member.email}</p>
            </div>

            {canManageRole && member.role !== "OWNER" ? (
              <div className="space-y-1">
                <Label htmlFor="member-role">Rol</Label>
                <select
                  id="member-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as AssignableRole)}
                  className="w-full text-sm border rounded px-3 py-2"
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1">
                <Label>Rol</Label>
                <p className="text-sm text-muted-foreground">{ROLE_LABELS[member.role]}</p>
              </div>
            )}

            {canManage && (
              <>
                <div className="space-y-1 border-t pt-3">
                  <Label htmlFor="member-new-pw">Restablecer contraseña</Label>
                  <div className="flex gap-2">
                    <Input
                      id="member-new-pw"
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Contraseña temporal (mín. 8)"
                      autoComplete="off"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={resettingPw || newPassword.length < 8}
                      onClick={handleResetPassword}
                    >
                      {resettingPw ? "…" : "Asignar"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    El usuario podrá iniciar sesión con esta contraseña.
                  </p>
                </div>

                {member.role !== "OWNER" &&
                  (member.status === "ACTIVE" ? (
                    <div className="space-y-1 border-t pt-3">
                      <Label htmlFor="member-reassign">Dar de baja y reasignar oportunidades a</Label>
                      <select
                        id="member-reassign"
                        value={reassignTo}
                        onChange={(e) => setReassignTo(e.target.value)}
                        className="w-full text-sm border rounded px-3 py-2"
                      >
                        <option value="">Selecciona un asesor…</option>
                        {reassignTargets.map((t) => (
                          <option key={t.id} value={t.id}>{t.name ?? t.email}</option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="destructive"
                        className="w-full mt-1"
                        disabled={deactivating || !reassignTo}
                        onClick={() => setDeactivateConfirmOpen(true)}
                      >
                        Dar de baja
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        El asesor permanece en el sistema pero no podrá iniciar sesión.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1 border-t pt-3">
                      <p className="text-sm text-amber-600">Este asesor está inactivo.</p>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={deactivating}
                        onClick={handleReactivate}
                      >
                        Reactivar asesor
                      </Button>
                    </div>
                  ))}
              </>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {canDelete && (
              <Button
                type="button"
                variant="destructive"
                className="sm:mr-auto"
                disabled={pending}
                onClick={() => setDeleteConfirmOpen(true)}
              >
                Eliminar
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={pending || uploading} onClick={handleSave}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="¿Eliminar miembro?"
        description={`Se removerá a ${name || member.email} del equipo. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
        onConfirm={handleDelete}
      />

      <AlertDialog
        open={deactivateConfirmOpen}
        onOpenChange={setDeactivateConfirmOpen}
        title="¿Dar de baja al asesor?"
        description={`Se reasignarán todas las oportunidades de ${name || member.email} al asesor seleccionado y no podrá volver a iniciar sesión hasta reactivarlo.`}
        confirmLabel="Dar de baja"
        cancelLabel="Cancelar"
        destructive
        onConfirm={handleDeactivate}
      />
    </>
  )
}
