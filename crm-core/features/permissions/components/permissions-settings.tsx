"use client"

import { Fragment, useState } from "react"
import { toast } from "sonner"
import { Lock } from "lucide-react"
import type { Role } from "@prisma/client"
import { setRolePermissionAction } from "@/features/permissions/actions"
import {
  LOCKED_ROLES,
  PERMISSION_DEFS,
  ROLE_LABELS,
  ROLES,
  type PermissionDef,
  type PermissionKey,
  type PermissionMatrix,
} from "@/lib/permissions/defaults"
import { toastErrorFromResult, toastMessages } from "@/lib/ui/toast-messages"

const LOCKED_ROLE_LABELS = ROLES.filter((role) => LOCKED_ROLES.includes(role))
  .map((role) => ROLE_LABELS[role])
  .join(" y ")

const LOCKED_HINT = `${LOCKED_ROLE_LABELS} siempre tienen acceso completo.`

/** PERMISSION_DEFS in catalogue order, agrupados por sección. */
function groupDefs(): Array<{ group: string; defs: PermissionDef[] }> {
  const groups: Array<{ group: string; defs: PermissionDef[] }> = []
  for (const def of PERMISSION_DEFS) {
    const last = groups[groups.length - 1]
    if (last && last.group === def.group) last.defs.push(def)
    else groups.push({ group: def.group, defs: [def] })
  }
  return groups
}

const GROUPS = groupDefs()

function PermissionToggle({
  checked,
  disabled,
  label,
  title,
  onToggle,
}: {
  checked: boolean
  disabled: boolean
  label: string
  title?: string
  onToggle: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={() => onToggle(!checked)}
      className={[
        "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "bg-indigo-500" : "bg-muted-foreground/30",
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform",
          checked ? "translate-x-4" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  )
}

interface Props {
  tenantId: string
  matrix: PermissionMatrix
  canManage: boolean
}

export function PermissionsSettings({ tenantId, matrix: initialMatrix, canManage }: Props) {
  const [matrix, setMatrix] = useState<PermissionMatrix>(initialMatrix)
  const [pending, setPending] = useState<string | null>(null)

  async function handleToggle(role: Role, key: PermissionKey, next: boolean) {
    if (!canManage || LOCKED_ROLES.includes(role)) return

    const previous = matrix[role][key]
    setMatrix((m) => ({ ...m, [role]: { ...m[role], [key]: next } }))
    setPending(`${role}:${key}`)

    const result = await setRolePermissionAction({ tenantId, role, key, allowed: next })

    setPending(null)
    if (!result.ok) {
      setMatrix((m) => ({ ...m, [role]: { ...m[role], [key]: previous } }))
      toast.error(toastErrorFromResult(result.error, toastMessages.settings.errorSave))
    }
  }

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-6">
      <p className="text-sm text-muted-foreground">
        Define qué puede ver cada rol. Los cambios se guardan al instante.
      </p>

      <div className="overflow-x-auto rounded-xl border border-border/80 bg-background">
        <table className="w-full min-w-[540px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border/60">
              <th className="sticky left-0 z-10 w-[220px] bg-background px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Permiso
              </th>
              {ROLES.map((role) => (
                <th
                  key={role}
                  scope="col"
                  className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                >
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map(({ group, defs }) => (
              <Fragment key={group}>
                <tr className="border-b border-border/60 bg-muted/40">
                  <th
                    scope="colgroup"
                    colSpan={ROLES.length + 1}
                    className="px-3 py-1.5 text-left"
                  >
                    <span className="sticky left-3 inline-block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {group}
                    </span>
                  </th>
                </tr>
                {defs.map((def) => (
                  <tr key={def.key} className="border-b border-border/40 last:border-b-0">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 w-[220px] bg-background px-3 py-3 align-top text-left"
                    >
                      <span className="block text-sm font-semibold leading-snug">{def.label}</span>
                      <span className="mt-1 block text-xs font-normal leading-snug text-muted-foreground">
                        {def.description}
                      </span>
                    </th>
                    {ROLES.map((role) => {
                      const locked = LOCKED_ROLES.includes(role)
                      const checked = locked || matrix[role][def.key]
                      const busy = pending === `${role}:${def.key}`
                      return (
                        <td key={role} className="px-2 py-3 align-middle text-center">
                          <div className="flex flex-col items-center gap-1">
                            <PermissionToggle
                              checked={checked}
                              disabled={locked || !canManage || busy}
                              label={`${def.label} — ${ROLE_LABELS[role]}`}
                              title={locked ? LOCKED_HINT : undefined}
                              onToggle={(next) => void handleToggle(role, def.key, next)}
                            />
                            {locked && (
                              <Lock
                                className="h-3 w-3 text-muted-foreground"
                                aria-hidden
                              />
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Las columnas de {LOCKED_ROLE_LABELS} no se pueden editar: siempre tienen acceso
        completo a todo el espacio de trabajo.
      </p>
    </div>
  )
}
