import { describe, it, expect } from "vitest"
import { dealIdSchema } from "@/lib/schemas/deal-id"
import { resolveDealUploadMimeType } from "@/lib/storage/upload-mime"

describe("dealIdSchema", () => {
  it("accepts tenant deal ids like AQX-0032-RO-26", () => {
    expect(dealIdSchema.safeParse("AQX-0032-RO-26").success).toBe(true)
    expect(dealIdSchema.safeParse("DEAL-0001-RO-26").success).toBe(true)
  })

  it("rejects cuid-only style when invalid format", () => {
    expect(dealIdSchema.safeParse("").success).toBe(false)
  })
})

describe("resolveDealUploadMimeType", () => {
  it("infers application/pdf from .pdf when browser sends octet-stream", () => {
    const file = new File([new Uint8Array([1])], "cotizacion.pdf", {
      type: "application/octet-stream",
    })
    expect(resolveDealUploadMimeType(file)).toBe("application/pdf")
  })

  it("returns null for disallowed types", () => {
    const file = new File([new Uint8Array([1])], "video.mp4", { type: "video/mp4" })
    expect(resolveDealUploadMimeType(file)).toBeNull()
  })
})
