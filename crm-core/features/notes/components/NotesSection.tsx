"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { toastMessages, toastErrorFromResult } from "@/lib/ui/toast-messages"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { addNoteAction, deleteNoteAction, getDealNotesAction, getClientNotesAction } from "@/features/notes/actions"
import type { NoteEntry } from "@/features/notes/queries"
import { formatDateTime } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"

interface NotesSectionProps {
  tenantId: string
  tenantSlug: string
  dealId?: string
  clientId?: string
  settings: IntlSettings
  canEdit?: boolean
}

export function NotesSection({ tenantId, tenantSlug, dealId, clientId, settings, canEdit = true }: NotesSectionProps) {
  const [notes, setNotes] = useState<NoteEntry[]>([])
  const [body, setBody] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetch = dealId
      ? getDealNotesAction(tenantId, dealId)
      : clientId
        ? getClientNotesAction(tenantId, clientId)
        : Promise.resolve([])
    fetch.then(setNotes)
  }, [tenantId, dealId, clientId])

  async function handleAdd() {
    if (!body.trim()) return
    setLoading(true)
    const result = await addNoteAction({ tenantId, tenantSlug, body: body.trim(), dealId, clientId })
    setLoading(false)
    if (!result.ok) {
      toast.error(toastErrorFromResult(result.error, toastMessages.note.errorSave))
      return
    }
    toast.success(toastMessages.note.saved)
    setBody("")
    const updated = dealId
      ? await getDealNotesAction(tenantId, dealId)
      : clientId
        ? await getClientNotesAction(tenantId, clientId)
        : []
    setNotes(updated)
  }

  async function handleDelete(noteId: string) {
    if (!confirm("¿Eliminar esta nota?")) return
    const result = await deleteNoteAction({ tenantId, tenantSlug, noteId })
    if (!result.ok) {
      toast.error(toastErrorFromResult(result.error, toastMessages.note.errorRemove))
      return
    }
    toast.success(toastMessages.note.removed)
    setNotes((prev) => prev.filter((n) => n.id !== noteId))
  }

  return (
    <div>
      {canEdit && (
        <>
          <Textarea
            placeholder="Escribe una nota..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="text-sm min-h-[72px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd()
            }}
          />
          <Button
            size="sm"
            className="mt-2 h-7 text-xs"
            onClick={handleAdd}
            disabled={loading || !body.trim()}
          >
            {loading ? "Guardando..." : "Guardar nota"}
          </Button>
        </>
      )}

      {notes.length === 0 && !canEdit && (
        <p className="text-xs text-muted-foreground">Sin notas.</p>
      )}

      {notes.length > 0 && (
        <ul className="mt-4 space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="p-3 bg-muted/40 rounded text-sm group relative">
              <p className="whitespace-pre-wrap break-words">{n.text}</p>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-muted-foreground">
                  {n.authorName ?? "Sistema"} · {formatDateTime(n.createdAt, settings)}
                </p>
                {canEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(n.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
