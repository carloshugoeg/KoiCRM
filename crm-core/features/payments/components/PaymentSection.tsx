"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, ExternalLink, Ban, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { toastMessages } from "@/lib/ui/toast-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { FileUploadButton } from "@/features/attachments/components/FileUploadButton";
import { confirmUpload } from "@/features/attachments/actions";
import { resolveDealFileUrl } from "@/lib/storage/media-url";
import { createPayment, voidPayment, deletePayment } from "@/features/payments/actions";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import type { Payment } from "@prisma/client";

interface PaymentSectionProps {
  dealId: string;
  tenantId: string;
  payments: Payment[];
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

export function PaymentSection({ dealId, tenantId, payments, canEdit, canDelete, onRefresh }: PaymentSectionProps) {
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

    const result = await createPayment(tenantId, {
      dealId,
      number: number.trim(),
      date: new Date(date),
      fileUrl: pending.url,
    });

    if (!result.ok) {
      toast.error(toastMessages.payment.errorSave);
    } else {
      toast.success(toastMessages.payment.added);
      resetForm();
      onRefresh?.();
    }
    setSubmitting(false);
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Comprobantes de Pago
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

        {payments.length === 0 && !showForm && (
          <p className="text-xs text-muted-foreground">Sin comprobantes.</p>
        )}

        <div className="space-y-1">
          {payments.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm bg-muted/40 ${p.isVoid ? "opacity-50" : ""}`}
            >
              <span className={`flex-1 font-medium ${p.isVoid ? "line-through" : ""}`}>
                {p.number}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(p.date), "dd MMM yyyy", { locale: es })}
              </span>
              {p.isVoid && (
                <Badge variant="outline" className="text-xs py-0 h-4">
                  Anulado
                </Badge>
              )}
              {p.fileUrl && (
                <a
                  href={resolveDealFileUrl(p.fileUrl) ?? p.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {!p.isVoid && canEdit && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() =>
                        voidPayment(tenantId, p.id).then((r) => {
                          if (!r.ok) toast.error(toastMessages.payment.errorVoid);
                          else {
                            toast.success(toastMessages.payment.voided);
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
                        deletePayment(tenantId, p.id).then((r) => {
                          if (!r.ok) toast.error(toastMessages.payment.errorRemove);
                          else {
                            toast.success(toastMessages.payment.removed);
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
          ))}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-2 rounded-md border p-2">
            <div className="flex gap-2">
              <Input
                placeholder="Número (ej. FAC-001, REC-105)"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="h-7 text-xs"
                required
              />
              <DatePicker
                value={date}
                onChange={setDate}
                className="shrink-0"
                placeholder="dd/mm/aaaa"
              />
            </div>
            <div className="flex items-center gap-2">
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
              <div className="ml-auto flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={resetForm}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="h-7 text-xs"
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
