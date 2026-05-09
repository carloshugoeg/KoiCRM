"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Loader2 } from "lucide-react";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

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
  disabled?: boolean;
}

export function FileUploadButton({
  dealId,
  tenantId,
  onUpload,
  onError,
  disabled,
}: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      onError?.("Tipo de archivo no permitido. Usa JPG, PNG, WEBP, GIF o PDF.");
      return;
    }

    setUploading(true);
    try {
      const signRes = await fetch("/api/upload/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: file.type,
          size: file.size,
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
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadRes.ok) {
        onError?.("Error al subir el archivo. Intenta de nuevo.");
        return;
      }

      onUpload({ url: publicUrl, key, mimeType: file.type, size: file.size });
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
        accept={ALLOWED_TYPES.join(",")}
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
        {uploading ? "Subiendo…" : "Adjuntar"}
      </Button>
    </>
  );
}
