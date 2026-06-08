"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { FileText, Trash2 } from "lucide-react"
import { FileUploadButton } from "@/features/attachments/components/FileUploadButton"
import {
  confirmUpload,
  deleteAttachment,
  getDealAttachmentsAction,
  type DealAttachmentDTO,
} from "@/features/attachments/actions"
import { resolveDealFileUrl } from "@/lib/storage/media-url"
import { AlertDialog } from "@/components/ui/alert-dialog"

interface Props {
  dealId: string
  tenantId: string
  canEdit?: boolean
  /** fileUrls already shown as Cotizaciones/Pagos — excluded from the general gallery. */
  excludeUrls?: string[]
}

export function DealAttachmentsSection({ dealId, tenantId, canEdit = false, excludeUrls = [] }: Props) {
  const [items, setItems] = useState<DealAttachmentDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const excluded = new Set(excludeUrls)

  const reload = useCallback(async () => {
    const rows = await getDealAttachmentsAction(tenantId, dealId)
    setItems(rows)
    setLoading(false)
  }, [tenantId, dealId])

  useEffect(() => {
    void reload()
  }, [reload])

  const visible = items.filter((a) => !excluded.has(a.url))

  async function handleUpload(result: { url: string; key: string; mimeType: string; size: number }) {
    const confirmed = await confirmUpload(tenantId, {
      dealId,
      key: result.key,
      url: result.url,
      mimeType: result.mimeType,
      size: result.size,
    })
    if (!confirmed.ok) {
      toast.error("No se pudo guardar el archivo.")
      return
    }
    toast.success("Archivo adjuntado.")
    void reload()
  }

  async function handleDelete(id: string) {
    const res = await deleteAttachment(tenantId, id)
    if (!res.ok) {
      toast.error("No se pudo eliminar el archivo.")
      return
    }
    toast.success("Archivo eliminado.")
    setItems((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Archivos e imágenes
          </h4>
          {canEdit && (
            <FileUploadButton
              dealId={dealId}
              tenantId={tenantId}
              onUpload={handleUpload}
              onError={(m) => toast.error(m)}
            />
          )}
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground">Cargando…</p>
        ) : visible.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin archivos. Sube capturas, fotos de productos, etc.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {visible.map((a) => {
              const isImage = a.mimeType.startsWith("image/")
              const mediaUrl = resolveDealFileUrl(a.url) ?? a.url
              return (
                <div key={a.id} className="group relative aspect-square overflow-hidden rounded-md border bg-muted/40">
                  <a href={mediaUrl} target="_blank" rel="noreferrer" className="block h-full w-full">
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                        <FileText className="h-6 w-6" />
                        <span className="text-[10px]">PDF</span>
                      </div>
                    )}
                  </a>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setDeleteId(a.id)}
                      className="absolute right-1 top-1 hidden rounded bg-black/60 p-1 text-white group-hover:block"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null) }}
        title="¿Eliminar archivo?"
        description="El archivo se eliminará de forma permanente."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
        onConfirm={() => { if (deleteId) handleDelete(deleteId) }}
      />
    </>
  )
}
