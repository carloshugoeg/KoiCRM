"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface PinDialogProps {
  open: boolean
  error?: string
  submitting?: boolean
  onSubmit: (pin: string) => void
  onCancel: () => void
}

/** 4-digit PIN entry shown before a sensitive deal write. The PIN identifies the author. */
export function PinDialog({ open, error, submitting, onSubmit, onCancel }: PinDialogProps) {
  const [pin, setPin] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset + focus on open.
  useEffect(() => {
    if (open) {
      setPin("")
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open])

  // Clear the entry whenever a new error arrives (e.g. wrong PIN) so the user can retry.
  useEffect(() => {
    if (error) {
      setPin("")
      inputRef.current?.focus()
    }
  }, [error])

  function handlePinChange(raw: string) {
    const next = raw.replace(/\D/g, "").slice(0, 4)
    setPin(next)
    if (next.length === 4 && !submitting) onSubmit(next)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !submitting) onCancel() }}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Confirma con tu PIN</DialogTitle>
          <DialogDescription>
            Ingresa tu PIN de 4 dígitos. Se verificará automáticamente al completarlo.
          </DialogDescription>
        </DialogHeader>
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={pin}
          disabled={submitting}
          onChange={(e) => handlePinChange(e.target.value)}
          className="w-full text-center text-2xl tracking-[0.6em] font-bold rounded-md border py-3 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
          placeholder="••••"
          aria-label="PIN de 4 dígitos"
          aria-invalid={!!error}
        />
        {submitting && (
          <p className="text-sm text-muted-foreground text-center">Verificando PIN…</p>
        )}
        {error && !submitting && <p className="text-sm text-red-600 text-center">{error}</p>}
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
