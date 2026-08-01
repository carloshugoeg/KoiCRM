import { describe, it, expect, vi } from "vitest"
import {
  PANEL_FILTER_KEYS,
  panelParamName,
  readPanelFilters,
  toStatsFilters,
  loadPanelData,
  type StatsFilters,
} from "@/features/stats/panel-filters"

describe("panelParamName", () => {
  it("namespaces a key under its panel", () => {
    expect(panelParamName("alerts", "owner")).toBe("alerts.owner")
  })

  it("keeps two panels' identical keys apart", () => {
    expect(panelParamName("embudo", "owner")).not.toBe(panelParamName("canal", "owner"))
  })
})

describe("readPanelFilters", () => {
  it("reads only the requested panel's params", () => {
    const params = { "alerts.owner": "u1", "canal.owner": "u2" }
    expect(readPanelFilters(params, "alerts", ["owner"])).toEqual({ owner: "u1" })
  })

  it("ignores keys the panel does not declare", () => {
    const params = { "alerts.owner": "u1", "alerts.channel": "web" }
    expect(readPanelFilters(params, "alerts", ["owner"])).toEqual({ owner: "u1" })
  })

  it("treats an empty or whitespace value as absent", () => {
    const params = { "alerts.owner": "   ", "alerts.channel": "" }
    expect(readPanelFilters(params, "alerts", ["owner", "channel"])).toEqual({})
  })

  it("takes the first entry when a param repeats", () => {
    const params = { "alerts.owner": ["u1", "u2"] }
    expect(readPanelFilters(params, "alerts", ["owner"])).toEqual({ owner: "u1" })
  })

  it("returns nothing when the panel has no params", () => {
    expect(readPanelFilters({}, "alerts", [...PANEL_FILTER_KEYS])).toEqual({})
  })
})

describe("toStatsFilters", () => {
  it("composes the panel's filters with the global range rather than replacing it", () => {
    const from = new Date("2026-01-01T00:00:00Z")
    const to = new Date("2026-02-01T00:00:00Z")
    expect(toStatsFilters({ from, to }, { owner: "u1", category: "solar" })).toEqual({
      from,
      to,
      ownerId: "u1",
      channelKey: undefined,
      equipmentCategoryKey: "solar",
      statusKey: undefined,
    })
  })

  it("keeps the range when the panel filters nothing", () => {
    const from = new Date("2026-01-01T00:00:00Z")
    expect(toStatsFilters({ from }, {}).from).toBe(from)
  })
})

describe("loadPanelData", () => {
  it("loads once per distinct filter set and reuses the result", async () => {
    const load = vi.fn(async (f: StatsFilters) => f.ownerId ?? "all")
    const shared: StatsFilters = {}
    const results = await loadPanelData([shared, shared, { ownerId: "u1" }], load)

    expect(results).toEqual(["all", "all", "u1"])
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("does not fan out concurrently", async () => {
    let inFlight = 0
    let peak = 0
    const load = vi.fn(async (f: StatsFilters) => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 1))
      inFlight -= 1
      return f.ownerId ?? "all"
    })

    await loadPanelData([{ ownerId: "a" }, { ownerId: "b" }, { ownerId: "c" }], load)
    expect(peak).toBe(1)
  })

  it("preserves the caller's ordering", async () => {
    const load = async (f: StatsFilters) => f.ownerId ?? "all"
    expect(await loadPanelData([{ ownerId: "b" }, { ownerId: "a" }], load)).toEqual(["b", "a"])
  })
})
