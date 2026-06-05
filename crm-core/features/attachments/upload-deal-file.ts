import { prepareFileForUpload } from "@/lib/storage/compress-upload-file"

export interface DealUploadResult {
  url: string
  key: string
  mimeType: string
  size: number
}

export async function uploadDealFile(
  tenantId: string,
  dealId: string,
  file: File,
): Promise<DealUploadResult | { error: string }> {
  const prepared = await prepareFileForUpload(file)
  if ("error" in prepared) return { error: prepared.error }

  const { file: uploadFile, mimeType } = prepared

  const signRes = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contentType: mimeType,
      size: uploadFile.size,
      dealId,
      tenantId,
    }),
  })

  if (!signRes.ok) {
    const err = await signRes.json().catch(() => ({}))
    return { error: (err as { error?: string }).error ?? "Error al subir el archivo." }
  }

  const { signedUrl, key, publicUrl } = await signRes.json()
  const uploadRes = await fetch(signedUrl, {
    method: "PUT",
    body: uploadFile,
    headers: { "Content-Type": mimeType },
  })

  if (!uploadRes.ok) {
    return { error: "Error al subir el archivo al almacenamiento." }
  }

  return {
    url: publicUrl as string,
    key: key as string,
    mimeType,
    size: uploadFile.size,
  }
}
