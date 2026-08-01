import { describe, it, expect, afterEach } from "vitest"
import {
  countFollowUpBannerItems,
  formatFollowUpBannerDate,
  toFollowUpBannerItems,
} from "@/features/follow-ups/banner-items"
import type { getFollowUpAlerts } from "@/features/follow-ups/queries"

const alerts = {
  overdue: [
    {
      id: "fu-1",
      note: "No responde, intentar WhatsApp",
      date: new Date("2026-05-08T12:00:00"),
      deal: {
        id: "deal-1",
        name: "Deal A",
        company: "ACME",
        stage: { key: "nuevo", label: "Nuevo", color: "#000" },
      },
    },
  ],
  today: [
    {
      id: "fu-2",
      note: "Pide información de financiamiento",
      date: new Date("2026-05-10T09:00:00"),
      deal: {
        id: "deal-2",
        name: "Deal B",
        company: null,
        stage: { key: "cotizacion", label: "Cotización", color: "#111" },
      },
    },
  ],
  next7: [
    {
      id: "fu-3",
      note: "Agendar visita técnica",
      date: new Date("2026-05-12T15:00:00"),
      deal: {
        id: "deal-3",
        name: "Deal C",
        company: "Beta",
        stage: { key: "nuevo", label: "Nuevo", color: "#000" },
      },
    },
  ],
} as Awaited<ReturnType<typeof getFollowUpAlerts>>

describe("toFollowUpBannerItems", () => {
  it("orders overdue, today, then upcoming and maps free-text notes", () => {
    const items = toFollowUpBannerItems(alerts, "America/Guatemala")

    expect(items).toHaveLength(3)
    expect(items[0]?.urgency).toBe("overdue")
    expect(items[1]?.urgency).toBe("today")
    expect(items[2]?.urgency).toBe("upcoming")
    expect(items[0]?.note).toBe("No responde, intentar WhatsApp")
    expect(items[0]?.dateIso).toContain("2026-05-08")
  })

  it("respects max limit", () => {
    expect(toFollowUpBannerItems(alerts, "America/Guatemala", 2)).toHaveLength(2)
  })

  it("formats dateLabel in the tenant's timezone, not the process's local zone", () => {
    const items = toFollowUpBannerItems(alerts, "America/Guatemala")
    expect(items[0]?.dateLabel).toBe(
      formatFollowUpBannerDate(items[0]!.dateIso, "America/Guatemala"),
    )
  })
})

describe("countFollowUpBannerItems", () => {
  it("sums all buckets", () => {
    expect(countFollowUpBannerItems(alerts)).toBe(3)
  })
})

describe("formatFollowUpBannerDate", () => {
  const originalTz = process.env.TZ
  afterEach(() => {
    process.env.TZ = originalTz
  })

  it("renders the same string for the same instant regardless of the process's local zone", () => {
    const iso = "2026-05-08T12:00:00.000Z"

    process.env.TZ = "UTC"
    const inUtcProcess = formatFollowUpBannerDate(iso, "America/Guatemala")

    process.env.TZ = "Pacific/Kiritimati" // UTC+14 — as far from Guatemala's zone as it gets
    const inFarEastProcess = formatFollowUpBannerDate(iso, "America/Guatemala")

    process.env.TZ = "America/Guatemala"
    const inGuatemalaProcess = formatFollowUpBannerDate(iso, "America/Guatemala")

    expect(inUtcProcess).toBe(inFarEastProcess)
    expect(inUtcProcess).toBe(inGuatemalaProcess)
  })

  it("actually applies the requested timezone offset, not just UTC", () => {
    // 2026-05-08T02:00:00Z is 2026-05-07 20:00 in Guatemala (UTC-6) but 2026-05-08 morning in UTC.
    const iso = "2026-05-08T02:00:00.000Z"
    const label = formatFollowUpBannerDate(iso, "America/Guatemala")
    expect(label).toContain("7 may")
    expect(label).not.toContain("8 may")
  })
})
