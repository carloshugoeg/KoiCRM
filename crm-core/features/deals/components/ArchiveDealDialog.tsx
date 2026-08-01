"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { CatalogItem } from "@prisma/client"

const NOTE_MAX_LENGTH = 500

interface ArchiveDealDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Active "archiveReason" catalog items for this tenant — the dialog cannot be confirmed without one selected. */
  reasons: CatalogItem[]
  submitting: boolean
  onConfirm: (reasonKey: string, note: string) => void
}

/**
 * Archiving a deal now records WHY (a required, tenant-configured reason) plus an optional
 * free note, instead of a bare yes/no confirmation. Unarchiving does not use this dialog — it
 * has its own plain confirm, since the reason/note already on the deal is preserved as history.
 */
export function ArchiveDealDialog({ open, onOpenChange, reasons, submitting, onConfirm }: ArchiveDealDialogProps) {
  const [reasonKey, setReasonKey] = useState("")
  const [note, setNote] = useState("")

  // Start from a clean slate every time the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setReasonKey("")
      setNote("")
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next) }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>¿Archivar oportunidad?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          La oportunidad se moverá al archivo y no aparecerá en el pipeline.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="archive-reason-select" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Motivo <span className="text-destructive">*</span>
            </label>
            {reasons.length === 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                No hay motivos configurados todavía. Un superadmin puede agregarlos en Ajustes → Catálogos → Motivos de archivo.
              </p>
            ) : (
              <Select value={reasonKey} onValueChange={setReasonKey} disabled={submitting}>
                <SelectTrigger id="archive-reason-select" className="h-11 text-sm">
                  <SelectValue placeholder="Selecciona un motivo…" />
                </SelectTrigger>
                <SelectContent>
                  {reasons.map((r) => (
                    <SelectItem key={r.id} value={r.key}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <label htmlFor="archive-note" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Nota (opcional)
            </label>
            <Textarea
              id="archive-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={NOTE_MAX_LENGTH}
              placeholder="Detalles adicionales sobre el archivo…"
              className="min-h-[80px] text-sm"
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-11"
            disabled={!reasonKey || submitting}
            onClick={() => onConfirm(reasonKey, note.trim())}
          >
            {submitting ? "Archivando…" : "Archivar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
