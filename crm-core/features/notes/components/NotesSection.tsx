"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { addNoteAction, deleteNoteAction } from "@/features/notes/actions"
import { getDealNotes, getClientNotes } from "@/features/notes/queries"
import { formatDateTime } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"
import type { NoteEntry } from "@/features/notes/queries"

interface NotesSectionProps {
  tenantId: string
  tenantSlug: string
  dealId?: string
  clientId?: string
  settings: IntlSettings
}

export function NotesSection({ tenantId, tenantSlug, dealId, clientId, settings }: NotesSectionProps) {
  const [notes, setNotes] = useState<NoteEntry[]>([])
  const [body, setBody] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetch = dealId
      ? getDealNotes(tenantId, dealId)
      : clientId
        ? getClientNotes(tenantId, clientId)
        : Promise.resolve([])
    fetch.then(setNotes)
  }, [tenantId, dealId, clientId])

  async function handleAdd() {
    if (!body.trim()) return
    setLoading(true)
    const result = await addNoteAction({ tenantId, tenantSlug, body: body.trim(), dealId, clientId })
    setLoading(false)
    if (!result.ok) {
      toast.error(result.error ?? "Error al guardar nota.")
      return
    }
    toast.success("Nota guardada.")
    setBody("")
    const updated = dealId
      ? await getDealNotes(tenantId, dealId)
      : clientId
        ? await getClientNotes(tenantId, clientId)
        : []
    setNotes(updated)
  }

  async function handleDelete(noteId: string) {
    if (!confirm("¿Eliminar esta nota?")) return
    const result = await deleteNoteAction({ tenantId, tenantSlug, noteId })
    if (!result.ok) {
      toast.error(result.error ?? "Error al eliminar.")
      return
    }
    setNotes((prev) => prev.filter((n) => n.id !== noteId))
  }

  return (
    <div>
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

      {notes.length > 0 && (
        <ul className="mt-4 space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="p-3 bg-muted/40 rounded text-sm group relative">
              <p className="whitespace-pre-wrap break-words">{n.text}</p>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-muted-foreground">
                  {n.authorName ?? "Sistema"} · {formatDateTime(n.createdAt, settings)}
                </p>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDelete(n.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
