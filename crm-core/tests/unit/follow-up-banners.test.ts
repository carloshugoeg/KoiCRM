import { describe, it, expect } from "vitest"
import { countFollowUpBannerItems, toFollowUpBannerItems } from "@/features/follow-ups/banner-items"
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
    const items = toFollowUpBannerItems(alerts)

    expect(items).toHaveLength(3)
    expect(items[0]?.urgency).toBe("overdue")
    expect(items[1]?.urgency).toBe("today")
    expect(items[2]?.urgency).toBe("upcoming")
    expect(items[0]?.note).toBe("No responde, intentar WhatsApp")
    expect(items[0]?.dateIso).toContain("2026-05-08")
  })

  it("respects max limit", () => {
    expect(toFollowUpBannerItems(alerts, 2)).toHaveLength(2)
  })
})

describe("countFollowUpBannerItems", () => {
  it("sums all buckets", () => {
    expect(countFollowUpBannerItems(alerts)).toBe(3)
  })
})
