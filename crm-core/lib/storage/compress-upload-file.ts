import {
  extensionForMime,
  isDealUploadMimeType,
  resolveDealUploadMimeType,
  type DealUploadMimeType,
} from "@/lib/storage/upload-mime"

const MAX_EDGE_PX = 2560
/** High quality — suitable for quotes and payment proofs without visible loss. */
const JPEG_QUALITY = 0.92
const SKIP_REENCODE_BELOW_BYTES = 350_000

export interface PrepareUploadResult {
  file: File
  mimeType: DealUploadMimeType
  compressed: boolean
  originalBytes: number
  finalBytes: number
}

function fileWithMime(file: File, mimeType: DealUploadMimeType): File {
  if (file.type === mimeType) return file
  const ext = extensionForMime(mimeType)
  const baseName = file.name.replace(/\.[^.]+$/, "") || "documento"
  return new File([file], `${baseName}.${ext}`, { type: mimeType, lastModified: file.lastModified })
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("No se pudo leer la imagen."))
    }
    img.src = url
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: "image/jpeg" | "image/png" | "image/webp",
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo comprimir la imagen."))
          return
        }
        resolve(blob)
      },
      mimeType,
      quality,
    )
  })
}

async function compressImage(file: File, mimeType: DealUploadMimeType): Promise<File> {
  const normalized = fileWithMime(file, mimeType)
  const img = await loadImageFromFile(normalized)

  const scale = Math.min(1, MAX_EDGE_PX / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))
  const needsResize = scale < 1

  if (!needsResize && normalized.size <= SKIP_REENCODE_BELOW_BYTES) {
    return normalized
  }

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("No se pudo preparar el lienzo de compresión.")
  ctx.drawImage(img, 0, 0, width, height)

  const hasAlpha = mimeType === "image/png" || mimeType === "image/gif" || mimeType === "image/webp"
  const outputMime: "image/jpeg" | "image/png" | "image/webp" =
    mimeType === "image/gif"
      ? "image/png"
      : mimeType === "image/webp"
        ? "image/webp"
        : hasAlpha && mimeType === "image/png"
          ? "image/png"
          : "image/jpeg"

  const blob = await canvasToBlob(
    canvas,
    outputMime,
    outputMime === "image/jpeg" ? JPEG_QUALITY : undefined,
  )

  const outMime = isDealUploadMimeType(outputMime) ? outputMime : "image/jpeg"
  const ext = extensionForMime(outMime)
  const outName = normalized.name.replace(/\.[^.]+$/, "") + `.${ext}`

  return new File([blob], outName, { type: outMime, lastModified: normalized.lastModified })
}

/**
 * Normalizes MIME (e.g. PDFs reported as application/octet-stream) and compresses
 * large photos client-side before upload to reduce R2 storage and egress.
 * PDFs are uploaded as-is (already compact for scanned docs).
 */
export async function prepareFileForUpload(
  file: File,
): Promise<PrepareUploadResult | { error: string }> {
  const mimeType = resolveDealUploadMimeType(file)
  if (!mimeType) {
    return {
      error: "Tipo de archivo no permitido. Usa JPG, PNG, WEBP, GIF o PDF.",
    }
  }

  const originalBytes = file.size

  if (mimeType === "application/pdf") {
    const pdf = fileWithMime(file, mimeType)
    return {
      file: pdf,
      mimeType,
      compressed: false,
      originalBytes,
      finalBytes: pdf.size,
    }
  }

  if (typeof document === "undefined") {
    const normalized = fileWithMime(file, mimeType)
    return {
      file: normalized,
      mimeType,
      compressed: false,
      originalBytes,
      finalBytes: normalized.size,
    }
  }

  try {
    const compressed = await compressImage(file, mimeType)
    return {
      file: compressed,
      mimeType: isDealUploadMimeType(compressed.type)
        ? compressed.type
        : mimeType,
      compressed: compressed.size < originalBytes,
      originalBytes,
      finalBytes: compressed.size,
    }
  } catch {
    const fallback = fileWithMime(file, mimeType)
    return {
      file: fallback,
      mimeType,
      compressed: false,
      originalBytes,
      finalBytes: fallback.size,
    }
  }
}
