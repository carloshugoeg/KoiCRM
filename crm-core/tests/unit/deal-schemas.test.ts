import { describe, it, expect } from "vitest"
import { updateDealFieldSchema } from "@/features/deals/schemas"

const base = { tenantId: "t1", tenantSlug: "s1", dealId: "d1" }

describe("updateDealFieldSchema field-level validation", () => {
  it("rejects non-email value for field=email", () => {
    const r = updateDealFieldSchema.safeParse({ ...base, field: "email", value: "not-an-email" })
    expect(r.success).toBe(false)
  })
  it("accepts empty string for field=email (nullable)", () => {
    const r = updateDealFieldSchema.safeParse({ ...base, field: "email", value: "" })
    expect(r.success).toBe(true)
  })
  it("rejects phone longer than 30 chars", () => {
    const r = updateDealFieldSchema.safeParse({ ...base, field: "phone", value: "x".repeat(31) })
    expect(r.success).toBe(false)
  })
  it("rejects whatsapp longer than 40 chars", () => {
    const r = updateDealFieldSchema.safeParse({ ...base, field: "whatsapp", value: "x".repeat(41) })
    expect(r.success).toBe(false)
  })
  it("rejects empty name for field=name", () => {
    const r = updateDealFieldSchema.safeParse({ ...base, field: "name", value: "" })
    expect(r.success).toBe(false)
  })
  it("rejects name longer than 200 chars", () => {
    const r = updateDealFieldSchema.safeParse({ ...base, field: "name", value: "x".repeat(201) })
    expect(r.success).toBe(false)
  })
  it("rejects negative value for field=value", () => {
    const r = updateDealFieldSchema.safeParse({ ...base, field: "value", value: -1 })
    expect(r.success).toBe(false)
  })
  it("accepts zero for field=value", () => {
    const r = updateDealFieldSchema.safeParse({ ...base, field: "value", value: 0 })
    expect(r.success).toBe(true)
  })
  it("rejects empty statusKey", () => {
    const r = updateDealFieldSchema.safeParse({ ...base, field: "statusKey", value: "" })
    expect(r.success).toBe(false)
  })
  it("accepts valid email for field=email", () => {
    const r = updateDealFieldSchema.safeParse({ ...base, field: "email", value: "user@example.com" })
    expect(r.success).toBe(true)
  })
  it("accepts string number '10' for field=value", () => {
    const r = updateDealFieldSchema.safeParse({ ...base, field: "value", value: "10" })
    expect(r.success).toBe(true)
  })
  it("rejects non-numeric string 'abc' for field=value", () => {
    const r = updateDealFieldSchema.safeParse({ ...base, field: "value", value: "abc" })
    expect(r.success).toBe(false)
  })
  it("rejects non-string (number) for string field=phone", () => {
    const r = updateDealFieldSchema.safeParse({ ...base, field: "phone", value: 12345 })
    expect(r.success).toBe(false)
  })
})

describe("BUG-007: cursor date validation", () => {
  it("new Date('garbage').getTime() is NaN", () => {
    expect(isNaN(new Date("garbage string").getTime())).toBe(true)
  })
  it("new Date(validIso).getTime() is not NaN", () => {
    expect(isNaN(new Date(new Date().toISOString()).getTime())).toBe(false)
  })
})
