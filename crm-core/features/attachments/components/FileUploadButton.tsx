"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Loader2 } from "lucide-react";
import { prepareFileForUpload } from "@/lib/storage/compress-upload-file";
import { DEAL_UPLOAD_ACCEPT } from "@/lib/storage/upload-mime";

interface UploadResult {
  url: string;
  key: string;
  mimeType: string;
  size: number;
}

interface FileUploadButtonProps {
  dealId: string;
  tenantId: string;
  onUpload: (result: UploadResult) => void;
  onError?: (message: string) => void;
  onCompressed?: (savedPercent: number) => void;
  disabled?: boolean;
  required?: boolean;
}

export function FileUploadButton({
  dealId,
  tenantId,
  onUpload,
  onError,
  onCompressed,
  disabled,
}: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [readyLabel, setReadyLabel] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setReadyLabel(null);
    try {
      const prepared = await prepareFileForUpload(file);
      if ("error" in prepared) {
        onError?.(prepared.error);
        return;
      }

      const { file: uploadFile, mimeType, compressed, originalBytes, finalBytes } = prepared;

      if (compressed && originalBytes > 0 && finalBytes < originalBytes) {
        const savedPercent = Math.round((1 - finalBytes / originalBytes) * 100);
        if (savedPercent >= 5) onCompressed?.(savedPercent);
      }

      const signRes = await fetch("/api/upload/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: mimeType,
          size: uploadFile.size,
          dealId,
          tenantId,
        }),
      });

      if (!signRes.ok) {
        const err = await signRes.json().catch(() => ({}));
        if (err.code === "storage_limit_exceeded") {
          onError?.(err.error);
        } else if (err.code === "file_too_large") {
          onError?.(err.error ?? "El archivo supera el tamaño máximo permitido.");
        } else {
          onError?.("Error al iniciar la subida. Intenta de nuevo.");
        }
        return;
      }

      const { signedUrl, key, publicUrl } = await signRes.json();

      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        body: uploadFile,
        headers: { "Content-Type": mimeType },
      });

      if (!uploadRes.ok) {
        onError?.("Error al subir el archivo. Intenta de nuevo.");
        return;
      }

      setReadyLabel(uploadFile.name);
      onUpload({ url: publicUrl, key, mimeType, size: uploadFile.size });
    } catch {
      onError?.("Error inesperado al subir el archivo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={DEAL_UPLOAD_ACCEPT}
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
        ) : (
          <Paperclip className="h-3 w-3 mr-1" />
        )}
        {uploading ? "Subiendo…" : readyLabel ? "Cambiar archivo" : "Adjuntar *"}
      </Button>
    </>
  );
}
