"use client"

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react"
import { PinDialog } from "@/features/auth/components/pin-dialog"

/** Minimum shape every PIN-gated server action returns. */
export interface GuardableResult {
  ok: boolean
  requiresPin?: boolean
  error?: string
}

interface PinGateContextValue {
  /**
   * Run a PIN-gated server action. Calls it first without a PIN (uses the unlock window);
   * if the server replies `requiresPin`, opens the dialog, collects the PIN, and retries.
   * Returns the final result; if the user cancels, returns the last `requiresPin` result.
   */
  guard: <R extends GuardableResult>(call: (pin?: string) => Promise<R>) => Promise<R>
}

const PinGateContext = createContext<PinGateContextValue | null>(null)

export function PinProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)
  const resolverRef = useRef<((pin: string | null) => void) | null>(null)

  const askPin = useCallback((errMsg?: string) => {
    setError(errMsg)
    setSubmitting(false)
    setOpen(true)
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const closeDialog = useCallback(() => {
    setOpen(false)
    setError(undefined)
    setSubmitting(false)
  }, [])

  const handleSubmit = useCallback((pin: string) => {
    setError(undefined)
    setSubmitting(true)
    resolverRef.current?.(pin)
    resolverRef.current = null
  }, [])

  const handleCancel = useCallback(() => {
    closeDialog()
    resolverRef.current?.(null)
    resolverRef.current = null
  }, [closeDialog])

  const guard = useCallback(
    async <R extends GuardableResult>(call: (pin?: string) => Promise<R>): Promise<R> => {
      let result = await call()
      let lastError: string | undefined
      while (result.requiresPin) {
        const pin = await askPin(lastError)
        if (!pin) return result // cancelled
        result = await call(pin)
        lastError = result.error
      }
      closeDialog()
      return result
    },
    [askPin, closeDialog],
  )

  return (
    <PinGateContext.Provider value={{ guard }}>
      {children}
      <PinDialog
        open={open}
        error={error}
        submitting={submitting}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </PinGateContext.Provider>
  )
}

export function useActionPin(): PinGateContextValue {
  const ctx = useContext(PinGateContext)
  if (!ctx) throw new Error("useActionPin must be used within a PinProvider")
  return ctx
}
