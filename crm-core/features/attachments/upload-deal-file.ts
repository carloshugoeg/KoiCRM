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

  const body = new FormData()
  body.append("file", uploadFile)
  body.append("tenantId", tenantId)
  body.append("dealId", dealId)
  body.append("contentType", mimeType)

  const uploadRes = await fetch("/api/upload/deal", {
    method: "POST",
    body,
  })

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}))
    const code = (err as { code?: string }).code
    if (code === "storage_limit_exceeded" || code === "file_too_large") {
      return { error: (err as { error?: string }).error ?? "Error al subir el archivo." }
    }
    return { error: (err as { error?: string }).error ?? "Error al subir el archivo." }
  }

  const { key, publicUrl } = await uploadRes.json()

  return {
    url: publicUrl as string,
    key: key as string,
    mimeType,
    size: uploadFile.size,
  }
}
