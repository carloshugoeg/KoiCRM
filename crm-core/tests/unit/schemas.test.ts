import { describe, it, expect } from "vitest"
import { createDealSchema, updateDealFieldSchema } from "@/features/deals/schemas"

const BASE_CREATE = {
  tenantId: "t1", tenantSlug: "demo", ownerId: "u1", channelKey: "web",
  name: "Deal A", equipment: [{ categoryKey: "bombas", subcategoryKeys: ["bombas__sumergible"] }],
}

describe("createDealSchema — phone", () => {
  it("rejects missing phone", () => {
    const r = createDealSchema.safeParse({ ...BASE_CREATE })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0].message).toMatch(/teléfono/i)
  })

  it("rejects phone without dash format", () => {
    const r = createDealSchema.safeParse({ ...BASE_CREATE, phone: "12345678" })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0].message).toMatch(/XXXX-XXXX/)
  })

  it("accepts phone with correct format", () => {
    const r = createDealSchema.safeParse({ ...BASE_CREATE, phone: "1234-5678" })
    expect(r.success).toBe(true)
  })
})

describe("createDealSchema — whatsapp", () => {
  it("accepts omitted whatsapp", () => {
    const r = createDealSchema.safeParse({ ...BASE_CREATE, phone: "1234-5678" })
    expect(r.success).toBe(true)
  })

  it("rejects whatsapp without country code", () => {
    const r = createDealSchema.safeParse({ ...BASE_CREATE, phone: "1234-5678", whatsapp: "12345678" })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0].message).toMatch(/\+502/)
  })

  it("accepts whatsapp with correct format", () => {
    const r = createDealSchema.safeParse({ ...BASE_CREATE, phone: "1234-5678", whatsapp: "+502 1234-5678" })
    expect(r.success).toBe(true)
  })

  it("accepts empty string whatsapp", () => {
    const r = createDealSchema.safeParse({ ...BASE_CREATE, phone: "1234-5678", whatsapp: "" })
    expect(r.success).toBe(true)
  })
})

describe("updateDealFieldSchema — phone inline edit", () => {
  const base = { tenantId: "t1", tenantSlug: "demo", dealId: "d1" }

  it("rejects empty phone via inline edit", () => {
    const r = updateDealFieldSchema.safeParse({ ...base, field: "phone", value: "" })
    expect(r.success).toBe(false)
  })

  it("rejects phone with wrong format", () => {
    const r = updateDealFieldSchema.safeParse({ ...base, field: "phone", value: "99999999" })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0].message).toMatch(/XXXX-XXXX/)
  })

  it("accepts phone with correct format", () => {
    const r = updateDealFieldSchema.safeParse({ ...base, field: "phone", value: "9999-8888" })
    expect(r.success).toBe(true)
  })

  it("rejects whatsapp with wrong format", () => {
    const r = updateDealFieldSchema.safeParse({ ...base, field: "whatsapp", value: "99999999" })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0].message).toMatch(/\+502/)
  })

  it("accepts whatsapp with correct format", () => {
    const r = updateDealFieldSchema.safeParse({ ...base, field: "whatsapp", value: "+502 9999-8888" })
    expect(r.success).toBe(true)
  })

  it("accepts empty whatsapp via inline edit", () => {
    const r = updateDealFieldSchema.safeParse({ ...base, field: "whatsapp", value: "" })
    expect(r.success).toBe(true)
  })
})
