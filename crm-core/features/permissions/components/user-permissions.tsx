"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ChevronDown, Lock, RotateCcw } from "lucide-react"
import type { Role } from "@prisma/client"
import { setUserPermissionAction } from "@/features/permissions/actions"
import {
  LOCKED_ROLES,
  PERMISSION_DEFS,
  ROLE_LABELS,
  type PermissionKey,
} from "@/lib/permissions/defaults"
import { avatarColor, avatarInitials } from "@/lib/utils/avatar-color"
import { toastErrorFromResult, toastMessages } from "@/lib/ui/toast-messages"
import { cn } from "@/lib/utils"

export interface MemberRow {
  userId: string
  name: string
  email: string
  role: Role
  overrides: Record<PermissionKey, boolean | null>
  inherited: Record<PermissionKey, boolean>
}

type Choice = "inherit" | "yes" | "no"

function choiceOf(value: boolean | null): Choice {
  if (value === null) return "inherit"
  return value ? "yes" : "no"
}

function Segmented({
  value,
  inherited,
  disabled,
  onChange,
}: {
  value: Choice
  inherited: boolean
  disabled: boolean
  onChange: (next: Choice) => void
}) {
  const options: { key: Choice; label: string }[] = [
    { key: "inherit", label: inherited ? "Hereda · sí" : "Hereda · no" },
    { key: "yes", label: "Sí" },
    { key: "no", label: "No" },
  ]

  return (
    <div className="flex shrink-0 gap-1" role="group">
      {options.map((o) => {
        const active = value === o.key
        return (
          <button
            key={o.key}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(o.key)}
            className={cn(
              "h-11 rounded-md border px-2.5 text-xs font-semibold transition-colors sm:h-8",
              o.key === "inherit" ? "min-w-[104px]" : "min-w-[44px]",
              active
                ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-400"
                : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function UserPermissions({
  tenantId,
  members,
  canManage,
}: {
  tenantId: string
  members: MemberRow[]
  canManage: boolean
}) {
  const [rows, setRows] = useState(members)
  const [openId, setOpenId] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  async function update(userId: string, key: PermissionKey, choice: Choice) {
    const allowed = choice === "inherit" ? null : choice === "yes"
    const previous = rows

    setRows((rs) =>
      rs.map((r) =>
        r.userId === userId ? { ...r, overrides: { ...r.overrides, [key]: allowed } } : r,
      ),
    )
    setPending(`${userId}:${key}`)

    const result = await setUserPermissionAction({ tenantId, userId, key, allowed })
    setPending(null)

    if (!result.ok) {
      setRows(previous)
      toast.error(toastErrorFromResult(result.error, toastMessages.settings.errorSave))
    }
  }

  async function resetAll(userId: string) {
    const row = rows.find((r) => r.userId === userId)
    if (!row) return
    const changed = PERMISSION_DEFS.filter((d) => row.overrides[d.key] !== null)
    if (changed.length === 0) return

    const previous = rows
    setRows((rs) =>
      rs.map((r) =>
        r.userId === userId
          ? {
              ...r,
              overrides: Object.fromEntries(
                PERMISSION_DEFS.map((d) => [d.key, null]),
              ) as MemberRow["overrides"],
            }
          : r,
      ),
    )

    for (const def of changed) {
      const result = await setUserPermissionAction({
        tenantId,
        userId,
        key: def.key,
        allowed: null,
      })
      if (!result.ok) {
        setRows(previous)
        toast.error(toastErrorFromResult(result.error, toastMessages.settings.errorSave))
        return
      }
    }
  }

  return (
    <div className="space-y-2">
      {rows.map((m) => {
        const locked = LOCKED_ROLES.includes(m.role)
        const count = PERMISSION_DEFS.filter((d) => m.overrides[d.key] !== null).length
        const open = openId === m.userId

        return (
          <div key={m.userId} className="overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : m.userId)}
              aria-expanded={open}
              className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: avatarColor(m.name || m.email) }}
                aria-hidden
              >
                {avatarInitials(m.name || m.email)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{m.name || m.email}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {ROLE_LABELS[m.role]}
                </span>
              </span>
              {locked ? (
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" aria-hidden />
                  Acceso completo
                </span>
              ) : count > 0 ? (
                <span className="shrink-0 rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-semibold text-indigo-400">
                  {count} {count === 1 ? "excepción" : "excepciones"}
                </span>
              ) : (
                <span className="shrink-0 text-xs text-muted-foreground">Hereda del rol</span>
              )}
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
                aria-hidden
              />
            </button>

            {open && (
              <div className="border-t border-border bg-muted/20 px-3 py-3">
                {locked ? (
                  <p className="text-xs text-muted-foreground">
                    {ROLE_LABELS[m.role]} siempre conserva el acceso completo. No admite
                    excepciones.
                  </p>
                ) : (
                  <>
                    <div className="space-y-3">
                      {PERMISSION_DEFS.map((def) => (
                        <div
                          key={def.key}
                          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{def.label}</p>
                            <p className="text-xs text-muted-foreground">{def.description}</p>
                          </div>
                          <Segmented
                            value={choiceOf(m.overrides[def.key])}
                            inherited={m.inherited[def.key]}
                            disabled={!canManage || pending === `${m.userId}:${def.key}`}
                            onChange={(next) => update(m.userId, def.key, next)}
                          />
                        </div>
                      ))}
                    </div>

                    {count > 0 && canManage && (
                      <button
                        type="button"
                        onClick={() => resetAll(m.userId)}
                        className="mt-4 flex h-11 items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground sm:h-8"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                        Volver a heredar todo del rol
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
