"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Lock, LockOpen } from "lucide-react"
import { toast } from "sonner"
import { useActionPin } from "@/features/auth/pin-gate"
import { toggleSessionPinLockAction } from "@/features/auth/session-pin-actions"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface Props {
  tenantId: string
  initialLocked: boolean
  hasPin: boolean
}

export function SessionPinToggle({ tenantId, initialLocked, hasPin }: Props) {
  const router = useRouter()
  const { confirmWithPin } = useActionPin()
  const [locked, setLocked] = useState(initialLocked)
  const [busy, setBusy] = useState(false)

  const requestToggle = useCallback(
    async (enable: boolean) => {
      if (busy) return
      if (!hasPin) {
        toast.error(
          "No tienes PIN configurado. Pide a un administrador que te asigne uno en Configuración → Usuarios.",
        )
        return
      }

      setBusy(true)
      try {
        let lastError: string | undefined
        let pin: string | null = null
        while (true) {
          pin = await confirmWithPin({
            title: enable ? "Activar protección con PIN" : "Desactivar protección con PIN",
            description: enable
              ? "Ingresa tu PIN para activar la protección. Cada cambio pedirá tu PIN mientras esté activa."
              : "Ingresa tu PIN para desactivar la protección y volver a operar sin confirmación.",
            error: lastError,
          })
          if (!pin) return

          const result = await toggleSessionPinLockAction({ tenantId, enable, pin })
          if (result.ok) {
            setLocked(result.locked ?? enable)
            toast.success(
              result.locked
                ? "Protección con PIN activada. Cada cambio pedirá tu PIN."
                : "Protección con PIN desactivada.",
            )
            router.refresh()
            return
          }
          if (result.error?.includes("PIN inválido")) {
            lastError = result.error
            continue
          }
          toast.error(result.error ?? "No se pudo cambiar la protección con PIN.")
          return
        }
      } finally {
        setBusy(false)
      }
    },
    [busy, confirmWithPin, hasPin, router, tenantId],
  )

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5" data-has-pin={hasPin ? "true" : "false"}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1.5 cursor-default">
              {locked ? (
                <Lock className="h-4 w-4 text-amber-600" aria-hidden />
              ) : (
                <LockOpen className="h-4 w-4 text-muted-foreground" aria-hidden />
              )}
              <span className="text-xs font-medium text-muted-foreground hidden sm:inline">PIN</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px] text-xs">
            {locked
              ? "Protección activa: cada cambio pedirá tu PIN. Desactívala con tu PIN al volver."
              : "Desactivado: tus cambios quedan a tu nombre. Actívalo al salir (ej. almorzar)."}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <button
        type="button"
        role="switch"
        aria-checked={locked}
        aria-label={locked ? "Desactivar protección con PIN" : "Activar protección con PIN"}
        data-testid="session-pin-toggle"
        disabled={busy}
        onClick={() => void requestToggle(!locked)}
        className={[
          "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:opacity-60",
          locked ? "bg-amber-500" : "bg-muted-foreground/30",
        ].join(" ")}
      >
        <span
          className={[
            "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform",
            locked ? "translate-x-4" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
  )
}
