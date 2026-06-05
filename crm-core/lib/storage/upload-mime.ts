export const DEAL_UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const

export type DealUploadMimeType = (typeof DEAL_UPLOAD_MIME_TYPES)[number]

export const DEAL_UPLOAD_ACCEPT = [
  ...DEAL_UPLOAD_MIME_TYPES,
  ".pdf",
].join(",")

const EXT_TO_MIME: Record<string, DealUploadMimeType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
}

const MIME_TO_EXT: Record<DealUploadMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
}

export function isDealUploadMimeType(value: string): value is DealUploadMimeType {
  return (DEAL_UPLOAD_MIME_TYPES as readonly string[]).includes(value)
}

export function resolveDealUploadMimeType(file: File): DealUploadMimeType | null {
  if (isDealUploadMimeType(file.type)) return file.type

  const ext = file.name.split(".").pop()?.toLowerCase()
  if (!ext) return null
  return EXT_TO_MIME[ext] ?? null
}

export function extensionForMime(mime: DealUploadMimeType): string {
  return MIME_TO_EXT[mime]
}
