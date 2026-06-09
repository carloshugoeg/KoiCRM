"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, ExternalLink, Ban, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { toastMessages, toastErrorFromResult } from "@/lib/ui/toast-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { FileUploadButton } from "@/features/attachments/components/FileUploadButton";
import { confirmUpload } from "@/features/attachments/actions";
import { resolveDealFileUrl } from "@/lib/storage/media-url";
import { createQuote, voidQuote, deleteQuote } from "@/features/quotes/actions";
import { useActionPin } from "@/features/auth/pin-gate";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import type { Quote } from "@prisma/client";

interface QuoteSectionProps {
  dealId: string;
  tenantId: string;
  quotes: Quote[];
  canEdit: boolean;
  canDelete: boolean;
  onRefresh?: () => void;
}

interface PendingUpload {
  url: string;
  key: string;
  mimeType: string;
  size: number;
}

export function QuoteSection({ dealId, tenantId, quotes, canEdit, canDelete, onRefresh }: QuoteSectionProps) {
  const { guard } = useActionPin();
  const [showForm, setShowForm] = useState(false);
  const [number, setNumber] = useState("");
  const [date, setDate] = useState("");
  const [pending, setPending] = useState<PendingUpload | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setShowForm(false);
    setNumber("");
    setDate("");
    setPending(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!number.trim() || !date) return;
    if (!pending) {
      toast.error(toastMessages.attachment.fileRequired);
      return;
    }
    setSubmitting(true);

    const confirmed = await confirmUpload(tenantId, {
      dealId,
      key: pending.key,
      url: pending.url,
      mimeType: pending.mimeType,
      size: pending.size,
    });
    if (!confirmed.ok) {
      toast.error(toastMessages.attachment.errorConfirm);
      setSubmitting(false);
      return;
    }

    const result = await guard((pin) => createQuote(tenantId, {
      dealId,
      number: number.trim(),
      date: new Date(date),
      fileUrl: pending.url,
      pin,
    }));

    if (!result.ok) {
      if (!result.requiresPin) toast.error(toastMessages.quote.errorSave);
    } else {
      toast.success(toastMessages.quote.added);
      resetForm();
      onRefresh?.();
    }
    setSubmitting(false);
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="min-w-0 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Cotizaciones
          </h4>
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => setShowForm((v) => !v)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Agregar
            </Button>
          )}
        </div>

        {quotes.length === 0 && !showForm && (
          <p className="text-xs text-muted-foreground">Sin cotizaciones.</p>
        )}

        <div className="space-y-1">
          {quotes.map((q) => (
            <div
              key={q.id}
              className={`rounded-md px-2 py-1.5 text-sm bg-muted/40 ${q.isVoid ? "opacity-50" : ""}`}
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className={`min-w-0 truncate font-medium ${q.isVoid ? "line-through" : ""}`}>
                  {q.number}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {format(new Date(q.date), "dd MMM yyyy", { locale: es })}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1">
              {q.isVoid && (
                <Badge variant="outline" className="text-xs py-0 h-4">
                  Anulado
                </Badge>
              )}
              {q.fileUrl && (
                <a
                  href={resolveDealFileUrl(q.fileUrl) ?? q.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {!q.isVoid && canEdit && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() =>
                        guard((pin) => voidQuote(tenantId, q.id, pin)).then((r) => {
                          if (!r.ok) {
                            if (!r.requiresPin) toast.error(toastMessages.quote.errorVoid);
                          } else {
                            toast.success(toastMessages.quote.voided);
                            onRefresh?.();
                          }
                        })
                      }
                    >
                      <Ban className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Anular
                  </TooltipContent>
                </Tooltip>
              )}
              {canDelete && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-destructive hover:text-destructive"
                      onClick={() =>
                        guard((pin) => deleteQuote(tenantId, q.id, pin)).then((r) => {
                          if (!r.ok) {
                            if (!r.requiresPin) toast.error(toastMessages.quote.errorRemove);
                          } else {
                            toast.success(toastMessages.quote.removed);
                            onRefresh?.();
                          }
                        })
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Eliminar
                  </TooltipContent>
                </Tooltip>
              )}
              </div>
            </div>
          ))}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="min-w-0 space-y-2 rounded-md border p-2">
            <Input
              placeholder="Número (ej. COT-001)"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="h-7 w-full text-xs"
              required
            />
            <DatePicker
              value={date}
              onChange={setDate}
              className="w-full"
              placeholder="dd/mm/aaaa"
            />
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <FileUploadButton
                  dealId={dealId}
                  tenantId={tenantId}
                  onUpload={(result) => setPending(result)}
                  onError={(msg) => toast.error(msg)}
                  onCompressed={(pct) =>
                    toast.info(`Imagen optimizada (~${pct}% menos peso).`)
                  }
                  disabled={submitting}
                />
                {pending ? (
                  <span className="text-xs text-green-600">Archivo listo ✓</span>
                ) : (
                  <span className="text-xs text-muted-foreground">PDF o foto obligatorio</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 flex-1 text-xs"
                  onClick={resetForm}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="h-7 flex-1 text-xs"
                  disabled={submitting || !pending}
                >
                  Guardar
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </TooltipProvider>
  );
}
